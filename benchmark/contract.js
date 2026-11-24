/* ASCEND — Benchmark Unified Request/Response Contract & Secret Redaction */
'use strict';

const EMOTIONS = new Set(['neutral', 'happy', 'sad', 'excited']);

function redactSecrets(raw) {
  return String(raw == null ? '' : raw)
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/gsk_[0-9A-Za-z_-]{10,}/g, '[REDACTED_GROQ_KEY]')
    .replace(/sk-or-v1-[0-9A-Za-z_-]{10,}/gi, '[REDACTED_OPENROUTER_KEY]')
    .replace(/sk-[0-9A-Za-z_-]{16,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[0-9A-Za-z._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:api[_-]?key|token|secret)\s*[:=]\s*['"]?[0-9A-Za-z._-]{8,}['"]?/gi, '[REDACTED_CREDENTIAL]');
}

function createUnifiedRequest({
  scenario,
  providerId,
  modelId,
  systemInstruction,
  contents,
  options = {},
}) {
  if (!scenario || !scenario.id) {
    throw new Error('UnifiedRequest requires a valid scenario object');
  }
  return {
    scenarioId: String(scenario.id),
    category: String(scenario.category || 'general'),
    providerId: String(providerId),
    modelId: String(modelId),
    lang: scenario.lang === 'en' ? 'en' : 'ru',
    currentMessage: String(scenario.currentMessage || ''),
    history: Array.isArray(scenario.history) ? scenario.history.slice() : [],
    profile: scenario.profile || { nickname: 'Alex', ageGroup: '18-24', goals: [] },
    barrettSettings: scenario.barrettSettings || { directness: 75, humor: 55, detail: 65, strictness: 70 },
    activePlans: Array.isArray(scenario.activePlans) ? scenario.activePlans.slice() : [],
    systemInstruction: String(systemInstruction || ''),
    contents: Array.isArray(contents) ? contents.slice() : [],
    options: {
      timeoutMs: Number(options.timeoutMs) || 25000,
      temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.4,
      maxTokens: Number(options.maxTokens) || 1200,
      responseFormat: 'json_object',
    },
  };
}

function parseNormalizedBarrettPayload(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return { ok: false, errorCode: 'EMPTY_RESPONSE', errorMessage: 'Model returned empty text', parsed: null };
  }
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, errorCode: 'INVALID_JSON', errorMessage: 'Parsed output is not a JSON object', parsed: null };
    }
    const reply = typeof obj.reply === 'string' ? obj.reply.trim() : '';
    if (!reply) {
      return { ok: false, errorCode: 'EMPTY_REPLY', errorMessage: 'JSON output has empty reply', parsed: null };
    }
    return {
      ok: true,
      errorCode: null,
      errorMessage: null,
      parsed: {
        emotion: EMOTIONS.has(obj.emotion) ? obj.emotion : 'neutral',
        reply,
        profileQuote: typeof obj.profileQuote === 'string' ? obj.profileQuote.trim() : '',
        followUps: Array.isArray(obj.followUps)
          ? obj.followUps.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 3)
          : [],
      },
    };
  } catch (err) {
    return {
      ok: false,
      errorCode: 'INVALID_JSON',
      errorMessage: redactSecrets(err && err.message ? err.message : 'Malformed JSON'),
      parsed: null,
    };
  }
}

function estimateCostUsd(modelMeta, usage) {
  if (!modelMeta || !modelMeta.pricingUsdPer1MTokens || !usage) {
    return { estimatedCostUsd: null, costStatus: 'unavailable' };
  }
  const p = modelMeta.pricingUsdPer1MTokens;
  if (typeof p.input !== 'number' || typeof p.output !== 'number') {
    return { estimatedCostUsd: null, costStatus: 'unavailable' };
  }
  const inTokens = Number(usage.promptTokens) || 0;
  const outTokens = Number(usage.completionTokens) || 0;
  const usd = (inTokens * p.input + outTokens * p.output) / 1_000_000;
  return {
    estimatedCostUsd: Number(usd.toFixed(8)),
    costStatus: 'estimated',
  };
}

function createUnifiedResponse({
  ok,
  providerId,
  modelId,
  scenarioId,
  rawText = '',
  parsed = null,
  latencyMs = 0,
  httpStatus = 200,
  errorCode = null,
  errorMessage = null,
  attempts = 1,
  usage = null,
  modelMeta = null,
  available = true,
  isMock = false,
}) {
  const cost = estimateCostUsd(modelMeta, usage);
  return {
    ok: Boolean(ok),
    providerId: String(providerId),
    modelId: String(modelId),
    scenarioId: String(scenarioId),
    rawText: redactSecrets(rawText),
    parsed,
    metrics: {
      latencyMs: Math.max(0, Math.round(Number(latencyMs) || 0)),
      httpStatus: Number(httpStatus) || 0,
      errorCode: errorCode ? String(errorCode) : null,
      errorMessage: errorMessage ? redactSecrets(errorMessage).slice(0, 240) : null,
      attempts: Math.max(1, Number(attempts) || 1),
      usage: usage
        ? {
            promptTokens: Number(usage.promptTokens) || 0,
            completionTokens: Number(usage.completionTokens) || 0,
            totalTokens: Number(usage.totalTokens) || ((Number(usage.promptTokens) || 0) + (Number(usage.completionTokens) || 0)),
          }
        : null,
      estimatedCostUsd: cost.estimatedCostUsd,
      costStatus: cost.costStatus,
      available: Boolean(available),
      isMock: Boolean(isMock),
    },
  };
}

module.exports = {
  redactSecrets,
  createUnifiedRequest,
  parseNormalizedBarrettPayload,
  estimateCostUsd,
  createUnifiedResponse,
};
