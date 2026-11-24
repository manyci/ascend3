/* ASCEND — Stage 1: Real AI API client for Barrett (LM.ChatAPI).
   Talks strictly to server proxy routes (/api/barrett/*) — never touches API keys.
   Provides:
     - Structured payload builder (clientId, lang, profile, history, activePlans)
     - Frontend duplicate & in-flight request protection
     - Timeout handling (AbortController)
     - Normalized localized error states & bounded retry with cooldown respect */
window.LM = window.LM || {};

(function () {
  const REQUEST_TIMEOUT_MS = 30000;
  const MAX_RETRY_ATTEMPTS = 5;
  const DUPLICATE_BOUNCE_MS = 600;
  const MAX_IMAGE_BYTES = 3500000;
  const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  const inFlight = new Map(); // threadId -> { msgId, startedAt, text }
  const pendingMediaByMsgId = new Map(); // msgId -> { image: { mimeType, dataBase64, sizeBytes, name }, explicitConsent: true }
  const sessionPreviewsByMsgId = new Map(); // msgId -> previewUrl (RAM only, never persisted)
  let lastSubmitted = { threadId: '', text: '', ts: 0 };

  function t(key, vars) {
    return (LM.t && LM.t(key, vars)) || key;
  }

  function decodeBase64Prefix(b64, maxBytes) {
    const clean = String(b64 || '').slice(0, Math.ceil((maxBytes * 4) / 3) + 8);
    if (typeof atob === 'function') {
      const bin = atob(clean);
      const out = new Uint8Array(Math.min(bin.length, maxBytes));
      for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(clean, 'base64').subarray(0, maxBytes);
    }
    return null;
  }

  function hasValidImageMagicBytes(bytes, mimeType) {
    if (!bytes || bytes.length < 12) return false;
    if (mimeType === 'image/jpeg') {
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mimeType === 'image/png') {
      return (
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
      );
    }
    if (mimeType === 'image/webp') {
      return (
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      );
    }
    return false;
  }

  function validateImagePayload(rawImg) {
    if (!rawImg || typeof rawImg !== 'object' || Array.isArray(rawImg)) {
      return { ok: false, status: 400, code: 'INVALID_IMAGE', message: t('chat.attach.errType') };
    }
    const rawMime = String(rawImg.mimeType || '').trim().toLowerCase();
    const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    if (!ALLOWED_IMAGE_MIMES.has(mimeType) || typeof rawImg.dataBase64 !== 'string') {
      return { ok: false, status: 400, code: 'INVALID_IMAGE', message: t('chat.attach.errType') };
    }
    const rawB64 = rawImg.dataBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '');
    if (rawB64.length < 24 || !/^[A-Za-z0-9+/=]+$/.test(rawB64)) {
      return { ok: false, status: 400, code: 'INVALID_IMAGE_DATA', message: t('chat.attach.errInvalid') };
    }
    const approxBytes = Math.floor((rawB64.length * 3) / 4);
    const sizeBytes = Number(rawImg.sizeBytes) > 0 ? Math.round(Number(rawImg.sizeBytes)) : approxBytes;
    if (approxBytes > MAX_IMAGE_BYTES || sizeBytes > MAX_IMAGE_BYTES) {
      return { ok: false, status: 413, code: 'IMAGE_TOO_LARGE', message: t('chat.attach.errTooLarge') };
    }
    try {
      const prefix = decodeBase64Prefix(rawB64, 16);
      if (prefix && !hasValidImageMagicBytes(prefix, mimeType)) {
        return { ok: false, status: 400, code: 'INVALID_IMAGE_DATA', message: t('chat.attach.errInvalid') };
      }
    } catch (e) {
      return { ok: false, status: 400, code: 'INVALID_IMAGE_DATA', message: t('chat.attach.errInvalid') };
    }
    const name = typeof rawImg.name === 'string'
      ? rawImg.name.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 120)
      : '';
    return {
      ok: true,
      image: {
        mimeType: mimeType,
        dataBase64: rawB64,
        sizeBytes: sizeBytes,
        name: name
      }
    };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (typeof FileReader === 'undefined') {
        reject(new Error('FileReader unavailable'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function readAndValidateImageFile(file) {
    if (!file || typeof file !== 'object') {
      return { ok: false, code: 'INVALID_IMAGE', error: t('chat.attach.errInvalid') };
    }
    const rawMime = String(file.type || '').trim().toLowerCase();
    const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
      return { ok: false, code: 'INVALID_IMAGE', error: t('chat.attach.errType') };
    }
    if (typeof file.size === 'number' && file.size > MAX_IMAGE_BYTES) {
      return { ok: false, code: 'IMAGE_TOO_LARGE', error: t('chat.attach.errTooLarge') };
    }
    if (typeof file.size === 'number' && file.size < 12) {
      return { ok: false, code: 'INVALID_IMAGE_DATA', error: t('chat.attach.errInvalid') };
    }
    let dataUrl = '';
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch (e) {
      return { ok: false, code: 'INVALID_IMAGE_DATA', error: t('chat.attach.errInvalid') };
    }
    const b64 = dataUrl.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '');
    const check = validateImagePayload({
      mimeType: mimeType,
      dataBase64: b64,
      sizeBytes: typeof file.size === 'number' ? file.size : undefined,
      name: file.name || ''
    });
    if (!check.ok) {
      return { ok: false, code: check.code, error: check.message };
    }
    return {
      ok: true,
      attachment: {
        kind: 'image',
        mimeType: check.image.mimeType,
        dataBase64: check.image.dataBase64,
        sizeBytes: check.image.sizeBytes,
        name: check.image.name,
        previewUrl: dataUrl
      }
    };
  }

  function isViewingThread(threadId) {
    try {
      const h = (window.location && window.location.hash ? window.location.hash : '').split('?')[0].replace(/^#\/?/, '');
      return h === 'chat/' + threadId;
    } catch (e) {
      return false;
    }
  }

  function buildHistory(threadId, excludeMsgId) {
    if (!LM.ChatStore) return [];
    const msgs = LM.ChatStore.getMessages(threadId) || [];
    const isEn = LM.I18n && LM.I18n.lang() === 'en';
    return msgs
      .filter(m => m && m.id !== excludeMsgId && m.status !== 'error' && m.status !== 'sending' && (m.role === 'user' || m.role === 'assistant'))
      .map(m => {
        const txt = String(m.text || '').trim();
        const hasAtt = Boolean(m.attachment && m.attachment.kind === 'image');
        const resolvedText = txt
          ? (hasAtt ? ((isEn ? '[Photo attached] ' : '[Прикреплено фото] ') + txt) : txt)
          : (hasAtt ? (isEn ? '[User shared a photo]' : '[Пользователь отправил фото]') : '');
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: resolvedText.slice(0, 1000)
        };
      })
      .filter(m => m.text.length > 0)
      .slice(-12);
  }

  function buildActivePlans() {
    if (!LM.Store || !LM.Store.get) return [];
    try {
      const st = LM.Store.get();
      const tasks = st && st.daily && Array.isArray(st.daily.tasks) ? st.daily.tasks : [];
      return tasks.slice(0, 6).map(task => ({
        id: String(task.id || '').slice(0, 40),
        title: (LM.taskTitle ? LM.taskTitle(task) : String(task.title || '')).slice(0, 100),
        category: String(task.cat || (task.kind === 'guide' ? 'guide' : 'habits')).slice(0, 32),
        progressText: task.done ? 'done' : 'pending'
      })).filter(p => p.title);
    } catch (e) {
      return [];
    }
  }

  function buildProfile() {
    if (!LM.Store || !LM.Store.get) return { nickname: 'Ascender' };
    const p = (LM.Store.get() && LM.Store.get().profile) || {};
    return {
      nickname: String(p.nickname || 'Ascender').slice(0, 32)
    };
  }

  function clampSetting(val, fallback) {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function buildBarrettSettings() {
    if (!LM.ChatStore || !LM.ChatStore.get) return null;
    try {
      const st = LM.ChatStore.get();
      const b = st && st.settings && st.settings.barrett;
      if (!b || typeof b !== 'object') return null;
      return {
        directness: clampSetting(b.directness, 75),
        humor: clampSetting(b.humor, 55),
        detail: clampSetting(b.detail, 65),
        strictness: clampSetting(b.strictness, 70)
      };
    } catch (e) {
      return null;
    }
  }

  async function requestJson(url, fetchOpts) {
    const res = await fetch(url, fetchOpts);
    const contentType = String(
      res.headers && typeof res.headers.get === 'function' ? (res.headers.get('content-type') || '') : ''
    ).toLowerCase();
    const rawText = await res.text();
    const trimmed = String(rawText || '').trim();
    const isHtmlHeader = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const looksLikeHtmlBody = /^<(?:!doctype\s+html|html\b|head\b|body\b)/i.test(trimmed);
    const isHtml = isHtmlHeader || looksLikeHtmlBody;
    const isPreviewWarmup = isHtml && (
      /starting\s+server/i.test(trimmed) ||
      /warmup\.html/i.test(trimmed) ||
      res.status === 200 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504
    );

    if (!trimmed) {
      return {
        res: res,
        status: res.status,
        ok: res.ok,
        contentType: contentType,
        kind: isHtml ? 'html' : 'empty',
        isPreviewWarmup: isPreviewWarmup,
        json: null
      };
    }

    if (isHtml) {
      return {
        res: res,
        status: res.status,
        ok: res.ok,
        contentType: contentType,
        kind: 'html',
        isPreviewWarmup: isPreviewWarmup,
        json: null
      };
    }

    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') {
        return {
          res: res,
          status: res.status,
          ok: res.ok,
          contentType: contentType,
          kind: 'json',
          isPreviewWarmup: false,
          json: parsed
        };
      }
      return {
        res: res,
        status: res.status,
        ok: res.ok,
        contentType: contentType,
        kind: 'invalid_json',
        isPreviewWarmup: false,
        json: null
      };
    } catch (e) {
      return {
        res: res,
        status: res.status,
        ok: res.ok,
        contentType: contentType,
        kind: 'invalid_json',
        isPreviewWarmup: false,
        json: null
      };
    }
  }

  function localizeError(code, status, rawMsg, retryAfterSec) {
    const sec = Math.max(1, Math.ceil(Number(retryAfterSec) || 0));
    switch (code) {
      case 'DUPLICATE_IN_FLIGHT':
        return t('chat.err.inFlight');
      case 'DUPLICATE_COOLDOWN':
      case 'USER_RATE_LIMIT':
      case 'IP_RATE_LIMIT':
        return retryAfterSec ? t('chat.err.rateLimitSec', { sec: sec }) : t('chat.err.rateLimit');
      case 'AI_QUOTA_EXCEEDED':
        return t('chat.err.quota');
      case 'DAILY_COST_CAP':
        return t('chat.err.dailyCap');
      case 'AI_TIMEOUT':
      case 'CLIENT_TIMEOUT':
        return t('chat.err.timeout');
      case 'AI_NOT_CONFIGURED':
      case 'AI_AUTH_ERROR':
      case 'AI_MODEL_UNAVAILABLE':
        return t('chat.err.serviceUnavailable');
      case 'INVALID_AI_RESPONSE':
      case 'AI_UNAVAILABLE':
      case 'SERVER_BUSY':
        return t('chat.err.unavailable');
      case 'NETWORK_ERROR':
        return t('chat.err.network');
      case 'RETRY_LIMIT':
        return t('chat.err.retryLimit');
      case 'INTERRUPTED':
        return t('chat.err.interrupted');
      case 'EMPTY_MESSAGE':
        return t('chat.err.empty');
      case 'NO_USER_PROMPT':
        return t('chat.err.noPrompt');
      case 'CONSENT_REQUIRED':
        return t('chat.err.consentRequired');
      case 'INVALID_IMAGE':
      case 'INVALID_IMAGE_DATA':
        return t('chat.err.invalidImage');
      case 'IMAGE_TOO_LARGE':
        return t('chat.err.imageTooLarge');
      case 'IMAGE_RETRY_UNAVAILABLE':
        return t('chat.err.imageRetryUnavailable');
      default:
        if (status === 429) return t('chat.err.rateLimit');
        if (status === 504) return t('chat.err.timeout');
        if (status >= 500) return t('chat.err.unavailable');
        return rawMsg || t('chat.err.generic');
    }
  }

  function normalizeError(opts) {
    const code = String(opts.code || 'UNKNOWN_ERROR');
    const status = Number(opts.status) || 0;
    const retryAfterSec = opts.retryAfterSec ? Math.max(1, Math.ceil(Number(opts.retryAfterSec))) : 0;
    const nonRetryableCodes = new Set([
      'AI_NOT_CONFIGURED',
      'AI_AUTH_ERROR',
      'AI_MODEL_UNAVAILABLE',
      'DAILY_COST_CAP',
      'AI_BAD_REQUEST',
      'RETRY_LIMIT',
      'EMPTY_MESSAGE',
      'NO_USER_PROMPT',
      'CONSENT_REQUIRED',
      'INVALID_IMAGE',
      'INVALID_IMAGE_DATA',
      'IMAGE_TOO_LARGE',
      'IMAGE_RETRY_UNAVAILABLE'
    ]);
    const retryable = opts.retryable !== undefined ? Boolean(opts.retryable) : !nonRetryableCodes.has(code);
    const attempts = Math.max(0, Number(opts.attempts) || 0);
    const enforceCooldown = status === 429 || code === 'DUPLICATE_COOLDOWN' || code === 'USER_RATE_LIMIT' || code === 'IP_RATE_LIMIT' || code === 'AI_QUOTA_EXCEEDED';
    return {
      code: code,
      status: status,
      message: localizeError(code, status, opts.message, retryAfterSec),
      retryable: retryable && attempts < MAX_RETRY_ATTEMPTS,
      retryAfterSec: retryAfterSec,
      nextRetryAt: (enforceCooldown && retryAfterSec > 0) ? Date.now() + retryAfterSec * 1000 : 0,
      attempts: attempts
    };
  }

  async function dispatchBarrett(userMsg, attempt) {
    const threadId = 'barrett';
    if (inFlight.has(threadId)) {
      return {
        ok: false,
        error: normalizeError({ code: 'DUPLICATE_IN_FLIGHT', status: 409, retryable: true, retryAfterSec: 2, attempts: attempt })
      };
    }

    const pendingMedia = pendingMediaByMsgId.get(userMsg.id) || null;
    if (userMsg.attachment && !pendingMedia) {
      const missingErr = normalizeError({
        code: 'IMAGE_RETRY_UNAVAILABLE',
        status: 400,
        retryable: false,
        attempts: attempt
      });
      if (LM.ChatStore) {
        LM.ChatStore.updateMessage(threadId, userMsg.id, { status: 'error', error: missingErr });
      }
      return { ok: false, error: missingErr };
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => {
      if (controller) controller.abort();
    }, REQUEST_TIMEOUT_MS);

    inFlight.set(threadId, { msgId: userMsg.id, startedAt: Date.now(), text: userMsg.text });

    try {
      const clientId = LM.ChatStore ? LM.ChatStore.getClientId() : ('asc_' + Date.now().toString(36) + '_guest');
      const lang = LM.I18n ? LM.I18n.lang() : 'ru';
      const barrettSettings = buildBarrettSettings();
      const payload = {
        clientId: clientId,
        lang: lang,
        message: String(userMsg.text || '').slice(0, 1500),
        profile: buildProfile(),
        messages: buildHistory(threadId, userMsg.id),
        memorySummary: '',
        activePlans: buildActivePlans(),
        ...(barrettSettings ? { barrettSettings: barrettSettings } : {}),
        ...(pendingMedia
          ? {
              image: {
                mimeType: pendingMedia.image.mimeType,
                dataBase64: pendingMedia.image.dataBase64
              },
              explicitConsent: pendingMedia.explicitConsent === true
            }
          : {}),
        updateSummary: false
      };

      const parsedRes = await requestJson('/api/barrett/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ascend-client': clientId
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      const res = parsedRes.res;
      const json = parsedRes.json;

      if (!res.ok || parsedRes.kind !== 'json' || !json || json.ok !== true || !json.data || !json.data.reply) {
        const srvErr = (json && json.error && typeof json.error === 'object') ? json.error : {};
        const headerRetry = Number(res.headers && res.headers.get ? res.headers.get('retry-after') : 0) || 0;
        const isInfraHtml = parsedRes.kind === 'html' && (parsedRes.isPreviewWarmup || res.status === 200 || res.status >= 500);
        const isTransientNonJson = parsedRes.kind !== 'json' && (res.status === 200 || res.status >= 500 || res.status === 429);

        let errCode = srvErr.code;
        let errStatus = res.status;
        let errMsg = srvErr.message || '';
        let retryable = srvErr.retryable;
        let retryAfterSec = Number(srvErr.retryAfterSec) || headerRetry || (res.status === 429 ? 5 : 0);

        if (!errCode) {
          if (isInfraHtml) {
            errCode = 'AI_UNAVAILABLE';
            errStatus = res.status === 200 ? 503 : res.status;
            errMsg = '';
            retryable = true;
            retryAfterSec = retryAfterSec || 3;
          } else if (isTransientNonJson) {
            errCode = res.status === 429 ? 'AI_QUOTA_EXCEEDED' : (parsedRes.kind === 'invalid_json' || parsedRes.kind === 'empty' ? 'INVALID_AI_RESPONSE' : 'AI_UNAVAILABLE');
            errMsg = '';
            retryable = true;
            retryAfterSec = retryAfterSec || 2;
          } else if (parsedRes.kind === 'html') {
            errCode = res.status === 401 || res.status === 403 ? 'AI_AUTH_ERROR' : 'UNKNOWN_ERROR';
            errMsg = '';
            retryable = false;
          } else {
            errCode = res.status >= 500 ? 'AI_UNAVAILABLE' : 'UNKNOWN_ERROR';
            retryable = retryable !== undefined ? retryable : (res.status === 429 || res.status >= 500);
          }
        } else if (retryable === undefined) {
          retryable = (res.status === 429 || res.status >= 500);
        }

        const errObj = normalizeError({
          code: errCode,
          status: errStatus,
          message: errMsg,
          retryable: retryable,
          retryAfterSec: retryAfterSec,
          attempts: attempt
        });
        inFlight.delete(threadId);
        if (!errObj.retryable) {
          pendingMediaByMsgId.delete(userMsg.id);
        }
        if (LM.ChatStore) {
          LM.ChatStore.updateMessage(threadId, userMsg.id, { status: 'error', error: errObj });
        }
        return { ok: false, error: errObj };
      }

      inFlight.delete(threadId);
      pendingMediaByMsgId.delete(userMsg.id);
      if (LM.ChatStore) {
        LM.ChatStore.updateMessage(threadId, userMsg.id, { status: 'sent', error: null });
        LM.ChatStore.addMessage(threadId, {
          role: 'assistant',
          sender: 'barrett',
          text: json.data.reply,
          emotion: json.data.emotion || 'neutral',
          followUps: Array.isArray(json.data.followUps) ? json.data.followUps.slice(0, 3) : [],
          replyToId: userMsg.id,
          ts: Date.now(),
          status: 'sent',
          markUnread: !isViewingThread(threadId)
        });
      }
      return { ok: true, data: json.data, meta: json.meta || {} };
    } catch (err) {
      const isTimeout = err && err.name === 'AbortError';
      const errObj = normalizeError({
        code: isTimeout ? 'CLIENT_TIMEOUT' : 'NETWORK_ERROR',
        status: isTimeout ? 504 : 0,
        retryable: true,
        retryAfterSec: isTimeout ? 3 : 2,
        attempts: attempt
      });
      inFlight.delete(threadId);
      if (LM.ChatStore) {
        LM.ChatStore.updateMessage(threadId, userMsg.id, { status: 'error', error: errObj });
      }
      return { ok: false, error: errObj };
    } finally {
      clearTimeout(timer);
      if (inFlight.has(threadId) && inFlight.get(threadId).msgId === userMsg.id) {
        inFlight.delete(threadId);
      }
    }
  }

  LM.ChatAPI = {
    MAX_RETRY_ATTEMPTS: MAX_RETRY_ATTEMPTS,
    REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS,
    MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
    ALLOWED_IMAGE_MIMES: ['image/jpeg', 'image/png', 'image/webp'],
    _requestJson: requestJson,
    validateImagePayload: validateImagePayload,
    readAndValidateImageFile: readAndValidateImageFile,

    getSessionPreview(msgId) {
      return msgId ? (sessionPreviewsByMsgId.get(msgId) || '') : '';
    },

    hasPendingMedia(msgId) {
      return Boolean(msgId && pendingMediaByMsgId.has(msgId));
    },

    clearSessionMedia(msgId) {
      if (!msgId) {
        pendingMediaByMsgId.clear();
        sessionPreviewsByMsgId.clear();
        return;
      }
      pendingMediaByMsgId.delete(msgId);
      sessionPreviewsByMsgId.delete(msgId);
    },

    isBusy(threadId) {
      return inFlight.has(threadId || 'barrett');
    },

    pendingInfo(threadId) {
      return inFlight.get(threadId || 'barrett') || null;
    },

    async health() {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = setTimeout(() => { if (controller) controller.abort(); }, 8000);
      try {
        const parsedRes = await requestJson('/api/barrett/health', {
          method: 'GET',
          signal: controller ? controller.signal : undefined
        });
        const json = parsedRes.json;
        return {
          ok: parsedRes.ok && parsedRes.kind === 'json' && json && json.ok === true,
          status: parsedRes.status,
          data: json
        };
      } catch (e) {
        return { ok: false, status: 0, error: normalizeError({ code: 'NETWORK_ERROR', status: 0 }) };
      } finally {
        clearTimeout(timer);
      }
    },

    async sendBarrett(rawText, opts) {
      const threadId = 'barrett';
      opts = opts || {};
      const text = String(rawText || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 1500);
      const hasRawImage = Boolean(opts.image);
      let validatedImg = null;
      if (hasRawImage) {
        const imgCheck = validateImagePayload(opts.image);
        if (!imgCheck.ok) {
          return {
            ok: false,
            error: normalizeError({ code: imgCheck.code, status: imgCheck.status, message: imgCheck.message, retryable: false })
          };
        }
        if (opts.explicitConsent !== true) {
          return {
            ok: false,
            error: normalizeError({ code: 'CONSENT_REQUIRED', status: 400, retryable: false })
          };
        }
        validatedImg = imgCheck.image;
      }

      if (!text && !validatedImg) {
        return { ok: false, error: normalizeError({ code: 'EMPTY_MESSAGE', status: 400, retryable: false }) };
      }
      if (this.isBusy(threadId)) {
        return { ok: false, error: normalizeError({ code: 'DUPLICATE_IN_FLIGHT', status: 409, retryable: true, retryAfterSec: 2 }) };
      }
      const now = Date.now();
      const dedupeText = text + (validatedImg ? ('|' + validatedImg.mimeType + '|' + validatedImg.sizeBytes + '|' + validatedImg.dataBase64.slice(0, 32)) : '');
      if (lastSubmitted.threadId === threadId && lastSubmitted.text === dedupeText && now - lastSubmitted.ts < DUPLICATE_BOUNCE_MS) {
        return { ok: false, error: normalizeError({ code: 'DUPLICATE_IN_FLIGHT', status: 409, retryable: true, retryAfterSec: 1 }) };
      }
      lastSubmitted = { threadId: threadId, text: dedupeText, ts: now };

      const msgPayload = {
        role: 'user',
        sender: 'user',
        text: text,
        ts: now,
        status: 'sending'
      };
      if (validatedImg) {
        msgPayload.attachment = {
          kind: 'image',
          mimeType: validatedImg.mimeType,
          sizeBytes: validatedImg.sizeBytes,
          name: validatedImg.name
        };
      }

      const userMsg = LM.ChatStore
        ? LM.ChatStore.addMessage(threadId, msgPayload)
        : Object.assign({ id: 'msg_' + now }, msgPayload);

      if (!userMsg) {
        return { ok: false, error: normalizeError({ code: 'EMPTY_MESSAGE', status: 400, retryable: false }) };
      }

      if (validatedImg) {
        pendingMediaByMsgId.set(userMsg.id, {
          image: validatedImg,
          explicitConsent: true
        });
        const previewUrl = (typeof opts.previewUrl === 'string' && opts.previewUrl) ||
          (typeof opts.image.previewUrl === 'string' && opts.image.previewUrl) ||
          ('data:' + validatedImg.mimeType + ';base64,' + validatedImg.dataBase64);
        sessionPreviewsByMsgId.set(userMsg.id, previewUrl);
      }

      return dispatchBarrett(userMsg, 0);
    },

    async retryBarrett(msgId) {
      const threadId = 'barrett';
      if (!LM.ChatStore) return { ok: false };
      if (this.isBusy(threadId)) {
        return { ok: false, error: normalizeError({ code: 'DUPLICATE_IN_FLIGHT', status: 409, retryable: true, retryAfterSec: 2 }) };
      }
      const msgs = LM.ChatStore.getMessages(threadId);
      const msg = msgs.find(m => m && m.id === msgId && m.role === 'user');
      if (!msg) return { ok: false };

      if (msg.attachment && !pendingMediaByMsgId.has(msg.id)) {
        const missingErr = normalizeError({ code: 'IMAGE_RETRY_UNAVAILABLE', status: 400, retryable: false, attempts: (msg.error && msg.error.attempts) || 0 });
        LM.ChatStore.updateMessage(threadId, msg.id, { status: 'error', error: missingErr });
        return { ok: false, error: missingErr };
      }

      const err = msg.error || {};
      const attempts = Number(err.attempts) || 0;
      if (attempts >= MAX_RETRY_ATTEMPTS || err.retryable === false) {
        const limitErr = normalizeError({ code: 'RETRY_LIMIT', status: 429, retryable: false, attempts: attempts });
        LM.ChatStore.updateMessage(threadId, msg.id, { status: 'error', error: limitErr });
        return { ok: false, error: limitErr };
      }
      if (err.nextRetryAt && Date.now() < err.nextRetryAt) {
        const waitSec = Math.max(1, Math.ceil((err.nextRetryAt - Date.now()) / 1000));
        return {
          ok: false,
          cooldown: true,
          waitSec: waitSec,
          error: {
            code: 'COOLDOWN_WAIT',
            message: t('chat.err.rateLimitSec', { sec: waitSec }),
            retryable: true,
            retryAfterSec: waitSec
          }
        };
      }

      const updated = LM.ChatStore.updateMessage(threadId, msg.id, { status: 'sending', error: null });
      return dispatchBarrett(updated || msg, attempts + 1);
    },

    async editAndResendBarrett(userMsgId, rawText) {
      const threadId = 'barrett';
      if (!LM.ChatStore) return { ok: false };
      const text = String(rawText || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 1500);
      if (!text) {
        return { ok: false, error: normalizeError({ code: 'EMPTY_MESSAGE', status: 400, retryable: false }) };
      }
      if (this.isBusy(threadId)) {
        return { ok: false, error: normalizeError({ code: 'DUPLICATE_IN_FLIGHT', status: 409, retryable: true, retryAfterSec: 2 }) };
      }
      const msgs = LM.ChatStore.getMessages(threadId);
      const existing = msgs.find(m => m && m.id === userMsgId && m.role === 'user');
      if (!existing) {
        return { ok: false, error: normalizeError({ code: 'UNKNOWN_ERROR', status: 404, retryable: false }) };
      }
      const res = LM.ChatStore.editUserMessage(threadId, userMsgId, text, {
        truncateAfter: true,
        nextStatus: 'sending'
      });
      if (!res || !res.msg) {
        return { ok: false, error: normalizeError({ code: 'EMPTY_MESSAGE', status: 400, retryable: false }) };
      }
      lastSubmitted = { threadId: threadId, text: text, ts: Date.now() };
      return dispatchBarrett(res.msg, 0);
    },

    async regenerateBarrett(assistantMsgId) {
      const threadId = 'barrett';
      if (!LM.ChatStore) return { ok: false };
      if (this.isBusy(threadId)) {
        return { ok: false, error: normalizeError({ code: 'DUPLICATE_IN_FLIGHT', status: 409, retryable: true, retryAfterSec: 2 }) };
      }
      const msgs = LM.ChatStore.getMessages(threadId);
      let targetIdx = assistantMsgId
        ? msgs.findIndex(m => m && m.id === assistantMsgId && m.role === 'assistant')
        : -1;
      if (targetIdx < 0 && !assistantMsgId) {
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i] && msgs[i].role === 'assistant') { targetIdx = i; break; }
        }
      }
      if (targetIdx < 0) {
        return { ok: false, error: normalizeError({ code: 'NO_USER_PROMPT', status: 400, retryable: false }) };
      }
      let userMsg = null;
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (msgs[i] && msgs[i].role === 'user') { userMsg = msgs[i]; break; }
      }
      if (!userMsg) {
        return { ok: false, error: normalizeError({ code: 'NO_USER_PROMPT', status: 400, retryable: false }) };
      }
      LM.ChatStore.truncateAfter(threadId, userMsg.id);
      const updated = LM.ChatStore.updateMessage(threadId, userMsg.id, { status: 'sending', error: null });
      return dispatchBarrett(updated || userMsg, 0);
    }
  };
})();
