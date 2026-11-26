/* ASCEND — Persona-independent AI Provider Router.
   Primary provider: Google Gemini (@google/genai)
   Secondary fallback provider: Cloudflare Workers AI (REST /accounts/{id}/ai/run/{model})
   - No character prompts, lore, or persona logic live in this module.
   - Images are NEVER routed to Cloudflare.
   - Fallback requires explicit opt-in consent, text-only request, configured Cloudflare credentials,
     and a transient primary failure (502/503/504/429/AI_TIMEOUT/transport/502 INVALID_AI_RESPONSE). */

'use strict';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_CLOUDFLARE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_JITTER_RATIO = 0.25;

let sdkPromise = null;
function loadGenAISDK() {
  if (!sdkPromise) {
    sdkPromise = import('@google/genai');
  }
  return sdkPromise;
}

function cleanSecret(val) {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["'](.*)["']$/, '$1').trim();
}

function getGeminiApiKey(overrides = {}) {
  const raw = overrides.apiKey !== undefined ? overrides.apiKey : process.env.GEMINI_API_KEY;
  return cleanSecret(raw);
}

function getCloudflareCredentials(overrides = {}) {
  const cf = overrides.cloudflare && typeof overrides.cloudflare === 'object' ? overrides.cloudflare : null;
  const hasAccOverride = Boolean(cf && Object.prototype.hasOwnProperty.call(cf, 'accountId'));
  const hasTokOverride = Boolean(cf && Object.prototype.hasOwnProperty.call(cf, 'apiToken'));
  const rawAcc = hasAccOverride ? cf.accountId : process.env.CLOUDFLARE_ACCOUNT_ID;
  const rawTok = hasTokOverride ? cf.apiToken : process.env.CLOUDFLARE_API_TOKEN;
  return {
    accountId: cleanSecret(rawAcc),
    apiToken: cleanSecret(rawTok),
    explicitOverride: hasAccOverride || hasTokOverride,
    explicitlyDisabled: Boolean(cf && cf.enabled === false),
  };
}

function isCloudflareConfigured(overrides = {}) {
  const creds = getCloudflareCredentials(overrides);
  if (creds.explicitlyDisabled) return false;
  if (creds.accountId && creds.apiToken) return true;
  if (creds.explicitOverride && (!creds.accountId || !creds.apiToken)) return false;
  return typeof overrides.cloudflareFn === 'function';
}

function parseRetryDelays(raw) {
  if (Array.isArray(raw)) {
    return raw.map((n) => Math.max(0, Math.min(10000, Number(n) || 0))).slice(0, 3);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Math.max(0, Math.min(10000, Number(s) || 0)))
      .slice(0, 3);
  }
  return [500, 1000];
}

function parseJitterRatio(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_JITTER_RATIO;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_JITTER_RATIO;
  return Math.max(0, Math.min(0.5, n));
}

function computeJitteredDelayMs(baseMs, jitterRatio = DEFAULT_JITTER_RATIO, randomFn = Math.random) {
  const cleanBase = Math.max(0, Number(baseMs) || 0);
  const ratio = parseJitterRatio(jitterRatio);
  if (cleanBase <= 0 || ratio <= 0) return Math.round(cleanBase);
  const r = typeof randomFn === 'function' ? Number(randomFn()) : Math.random();
  const unit = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0.5;
  const factor = 1 + (unit * 2 - 1) * ratio;
  return Math.max(0, Math.round(cleanBase * factor));
}

function validateCloudflareModelName(raw) {
  const m = String(raw || '').trim();
  if (/^@[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(m) && !m.includes('..')) {
    return m;
  }
  return DEFAULT_CLOUDFLARE_MODEL;
}

function readProviderRouterConfig(overrides = {}) {
  const isVercelRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const rawThinking = String(
    overrides.thinkingLevel || process.env.AI_THINKING_LEVEL || 'LOW'
  ).trim().toUpperCase();
  const thinkingLevel = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'].includes(rawThinking) ? rawThinking : 'LOW';

  const defaultTimeoutMs = isVercelRuntime ? 8500 : 25000;
  const rawTimeout = overrides.timeoutMs !== undefined ? Number(overrides.timeoutMs) : Number(process.env.AI_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0
    ? Math.max(250, Math.min(28000, rawTimeout))
    : defaultTimeoutMs;

  const rawPrimaryFallback = overrides.primaryFallbackTimeoutMs !== undefined
    ? Number(overrides.primaryFallbackTimeoutMs)
    : Number(process.env.AI_PRIMARY_FALLBACK_TIMEOUT_MS);
  const defaultPrimaryFallback = timeoutMs >= 5000
    ? (isVercelRuntime || timeoutMs <= 10000
      ? Math.min(4500, Math.max(1000, Math.floor(timeoutMs * 0.53)))
      : Math.min(10500, Math.max(1000, Math.floor(timeoutMs * 0.44))))
    : Math.max(120, Math.floor(timeoutMs * 0.55));
  const primaryFallbackTimeoutMs = Number.isFinite(rawPrimaryFallback) && rawPrimaryFallback > 0
    ? Math.max(100, Math.min(timeoutMs - 100, rawPrimaryFallback))
    : defaultPrimaryFallback;

  const defaultCfTimeoutMs = isVercelRuntime ? 3500 : 13500;
  const rawCfTimeout = overrides.cloudflareTimeoutMs !== undefined
    ? Number(overrides.cloudflareTimeoutMs)
    : Number(process.env.CLOUDFLARE_AI_TIMEOUT_MS);
  const cloudflareTimeoutMs = Number.isFinite(rawCfTimeout) && rawCfTimeout > 0
    ? Math.max(100, Math.min(20000, rawCfTimeout))
    : defaultCfTimeoutMs;

  const cfOpts = overrides.cloudflare && typeof overrides.cloudflare === 'object' ? overrides.cloudflare : {};
  const cloudflareModel = validateCloudflareModelName(
    overrides.cloudflareModel || cfOpts.model || process.env.CLOUDFLARE_AI_MODEL || DEFAULT_CLOUDFLARE_MODEL
  );

  const rawDelays = overrides.retryDelaysMs !== undefined
    ? overrides.retryDelaysMs
    : (process.env.AI_RETRY_DELAYS_MS !== undefined
      ? process.env.AI_RETRY_DELAYS_MS
      : (isVercelRuntime ? '250,500' : undefined));
  const rawJitter = overrides.jitterRatio !== undefined
    ? overrides.jitterRatio
    : process.env.AI_RETRY_JITTER_RATIO;

  return {
    thinkingLevel,
    timeoutMs,
    primaryFallbackTimeoutMs,
    cloudflareTimeoutMs,
    cloudflareModel,
    retryDelaysMs: parseRetryDelays(rawDelays),
    jitterRatio: parseJitterRatio(rawJitter),
  };
}

function sanitizeProviderErrorMsg(raw, secretValues = []) {
  let out = String(raw || '')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED]')
    .replace(/Bearer\s+[0-9A-Za-z._~+/-]+/gi, 'Bearer [REDACTED]')
    .replace(/key=[0-9A-Za-z_-]+/gi, 'key=[REDACTED]')
    .replace(/accounts\/[A-Za-z0-9_-]{6,}/gi, 'accounts/[REDACTED]')
    .replace(/(?:token|secret|password|apikey|api_key)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]');

  for (const s of secretValues) {
    if (typeof s === 'string' && s.length >= 6) {
      out = out.split(s).join('[REDACTED]');
    }
  }
  return out.slice(0, 240);
}

function extractSafeProviderMeta(err) {
  let upstreamStatus = Number(err?.status || err?.statusCode || err?.response?.status) || 0;
  let apiStatus = '';
  try {
    const parsedMsg = JSON.parse(String(err?.message || ''));
    if (parsedMsg && parsedMsg.error) {
      if (!upstreamStatus && parsedMsg.error.code) upstreamStatus = Number(parsedMsg.error.code) || 0;
      if (parsedMsg.error.status && /^[A-Z0-9_]{2,48}$/.test(String(parsedMsg.error.status))) {
        apiStatus = String(parsedMsg.error.status);
      }
    }
  } catch (_) {}
  const errorType = String(err?.code || apiStatus || err?.name || 'Error').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 48) || 'Error';
  return {
    upstreamStatus: upstreamStatus || undefined,
    errorType,
    attempts: Number(err?.attempts) || undefined,
  };
}

function createInvalidResponseError(message) {
  const err = new Error(message);
  err.code = 'INVALID_AI_RESPONSE';
  err.status = 502;
  err.isContentError = true;
  return err;
}

function extractBalancedJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function parseProviderJson(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw createInvalidResponseError('Empty AI response');
  }
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    const extracted = extractBalancedJsonObject(cleaned);
    if (!extracted) {
      throw createInvalidResponseError('Malformed JSON from AI');
    }
    try {
      parsed = JSON.parse(extracted);
    } catch (_inner) {
      throw createInvalidResponseError('Malformed JSON from AI');
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createInvalidResponseError('AI response must be a JSON object');
  }
  return parsed;
}

function validateStructuredPayload(rawTextOrObj, spec = {}, opts = {}) {
  const parsed = typeof rawTextOrObj === 'string'
    ? parseProviderJson(rawTextOrObj)
    : (rawTextOrObj && typeof rawTextOrObj === 'object' && !Array.isArray(rawTextOrObj) ? rawTextOrObj : null);

  if (!parsed) {
    throw createInvalidResponseError('AI response is not a JSON object');
  }

  const strictEnums = Boolean(opts.strictEnums);
  const requiredFields = Array.isArray(spec.requiredFields) ? spec.requiredFields : [];
  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(parsed, field) || parsed[field] === undefined || parsed[field] === null) {
      throw createInvalidResponseError(`Missing required field "${field}" in AI response`);
    }
    if (typeof parsed[field] === 'string' && !parsed[field].trim()) {
      throw createInvalidResponseError(`Empty required field "${field}" in AI response`);
    }
  }

  const nonEmptyStrings = Array.isArray(spec.nonEmptyStrings) ? spec.nonEmptyStrings : [];
  for (const field of nonEmptyStrings) {
    if (typeof parsed[field] !== 'string' || !parsed[field].trim()) {
      throw createInvalidResponseError(`Field "${field}" must be a non-empty string`);
    }
  }

  const enumFields = spec.enumFields && typeof spec.enumFields === 'object' ? spec.enumFields : {};
  for (const [field, allowed] of Object.entries(enumFields)) {
    if (!Array.isArray(allowed) || !allowed.length) continue;
    const val = parsed[field];
    if (typeof val !== 'string' || !allowed.includes(val)) {
      if (strictEnums) {
        throw createInvalidResponseError(`Invalid enum value for "${field}" in AI response`);
      }
    }
  }

  if (spec.optionalStringArrayFields && Array.isArray(spec.optionalStringArrayFields)) {
    for (const field of spec.optionalStringArrayFields) {
      if (parsed[field] !== undefined && parsed[field] !== null && !Array.isArray(parsed[field])) {
        if (strictEnums) {
          throw createInvalidResponseError(`Field "${field}" must be an array`);
        }
      }
    }
  }

  return parsed;
}

/* Strictly extract text from Cloudflare Workers AI standard envelope:
   { result: { response: "..." }, success: true, errors: [], messages: [] }
   Never mixes OpenAI-compatible choices[]. */
function extractCloudflareResponseText(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createInvalidResponseError('Malformed Cloudflare Workers AI envelope');
  }
  if (payload.success === false) {
    const firstErr = Array.isArray(payload.errors) && payload.errors[0] ? payload.errors[0] : {};
    const msg = sanitizeProviderErrorMsg(firstErr.message || 'Cloudflare Workers AI returned success=false');
    const err = new Error(msg || 'Cloudflare Workers AI failed');
    err.status = 502;
    err.code = 'AI_UNAVAILABLE';
    throw err;
  }
  const resp = payload.result && typeof payload.result === 'object' ? payload.result.response : undefined;
  if (resp && typeof resp === 'object' && !Array.isArray(resp)) {
    if (!Object.keys(resp).length) {
      throw createInvalidResponseError('Cloudflare result.response object is empty');
    }
    return JSON.stringify(resp);
  }
  if (typeof resp !== 'string' || !resp.trim()) {
    throw createInvalidResponseError('Cloudflare result.response is missing or empty');
  }
  return resp.trim();
}

function convertResponseSchemaToJsonSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null;
  const out = {};
  if (schema.type) {
    const t = String(schema.type).trim().toLowerCase();
    if (['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'].includes(t)) {
      out.type = t;
    }
  }
  if (typeof schema.description === 'string' && schema.description.trim()) {
    out.description = schema.description.trim();
  }
  if (Array.isArray(schema.enum) && schema.enum.length) {
    out.enum = schema.enum.slice();
  }
  if (schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)) {
    out.properties = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      const convertedProp = convertResponseSchemaToJsonSchema(val);
      if (convertedProp) out.properties[key] = convertedProp;
    }
    if (!out.type) out.type = 'object';
  }
  if (Array.isArray(schema.required) && schema.required.length) {
    out.required = schema.required.filter((r) => typeof r === 'string');
  }
  if (schema.items) {
    const convertedItems = convertResponseSchemaToJsonSchema(schema.items);
    if (convertedItems) out.items = convertedItems;
  }
  return Object.keys(out).length ? out : null;
}

function buildSchemaPromptAddon(responseSchema) {
  if (!responseSchema || typeof responseSchema !== 'object') {
    return 'Return strictly a single valid JSON object with no markdown fences or commentary.';
  }
  const required = Array.isArray(responseSchema.required) ? responseSchema.required : [];
  const props = responseSchema.properties && typeof responseSchema.properties === 'object' ? Object.keys(responseSchema.properties) : [];
  const reqLabel = required.length ? `required: ${required.join(', ')}` : (props.length ? `fields: ${props.join(', ')}` : 'JSON object');
  return `Return strictly a single raw JSON object matching the response_format schema (${reqLabel}; no markdown fences).`;
}

function convertGeminiContentsToMessages({ systemInstruction = '', contents, responseSchema }) {
  const schemaAddon = buildSchemaPromptAddon(responseSchema);
  const fullSystem = [String(systemInstruction || '').trim(), schemaAddon].filter(Boolean).join('\n\n');
  const messages = [];
  if (fullSystem) {
    messages.push({ role: 'system', content: fullSystem });
  }

  if (typeof contents === 'string') {
    const txt = contents.trim();
    if (txt) messages.push({ role: 'user', content: txt });
    return messages;
  }

  if (Array.isArray(contents)) {
    for (const turn of contents) {
      if (!turn || typeof turn !== 'object') continue;
      const role = turn.role === 'model' || turn.role === 'assistant' ? 'assistant' : 'user';
      const parts = Array.isArray(turn.parts) ? turn.parts : [];
      const textParts = [];
      for (const part of parts) {
        if (part && typeof part.text === 'string' && part.text.trim()) {
          textParts.push(part.text.trim());
        }
      }
      const joined = textParts.join('\n').trim();
      if (!joined) continue;
      if (messages.length > 1 && messages[messages.length - 1].role === role) {
        messages[messages.length - 1].content += `\n${joined}`;
      } else {
        messages.push({ role, content: joined });
      }
    }
  }
  return messages;
}

function extractErrorDetails(err, secretValues = []) {
  let status = Number(err?.status || err?.statusCode || err?.response?.status) || 0;
  let rawMsg = String(err?.message || '');
  let apiStatus = '';

  try {
    const parsedMsg = JSON.parse(rawMsg);
    if (parsedMsg && parsedMsg.error) {
      if (!status && parsedMsg.error.code) status = Number(parsedMsg.error.code) || 0;
      if (parsedMsg.error.status) apiStatus = String(parsedMsg.error.status);
      if (parsedMsg.error.message) rawMsg = String(parsedMsg.error.message);
    }
  } catch (_) {}

  return {
    status,
    apiStatus,
    rawMsg,
    msg: sanitizeProviderErrorMsg(rawMsg, secretValues),
  };
}

function isTransientPrimaryError(err, clientSignal) {
  if (clientSignal && clientSignal.aborted) return false;
  if (!err) return false;
  if (err.code === 'AI_NOT_CONFIGURED') return false;
  if (err.name === 'AbortError' && err.code !== 'AI_TIMEOUT') return false;
  if (err.code === 'AI_TIMEOUT' || err.code === 'INVALID_AI_RESPONSE' || err.isContentError) return true;

  const { status, apiStatus, rawMsg } = extractErrorDetails(err);

  if (status === 400 || status === 401 || status === 403 || status === 404) return false;
  if (/API_KEY_INVALID|PERMISSION_DENIED|NOT_FOUND|INVALID_ARGUMENT/i.test(rawMsg) || /PERMISSION_DENIED|NOT_FOUND|INVALID_ARGUMENT/i.test(apiStatus)) {
    return false;
  }

  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  if (/RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED|INTERNAL/i.test(apiStatus)) return true;

  const code = String(err?.code || '');
  if (/^(ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE|UND_ERR_.*)$/i.test(code)) {
    return true;
  }
  if (err instanceof TypeError && /fetch|network|socket/i.test(rawMsg)) {
    return true;
  }
  return false;
}

function mapProviderError(err, options = {}) {
  const secretValues = Array.isArray(options.secretValues) ? options.secretValues : [];
  if (err && err.code && err.status && err.isRouterError) return err;

  const fromFallback = Boolean(err && err.fromFallback);
  const attempts = Number(err?.attempts) || undefined;
  const { status, apiStatus, msg } = extractErrorDetails(err, secretValues);

  if (err && err.code === 'AI_NOT_CONFIGURED') {
    return {
      status: 503,
      code: 'AI_NOT_CONFIGURED',
      message: msg || 'GEMINI_API_KEY is not configured on the server.',
      retryable: false,
      errorType: 'AI_NOT_CONFIGURED',
    };
  }
  if ((err && err.name === 'AbortError') || err?.code === 'AI_TIMEOUT') {
    return {
      status: 504,
      code: 'AI_TIMEOUT',
      message: 'AI mentor took too long to respond. Please try again.',
      retryable: true,
      retryAfterSec: 3,
      errorType: 'AI_TIMEOUT',
      upstreamStatus: status || 504,
      ...(attempts ? { attempts } : {}),
    };
  }
  if (err && (err.code === 'INVALID_AI_RESPONSE' || err.isContentError)) {
    return {
      status: 502,
      code: 'INVALID_AI_RESPONSE',
      message: 'AI returned an unexpected format. Please retry.',
      retryable: true,
      retryAfterSec: 2,
      errorType: 'INVALID_AI_RESPONSE',
      upstreamStatus: 502,
      ...(attempts ? { attempts } : {}),
    };
  }
  if (fromFallback && (status === 400 || status === 401 || status === 403 || status === 404 || /API_KEY_INVALID|PERMISSION_DENIED|NOT_FOUND/i.test(msg))) {
    return {
      status: 503,
      code: 'AI_UNAVAILABLE',
      message: 'AI service is temporarily unreachable. Your saved ASCEND progress and plans remain available.',
      retryable: true,
      retryAfterSec: 5,
      errorType: 'FALLBACK_FAILED',
      upstreamStatus: status || 503,
      ...(attempts ? { attempts } : {}),
    };
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(msg) || /PERMISSION_DENIED/i.test(apiStatus)) {
    return {
      status: 503,
      code: 'AI_AUTH_ERROR',
      message: 'AI service credentials need attention in Settings > Secrets.',
      retryable: false,
      detail: apiStatus || `HTTP_${status || 'AUTH'}`,
      ...(attempts ? { attempts } : {}),
    };
  }
  if (status === 404 || /NOT_FOUND/i.test(msg) || /NOT_FOUND/i.test(apiStatus)) {
    return {
      status: 503,
      code: 'AI_MODEL_UNAVAILABLE',
      message: 'Configured AI model is currently unavailable.',
      retryable: false,
      detail: apiStatus || 'NOT_FOUND',
      ...(attempts ? { attempts } : {}),
    };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg) || /RESOURCE_EXHAUSTED/i.test(apiStatus)) {
    return {
      status: 429,
      code: 'AI_QUOTA_EXCEEDED',
      message: 'AI rate or quota limit reached. Please wait a moment and try again.',
      retryable: true,
      retryAfterSec: fromFallback ? 5 : 15,
      detail: apiStatus || 'RESOURCE_EXHAUSTED',
      upstreamStatus: 429,
      ...(attempts ? { attempts } : {}),
    };
  }
  if (status === 400) {
    return {
      status: 400,
      code: 'AI_BAD_REQUEST',
      message: 'Request could not be processed by AI provider.',
      retryable: false,
      detail: msg ? `${apiStatus || 'INVALID_ARGUMENT'}: ${msg}` : (apiStatus || 'INVALID_ARGUMENT'),
      ...(attempts ? { attempts } : {}),
    };
  }
  return {
    status: 503,
    code: 'AI_UNAVAILABLE',
    message: 'AI service is temporarily unreachable. Your saved ASCEND progress and plans remain available.',
    retryable: true,
    retryAfterSec: 5,
    ...(fromFallback ? { errorType: 'FALLBACK_FAILED' } : { detail: `${apiStatus || err?.code || err?.name || 'UPSTREAM'}${status ? '_' + status : ''}${msg ? ': ' + msg : ''}` }),
    ...(status ? { upstreamStatus: status } : {}),
    ...(attempts ? { attempts } : {}),
  };
}

function createAIProviderRouter(options = {}) {
  const cfg = readProviderRouterConfig(options.config);
  const logFallback = typeof options.logFallbackFn === 'function'
    ? options.logFallbackFn
    : (entry) => console.info('[ai:fallback]', JSON.stringify(entry));
  const logEvent = typeof options.logEventFn === 'function'
    ? options.logEventFn
    : (entry) => console.info('[ai:router]', JSON.stringify(entry));

  function safeEmitEvent(payload) {
    try {
      logEvent(payload);
    } catch (_) {}
  }

  function getSecretsList() {
    const cf = getCloudflareCredentials(options);
    return [getGeminiApiKey(options), cf.accountId, cf.apiToken].filter(Boolean);
  }

  function sleepWithSignal(ms, signal) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        const aErr = new Error('Aborted');
        aErr.name = 'AbortError';
        reject(aErr);
        return;
      }
      let timer = null;
      const onAbort = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (signal) signal.removeEventListener('abort', onAbort);
        const aErr = new Error('Aborted');
        aErr.name = 'AbortError';
        reject(aErr);
      };
      timer = setTimeout(() => {
        timer = null;
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function invokeWithBudget({ budgetMs, clientSignal, fn, timeoutMessage }) {
    const controller = new AbortController();
    let timedOut = false;

    const onClientAbort = () => controller.abort();
    if (clientSignal) {
      if (clientSignal.aborted) {
        const aErr = new Error('Client aborted request');
        aErr.name = 'AbortError';
        throw aErr;
      }
      clientSignal.addEventListener('abort', onClientAbort, { once: true });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, budgetMs);

    const abortPromise = new Promise((_, reject) => {
      if (controller.signal.aborted) {
        const err = new Error(timedOut ? timeoutMessage : 'Request aborted');
        if (timedOut) err.code = 'AI_TIMEOUT';
        else err.name = 'AbortError';
        reject(err);
        return;
      }
      controller.signal.addEventListener('abort', () => {
        const err = new Error(timedOut ? timeoutMessage : 'Request aborted');
        if (timedOut) err.code = 'AI_TIMEOUT';
        else err.name = 'AbortError';
        reject(err);
      }, { once: true });
    });

    try {
      const workPromise = fn(controller.signal, () => timedOut);
      return await Promise.race([workPromise, abortPromise]);
    } catch (err) {
      if (timedOut && (!err || err.code !== 'AI_TIMEOUT')) {
        const timeoutErr = new Error(timeoutMessage);
        timeoutErr.code = 'AI_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (clientSignal) clientSignal.removeEventListener('abort', onClientAbort);
    }
  }

  async function callPrimaryGemini({
    model,
    contents,
    systemInstruction,
    responseSchema,
    validatorSpec,
    thinkingLevel,
    budgetMs,
    clientSignal,
  }) {
    const apiKey = getGeminiApiKey(options);
    if (!apiKey && typeof options.generateFn !== 'function') {
      const err = new Error('GEMINI_API_KEY is not configured on the server.');
      err.status = 503;
      err.code = 'AI_NOT_CONFIGURED';
      err.isRouterError = true;
      throw err;
    }

    const deadline = Date.now() + budgetMs;
    const retryDelays = cfg.retryDelaysMs;
    const minAttemptMarginMs = Math.min(3500, Math.floor(budgetMs * 0.25));
    const effectiveThinking = thinkingLevel || cfg.thinkingLevel;

    return invokeWithBudget({
      budgetMs,
      clientSignal,
      timeoutMessage: 'Gemini request timed out',
      fn: async (outerSignal, isTimedOut) => {
        let attempts = 0;
        while (true) {
          attempts += 1;
          const attemptController = new AbortController();
          const onOuterAbort = () => attemptController.abort();
          outerSignal.addEventListener('abort', onOuterAbort, { once: true });

          try {
            const rawResult = await (async () => {
              if (typeof options.generateFn === 'function') {
                return options.generateFn({
                  model,
                  contents,
                  systemInstruction,
                  responseSchema,
                  thinkingLevel: effectiveThinking,
                  abortSignal: attemptController.signal,
                });
              }
              const { GoogleGenAI, ThinkingLevel } = await loadGenAISDK();
              const ai = new GoogleGenAI({
                apiKey,
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
              });
              const levelEnum = ThinkingLevel[effectiveThinking] || ThinkingLevel.LOW;
              const response = await ai.models.generateContent({
                model,
                contents,
                config: {
                  systemInstruction,
                  responseMimeType: 'application/json',
                  responseSchema,
                  thinkingConfig: { thinkingLevel: levelEnum },
                  abortSignal: attemptController.signal,
                },
              });
              return { text: response.text };
            })();

            if (validatorSpec) {
              const parsed = validateStructuredPayload(rawResult?.text, validatorSpec, { strictEnums: false });
              return { text: rawResult.text, parsed, attempts };
            }
            return { text: rawResult?.text, parsed: null, attempts };
          } catch (err) {
            if (isTimedOut() || outerSignal.aborted) {
              const timeoutErr = err && (err.code === 'AI_TIMEOUT' || err.name === 'AbortError')
                ? err
                : Object.assign(new Error('Gemini request timed out'), { code: 'AI_TIMEOUT' });
              timeoutErr.attempts = attempts;
              throw timeoutErr;
            }
            const { status, apiStatus } = extractErrorDetails(err);
            const isContentErr = Boolean(err?.isContentError || err?.code === 'INVALID_AI_RESPONSE');
            const transientRetryable = !isContentErr && (
              status === 500 ||
              status === 502 ||
              status === 503 ||
              status === 504 ||
              /INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(apiStatus)
            );
            const retryIdx = attempts - 1;
            const rawDelay = retryIdx < retryDelays.length ? retryDelays[retryIdx] : null;
            const delayMs = rawDelay === null
              ? null
              : computeJitteredDelayMs(rawDelay, cfg.jitterRatio, options.randomFn);
            const remainingMs = deadline - Date.now();
            if (!transientRetryable || delayMs === null || remainingMs <= delayMs + minAttemptMarginMs) {
              if (err && typeof err === 'object') err.attempts = attempts;
              throw err;
            }
            await sleepWithSignal(delayMs, outerSignal);
          } finally {
            outerSignal.removeEventListener('abort', onOuterAbort);
          }
        }
      },
    });
  }

  async function callCloudflareWorkersAI({
    model,
    messages,
    responseSchema,
    validatorSpec,
    budgetMs,
    clientSignal,
    task,
    characterId,
  }) {
    const cfCreds = getCloudflareCredentials(options);
    const cfModel = validateCloudflareModelName(model || cfg.cloudflareModel);
    const cfJsonSchema = convertResponseSchemaToJsonSchema(responseSchema);
    const responseFormat = cfJsonSchema
      ? { type: 'json_schema', json_schema: cfJsonSchema }
      : { type: 'json_object' };

    return invokeWithBudget({
      budgetMs,
      clientSignal,
      timeoutMessage: 'Cloudflare fallback request timed out',
      fn: async (signal) => {
        let rawText = '';
        if (typeof options.cloudflareFn === 'function') {
          const mockRes = await options.cloudflareFn({
            provider: 'cloudflare-workers-ai',
            model: cfModel,
            messages,
            response_format: responseFormat,
            task,
            characterId,
            abortSignal: signal,
          });
          if (mockRes && typeof mockRes === 'object' && ('result' in mockRes || 'success' in mockRes)) {
            rawText = extractCloudflareResponseText(mockRes);
          } else {
            rawText = typeof mockRes?.text === 'string' ? mockRes.text.trim() : '';
            if (!rawText) {
              throw createInvalidResponseError('Empty Cloudflare mock response');
            }
          }
        } else {
          if (!cfCreds.accountId || !cfCreds.apiToken) {
            const err = new Error('Cloudflare credentials are not configured');
            err.status = 503;
            err.code = 'AI_UNAVAILABLE';
            throw err;
          }
          const fetchImpl = typeof options.fetchFn === 'function' ? options.fetchFn : fetch;
          const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfCreds.accountId)}/ai/run/${cfModel}`;
          const res = await fetchImpl(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cfCreds.apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages,
              max_tokens: 1600,
              temperature: 0.4,
              response_format: responseFormat,
            }),
            signal,
          });

          let payload = null;
          const respText = await res.text();
          try {
            payload = JSON.parse(respText);
          } catch (_) {
            payload = null;
          }

          if (!res.ok) {
            const apiMsg = payload && Array.isArray(payload.errors) && payload.errors[0]
              ? payload.errors[0].message
              : respText.slice(0, 120);
            const err = new Error(sanitizeProviderErrorMsg(apiMsg || `Cloudflare HTTP ${res.status}`, getSecretsList()));
            err.status = res.status;
            throw err;
          }
          rawText = extractCloudflareResponseText(payload);
        }

        if (validatorSpec) {
          const parsed = validateStructuredPayload(rawText, validatorSpec, { strictEnums: true });
          return { text: rawText, parsed, model: cfModel };
        }
        return { text: rawText, parsed: null, model: cfModel };
      },
    });
  }

  async function generate({
    task = 'chat',
    characterId = 'default',
    requestId = '',
    route = '',
    model = DEFAULT_GEMINI_MODEL,
    contents,
    systemInstruction = '',
    fallbackContents,
    fallbackSystemInstruction,
    responseSchema,
    fallbackResponseSchema,
    validatorSpec,
    thinkingLevel,
    allowFallback = false,
    userConsent = false,
    hasImage = false,
    clientSignal,
  }) {
    const cfConfigured = isCloudflareConfigured(options);
    const canEverFallback = Boolean(allowFallback && userConsent === true && !hasImage && cfConfigured);

    const totalStartedAt = Date.now();
    const totalDeadline = totalStartedAt + cfg.timeoutMs;
    const primaryBudgetMs = canEverFallback ? cfg.primaryFallbackTimeoutMs : cfg.timeoutMs;

    let primaryErr = null;
    try {
      const primaryRes = await callPrimaryGemini({
        model,
        contents,
        systemInstruction,
        responseSchema,
        validatorSpec,
        thinkingLevel,
        budgetMs: primaryBudgetMs,
        clientSignal,
      });

      const durationMs = Math.max(0, Date.now() - totalStartedAt);
      safeEmitEvent({
        event: 'gemini_success',
        requestId: String(requestId || ''),
        route: String(route || ''),
        task: String(task || 'chat'),
        characterId: String(characterId || 'default'),
        provider: 'gemini',
        model,
        fallbackUsed: false,
        attempts: primaryRes.attempts || 1,
        durationMs,
      });

      return {
        ok: true,
        provider: 'gemini',
        model,
        fallbackUsed: false,
        text: primaryRes.text,
        data: primaryRes.parsed,
        attempts: primaryRes.attempts || 1,
        durationMs,
      };
    } catch (err) {
      primaryErr = err;
    }

    const primaryMeta = extractSafeProviderMeta(primaryErr);
    const primaryDurationMs = Math.max(0, Date.now() - totalStartedAt);
    safeEmitEvent({
      event: 'gemini_failed',
      requestId: String(requestId || ''),
      route: String(route || ''),
      task: String(task || 'chat'),
      characterId: String(characterId || 'default'),
      provider: 'gemini',
      model,
      reasonCode: primaryMeta.errorType,
      upstreamStatus: primaryMeta.upstreamStatus,
      attempts: primaryMeta.attempts || 1,
      durationMs: primaryDurationMs,
    });

    const transientPrimary = isTransientPrimaryError(primaryErr, clientSignal);
    if (!canEverFallback || !transientPrimary) {
      let skipReason = 'non_transient_error';
      if (clientSignal && clientSignal.aborted) skipReason = 'client_aborted';
      else if (hasImage) skipReason = 'image_not_allowed';
      else if (!allowFallback) skipReason = 'route_disallowed';
      else if (userConsent !== true) skipReason = 'fallback_disabled_by_user';
      else if (!cfConfigured) skipReason = 'cloudflare_not_configured';

      safeEmitEvent({
        event: 'fallback_skipped',
        requestId: String(requestId || ''),
        route: String(route || ''),
        task: String(task || 'chat'),
        characterId: String(characterId || 'default'),
        reason: skipReason,
        primaryReasonCode: primaryMeta.errorType,
      });
      throw primaryErr;
    }

    const remainingTotalMs = totalDeadline - Date.now();
    if (remainingTotalMs < 100) {
      safeEmitEvent({
        event: 'fallback_skipped',
        requestId: String(requestId || ''),
        route: String(route || ''),
        task: String(task || 'chat'),
        characterId: String(characterId || 'default'),
        reason: 'budget_exhausted',
        primaryReasonCode: primaryMeta.errorType,
      });
      throw primaryErr;
    }
    const cfBudgetMs = Math.min(cfg.cloudflareTimeoutMs, remainingTotalMs);

    try {
      logFallback({
        requestId: String(requestId || ''),
        route: String(route || ''),
        task: String(task || 'chat'),
        characterId: String(characterId || 'default'),
        fromProvider: 'gemini',
        toProvider: 'cloudflare-workers-ai',
        reasonCode: primaryMeta.errorType,
        upstreamStatus: primaryMeta.upstreamStatus,
      });
    } catch (_) {}

    const cfSchema = fallbackResponseSchema !== undefined ? fallbackResponseSchema : responseSchema;
    const cfMessages = convertGeminiContentsToMessages({
      systemInstruction: fallbackSystemInstruction !== undefined ? fallbackSystemInstruction : systemInstruction,
      contents: fallbackContents !== undefined ? fallbackContents : contents,
      responseSchema: cfSchema,
    });

    try {
      const cfRes = await callCloudflareWorkersAI({
        model: cfg.cloudflareModel,
        messages: cfMessages,
        responseSchema: cfSchema,
        validatorSpec,
        budgetMs: cfBudgetMs,
        clientSignal,
        task,
        characterId,
      });

      const durationMs = Math.max(0, Date.now() - totalStartedAt);
      const totalAttempts = (Number(primaryErr?.attempts) || 1) + 1;
      safeEmitEvent({
        event: 'cloudflare_success',
        requestId: String(requestId || ''),
        route: String(route || ''),
        task: String(task || 'chat'),
        characterId: String(characterId || 'default'),
        provider: 'cloudflare-workers-ai',
        model: cfRes.model,
        fallbackUsed: true,
        reasonCode: primaryMeta.errorType,
        attempts: totalAttempts,
        durationMs,
      });

      return {
        ok: true,
        provider: 'cloudflare-workers-ai',
        model: cfRes.model,
        fallbackUsed: true,
        fallbackReason: primaryMeta.errorType,
        text: cfRes.text,
        data: cfRes.parsed,
        attempts: totalAttempts,
        durationMs,
      };
    } catch (cfErr) {
      const cfMeta = extractSafeProviderMeta(cfErr);
      const totalAttempts = (Number(primaryErr?.attempts) || 1) + 1;
      safeEmitEvent({
        event: 'cloudflare_failed',
        requestId: String(requestId || ''),
        route: String(route || ''),
        task: String(task || 'chat'),
        characterId: String(characterId || 'default'),
        provider: 'cloudflare-workers-ai',
        model: cfg.cloudflareModel,
        reasonCode: cfMeta.errorType,
        upstreamStatus: cfMeta.upstreamStatus,
        attempts: totalAttempts,
        durationMs: Math.max(0, Date.now() - totalStartedAt),
      });
      if (clientSignal && clientSignal.aborted) {
        throw cfErr;
      }
      if (cfErr && typeof cfErr === 'object') {
        cfErr.fromFallback = true;
        if (!cfErr.attempts) {
          cfErr.attempts = totalAttempts;
        }
      }
      throw cfErr;
    }
  }

  return {
    config: cfg,
    generate,
    isCloudflareConfigured: () => isCloudflareConfigured(options),
    getSecretsList,
  };
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_CLOUDFLARE_MODEL,
  DEFAULT_JITTER_RATIO,
  computeJitteredDelayMs,
  loadGenAISDK,
  getGeminiApiKey,
  getCloudflareCredentials,
  isCloudflareConfigured,
  readProviderRouterConfig,
  sanitizeProviderErrorMsg,
  extractSafeProviderMeta,
  extractCloudflareResponseText,
  parseProviderJson,
  validateStructuredPayload,
  isTransientPrimaryError,
  mapProviderError,
  convertGeminiContentsToMessages,
  convertResponseSchemaToJsonSchema,
  buildSchemaPromptAddon,
  createAIProviderRouter,
};
