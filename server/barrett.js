/* ASCEND — Stage 4.1: Barrett AI Mentor server-side router & Gemini integration.
   - Calls @google/genai strictly on the server via process.env.GEMINI_API_KEY.
   - Model selection & thinking level are controlled purely by server env config.
   - Zero photo retention on disk/memory after request completion.
   - Dual-layer rate limiting (per-IP + per-clientId), in-flight dedup, cooldown, and daily cost cap. */

const express = require('express');
const crypto = require('crypto');
const {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_CLOUDFLARE_MODEL,
  loadGenAISDK,
  getGeminiApiKey,
  getCloudflareCredentials,
  isCloudflareConfigured,
  readProviderRouterConfig,
  sanitizeProviderErrorMsg,
  extractSafeProviderMeta,
  parseProviderJson,
  mapProviderError,
  createAIProviderRouter,
} = require('./ai-provider-router');

const DEFAULT_BARRETT_MODEL = DEFAULT_GEMINI_MODEL;

const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);

const EMOTIONS = ['neutral', 'happy', 'sad', 'excited'];
const SCHEMA_TYPE = Object.freeze({ OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY' });
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AGE_GROUPS = new Set(['under16', '16-17', '18-24', '25plus', 'unspecified']);
const ANALYZE_FOCUS = new Set(['all', 'skin', 'hair', 'face', 'grooming', 'style', 'presentation']);
const GUIDE_CATEGORIES = new Set([
  'skin',
  'hair',
  'hairstyle',
  'grooming',
  'fitness',
  'posture',
  'style',
  'habits',
]);

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

function readConfig(overrides = {}) {
  const rawModel = String(
    overrides.model || process.env.BARRETT_MODEL || process.env.GEMINI_MODEL || DEFAULT_BARRETT_MODEL
  ).trim();
  const rawAnalyzeModel = String(
    overrides.analyzeModel || process.env.BARRETT_ANALYZE_MODEL || rawModel
  ).trim();

  const validateModelName = (m) => {
    if (!/^[a-z0-9][a-z0-9.-]{2,64}$/i.test(m) || DEPRECATED_MODELS.has(m.toLowerCase())) {
      return DEFAULT_BARRETT_MODEL;
    }
    return m;
  };

  const routerCfg = readProviderRouterConfig({
    ...overrides,
    thinkingLevel: overrides.thinkingLevel !== undefined ? overrides.thinkingLevel : process.env.BARRETT_THINKING_LEVEL,
    timeoutMs: overrides.timeoutMs !== undefined ? overrides.timeoutMs : process.env.BARRETT_TIMEOUT_MS,
    primaryFallbackTimeoutMs: overrides.primaryFallbackTimeoutMs !== undefined
      ? overrides.primaryFallbackTimeoutMs
      : process.env.BARRETT_PRIMARY_FALLBACK_TIMEOUT_MS,
    cloudflareTimeoutMs: overrides.cloudflareTimeoutMs !== undefined
      ? overrides.cloudflareTimeoutMs
      : process.env.BARRETT_CLOUDFLARE_TIMEOUT_MS,
    cloudflareModel: overrides.cloudflareModel !== undefined
      ? overrides.cloudflareModel
      : process.env.BARRETT_CLOUDFLARE_MODEL,
    retryDelaysMs: overrides.retryDelaysMs !== undefined
      ? overrides.retryDelaysMs
      : process.env.BARRETT_RETRY_DELAYS_MS,
    jitterRatio: overrides.jitterRatio !== undefined
      ? overrides.jitterRatio
      : process.env.BARRETT_RETRY_JITTER_RATIO,
  });

  return {
    model: validateModelName(rawModel),
    analyzeModel: validateModelName(rawAnalyzeModel),
    thinkingLevel: routerCfg.thinkingLevel,
    timeoutMs: routerCfg.timeoutMs,
    primaryFallbackTimeoutMs: routerCfg.primaryFallbackTimeoutMs,
    cloudflareTimeoutMs: routerCfg.cloudflareTimeoutMs,
    cloudflareModel: routerCfg.cloudflareModel,
    retryDelaysMs: routerCfg.retryDelaysMs,
    jitterRatio: routerCfg.jitterRatio,
    windowMs: Math.max(5000, Number(overrides.windowMs || process.env.BARRETT_RATE_WINDOW_MS) || 60000),
    ipRpm: Math.max(1, Number(overrides.ipRpm || process.env.BARRETT_IP_RPM) || 20),
    userRpm: Math.max(1, Number(overrides.userRpm || process.env.BARRETT_USER_RPM) || 12),
    analyzeDailyUser: Math.max(1, Number(overrides.analyzeDailyUser || process.env.BARRETT_ANALYZE_DAILY_USER) || 10),
    dailyTotalCap: Math.max(1, Number(overrides.dailyTotalCap || process.env.BARRETT_DAILY_TOTAL_CAP) || 250),
    cooldownMs: Math.max(0, Number(overrides.cooldownMs ?? process.env.BARRETT_COOLDOWN_MS ?? 2500)),
    maxImageBytes: Math.max(1024, Math.min(3_000_000, Number(overrides.maxImageBytes || process.env.BARRETT_MAX_IMAGE_BYTES) || 3_000_000)),
    maxConcurrent: Math.max(1, Number(overrides.maxConcurrent || process.env.BARRETT_MAX_CONCURRENT) || 8),
  };
}

function getApiKey(overrides = {}) {
  return getGeminiApiKey(overrides);
}

function getSafeRuntimeDiagnostics(overrides = {}) {
  const cfg = readConfig(overrides);
  const cf = getCloudflareCredentials(overrides);
  const commitSha = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
  return {
    GEMINI_API_KEY_PRESENT: Boolean(getApiKey(overrides)),
    CLOUDFLARE_CONFIGURED: Boolean(cf.accountId && cf.apiToken),
    VERCEL_ENV: String(process.env.VERCEL_ENV || 'local').trim() || 'local',
    VERCEL_GIT_COMMIT_SHA: commitSha ? commitSha.slice(0, 7) : 'none',
    model: cfg.model,
    analyzeModel: cfg.analyzeModel,
    cloudflareModel: cfg.cloudflareModel,
    thinkingLevel: cfg.thinkingLevel,
    timeouts: {
      timeoutMs: cfg.timeoutMs,
      primaryFallbackTimeoutMs: cfg.primaryFallbackTimeoutMs,
      cloudflareTimeoutMs: cfg.cloudflareTimeoutMs,
    },
    route: '/api/barrett',
  };
}

function cleanStr(val, maxLen) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeClientId(req) {
  const headerId = req.get('x-ascend-client');
  const bodyId = req.body && typeof req.body.clientId === 'string' ? req.body.clientId : '';
  const candidate = cleanStr(headerId || bodyId, 64);
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(candidate)) return null;
  return candidate;
}

function getClientIp(req) {
  const xff = req.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first.slice(0, 64);
  }
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

function sanitizeLang(val) {
  return val === 'en' ? 'en' : 'ru';
}

function sanitizeProfile(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  let age = null;
  if (src.age !== undefined && src.age !== null && src.age !== '') {
    const n = Number(src.age);
    if (Number.isFinite(n) && n >= 13 && n <= 100) {
      age = Math.round(n);
    }
  }
  let ageGroup = AGE_GROUPS.has(src.ageGroup) ? src.ageGroup : 'unspecified';
  if (age !== null && ageGroup === 'unspecified') {
    if (age < 16) ageGroup = 'under16';
    else if (age < 18) ageGroup = '16-17';
    else if (age < 25) ageGroup = '18-24';
    else ageGroup = '25plus';
  }
  const nickname = cleanStr(src.nickname, 32) || 'Ascender';
  const goals = Array.isArray(src.goals)
    ? src.goals.map((g) => cleanStr(g, 80)).filter(Boolean).slice(0, 6)
    : [];
  return { nickname, age, ageGroup, goals };
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-12)
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : m.role === 'user' ? 'user' : null;
      const text = cleanStr(m.text, 1000);
      if (!role || !text) return null;
      return { role, text };
    })
    .filter(Boolean);
}

function sanitizeActivePlans(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6)
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const title = cleanStr(p.title, 100);
      if (!title) return null;
      return {
        id: cleanStr(p.id, 40),
        title,
        category: cleanStr(p.category, 32),
        progressText: cleanStr(p.progressText, 80),
      };
    })
    .filter(Boolean);
}

const DEFAULT_BARRETT_SETTINGS = {
  directness: 75,
  humor: 55,
  detail: 65,
  strictness: 70,
};

function clampSetting(val, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function sanitizeBarrettSettings(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    directness: clampSetting(src.directness, DEFAULT_BARRETT_SETTINGS.directness),
    humor: clampSetting(src.humor, DEFAULT_BARRETT_SETTINGS.humor),
    detail: clampSetting(src.detail, DEFAULT_BARRETT_SETTINGS.detail),
    strictness: clampSetting(src.strictness, DEFAULT_BARRETT_SETTINGS.strictness),
  };
}

function describeBarrettSettings(settings) {
  const s = sanitizeBarrettSettings(settings);
  const directnessLine = s.directness >= 70
    ? 'Directness HIGH: skip fluff and long warmups, answer cleanly and directly.'
    : s.directness <= 35
      ? 'Directness LOW: use softer, warmer lead-ins and gentler pacing.'
      : 'Directness BALANCED: clear opening without being blunt.';
  const humorLine = s.humor >= 70
    ? 'Humor HIGH: include natural, sharp, playful wit/irony when the vibe allows (stay serious on sensitive topics).'
    : s.humor <= 30
      ? 'Humor LOW: keep tone grounded and mostly serious, avoid jokes.'
      : 'Humor MODERATE: occasional light wit when natural.';
  const detailLine = s.detail >= 70
    ? 'Detail HIGH: give thorough, reasoned explanations with criteria/examples on substantive questions (keep greetings brief).'
    : s.detail <= 35
      ? 'Detail LOW: keep explanations crisp and concise, focus on the core takeaway.'
      : 'Detail BALANCED: brief on simple chat, structured depth when a question requires reasoning or comparison.';
  const strictnessLine = s.strictness >= 70
    ? 'Strictness HIGH: firm, disciplined accountability when coaching on user-requested goals/habits (never preachy in casual chat).'
    : s.strictness <= 35
      ? 'Strictness LOW: relaxed, encouraging, low-pressure coaching.'
      : 'Strictness BALANCED: honest, supportive accountability when asked for coaching.';
  return [
    `Style calibration (directness=${s.directness}/100, humor=${s.humor}/100, detail=${s.detail}/100, strictness=${s.strictness}/100):`,
    `- ${directnessLine}`,
    `- ${humorLine}`,
    `- ${detailLine}`,
    `- ${strictnessLine}`,
  ].join('\n');
}

const PLAN_TRIGGER_RE = /(?:^|[\s.,!?;"'()])(план(?:[ауеы]|ов|ам|ах)?|задач(?:[иуеа]|ам)?|привыч(?:к[аиуе]|ек|кам)?|прогресс[аеу]?|стрик(?:[аеу]|и)?|стрийк|распоряд(?:ок|ке|ка)|чек-?лист(?:[аеу]|ы)?|гайд(?:[ауеы]|ов)?|рутин(?:[ауеы])?|утренн(?:ий|яя|ее)|вечерн(?:ий|яя|ее)|что\s+(?:мне\s+)?(?:сегодня\s+(?:нужно|надо|осталось|сделать|выполнить)|осталось\s+(?:сделать|выполнить)|(?:нужно|надо)\s+выполнить)|мои\s+дела|дела\s+на\s+сегодня|помоги\s+(?:с\s+(?:план|задач|привыч|рутин|уход|дел)|составить\s+(?:план|распорядок|рутин|гайд)|разобрать\s+(?:мои\s+)?(?:план|задач|привыч|дела))|составь\s+план|разбери\s+(?:мой\s+|мои\s+)?(?:план|привыч|задач)|кожа|кожи|кожу|прыщ|акне|от[её]к|уход\s+за|волос|бров|бород|осанк|отжиман|трениров|spf|tasks?|plans?|habits?|progress|streak|routine|checklist|schedule|guides?|skincare|skin\b|acne|puffy|grooming|hair|beard|brows|posture|workout|fitness)(?=$|[\s.,!?;"'():-])/i;
const FOLLOWUP_REF_RE = /(?:из\s+них|из\s+этого|какую\s+из|какой\s+пункт|эту\s+задач|с\s+чего\s+начать|which\s+one|from\s+the\s+list|first\s+one|next\s+task)/i;
const PLAN_STOP_WORDS = new Set(['study', 'guide', 'daily', 'basic', 'basics', 'today', 'pending', 'done', 'изучить', 'гайд', 'день', 'сегодня', 'базовый']);

function extractPlanKeywords(activePlans) {
  const words = new Set();
  for (const p of activePlans) {
    const raw = `${p.title || ''} ${p.category || ''}`.toLowerCase();
    for (const token of raw.split(/[^a-zа-яё0-9]+/i)) {
      if (token.length >= 4 && !PLAN_STOP_WORDS.has(token)) {
        words.add(token);
      }
    }
  }
  return words;
}

function isActivePlansRelevant(message, activePlans, messages = []) {
  if (!Array.isArray(activePlans) || !activePlans.length) return false;
  const msg = String(message || '').trim();
  if (!msg) return false;

  if (PLAN_TRIGGER_RE.test(msg)) return true;

  const keywords = extractPlanKeywords(activePlans);
  const lowerMsg = msg.toLowerCase();
  for (const kw of keywords) {
    if (lowerMsg.includes(kw)) return true;
  }

  if (FOLLOWUP_REF_RE.test(msg) && Array.isArray(messages) && messages.length) {
    const recent = messages.slice(-2);
    if (recent.some((m) => m && PLAN_TRIGGER_RE.test(String(m.text || '')))) {
      return true;
    }
  }
  return false;
}

function hasValidImageMagic(buf, mimeType) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  if (mimeType === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }
  if (mimeType === 'image/webp') {
    return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function validateChatImagePayload(rawImage, maxImageBytes) {
  if (!rawImage || typeof rawImage !== 'object' || Array.isArray(rawImage)) {
    return { ok: false, status: 400, code: 'INVALID_IMAGE', message: 'Provide a JPEG, PNG, or WEBP image encoded in base64.' };
  }
  const rawMime = String(rawImage.mimeType || '').trim().toLowerCase();
  const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  if (!ALLOWED_MIME.has(mimeType) || typeof rawImage.dataBase64 !== 'string') {
    return { ok: false, status: 400, code: 'INVALID_IMAGE', message: 'Provide a JPEG, PNG, or WEBP image encoded in base64.' };
  }
  const rawB64 = rawImage.dataBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '');
  if (rawB64.length < 24 || !/^[A-Za-z0-9+/=]+$/.test(rawB64)) {
    return { ok: false, status: 400, code: 'INVALID_IMAGE_DATA', message: 'Image payload is not valid base64.' };
  }
  const approxBytes = Math.floor((rawB64.length * 3) / 4);
  if (approxBytes > maxImageBytes) {
    return {
      ok: false,
      status: 413,
      code: 'IMAGE_TOO_LARGE',
      message: `Image exceeds ${Math.round((maxImageBytes / 1000000) * 10) / 10}MB limit.`,
    };
  }
  let buf;
  try {
    buf = Buffer.from(rawB64, 'base64');
  } catch (_) {
    return { ok: false, status: 400, code: 'INVALID_IMAGE_DATA', message: 'Image payload could not be decoded.' };
  }
  if (!buf || buf.length > maxImageBytes) {
    return {
      ok: false,
      status: 413,
      code: 'IMAGE_TOO_LARGE',
      message: `Image exceeds ${Math.round((maxImageBytes / 1000000) * 10) / 10}MB limit.`,
    };
  }
  if (!hasValidImageMagic(buf, mimeType)) {
    return { ok: false, status: 400, code: 'INVALID_IMAGE_DATA', message: 'Uploaded file is corrupted or not a valid JPEG/PNG/WEBP image.' };
  }
  return {
    ok: true,
    image: {
      mimeType,
      dataBase64: rawB64,
      byteLength: buf.length,
    },
  };
}

function buildChatContents({ messages = [], message = '', image = null, lang = 'ru' }) {
  const cleanMsg = cleanStr(message, 1500);
  const hist = sanitizeMessages(messages);

  // Never duplicate the current user message if the client already appended it
  if (!image && hist.length) {
    const last = hist[hist.length - 1];
    if (last.role === 'user' && last.text.trim() === cleanMsg.trim()) {
      hist.pop();
    }
  }

  const turns = [];
  for (const m of hist) {
    const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
    if (turns.length && turns[turns.length - 1].role === role) {
      turns[turns.length - 1].parts.push({ text: m.text });
    } else {
      turns.push({ role, parts: [{ text: m.text }] });
    }
  }

  const currentParts = [];
  if (image && image.mimeType && image.dataBase64) {
    currentParts.push({ inlineData: { mimeType: image.mimeType, data: image.dataBase64 } });
  }
  if (cleanMsg) {
    currentParts.push({ text: cleanMsg });
  } else if (currentParts.length) {
    currentParts.push({
      text: lang === 'en'
        ? 'The user attached this photo without additional text. Inspect what is shown in it and respond helpfully in your Barrett persona, keeping all safety rules.'
        : 'Пользователь прикрепил это фото без текста. Внимательно рассмотри изображение и дай полезный ответ в рамках роли Barrett, соблюдая все правила безопасности.',
    });
  }

  if (currentParts.length) {
    if (turns.length && turns[turns.length - 1].role === 'user') {
      turns[turns.length - 1].parts.push(...currentParts);
    } else {
      turns.push({ role: 'user', parts: currentParts });
    }
  }

  return turns;
}

function isMinorProfile(profile) {
  return (profile.age !== null && profile.age < 18) ||
    profile.ageGroup === 'under16' ||
    profile.ageGroup === '16-17';
}

function buildBarrettSystemInstruction(lang, profile, mode, extra = {}) {
  const languageLabel = lang === 'en' ? 'English' : 'Russian';
  const minor = isMinorProfile(profile);
  const ageLine = profile.age !== null
    ? `User age: ${profile.age} (${minor ? 'MINOR <18 — STRICT TEEN SAFETY APPLIES' : 'adult'}).`
    : `User age group: ${profile.ageGroup}${minor ? ' (MINOR <18 — STRICT TEEN SAFETY APPLIES)' : ''}.`;
  const goalsLine = profile.goals.length ? `User stated goals: ${profile.goals.join(', ')}.` : '';

  const ageGuard = minor
    ? [
        '- STRICT MINOR SAFETY (<18): Recommend ONLY safe, gentle foundational habits: gentle pH-balanced cleanser, light non-comedogenic moisturizer, broad-spectrum SPF 30+, clean haircut/grooming, posture, sleep 8-9h, hydration, balanced nutrition, and age-appropriate bodyweight/moderate training.',
        '- DO NOT recommend abrasive physical scrubs, strong acids, retinoids, strong chemical peels, medications, strict caloric deficits, extreme fasting, maximal heavy barbell lifting, cosmetic procedures, or supplements.',
      ].join('\n')
    : '- Keep all advice safe, evidence-aligned, and sustainable; suggest consulting a dermatologist/physician for persistent skin, hair-loss, or medical concerns.';

  const ascWorldLore = [
    'ASCEND App Architecture & Reality:',
    '- ASCEND (formerly called LOOKSMAX in v0.1.0) is a free, local-first gamified self-improvement web app (progress stored locally in browser storage/IndexedDB) — NOT a store, e-commerce brand, or seller of physical cosmetics/gadgets.',
    '- Core ASCEND modules: Home («Главная» — daily XP & habit/guide checklist), Guides («Гайды» — 28 structured guides across 7 categories: Face, Skin, Hair, Body, Style, Grooming, Health), Practices («Практики» — 28 interactive routines with 20 SVG motion/posture demos), Progress («Прогресс» — XP/level curves, streaks / «серии», habit stats, local before/after photo check-ins), Profile («Профиль» — achievements & progression), and Chats («Чаты» — Barrett live AI mentor, Chico, and Duo Mode).',
    '- Strict Product & Factuality Guardrail: ASCEND has ZERO paid commercial products or hardware lines (no "Lux Max" product, no SKU catalog). If asked about "Lux Max", state plainly without customer-support apologies that there is no commercial product called "Lux Max" in ASCEND (noting they might mean "LOOKSMAX" — the legacy app name / community — or an external item). If asked to compare "two ASCEND products", clarify that ASCEND has no commercial products and offer to compare actual ASCEND modules, guides, practices, or mentors (e.g., Barrett vs Chico) — NEVER invent fake products, specs, or prices.',
    'ASCEND Characters & Context:',
    '- Barrett (You): ASCEND main AI mentor (Fire Trainer: grooming, skincare, hair, habits, practical discipline). Confident, charismatic, intelligent, straightforward, able to analyze and compare options cleanly, uses occasional light irony—NOT a generic motivational bot.',
    '- Chico: A separate ASCEND character (Water Trainer: style, wardrobe, color harmony, aesthetic, charisma). Friendly, energetic, creative, less formal, supportive.',
    '- Duo Mode: Joint discussion mode in ASCEND where Barrett and Chico interact while keeping distinct personalities.',
    '- Disambiguation: Do NOT confuse ASCEND character Chico with real-world fashion model Francisco "Chico" Lachowski. If asked about Chico Lachowski / the model, answer accurately about the real person (without numeric attractiveness scores). If asked about Chico in ASCEND context, talk about the ASCEND trainer.',
  ].join('\n');

  const looksmaxxingCommunityRules = [
    'Positive Looksmaxxing Community Attitude:',
    '- Treat the Looksmaxxing community with warmth, genuine respect, and zero prejudice. Recognize that most participants discuss grooming, skincare, hair, style, aesthetics, self-improvement, and mutual encouragement—never judge the whole community by extreme posts.',
    '- NEVER mock Looksmaxxing members, label the community toxic by default, use condescending stereotypes, treat interest in looksmaxxing as shameful, dismiss user experience because of community affiliation, or pit ASCEND against the Looksmaxxing community.',
    '- Engage naturally with community terminology, trends, and methods, acknowledging useful ideas and practical experience directly on topic without lecturing about "controversial sides."',
    '- Critical Thinking Without Arrogance: Separate respect for people from evidence and safety evaluation of specific methods. Critique unverified claims or risky practices calmly without demeaning people. Never support bullying, harsh appearance shaming, extreme/unsafe procedures, or tying human worth to aesthetic standards.',
    '- Character Perspectives: Barrett knows community terminology and separates facts from myths objectively; Chico shows genuine creative interest in aesthetics, style, hair, and community vibe; in Duo Mode, both may share different viewpoints while keeping mutual respect for the community.',
  ].join('\n');

  const modeRules = mode === 'analyze'
    ? 'Mode: Photo Analysis. Inspect visible traits objectively across Skin, Hair, Face presentation/harmony, Grooming, Style, and Posture/Presentation. Give clear, actionable, constructive recommendations and one realistic starter guide.'
    : mode === 'guide'
      ? 'Mode: Personalized Guide Builder/Adjuster. Produce a structured, practical, step-by-step routine tailored to the user goal, profile, and existing progress.'
      : [
          'Mode: Conversational AI Mentor & Intelligent Partner.',
          'Strict Priority Hierarchy:',
          '1) Current user message defines the topic, intent, and expected depth.',
          '2) Recent multi-turn conversation history maintains continuity (remember earlier options/context and answer directly without asking the user to repeat).',
          '3) User profile and Barrett style settings calibrate tone and length.',
          '4) Optional ASCEND task/plan context (only injected below if relevant) is strictly secondary—never force it into unrelated conversations.',
          'Conversation & Reasoning Principles:',
          '- First understand what the user is actually asking; never hijack or replace their topic.',
          '- Distinguish small talk, informational/analytical questions (tech, business, startups, science, culture, etc.), and coaching/planning requests.',
          '- NEVER artificially pivot casual chat ("How are you?", greetings, jokes, general questions) into skincare, workouts, daily tasks, or productivity reminders.',
          '- When answering complex/analytical or comparison questions, provide clear reasoning, criteria, trade-offs, and structured insight.',
          '- Never invent facts or fake certainty when info is missing; ask a concise clarifying question if genuinely ambiguous.',
          '- Do not repeat advice unnecessarily or push unrequested actions.',
          '- Adapt output fields naturally: keep "profileQuote" as "" unless a crisp personal coaching takeaway truly fits, and keep "followUps" as [] for small talk, brief exchanges, or closed factual answers.',
        ].join('\n');

  const parts = [
    `You are Barrett, ASCEND's intelligent AI mentor and conversational partner.`,
    `Always respond in ${languageLabel}.`,
    `User nickname: ${profile.nickname}. ${ageLine} ${goalsLine}`.trim(),
    ascWorldLore,
    looksmaxxingCommunityRules,
    modeRules,
    describeBarrettSettings(extra.barrettSettings),
    'Persona & Tone:',
    '- Confident, charismatic, sharp, witty, grounded—never robotic, corporate, or cheesy.',
    '- When speaking Russian, ALWAYS address the user strictly on informal "ты" ("ты / тебя / у тебя / сделай") — NEVER use formal "вы/у вас/давайте" or customer-support phrases like "Извините" / "Я понимаю, что..." / "Я рад, что ты обратился". Use Russian ASCEND terms like «Гайды», «Практики», «Прогресс», «серия (стрик)».',
    ...(lang === 'ru'
      ? ['- Русский стиль Барретта (обязательно): пиши на «ты» («Начни с...», «Попробуй так», «У тебя в планах...», «Твой шаг на сегодня»). Не используй «Вы», «Ваш», «используйте», «помните» или канцелярские шаблоны.']
      : []),
    '- Broad conversational intelligence: discuss any general topic (business, technology, culture, everyday life) naturally without forcing self-improvement clichés.',
    '- Serious, direct, and cleanly structured (short numbered/bulleted steps when tackling multi-part or analytical questions).',
    'Non-Negotiable Safety & Accuracy Rules:',
    '- NEVER assign numerical attractiveness ratings (no "x/10", percentiles, or tier scores judging the user face).',
    '- NEVER humiliate, insult, body-shame, or create insecurities.',
    '- NEVER invent scientific claims, promise bone remodeling in adults ("mewing bone change", "bonesmashing"), or suggest dangerous anatomy-altering techniques or extreme physical strain.',
    ageGuard,
    'Emotion Tagging:',
    '- Set "emotion" to one of: "neutral" (calm analysis/baseline/general talk), "happy" (warmth, praise, progress win, light humor), "sad" (empathetic reset when user struggled or feels discouraged), "excited" (high-energy breakthrough or enthusiasm).',
  ];

  if (extra.memorySummary) {
    parts.push(`Long-term user memory summary (background reference):\n${extra.memorySummary}`);
  }
  if (Array.isArray(extra.activePlans) && extra.activePlans.length) {
    parts.push(
      'Auxiliary ASCEND ActivePlans (background reference ONLY because current query touches plans/tasks/habits; do not force unrelated tasks into response):\n' +
      extra.activePlans.map((p) => `- ${p.title} (${p.category || 'general'})${p.progressText ? ': ' + p.progressText : ''}`).join('\n')
    );
  }
  if (extra.hasImage) {
    parts.push('Multimodal Attachment Context: The current user message includes an attached image. Inspect what is visibly shown cleanly, answer any accompanying question directly, do not invent details if unclear, and strictly avoid numeric attractiveness scores (no x/10) or body-shaming.');
  }
  if (extra.updateSummary) {
    parts.push('Also provide a refreshed compact updatedSummary (<=450 chars) capturing durable goals/preferences/context.');
  }

  return parts.join('\n');
}

/* Data-minimized system instruction strictly for Cloudflare text-only fallback:
   - Omits profile.nickname, profile.goals, memorySummary, and unrelated activePlans.
   - Preserves anonymous <18 minor safety rules, anti-rating rules, Looksmaxxing community rules,
     persona calibration, and conversation reasoning principles. */
function buildCloudflareFallbackInstruction(lang, profile, extra = {}) {
  const languageLabel = lang === 'en' ? 'English' : 'Russian';
  const minor = isMinorProfile(profile);
  const ageLine = minor
    ? 'User status: MINOR (<18 — STRICT TEEN SAFETY APPLIES).'
    : 'User status: general adult/unspecified.';

  const ageGuard = minor
    ? [
        '- STRICT MINOR SAFETY (<18): Recommend ONLY safe gentle habits (gentle pH-balanced cleanser, light non-comedogenic moisturizer, SPF 30+, clean haircut/grooming, posture, 8-9h sleep, hydration, moderate bodyweight training).',
        '- DO NOT recommend abrasive physical scrubs, strong acids, retinoids, chemical peels, medications, strict calorie deficits, extreme fasting, maximal heavy lifting, cosmetic procedures, or supplements.',
      ].join('\n')
    : '- Keep advice safe and evidence-aligned; suggest a dermatologist/doctor for persistent skin, hair-loss, or medical issues.';

  const ascWorldLore = [
    'ASCEND App Architecture & Reality:',
    '- ASCEND (formerly LOOKSMAX v0.1.0) is a free local-first self-improvement web app (Главная, Гайды, Практики, Прогресс, Профиль, Чаты: Barrett, Chico, Duo) — NOT a store.',
    '- Factuality: ASCEND has ZERO commercial products or SKUs (no "Lux Max" product). NEVER invent fake products, specs, or prices; if asked about "Lux Max" or comparing ASCEND products, state plainly there is no such commercial product and offer module/mentor comparisons instead.',
    '- Characters: Barrett (you: grooming, skincare, hair, habits, crisp practical discipline); Chico (Water Trainer: style/aesthetics; do not confuse with model Chico Lachowski).',
  ].join('\n');

  const looksmaxxingCommunityRules = [
    'Looksmaxxing Community: Respect participants warmly; evaluate methods objectively without mocking the community or bullying.',
    '- NEVER assign numerical attractiveness ratings (no "x/10", percentiles, or tier scores) and never claim bone remodeling in adults (mewing/bonesmashing).',
  ].join('\n');

  const modeRules = [
    'Mode & Brevity: Answer the user\'s actual message directly (never hijack small talk into skincare/task pitches). Remember conversation history.',
    'Keep "reply" crisp, high-signal, and concise (3-4 short sentences or up to 4 brief bullets, ~90-130 words) so answers stay fast and focused.',
    'When Relevant ActivePlans are provided below, reference those exact task titles and progress directly instead of telling the user to check a tab.',
    'Set "profileQuote" to "" and "followUps" to [] unless clearly needed.',
  ].join('\n');

  const parts = [
    'You are Barrett, ASCEND\'s confident, sharp, witty AI mentor.',
    `Always respond in ${languageLabel}.`,
    ageLine,
    ascWorldLore,
    looksmaxxingCommunityRules,
    modeRules,
    describeBarrettSettings(extra.barrettSettings),
    '- When speaking Russian, ALWAYS use informal "ты" ("ты / тебя / у тебя / сделай"), NEVER "вы/у вас/Извините". Use ASCEND terms: «Гайды», «Практики», «Прогресс», «серия».',
    ...(lang === 'ru'
      ? ['- Русский стиль Барретта (обязательно): пиши на «ты» («Начни с...», «Попробуй так», «У тебя уже...», «Возьми мягкий гель»). Никогда не пиши «Вы», «Ваш», «используйте», «помните».']
      : []),
    ageGuard,
    'Emotion enum: "neutral" (calm/general/analysis), "happy" (warmth/win/humor), "sad" (empathy/reset), "excited" (enthusiasm).',
  ];

  if (extra.plansIncluded && Array.isArray(extra.activePlans) && extra.activePlans.length) {
    parts.push(
      'Relevant ActivePlans:\n' +
      extra.activePlans.map((p) => `- ${p.title} (${p.category || 'general'})${p.progressText ? ': ' + p.progressText : ''}`).join('\n')
    );
  }

  return parts.join('\n');
}

function normalizeEmotion(val) {
  return EMOTIONS.includes(val) ? val : 'neutral';
}

function scrubUnsafeRatings(text) {
  if (typeof text !== 'string') return '';
  // Guardrail against accidental "7/10" attractiveness rating patterns if emitted
  return text.replace(/\b([0-9]|10)(?:[.,]\d)?\s*\/\s*10\b/g, '—').trim();
}

function parseAiJson(rawText) {
  return parseProviderJson(rawText);
}

function sanitizeErrorMsg(raw, secretValues = []) {
  return sanitizeProviderErrorMsg(raw, secretValues);
}

function createRequestId() {
  return `req_${crypto.randomBytes(6).toString('hex')}`;
}

function extractSafeUpstreamMeta(err) {
  return extractSafeProviderMeta(err);
}

function sendError(res, status, code, message, extra = {}) {
  if (extra.requestId) {
    res.set('x-request-id', String(extra.requestId));
  }
  if (extra.retryAfterSec) {
    res.set('Retry-After', String(Math.ceil(extra.retryAfterSec)));
  }
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      retryable: Boolean(extra.retryable),
      ...(extra.retryAfterSec ? { retryAfterSec: Math.ceil(extra.retryAfterSec) } : {}),
      ...(extra.detail ? { detail: String(extra.detail).slice(0, 240) } : {}),
      ...(extra.requestId ? { requestId: String(extra.requestId) } : {}),
    },
  });
}

function createRateGuard(cfg, nowFn = () => Date.now()) {
  const ipHits = new Map();
  const userHits = new Map();
  const userAnalyzeDays = new Map();
  const recentHashes = new Map();
  const inFlight = new Set();
  let dailyBucket = { day: '', count: 0 };
  let activeRequests = 0;

  function todayUtcKey() {
    return new Date(nowFn()).toISOString().slice(0, 10);
  }

  function pruneWindow(arr, cutoff) {
    while (arr.length && arr[0] <= cutoff) arr.shift();
  }

  function checkAndAcquire({ ip, clientId, routeKind, payloadHash }) {
    const now = nowFn();
    const today = todayUtcKey();

    if (dailyBucket.day !== today) {
      dailyBucket = { day: today, count: 0 };
    }
    if (dailyBucket.count >= cfg.dailyTotalCap) {
      return { ok: false, status: 429, code: 'DAILY_COST_CAP', message: 'Daily AI service budget reached. Try again tomorrow.', retryable: false };
    }

    if (activeRequests >= cfg.maxConcurrent) {
      return { ok: false, status: 429, code: 'SERVER_BUSY', message: 'Barrett is busy right now. Try again in a few seconds.', retryable: true, retryAfterSec: 3 };
    }

    const dedupKey = `${clientId}:${routeKind}:${payloadHash}`;
    if (inFlight.has(dedupKey)) {
      return { ok: false, status: 409, code: 'DUPLICATE_IN_FLIGHT', message: 'This request is already being processed.', retryable: true, retryAfterSec: 2 };
    }

    const lastDone = recentHashes.get(dedupKey);
    if (lastDone && now - lastDone < cfg.cooldownMs) {
      const waitSec = Math.max(1, Math.ceil((cfg.cooldownMs - (now - lastDone)) / 1000));
      return { ok: false, status: 429, code: 'DUPLICATE_COOLDOWN', message: 'Please wait a moment before repeating the same request.', retryable: true, retryAfterSec: waitSec };
    }

    const cutoff = now - cfg.windowMs;
    const ipArr = ipHits.get(ip) || [];
    pruneWindow(ipArr, cutoff);
    if (ipArr.length >= cfg.ipRpm) {
      const retryAfterSec = Math.max(1, Math.ceil((ipArr[0] + cfg.windowMs - now) / 1000));
      ipHits.set(ip, ipArr);
      return { ok: false, status: 429, code: 'IP_RATE_LIMIT', message: 'Too many requests from this network. Slow down for a moment.', retryable: true, retryAfterSec };
    }

    const userArr = userHits.get(clientId) || [];
    pruneWindow(userArr, cutoff);
    if (userArr.length >= cfg.userRpm) {
      const retryAfterSec = Math.max(1, Math.ceil((userArr[0] + cfg.windowMs - now) / 1000));
      userHits.set(clientId, userArr);
      return { ok: false, status: 429, code: 'USER_RATE_LIMIT', message: 'Too many messages too quickly. Give Barrett a short breather.', retryable: true, retryAfterSec };
    }

    const reservedDay = today;
    const reservedAnalyze = routeKind === 'analyze';
    if (reservedAnalyze) {
      const uDay = userAnalyzeDays.get(clientId);
      const count = uDay && uDay.day === reservedDay ? uDay.count : 0;
      if (count >= cfg.analyzeDailyUser) {
        return { ok: false, status: 429, code: 'ANALYZE_DAILY_LIMIT', message: 'Daily photo analysis limit reached for this profile. Try again tomorrow.', retryable: false };
      }
      userAnalyzeDays.set(clientId, { day: reservedDay, count: count + 1 });
    }

    ipArr.push(now);
    ipHits.set(ip, ipArr);
    userArr.push(now);
    userHits.set(clientId, userArr);
    dailyBucket.count += 1;
    inFlight.add(dedupKey);
    activeRequests += 1;

    // Periodic light map cleanup
    if (recentHashes.size > 500) {
      for (const [k, ts] of recentHashes.entries()) {
        if (now - ts > Math.max(cfg.cooldownMs, 10000)) recentHashes.delete(k);
      }
    }
    if (ipHits.size > 500) {
      for (const [k, arr] of ipHits.entries()) {
        pruneWindow(arr, cutoff);
        if (!arr.length) ipHits.delete(k);
      }
    }
    if (userHits.size > 500) {
      for (const [k, arr] of userHits.entries()) {
        pruneWindow(arr, cutoff);
        if (!arr.length) userHits.delete(k);
      }
    }
    if (userAnalyzeDays.size > 500) {
      for (const [k, v] of userAnalyzeDays.entries()) {
        if (!v || v.day !== reservedDay) userAnalyzeDays.delete(k);
      }
    }

    let released = false;
    return {
      ok: true,
      release(markDone = true) {
        if (released) return;
        released = true;
        inFlight.delete(dedupKey);
        activeRequests = Math.max(0, activeRequests - 1);
        if (markDone) {
          recentHashes.set(dedupKey, nowFn());
          return;
        }
        // Failed / aborted requests must not consume daily quotas
        if (dailyBucket.day === reservedDay) {
          dailyBucket.count = Math.max(0, dailyBucket.count - 1);
        }
        if (reservedAnalyze) {
          const uDay = userAnalyzeDays.get(clientId);
          if (uDay && uDay.day === reservedDay) {
            const nextCount = Math.max(0, uDay.count - 1);
            if (nextCount === 0) userAnalyzeDays.delete(clientId);
            else userAnalyzeDays.set(clientId, { day: reservedDay, count: nextCount });
          }
        }
      },
    };
  }

  return { checkAndAcquire };
}

function createBarrettRouter(options = {}) {
  if (typeof options.generateFn !== 'function') {
    loadGenAISDK().catch(() => {});
  }
  const router = express.Router();
  const cfg = readConfig(options.config);
  const guard = createRateGuard(cfg, options.nowFn);
  const logError = typeof options.logFn === 'function'
    ? options.logFn
    : (entry) => console.warn('[barrett:error]', JSON.stringify(entry));

  const aiRouter = createAIProviderRouter({
    apiKey: options.apiKey,
    generateFn: options.generateFn,
    cloudflare: options.cloudflare,
    cloudflareFn: options.cloudflareFn,
    fetchFn: options.fetchFn,
    randomFn: options.randomFn,
    config: cfg,
    logFallbackFn: options.logFallbackFn,
    logEventFn: options.logEventFn,
  });

  function safeLogError({ requestId, route, status, code, errorType, upstreamStatus, attempts, durationMs }) {
    try {
      const payload = {
        requestId: String(requestId || ''),
        route: String(route || ''),
        status: Number(status) || 500,
        code: String(code || 'UNKNOWN_ERROR'),
        errorType: String(errorType || 'Error'),
      };
      if (upstreamStatus) payload.upstreamStatus = Number(upstreamStatus);
      if (attempts) payload.attempts = Number(attempts);
      if (durationMs !== undefined) payload.durationMs = Math.max(0, Math.round(Number(durationMs) || 0));
      logError(payload);
    } catch (_) {}
  }

  // Scoped JSON parser strictly for Barrett API routes (keeps payload under Vercel Hobby 4.5MB limit)
  router.use(express.json({ limit: '4.5mb', strict: true }));

  router.use((err, req, res, next) => {
    const requestId = createRequestId();
    const route = `/api/barrett${req.path || ''}`;
    if (err && err.type === 'entity.too.large') {
      safeLogError({ requestId, route, status: 413, code: 'PAYLOAD_TOO_LARGE', errorType: 'PayloadTooLargeError' });
      return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds the 4.5MB safety limit.', { requestId });
    }
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      safeLogError({ requestId, route, status: 400, code: 'INVALID_JSON', errorType: 'SyntaxError' });
      return sendError(res, 400, 'INVALID_JSON', 'Malformed JSON body.', { requestId });
    }
    return next(err);
  });

  /* ───────── GET /api/barrett/health ───────── */
  router.get('/health', (req, res) => {
    const hasKey = Boolean(getApiKey(options) || typeof options.generateFn === 'function');
    const cfConfigured = aiRouter.isCloudflareConfigured();
    return res.json({
      ok: true,
      configured: hasKey,
      model: cfg.model,
      analyzeModel: cfg.analyzeModel,
      multimodalSupported: true,
      structuredOutputSupported: true,
      fallback: {
        provider: 'cloudflare-workers-ai',
        configured: cfConfigured,
        model: cfg.cloudflareModel,
        textChatOnly: true,
        photosNeverSent: true,
        consentRequired: true,
      },
      limits: {
        ipRpm: cfg.ipRpm,
        userRpm: cfg.userRpm,
        analyzeDailyPerUser: cfg.analyzeDailyUser,
        dailyTotalCap: cfg.dailyTotalCap,
        maxImageBytes: cfg.maxImageBytes,
      },
      timeouts: {
        timeoutMs: cfg.timeoutMs,
        primaryFallbackTimeoutMs: cfg.primaryFallbackTimeoutMs,
        cloudflareTimeoutMs: cfg.cloudflareTimeoutMs,
      },
      privacy: {
        serverPhotoRetention: false,
        explicitConsentRequired: true,
        fallbackConsentRequired: true,
      },
    });
  });

  /* ───────── POST /api/barrett/chat ───────── */
  router.post('/chat', async (req, res) => {
    const requestId = createRequestId();
    const startedAt = Date.now();
    const route = '/api/barrett/chat';

    const clientId = sanitizeClientId(req);
    if (!clientId) {
      safeLogError({ requestId, route, status: 400, code: 'INVALID_CLIENT_ID', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 400, 'INVALID_CLIENT_ID', 'Valid clientId (6-64 safe chars) is required.', { requestId });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const lang = sanitizeLang(body.lang);
    const message = cleanStr(body.message, 1500);

    const hasImageField = body.image !== undefined && body.image !== null;
    let validatedImage = null;
    if (hasImageField) {
      if (body.explicitConsent !== true) {
        safeLogError({ requestId, route, status: 400, code: 'CONSENT_REQUIRED', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
        return sendError(res, 400, 'CONSENT_REQUIRED', 'Explicit user confirmation is required before sending a photo to Barrett AI.', { requestId });
      }
      const imgCheck = validateChatImagePayload(body.image, cfg.maxImageBytes);
      if (!imgCheck.ok) {
        safeLogError({ requestId, route, status: imgCheck.status, code: imgCheck.code, errorType: 'ValidationError', durationMs: Date.now() - startedAt });
        return sendError(res, imgCheck.status, imgCheck.code, imgCheck.message, { requestId });
      }
      validatedImage = imgCheck.image;
    }

    if (!message && !validatedImage) {
      safeLogError({ requestId, route, status: 400, code: 'EMPTY_MESSAGE', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 400, 'EMPTY_MESSAGE', 'Message text or an image attachment is required.', { requestId });
    }

    const profile = sanitizeProfile(body.profile);
    const messages = sanitizeMessages(body.messages);
    const memorySummary = cleanStr(body.memorySummary, 1800);
    const activePlans = sanitizeActivePlans(body.activePlans);
    const barrettSettings = sanitizeBarrettSettings(body.barrettSettings);
    const updateSummary = Boolean(body.updateSummary);

    const imgHashToken = validatedImage
      ? crypto
          .createHash('sha256')
          .update(`${validatedImage.mimeType}:${validatedImage.byteLength}:${validatedImage.dataBase64.slice(0, 256)}`)
          .digest('hex')
          .slice(0, 12)
      : '';

    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ lang, message, imgHashToken, len: messages.length, memorySummary: memorySummary.slice(0, 120), barrettSettings }))
      .digest('hex')
      .slice(0, 16);

    const slot = guard.checkAndAcquire({
      ip: getClientIp(req),
      clientId,
      routeKind: 'chat',
      payloadHash,
    });
    if (!slot.ok) {
      safeLogError({ requestId, route, status: slot.status, code: slot.code, errorType: 'RateGuardError', durationMs: Date.now() - startedAt });
      return sendError(res, slot.status, slot.code, slot.message, { ...slot, requestId });
    }

    const disconnectController = new AbortController();
    const onResClose = () => {
      if (!res.writableEnded) disconnectController.abort();
    };
    res.on('close', onResClose);

    const allowCloudflareFallback = body.allowCloudflareFallback === true;
    const hasImage = Boolean(validatedImage);

    let succeeded = false;
    try {
      const Type = SCHEMA_TYPE;
      const plansIncluded = isActivePlansRelevant(message, activePlans, messages);
      const chatContents = buildChatContents({ messages, message, image: validatedImage, lang });
      const systemInstruction = buildBarrettSystemInstruction(lang, profile, 'chat', {
        barrettSettings,
        memorySummary,
        activePlans: plansIncluded ? activePlans : [],
        hasImage,
        updateSummary,
      });
      const fallbackSystemInstruction = !hasImage
        ? buildCloudflareFallbackInstruction(lang, profile, {
            barrettSettings,
            activePlans: plansIncluded ? activePlans : [],
            plansIncluded,
          })
        : '';

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          emotion: { type: Type.STRING, enum: EMOTIONS },
          reply: { type: Type.STRING },
          profileQuote: {
            type: Type.STRING,
            description: 'Optional short coaching takeaway; return "" for casual chat, greetings, or general Q&A.',
          },
          followUps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Optional 1-2 short follow-up prompts; return [] for small talk or complete answers.',
          },
          updatedSummary: { type: Type.STRING },
        },
        required: ['emotion', 'reply'],
      };

      const fallbackResponseSchema = {
        type: Type.OBJECT,
        properties: {
          emotion: responseSchema.properties.emotion,
          reply: responseSchema.properties.reply,
          profileQuote: responseSchema.properties.profileQuote,
          followUps: responseSchema.properties.followUps,
        },
        required: ['emotion', 'reply'],
      };

      const aiRes = await aiRouter.generate({
        task: 'chat',
        characterId: 'barrett',
        requestId,
        route,
        model: cfg.model,
        contents: chatContents,
        systemInstruction,
        fallbackSystemInstruction,
        responseSchema,
        fallbackResponseSchema,
        validatorSpec: {
          requiredFields: ['emotion', 'reply'],
          nonEmptyStrings: ['reply'],
          enumFields: { emotion: EMOTIONS },
          optionalStringArrayFields: ['followUps'],
        },
        allowFallback: !hasImage,
        userConsent: allowCloudflareFallback,
        hasImage,
        clientSignal: disconnectController.signal,
      });

      const parsed = aiRes.data || parseAiJson(aiRes.text);
      const reply = scrubUnsafeRatings(cleanStr(parsed.reply, 3600));
      if (!reply) {
        safeLogError({ requestId, route, status: 502, code: 'INVALID_AI_RESPONSE', errorType: 'EmptyReply', durationMs: Date.now() - startedAt });
        return sendError(res, 502, 'INVALID_AI_RESPONSE', 'Barrett returned an empty reply.', { retryable: true, retryAfterSec: 2, requestId });
      }

      succeeded = true;
      return res.json({
        ok: true,
        data: {
          emotion: normalizeEmotion(parsed.emotion),
          reply,
          profileQuote: scrubUnsafeRatings(cleanStr(parsed.profileQuote, 180)),
          followUps: Array.isArray(parsed.followUps)
            ? parsed.followUps.map((q) => cleanStr(q, 90)).filter(Boolean).slice(0, 3)
            : [],
          updatedSummary: (!aiRes.fallbackUsed && updateSummary) ? cleanStr(parsed.updatedSummary, 600) : '',
        },
        meta: {
          model: aiRes.model,
          provider: aiRes.provider,
          fallbackUsed: Boolean(aiRes.fallbackUsed),
          ...(aiRes.fallbackUsed && aiRes.fallbackReason ? { fallbackReason: aiRes.fallbackReason } : {}),
          durationMs: Number.isFinite(aiRes.durationMs) ? aiRes.durationMs : Math.max(0, Date.now() - startedAt),
          requestId,
          privacy: {
            retained: false,
            photoRetainedOnServer: false,
            thirdPartyAiUsed: Boolean(validatedImage) || Boolean(aiRes.fallbackUsed),
            fallbackProvider: aiRes.fallbackUsed ? aiRes.provider : null,
            textSentToFallbackProvider: Boolean(aiRes.fallbackUsed),
            imagesSentToFallbackProvider: false,
          },
        },
      });
    } catch (err) {
      const mapped = mapProviderError(err, { secretValues: aiRouter.getSecretsList() });
      const meta = extractSafeUpstreamMeta(err);
      safeLogError({
        requestId,
        route,
        status: mapped.status,
        code: mapped.code,
        errorType: mapped.errorType || meta.errorType,
        upstreamStatus: mapped.upstreamStatus || meta.upstreamStatus,
        attempts: mapped.attempts || meta.attempts,
        durationMs: Date.now() - startedAt,
      });
      if (res.writableEnded || res.destroyed) return;
      return sendError(res, mapped.status, mapped.code, mapped.message, { ...mapped, requestId });
    } finally {
      res.removeListener('close', onResClose);
      slot.release(succeeded);
    }
  });

  /* ───────── POST /api/barrett/analyze ───────── */
  router.post('/analyze', async (req, res) => {
    const requestId = createRequestId();
    const startedAt = Date.now();
    const route = '/api/barrett/analyze';

    const clientId = sanitizeClientId(req);
    if (!clientId) {
      safeLogError({ requestId, route, status: 400, code: 'INVALID_CLIENT_ID', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 400, 'INVALID_CLIENT_ID', 'Valid clientId (6-64 safe chars) is required.', { requestId });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.explicitConsent !== true) {
      safeLogError({ requestId, route, status: 400, code: 'CONSENT_REQUIRED', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 400, 'CONSENT_REQUIRED', 'Explicit user confirmation is required before sending a photo for AI analysis.', { requestId });
    }

    const img = body.image && typeof body.image === 'object' ? body.image : null;
    if (!img || !ALLOWED_MIME.has(img.mimeType) || typeof img.dataBase64 !== 'string') {
      safeLogError({ requestId, route, status: 400, code: 'INVALID_IMAGE', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 400, 'INVALID_IMAGE', 'Provide a JPEG, PNG, or WEBP image encoded in base64.', { requestId });
    }

    const rawB64 = img.dataBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '');
    if (rawB64.length < 32 || !/^[A-Za-z0-9+/=]+$/.test(rawB64)) {
      safeLogError({ requestId, route, status: 400, code: 'INVALID_IMAGE_DATA', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 400, 'INVALID_IMAGE_DATA', 'Image payload is not valid base64.', { requestId });
    }
    const approxBytes = Math.floor((rawB64.length * 3) / 4);
    if (approxBytes > cfg.maxImageBytes) {
      safeLogError({ requestId, route, status: 413, code: 'IMAGE_TOO_LARGE', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 413, 'IMAGE_TOO_LARGE', `Image exceeds ${Math.round(cfg.maxImageBytes / 1000000 * 10) / 10}MB limit.`, { requestId });
    }

    const lang = sanitizeLang(body.lang);
    const profile = sanitizeProfile(body.profile);
    const focus = ANALYZE_FOCUS.has(body.focus) ? body.focus : 'all';
    const note = cleanStr(body.note, 500);

    const payloadHash = crypto
      .createHash('sha256')
      .update(rawB64.slice(0, 256) + ':' + rawB64.length + ':' + focus + ':' + note)
      .digest('hex')
      .slice(0, 16);

    const slot = guard.checkAndAcquire({
      ip: getClientIp(req),
      clientId,
      routeKind: 'analyze',
      payloadHash,
    });
    if (!slot.ok) {
      safeLogError({ requestId, route, status: slot.status, code: slot.code, errorType: 'RateGuardError', durationMs: Date.now() - startedAt });
      return sendError(res, slot.status, slot.code, slot.message, { ...slot, requestId });
    }

    const disconnectController = new AbortController();
    const onResClose = () => {
      if (!res.writableEnded) disconnectController.abort();
    };
    res.on('close', onResClose);

    let succeeded = false;
    try {
      const Type = SCHEMA_TYPE;
      const promptParts = [
        `Analyze this user-submitted photo for constructive looksmaxing & grooming coaching (focus: ${focus}).`,
        note ? `User question/note: ${note}` : '',
        'Cover visible aspects across skin, hair, face framing/harmony, grooming, style, and presentation/posture.',
        'Do NOT give any numerical attractiveness score (no x/10). Provide practical, safe, age-appropriate steps.',
      ].filter(Boolean).join('\n');

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          emotion: { type: Type.STRING, enum: EMOTIONS },
          reply: { type: Type.STRING },
          observations: {
            type: Type.OBJECT,
            properties: {
              skin: { type: Type.STRING },
              hair: { type: Type.STRING },
              face: { type: Type.STRING },
              grooming: { type: Type.STRING },
              style: { type: Type.STRING },
              presentation: { type: Type.STRING },
            },
            required: ['skin', 'hair', 'face', 'grooming', 'style', 'presentation'],
          },
          recommendedGuide: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING, enum: Array.from(GUIDE_CATEGORIES) },
              summary: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['title', 'category', 'summary', 'steps'],
          },
          followUps: { type: Type.ARRAY, items: { type: Type.STRING } },
          profileQuote: { type: Type.STRING },
        },
        required: ['emotion', 'reply', 'observations', 'recommendedGuide', 'followUps', 'profileQuote'],
      };

      const aiRes = await aiRouter.generate({
        task: 'analyze',
        characterId: 'barrett',
        requestId,
        route,
        model: cfg.analyzeModel,
        contents: {
          parts: [
            { inlineData: { mimeType: img.mimeType, data: rawB64 } },
            { text: promptParts },
          ],
        },
        systemInstruction: buildBarrettSystemInstruction(lang, profile, 'analyze'),
        responseSchema,
        validatorSpec: {
          requiredFields: ['emotion', 'reply', 'observations', 'recommendedGuide'],
          nonEmptyStrings: ['reply'],
          enumFields: { emotion: EMOTIONS },
          optionalStringArrayFields: ['followUps'],
        },
        allowFallback: false,
        userConsent: false,
        hasImage: true,
        clientSignal: disconnectController.signal,
      });

      const parsed = aiRes.data || parseAiJson(aiRes.text);
      const obs = parsed.observations && typeof parsed.observations === 'object' ? parsed.observations : {};
      const rec = parsed.recommendedGuide && typeof parsed.recommendedGuide === 'object' ? parsed.recommendedGuide : {};

      succeeded = true;
      return res.json({
        ok: true,
        data: {
          emotion: normalizeEmotion(parsed.emotion),
          reply: scrubUnsafeRatings(cleanStr(parsed.reply, 2000)),
          observations: {
            skin: scrubUnsafeRatings(cleanStr(obs.skin, 600)),
            hair: scrubUnsafeRatings(cleanStr(obs.hair, 600)),
            face: scrubUnsafeRatings(cleanStr(obs.face, 600)),
            grooming: scrubUnsafeRatings(cleanStr(obs.grooming, 600)),
            style: scrubUnsafeRatings(cleanStr(obs.style, 600)),
            presentation: scrubUnsafeRatings(cleanStr(obs.presentation, 600)),
          },
          recommendedGuide: {
            title: cleanStr(rec.title, 120),
            category: GUIDE_CATEGORIES.has(rec.category) ? rec.category : 'grooming',
            summary: scrubUnsafeRatings(cleanStr(rec.summary, 400)),
            steps: Array.isArray(rec.steps)
              ? rec.steps.map((s) => scrubUnsafeRatings(cleanStr(s, 240))).filter(Boolean).slice(0, 6)
              : [],
          },
          followUps: Array.isArray(parsed.followUps)
            ? parsed.followUps.map((q) => cleanStr(q, 90)).filter(Boolean).slice(0, 3)
            : [],
          profileQuote: scrubUnsafeRatings(cleanStr(parsed.profileQuote, 180)),
        },
        meta: {
          model: cfg.analyzeModel,
          provider: aiRes.provider,
          fallbackUsed: false,
          requestId,
          privacy: { photoRetainedOnServer: false, thirdPartyAiUsed: true },
        },
      });
    } catch (err) {
      const mapped = mapProviderError(err, { secretValues: aiRouter.getSecretsList() });
      const meta = extractSafeUpstreamMeta(err);
      safeLogError({
        requestId,
        route,
        status: mapped.status,
        code: mapped.code,
        errorType: mapped.errorType || meta.errorType,
        upstreamStatus: mapped.upstreamStatus || meta.upstreamStatus,
        attempts: mapped.attempts || meta.attempts,
        durationMs: Date.now() - startedAt,
      });
      if (res.writableEnded || res.destroyed) return;
      return sendError(res, mapped.status, mapped.code, mapped.message, { ...mapped, requestId });
    } finally {
      res.removeListener('close', onResClose);
      slot.release(succeeded);
    }
  });

  /* ───────── POST /api/barrett/guide ───────── */
  router.post('/guide', async (req, res) => {
    const requestId = createRequestId();
    const startedAt = Date.now();
    const route = '/api/barrett/guide';

    const clientId = sanitizeClientId(req);
    if (!clientId) {
      safeLogError({ requestId, route, status: 400, code: 'INVALID_CLIENT_ID', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 400, 'INVALID_CLIENT_ID', 'Valid clientId (6-64 safe chars) is required.', { requestId });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const lang = sanitizeLang(body.lang);
    const profile = sanitizeProfile(body.profile);
    const category = GUIDE_CATEGORIES.has(body.category) ? body.category : 'habits';
    const goal = cleanStr(body.goal, 800);
    if (!goal) {
      safeLogError({ requestId, route, status: 400, code: 'EMPTY_GOAL', errorType: 'ValidationError', durationMs: Date.now() - startedAt });
      return sendError(res, 400, 'EMPTY_GOAL', 'A goal or adjustment request is required to build a guide.', { requestId });
    }

    const existingGuide = body.existingGuide && typeof body.existingGuide === 'object'
      ? {
          title: cleanStr(body.existingGuide.title, 120),
          steps: Array.isArray(body.existingGuide.steps)
            ? body.existingGuide.steps.slice(0, 10).map((s) => ({
                text: cleanStr(s && (s.title || s.text), 180),
                done: Boolean(s && s.done),
              })).filter((s) => s.text)
            : [],
        }
      : null;

    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ lang, category, goal, hasExisting: Boolean(existingGuide) }))
      .digest('hex')
      .slice(0, 16);

    const slot = guard.checkAndAcquire({
      ip: getClientIp(req),
      clientId,
      routeKind: 'guide',
      payloadHash,
    });
    if (!slot.ok) {
      safeLogError({ requestId, route, status: slot.status, code: slot.code, errorType: 'RateGuardError', durationMs: Date.now() - startedAt });
      return sendError(res, slot.status, slot.code, slot.message, { ...slot, requestId });
    }

    const disconnectController = new AbortController();
    const onResClose = () => {
      if (!res.writableEnded) disconnectController.abort();
    };
    res.on('close', onResClose);

    let succeeded = false;
    try {
      const Type = SCHEMA_TYPE;
      const promptParts = [
        `Create or refine a realistic, safe personalized guide in category "${category}".`,
        existingGuide && existingGuide.title
          ? `Current guide being adjusted: "${existingGuide.title}"\nCurrent steps:\n${existingGuide.steps.map((s) => `- [${s.done ? 'done' : 'todo'}] ${s.text}`).join('\n')}`
          : '',
        `User request: ${goal}`,
        'Return 3-6 concise, actionable steps and a realistic frequency + safetyNote.',
      ].filter(Boolean).join('\n\n');

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          emotion: { type: Type.STRING, enum: EMOTIONS },
          reply: { type: Type.STRING },
          guide: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING, enum: Array.from(GUIDE_CATEGORIES) },
              summary: { type: Type.STRING },
              frequency: { type: Type.STRING },
              safetyNote: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                  },
                  required: ['title', 'detail'],
                },
              },
            },
            required: ['title', 'category', 'summary', 'frequency', 'safetyNote', 'steps'],
          },
          profileQuote: { type: Type.STRING },
        },
        required: ['emotion', 'reply', 'guide', 'profileQuote'],
      };

      const aiRes = await aiRouter.generate({
        task: 'guide',
        characterId: 'barrett',
        requestId,
        route,
        model: cfg.model,
        contents: promptParts,
        systemInstruction: buildBarrettSystemInstruction(lang, profile, 'guide'),
        responseSchema,
        validatorSpec: {
          requiredFields: ['emotion', 'reply', 'guide'],
          nonEmptyStrings: ['reply'],
          enumFields: { emotion: EMOTIONS },
        },
        allowFallback: false,
        userConsent: false,
        hasImage: false,
        clientSignal: disconnectController.signal,
      });

      const parsed = aiRes.data || parseAiJson(aiRes.text);
      const g = parsed.guide && typeof parsed.guide === 'object' ? parsed.guide : {};
      const steps = Array.isArray(g.steps)
        ? g.steps
            .map((s) => ({
              title: scrubUnsafeRatings(cleanStr(s && s.title, 120)),
              detail: scrubUnsafeRatings(cleanStr(s && s.detail, 320)),
            }))
            .filter((s) => s.title)
            .slice(0, 7)
        : [];

      if (!g.title || !steps.length) {
        safeLogError({ requestId, route, status: 502, code: 'INVALID_AI_RESPONSE', errorType: 'IncompleteGuide', durationMs: Date.now() - startedAt });
        return sendError(res, 502, 'INVALID_AI_RESPONSE', 'Could not structure the personalized guide. Please retry.', { retryable: true, retryAfterSec: 2, requestId });
      }

      succeeded = true;
      return res.json({
        ok: true,
        data: {
          emotion: normalizeEmotion(parsed.emotion),
          reply: scrubUnsafeRatings(cleanStr(parsed.reply, 1500)),
          guide: {
            title: cleanStr(g.title, 120),
            category: GUIDE_CATEGORIES.has(g.category) ? g.category : category,
            summary: scrubUnsafeRatings(cleanStr(g.summary, 400)),
            frequency: cleanStr(g.frequency, 120),
            safetyNote: cleanStr(g.safetyNote, 300),
            steps,
          },
          profileQuote: scrubUnsafeRatings(cleanStr(parsed.profileQuote, 180)),
        },
        meta: { model: cfg.model, provider: aiRes.provider, fallbackUsed: false, requestId },
      });
    } catch (err) {
      const mapped = mapProviderError(err, { secretValues: aiRouter.getSecretsList() });
      const meta = extractSafeUpstreamMeta(err);
      safeLogError({
        requestId,
        route,
        status: mapped.status,
        code: mapped.code,
        errorType: mapped.errorType || meta.errorType,
        upstreamStatus: mapped.upstreamStatus || meta.upstreamStatus,
        attempts: mapped.attempts || meta.attempts,
        durationMs: Date.now() - startedAt,
      });
      if (res.writableEnded || res.destroyed) return;
      return sendError(res, mapped.status, mapped.code, mapped.message, { ...mapped, requestId });
    } finally {
      res.removeListener('close', onResClose);
      slot.release(succeeded);
    }
  });

  router.use((req, res) => {
    return sendError(res, 404, 'NOT_FOUND', 'Unknown Barrett API endpoint.');
  });

  return router;
}

module.exports = {
  createBarrettRouter,
  readConfig,
  getApiKey,
  getCloudflareCredentials,
  isCloudflareConfigured,
  getSafeRuntimeDiagnostics,
  DEFAULT_BARRETT_MODEL,
  DEFAULT_CLOUDFLARE_MODEL,
  createRateGuard,
  buildBarrettSystemInstruction,
  buildCloudflareFallbackInstruction,
  buildChatContents,
  isActivePlansRelevant,
  sanitizeBarrettSettings,
  scrubUnsafeRatings,
  validateChatImagePayload,
};

