/* ASCEND — Stage 2: Independent chat persistence layer (LM.ChatStore).
   Stored under localStorage key 'ascend.chat.v1', cleanly separated from:
     - LM.Store ('ascend.state') -> progress reset does not wipe chat history/settings
     - LM.Photos ('ascend-photos' IndexedDB) -> photo deletion does not delete chats */
window.LM = window.LM || {};

(function () {
  const KEY = 'ascend.chat.v1';
  const VERSION = 1;
  const THREAD_IDS = ['barrett', 'chico', 'duo'];
  const MAX_MESSAGES_PER_THREAD = 400;

  LM.CHAT_CHARS = {
    barrett: {
      id: 'barrett',
      avatar: '/assets/avatars/barrett.jpg',
      accent: 'barrett',
      nameKey: 'chat.char.barrett.name',
      roleKey: 'chat.char.barrett.role',
      descKey: 'chat.char.barrett.desc'
    },
    chico: {
      id: 'chico',
      avatar: '/assets/avatars/chico.jpg',
      accent: 'chico',
      nameKey: 'chat.char.chico.name',
      roleKey: 'chat.char.chico.role',
      descKey: 'chat.char.chico.desc'
    },
    duo: {
      id: 'duo',
      avatar: '/assets/avatars/duo.jpg',
      accent: 'duo',
      nameKey: 'chat.char.duo.name',
      roleKey: 'chat.char.duo.role',
      descKey: 'chat.char.duo.desc'
    }
  };

  LM.MENTOR_PROFILES = {
    barrett: {
      id: 'barrett',
      accent: 'barrett',
      profileEnabled: true,
      avatar: '/assets/avatars/barrett.jpg',
      photo: '/assets/avatars/barrett-portrait.png',
      displayNameKey: 'chat.profile.barrett.displayName',
      shortNameKey: 'chat.char.barrett.name',
      roleKey: 'chat.char.barrett.role',
      statusKey: 'chat.profile.barrett.status',
      personalityKey: 'chat.profile.barrett.personality',
      bioKey: 'chat.profile.barrett.bio',
      quoteKey: 'chat.profile.barrett.quote',
      interestsKey: 'chat.profile.barrett.interests',
      specializationsKey: 'chat.profile.barrett.specializations',
      principlesKey: 'chat.profile.barrett.principles'
    },
    chico: {
      id: 'chico',
      accent: 'chico',
      profileEnabled: false,
      avatar: '/assets/avatars/chico.jpg',
      photo: '/assets/avatars/chico.jpg',
      displayNameKey: 'chat.profile.chico.displayName',
      shortNameKey: 'chat.char.chico.name',
      roleKey: 'chat.char.chico.role',
      statusKey: 'chat.profile.chico.status',
      personalityKey: 'chat.profile.chico.personality',
      bioKey: 'chat.profile.chico.bio',
      quoteKey: 'chat.profile.chico.quote',
      interestsKey: 'chat.profile.chico.interests',
      specializationsKey: 'chat.profile.chico.specializations',
      principlesKey: 'chat.profile.chico.principles'
    }
  };

  function tr(key) {
    return (LM.t && typeof LM.t === 'function') ? LM.t(key) : key;
  }

  function splitPipeList(val) {
    if (Array.isArray(val)) return val.map(x => String(x || '').trim()).filter(Boolean);
    return String(val || '')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);
  }

  LM.getMentorProfile = function (id) {
    const raw = id && LM.MENTOR_PROFILES && LM.MENTOR_PROFILES[id];
    if (!raw) return null;
    const interestsRaw = raw.interestsKey ? tr(raw.interestsKey) : '';
    return {
      id: raw.id,
      accent: raw.accent || raw.id,
      profileEnabled: Boolean(raw.profileEnabled),
      avatar: raw.avatar,
      photo: raw.photo || raw.avatar,
      displayName: raw.displayNameKey ? tr(raw.displayNameKey) : tr(raw.shortNameKey),
      shortName: raw.shortNameKey ? tr(raw.shortNameKey) : '',
      role: raw.roleKey ? tr(raw.roleKey) : '',
      status: raw.statusKey ? tr(raw.statusKey) : '',
      personality: raw.personalityKey ? tr(raw.personalityKey) : '',
      bio: raw.bioKey ? tr(raw.bioKey) : '',
      quote: raw.quoteKey ? tr(raw.quoteKey) : '',
      interestsLine: interestsRaw,
      interests: interestsRaw
        ? interestsRaw.split('·').map(s => s.trim()).filter(Boolean)
        : [],
      specializations: raw.specializationsKey ? splitPipeList(tr(raw.specializationsKey)) : [],
      principles: raw.principlesKey ? splitPipeList(tr(raw.principlesKey)) : []
    };
  };

  let state = null;
  const listeners = new Set();

  function genId(prefix) {
    return (prefix || 'm') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function makeClientId() {
    return 'asc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function defaultThread() {
    return {
      messages: [],
      unread: 0,
      pinnedIds: [],
      lastReadAt: 0,
      customTitle: '',
      archived: false,
      bg: {
        type: 'default',
        value: '',
        brightness: 1,
        blur: 0,
        posX: 50,
        posY: 50,
        photoId: null
      }
    };
  }

  function defaults() {
    return {
      version: VERSION,
      clientId: makeClientId(),
      threads: {
        barrett: defaultThread(),
        chico: defaultThread(),
        duo: defaultThread()
      },
      onboarding: {
        completed: false,
        seen: { barrett: false, chico: false }
      },
      memory: {
        sharedEnabled: true,
        barrettSummary: '',
        shared: [],
        private: { barrett: [], chico: [] },
        duo: []
      },
      settings: {
        barrett: { directness: 75, humor: 55, detail: 65, strictness: 70 },
        chico: { sociability: 80, humor: 75, creativity: 80, detail: 60 },
        general: {
          autonomousFreq: 'normal',
          humorFreq: 'normal',
          allowInitiative: true
        }
      },
      autonomous: {
        lastAt: 0,
        lastTopic: ''
      }
    };
  }

  const VALID_EMOTIONS = new Set(['neutral', 'happy', 'sad', 'excited']);
  const ALLOWED_ATTACHMENT_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  function cleanAttachment(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (raw.kind !== 'image') return null;
    const rawMime = String(raw.mimeType || '').trim().toLowerCase();
    const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    if (!ALLOWED_ATTACHMENT_MIMES.has(mimeType)) return null;
    const sizeBytes = Number(raw.sizeBytes);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 5000000) return null;
    const name = typeof raw.name === 'string'
      ? raw.name.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 120)
      : '';
    return {
      kind: 'image',
      mimeType: mimeType,
      sizeBytes: Math.round(sizeBytes),
      name: name
    };
  }

  function cleanError(rawErr) {
    if (!rawErr || typeof rawErr !== 'object') return null;
    const code = typeof rawErr.code === 'string' ? rawErr.code.slice(0, 64) : 'UNKNOWN_ERROR';
    const message = typeof rawErr.message === 'string'
      ? rawErr.message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 400)
      : '';
    return {
      code: code,
      status: Number(rawErr.status) || 0,
      message: message,
      retryable: rawErr.retryable !== false,
      retryAfterSec: Math.max(0, Math.min(300, Number(rawErr.retryAfterSec) || 0)),
      nextRetryAt: Math.max(0, Number(rawErr.nextRetryAt) || 0),
      attempts: Math.max(0, Math.min(20, Number(rawErr.attempts) || 0))
    };
  }

  function cleanMessage(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const text = typeof raw.text === 'string'
      ? raw.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 4000)
      : '';
    const attachment = cleanAttachment(raw.attachment);
    if (!text && !attachment) return null;
    const role = raw.role === 'assistant' ? 'assistant' : raw.role === 'system' ? 'system' : 'user';
    const sender = (raw.sender === 'barrett' || raw.sender === 'chico' || raw.sender === 'user')
      ? raw.sender
      : (role === 'user' ? 'user' : 'barrett');
    const status = raw.status === 'error' || raw.status === 'sending' ? raw.status : 'sent';
    const out = {
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : genId('msg'),
      role: role,
      sender: sender,
      text: text,
      ts: (typeof raw.ts === 'number' && isFinite(raw.ts) && raw.ts > 0) ? raw.ts : Date.now(),
      editedAt: (typeof raw.editedAt === 'number' && isFinite(raw.editedAt) && raw.editedAt > 0) ? raw.editedAt : null,
      replyToId: typeof raw.replyToId === 'string' && raw.replyToId ? raw.replyToId.slice(0, 64) : null,
      status: status
    };
    if (attachment) out.attachment = attachment;
    if (role === 'assistant') {
      if (typeof raw.emotion === 'string' && VALID_EMOTIONS.has(raw.emotion)) {
        out.emotion = raw.emotion;
      }
      if (Array.isArray(raw.followUps) && raw.followUps.length) {
        const cleanFollowUps = raw.followUps
          .map(q => (typeof q === 'string' ? q.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 90) : ''))
          .filter(Boolean)
          .slice(0, 3);
        if (cleanFollowUps.length) out.followUps = cleanFollowUps;
      }
      if (raw.fallbackUsed === true) {
        out.fallbackUsed = true;
        if (typeof raw.provider === 'string' && raw.provider.trim()) {
          out.provider = raw.provider.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 48);
        }
      }
    }
    if (status === 'error') {
      const errObj = cleanError(raw.error);
      if (errObj) out.error = errObj;
    }
    return out;
  }

  function cleanTitle(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
  }

  function cleanMemorySummary(raw) {
    if (typeof raw !== 'string') return '';
    return raw
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 600);
  }

  function isValidMemorySummary(raw) {
    const cleaned = cleanMemorySummary(raw);
    if (cleaned.length < 3) return false;
    if (/^(?:null|undefined|none|n\/a|\{\}|\[\])$/i.test(cleaned)) return false;
    return true;
  }

  function sanitizeThread(raw) {
    const def = defaultThread();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return def;
    const msgs = Array.isArray(raw.messages)
      ? raw.messages.map(cleanMessage).filter(Boolean).slice(-MAX_MESSAGES_PER_THREAD)
      : [];
    const msgIds = new Set(msgs.map(m => m.id));
    def.messages = msgs;
    def.unread = Math.max(0, Math.min(999, Number(raw.unread) || 0));
    def.lastReadAt = Math.max(0, Number(raw.lastReadAt) || 0);
    def.customTitle = cleanTitle(raw.customTitle);
    def.archived = Boolean(raw.archived);
    def.pinnedIds = Array.isArray(raw.pinnedIds)
      ? raw.pinnedIds.filter(id => typeof id === 'string' && msgIds.has(id)).slice(0, 25)
      : [];
    if (raw.bg && typeof raw.bg === 'object') {
      const t = raw.bg.type;
      def.bg.type = (t === 'color' || t === 'gradient' || t === 'photo') ? t : 'default';
      def.bg.value = typeof raw.bg.value === 'string' ? raw.bg.value.slice(0, 200) : '';
      def.bg.brightness = Math.max(0.25, Math.min(1.5, Number(raw.bg.brightness) || 1));
      def.bg.blur = Math.max(0, Math.min(24, Number(raw.bg.blur) || 0));
      def.bg.posX = Math.max(0, Math.min(100, raw.bg.posX != null ? Number(raw.bg.posX) : 50));
      def.bg.posY = Math.max(0, Math.min(100, raw.bg.posY != null ? Number(raw.bg.posY) : 50));
      def.bg.photoId = typeof raw.bg.photoId === 'string' ? raw.bg.photoId.slice(0, 64) : null;
    }
    return def;
  }

  function sanitize(parsed) {
    const d = defaults();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return d;
    if (typeof parsed.clientId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(parsed.clientId)) {
      d.clientId = parsed.clientId;
    }
    THREAD_IDS.forEach(id => {
      if (parsed.threads && parsed.threads[id]) {
        d.threads[id] = sanitizeThread(parsed.threads[id]);
      }
    });
    if (parsed.onboarding && typeof parsed.onboarding === 'object') {
      d.onboarding.completed = Boolean(parsed.onboarding.completed);
      if (parsed.onboarding.seen && typeof parsed.onboarding.seen === 'object') {
        d.onboarding.seen.barrett = Boolean(parsed.onboarding.seen.barrett);
        d.onboarding.seen.chico = Boolean(parsed.onboarding.seen.chico);
      }
    }
    if (parsed.memory && typeof parsed.memory === 'object') {
      d.memory.sharedEnabled = parsed.memory.sharedEnabled !== false;
      d.memory.barrettSummary = cleanMemorySummary(parsed.memory.barrettSummary);
      if (Array.isArray(parsed.memory.shared)) d.memory.shared = parsed.memory.shared.slice(0, 120);
      if (parsed.memory.private && typeof parsed.memory.private === 'object') {
        if (Array.isArray(parsed.memory.private.barrett)) d.memory.private.barrett = parsed.memory.private.barrett.slice(0, 120);
        if (Array.isArray(parsed.memory.private.chico)) d.memory.private.chico = parsed.memory.private.chico.slice(0, 120);
      }
      if (Array.isArray(parsed.memory.duo)) d.memory.duo = parsed.memory.duo.slice(0, 120);
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      if (parsed.settings.barrett) Object.assign(d.settings.barrett, parsed.settings.barrett);
      if (parsed.settings.chico) Object.assign(d.settings.chico, parsed.settings.chico);
      if (parsed.settings.general) Object.assign(d.settings.general, parsed.settings.general);
    }
    if (parsed.autonomous && typeof parsed.autonomous === 'object') {
      d.autonomous.lastAt = Math.max(0, Number(parsed.autonomous.lastAt) || 0);
      d.autonomous.lastTopic = typeof parsed.autonomous.lastTopic === 'string' ? parsed.autonomous.lastTopic.slice(0, 160) : '';
    }
    return d;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        state = defaults();
        persist();
        return state;
      }
      state = sanitize(JSON.parse(raw));
      let recovered = false;
      THREAD_IDS.forEach(id => {
        state.threads[id].messages.forEach(m => {
          if (m.status === 'sending') {
            m.status = 'error';
            m.error = cleanError({ code: 'INTERRUPTED', retryable: true, attempts: 0 });
            recovered = true;
          }
        });
      });
      if (recovered) persist();
    } catch (e) {
      state = defaults();
    }
    return state;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function ensureLoaded() {
    if (!state) load();
    return state;
  }

  function notify() {
    listeners.forEach(fn => {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  LM.ChatStore = {
    KEY: KEY,
    VERSION: VERSION,
    THREAD_IDS: THREAD_IDS.slice(),

    isValidThread(id) {
      return THREAD_IDS.indexOf(id) >= 0;
    },

    get() {
      return ensureLoaded();
    },

    reload() {
      load();
      notify();
      return state;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    update(fn, silent) {
      ensureLoaded();
      fn(state);
      persist();
      if (!silent) notify();
    },

    getClientId() {
      return ensureLoaded().clientId;
    },

    isSharedMemoryEnabled() {
      const s = ensureLoaded();
      return Boolean(s.memory && s.memory.sharedEnabled !== false);
    },

    setSharedMemoryEnabled(enabled) {
      const next = Boolean(enabled);
      this.update(s => {
        if (!s.memory || typeof s.memory !== 'object') s.memory = defaults().memory;
        s.memory.sharedEnabled = next;
      });
      return next;
    },

    getBarrettSummary() {
      const s = ensureLoaded();
      return s.memory && typeof s.memory.barrettSummary === 'string'
        ? cleanMemorySummary(s.memory.barrettSummary)
        : '';
    },

    setBarrettSummary(raw) {
      if (!isValidMemorySummary(raw)) return false;
      const cleaned = cleanMemorySummary(raw);
      this.update(s => {
        if (!s.memory || typeof s.memory !== 'object') s.memory = defaults().memory;
        s.memory.barrettSummary = cleaned;
      });
      return true;
    },

    clearBarrettSummary() {
      this.update(s => {
        if (!s.memory || typeof s.memory !== 'object') s.memory = defaults().memory;
        s.memory.barrettSummary = '';
      });
    },

    getThread(id) {
      const s = ensureLoaded();
      return this.isValidThread(id) ? s.threads[id] : null;
    },

    getMessages(id) {
      const th = this.getThread(id);
      return th ? th.messages : [];
    },

    getThreadTitle(id) {
      const th = this.getThread(id);
      if (!th) return '';
      if (th.customTitle) return th.customTitle;
      const meta = LM.CHAT_CHARS[id];
      return meta && LM.t ? LM.t(meta.nameKey) : id;
    },

    listThreads() {
      const s = ensureLoaded();
      return THREAD_IDS.map(id => {
        const th = s.threads[id];
        const last = th.messages.length ? th.messages[th.messages.length - 1] : null;
        return {
          id: id,
          meta: LM.CHAT_CHARS[id],
          thread: th,
          title: th.customTitle || (LM.t ? LM.t(LM.CHAT_CHARS[id].nameKey) : id),
          archived: Boolean(th.archived),
          pinnedCount: Array.isArray(th.pinnedIds) ? th.pinnedIds.length : 0,
          lastMessage: last,
          unread: th.unread || 0,
          messageCount: th.messages.length
        };
      });
    },

    addMessage(threadId, payload) {
      if (!this.isValidThread(threadId)) return null;
      const msg = cleanMessage(Object.assign({ id: genId('msg'), ts: Date.now() }, payload || {}));
      if (!msg) return null;
      this.update(s => {
        const th = s.threads[threadId];
        th.messages.push(msg);
        if (th.messages.length > MAX_MESSAGES_PER_THREAD) {
          th.messages = th.messages.slice(-MAX_MESSAGES_PER_THREAD);
          const keep = new Set(th.messages.map(m => m.id));
          th.pinnedIds = th.pinnedIds.filter(id => keep.has(id));
        }
        if (msg.role === 'assistant' && payload && payload.markUnread) {
          th.unread = (th.unread || 0) + 1;
        }
      });
      return msg;
    },

    updateMessage(threadId, msgId, patch) {
      if (!this.isValidThread(threadId) || !msgId || !patch || typeof patch !== 'object') return null;
      let updated = null;
      this.update(s => {
        const th = s.threads[threadId];
        const idx = th.messages.findIndex(m => m && m.id === msgId);
        if (idx < 0) return;
        const merged = cleanMessage(Object.assign({}, th.messages[idx], patch, { id: th.messages[idx].id }));
        if (!merged) return;
        th.messages[idx] = merged;
        updated = merged;
      });
      return updated;
    },

    editUserMessage(threadId, msgId, newText, opts) {
      if (!this.isValidThread(threadId) || !msgId) return null;
      opts = opts || {};
      const cleanedText = typeof newText === 'string'
        ? newText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 4000)
        : '';
      if (!cleanedText) return null;
      let result = null;
      this.update(s => {
        const th = s.threads[threadId];
        const idx = th.messages.findIndex(m => m && m.id === msgId);
        if (idx < 0 || th.messages[idx].role !== 'user') return;
        const updated = cleanMessage(Object.assign({}, th.messages[idx], {
          text: cleanedText,
          editedAt: Date.now(),
          status: opts.nextStatus || th.messages[idx].status,
          error: opts.nextStatus === 'sending' || opts.nextStatus === 'sent' ? null : th.messages[idx].error
        }, { id: th.messages[idx].id }));
        if (!updated) return;
        th.messages[idx] = updated;
        let removedCount = 0;
        if (opts.truncateAfter && idx < th.messages.length - 1) {
          removedCount = th.messages.length - 1 - idx;
          th.messages = th.messages.slice(0, idx + 1);
          const keep = new Set(th.messages.map(m => m.id));
          th.pinnedIds = th.pinnedIds.filter(id => keep.has(id));
        }
        result = { msg: updated, removedCount: removedCount };
      });
      return result;
    },

    truncateAfter(threadId, msgId) {
      if (!this.isValidThread(threadId) || !msgId) return 0;
      let removedCount = 0;
      this.update(s => {
        const th = s.threads[threadId];
        const idx = th.messages.findIndex(m => m && m.id === msgId);
        if (idx < 0 || idx >= th.messages.length - 1) return;
        removedCount = th.messages.length - 1 - idx;
        th.messages = th.messages.slice(0, idx + 1);
        const keep = new Set(th.messages.map(m => m.id));
        th.pinnedIds = th.pinnedIds.filter(id => keep.has(id));
      });
      return removedCount;
    },

    removeMessage(threadId, msgId) {
      if (!this.isValidThread(threadId) || !msgId) return false;
      let removed = false;
      this.update(s => {
        const th = s.threads[threadId];
        const prevLen = th.messages.length;
        th.messages = th.messages.filter(m => m && m.id !== msgId);
        th.pinnedIds = th.pinnedIds.filter(id => id !== msgId);
        removed = th.messages.length !== prevLen;
      });
      return removed;
    },

    isPinned(threadId, msgId) {
      const th = this.getThread(threadId);
      return !!(th && Array.isArray(th.pinnedIds) && th.pinnedIds.indexOf(msgId) >= 0);
    },

    togglePin(threadId, msgId) {
      if (!this.isValidThread(threadId) || !msgId) return { pinned: false };
      let outcome = { pinned: false };
      this.update(s => {
        const th = s.threads[threadId];
        const exists = th.messages.some(m => m && m.id === msgId);
        if (!exists) return;
        const pos = th.pinnedIds.indexOf(msgId);
        if (pos >= 0) {
          th.pinnedIds.splice(pos, 1);
          outcome = { pinned: false };
        } else {
          if (th.pinnedIds.length >= 25) {
            outcome = { pinned: false, limitReached: true };
            return;
          }
          th.pinnedIds.push(msgId);
          outcome = { pinned: true };
        }
      });
      return outcome;
    },

    getPinnedMessages(threadId) {
      const th = this.getThread(threadId);
      if (!th || !Array.isArray(th.pinnedIds) || !th.pinnedIds.length) return [];
      const byId = new Map(th.messages.map(m => [m.id, m]));
      return th.pinnedIds.map(id => byId.get(id)).filter(Boolean);
    },

    renameThread(threadId, newTitle) {
      if (!this.isValidThread(threadId)) return '';
      const cleaned = cleanTitle(newTitle);
      this.update(s => {
        s.threads[threadId].customTitle = cleaned;
      });
      return cleaned;
    },

    archiveThread(threadId, archived) {
      if (!this.isValidThread(threadId)) return false;
      const next = archived === undefined ? !this.getThread(threadId).archived : Boolean(archived);
      this.update(s => {
        s.threads[threadId].archived = next;
      });
      return next;
    },

    deleteThread(threadId) {
      if (!this.isValidThread(threadId)) return false;
      this.update(s => {
        const bg = s.threads[threadId].bg;
        s.threads[threadId] = defaultThread();
        s.threads[threadId].bg = bg;
      });
      return true;
    },

    searchMessages(query, opts) {
      opts = opts || {};
      const q = String(query || '').trim().toLowerCase();
      if (!q) return [];
      const s = ensureLoaded();
      const ids = opts.threadId ? (this.isValidThread(opts.threadId) ? [opts.threadId] : []) : THREAD_IDS;
      const includeArchived = opts.includeArchived !== false;
      const results = [];
      ids.forEach(tid => {
        const th = s.threads[tid];
        if (!th || (!includeArchived && th.archived)) return;
        th.messages.forEach((msg, index) => {
          if (msg && typeof msg.text === 'string' && msg.text.toLowerCase().indexOf(q) >= 0) {
            results.push({ threadId: tid, msg: msg, index: index });
          }
        });
      });
      return results;
    },

    markRead(threadId) {
      if (!this.isValidThread(threadId)) return;
      const th = this.getThread(threadId);
      if (!th) return;
      if (th.unread === 0 && th.lastReadAt > 0) return;
      this.update(s => {
        s.threads[threadId].unread = 0;
        s.threads[threadId].lastReadAt = Date.now();
      });
    },

    totalUnread() {
      const s = ensureLoaded();
      return THREAD_IDS.reduce((sum, id) => sum + (s.threads[id].archived ? 0 : (s.threads[id].unread || 0)), 0);
    },

    clearThread(threadId) {
      if (!this.isValidThread(threadId)) return;
      this.update(s => {
        const bg = s.threads[threadId].bg;
        s.threads[threadId] = defaultThread();
        s.threads[threadId].bg = bg;
      });
    },

    resetAll() {
      state = defaults();
      persist();
      notify();
    }
  };
})();
