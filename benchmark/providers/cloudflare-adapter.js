/* ASCEND — Cloudflare Workers AI Benchmark Adapter (Isolated Mock-Only Preparation)
   Prepares configuration (Account ID, API Token, Model ID, timeout, request builder,
   and UnifiedResponse normalization) strictly inside /benchmark/.
   Live HTTP requests and live key checks are explicitly disabled (CLOUDFLARE_LIVE_DISABLED). */
'use strict';

const { BaseProviderAdapter } = require('./base');
const { getModelMeta } = require('../registry');
const { parseNormalizedBarrettPayload, createUnifiedResponse, redactSecrets } = require('../contract');

const DEFAULT_CF_MODEL = 'cloudflare-model-unverified';

class CloudflareBenchmarkAdapter extends BaseProviderAdapter {
  constructor(opts = {}) {
    super({ providerId: 'cloudflare-workers-ai', env: opts.env });
    this._accountId = opts.accountId !== undefined ? String(opts.accountId).trim() : '';
    this._apiToken = opts.apiToken !== undefined ? String(opts.apiToken).trim() : '';
    this._modelId = opts.modelId ? String(opts.modelId).trim() : DEFAULT_CF_MODEL;
    this._timeoutMs = Math.max(100, Math.min(60000, Number(opts.timeoutMs) || 25000));
    this._mockHandler = typeof opts.mockHandler === 'function' ? opts.mockHandler : null;
  }

  getRequiredEnvVars() {
    return ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
  }

  getConfig(modelIdOverride) {
    const accountId = this._accountId || '[CLOUDFLARE_ACCOUNT_ID_UNSET]';
    const modelId = modelIdOverride || this._modelId || DEFAULT_CF_MODEL;
    return {
      providerId: this.providerId,
      accountIdConfigured: Boolean(this._accountId),
      apiTokenConfigured: Boolean(this._apiToken),
      accountIdPlaceholder: this._accountId ? '[CONFIGURED]' : 'CLOUDFLARE_ACCOUNT_ID',
      apiTokenPlaceholder: this._apiToken ? '[CONFIGURED]' : 'CLOUDFLARE_API_TOKEN',
      modelId,
      modelStatus: 'UNVERIFIED',
      timeoutMs: this._timeoutMs,
      mockOnly: true,
      liveRequestsAllowed: false,
      endpointTemplate: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`,
    };
  }

  // Live credential lookup is disabled in mock-only mode
  hasCredentials() {
    return false;
  }

  getApiKey() {
    return this._apiToken;
  }

  buildHttpRequest(unifiedReq) {
    const accountId = this._accountId || 'CLOUDFLARE_ACCOUNT_ID';
    const modelId = (unifiedReq && unifiedReq.modelId) || this._modelId || DEFAULT_CF_MODEL;
    const timeoutMs = (unifiedReq && unifiedReq.options && unifiedReq.options.timeoutMs) || this._timeoutMs;
    return {
      url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${modelId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this._apiToken || 'CLOUDFLARE_API_TOKEN'}`,
      },
      timeoutMs,
      body: {
        messages: this.toChatMessages(unifiedReq || {}),
        temperature: unifiedReq && unifiedReq.options ? unifiedReq.options.temperature : 0.4,
        max_tokens: unifiedReq && unifiedReq.options ? unifiedReq.options.maxTokens : 1200,
      },
    };
  }

  normalizeProviderPayload(payload, { unifiedReq, latencyMs = 0, httpStatus = 200, modelMeta = null, isMock = true } = {}) {
    const modelId = (unifiedReq && unifiedReq.modelId) || this._modelId || DEFAULT_CF_MODEL;
    const scenarioId = (unifiedReq && unifiedReq.scenarioId) || 'synthetic';

    if (payload === null || payload === undefined) {
      return createUnifiedResponse({
        ok: false,
        providerId: this.providerId,
        modelId,
        scenarioId,
        latencyMs,
        httpStatus: httpStatus >= 400 ? httpStatus : 502,
        errorCode: 'EMPTY_RESPONSE',
        errorMessage: 'Cloudflare mock payload is empty.',
        modelMeta,
        available: false,
        isMock,
      });
    }

    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      if (!trimmed) {
        return createUnifiedResponse({
          ok: false,
          providerId: this.providerId,
          modelId,
          scenarioId,
          latencyMs,
          httpStatus: 502,
          errorCode: 'EMPTY_RESPONSE',
          errorMessage: 'Cloudflare mock returned empty string.',
          modelMeta,
          available: false,
          isMock,
        });
      }
      const parsedOut = parseNormalizedBarrettPayload(trimmed);
      return createUnifiedResponse({
        ok: parsedOut.ok,
        providerId: this.providerId,
        modelId,
        scenarioId,
        rawText: trimmed,
        parsed: parsedOut.parsed,
        latencyMs,
        httpStatus: parsedOut.ok ? 200 : 502,
        errorCode: parsedOut.errorCode,
        errorMessage: parsedOut.errorMessage,
        modelMeta,
        available: true,
        isMock,
      });
    }

    if (typeof payload === 'object') {
      if (payload.success === false || (Array.isArray(payload.errors) && payload.errors.length > 0)) {
        const firstErr = Array.isArray(payload.errors) && payload.errors[0] ? payload.errors[0] : {};
        const errStatus = Number(httpStatus >= 400 ? httpStatus : (firstErr.status || 503));
        return createUnifiedResponse({
          ok: false,
          providerId: this.providerId,
          modelId,
          scenarioId,
          latencyMs,
          httpStatus: errStatus,
          errorCode: firstErr.code ? `CF_${String(firstErr.code)}` : 'CLOUDFLARE_API_ERROR',
          errorMessage: redactSecrets(firstErr.message || payload.error || `Cloudflare error (${errStatus})`),
          modelMeta,
          available: false,
          isMock,
        });
      }

      if (httpStatus >= 400) {
        return createUnifiedResponse({
          ok: false,
          providerId: this.providerId,
          modelId,
          scenarioId,
          latencyMs,
          httpStatus,
          errorCode: `HTTP_${httpStatus}`,
          errorMessage: redactSecrets((payload.error && payload.error.message) || payload.message || `Cloudflare HTTP ${httpStatus}`),
          modelMeta,
          available: false,
          isMock,
        });
      }

      const rawText = extractCloudflareText(payload);
      const parsedOut = parseNormalizedBarrettPayload(rawText);
      const usageRaw = (payload.result && payload.result.usage) || payload.usage || null;
      const usage = usageRaw && typeof usageRaw === 'object'
        ? {
            promptTokens: uNum(usageRaw.prompt_tokens ?? usageRaw.promptTokens),
            completionTokens: uNum(usageRaw.completion_tokens ?? usageRaw.completionTokens),
            totalTokens: uNum(usageRaw.total_tokens ?? usageRaw.totalTokens),
          }
        : null;

      return createUnifiedResponse({
        ok: parsedOut.ok,
        providerId: this.providerId,
        modelId,
        scenarioId,
        rawText,
        parsed: parsedOut.parsed,
        latencyMs,
        httpStatus: parsedOut.ok ? 200 : 502,
        errorCode: parsedOut.errorCode,
        errorMessage: parsedOut.errorMessage,
        usage,
        modelMeta,
        available: true,
        isMock,
      });
    }

    return createUnifiedResponse({
      ok: false,
      providerId: this.providerId,
      modelId,
      scenarioId,
      latencyMs,
      httpStatus: 502,
      errorCode: 'INVALID_JSON',
      errorMessage: 'Unsupported Cloudflare response type.',
      modelMeta,
      available: false,
      isMock,
    });
  }

  async invokeLive() {
    // Hard safety guard: never execute live HTTP requests to Cloudflare
    const err = new Error('Cloudflare Workers AI live calls are disabled (mock-only).');
    err.code = 'CLOUDFLARE_LIVE_DISABLED';
    throw err;
  }

  async invoke(unifiedReq, runtimeOpts = {}) {
    const req = unifiedReq || {};
    const modelId = req.modelId || this._modelId || DEFAULT_CF_MODEL;
    const scenarioId = req.scenarioId || 'synthetic';
    const modelMeta = getModelMeta(this.providerId, modelId);

    // Block ANY live request attempt regardless of allowLiveRequests flag
    if (runtimeOpts.mode === 'live' || runtimeOpts.allowLiveRequests === true) {
      return createUnifiedResponse({
        ok: false,
        providerId: this.providerId,
        modelId,
        scenarioId,
        latencyMs: 0,
        httpStatus: 0,
        errorCode: 'CLOUDFLARE_LIVE_DISABLED',
        errorMessage: 'Cloudflare Workers AI live HTTP requests and live key checks are disabled (mock-only).',
        modelMeta,
        available: false,
        isMock: false,
      });
    }

    const startedAt = Date.now();
    const timeoutMs = Math.max(20, Math.min(60000, Number(runtimeOpts.timeoutMs || (req.options && req.options.timeoutMs) || this._timeoutMs)));
    const handler = typeof runtimeOpts.mockHandler === 'function' ? runtimeOpts.mockHandler : this._mockHandler;

    if (!handler) {
      const syntheticRaw = JSON.stringify({
        emotion: 'neutral',
        reply: req.lang === 'en'
          ? 'Mock Cloudflare Workers AI response normalized to Barrett contract.'
          : 'Тестовый мок-ответ Cloudflare Workers AI, нормализованный под контракт Barrett.',
        profileQuote: '',
        followUps: [],
      });
      return this.normalizeProviderPayload(
        {
          success: true,
          result: {
            response: syntheticRaw,
            usage: { prompt_tokens: 90, completion_tokens: 24, total_tokens: 114 },
          },
        },
        { unifiedReq: req, latencyMs: 45, httpStatus: 200, modelMeta, isMock: true }
      );
    }

    let timer = null;
    try {
      const reqSpec = this.buildHttpRequest(req);
      const result = await Promise.race([
        Promise.resolve().then(() => handler(reqSpec, req)),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const tErr = new Error(`Cloudflare mock timed out after ${timeoutMs}ms`);
            tErr.name = 'AbortError';
            tErr.code = 'TIMEOUT';
            reject(tErr);
          }, timeoutMs);
        }),
      ]);

      const httpStatus = result && typeof result === 'object' && Number.isFinite(Number(result.httpStatus))
        ? Number(result.httpStatus)
        : 200;
      const payload = result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'body')
        ? result.body
        : result;

      return this.normalizeProviderPayload(payload, {
        unifiedReq: req,
        latencyMs: Date.now() - startedAt,
        httpStatus,
        modelMeta,
        isMock: true,
      });
    } catch (err) {
      const isTimeout = Boolean(err && (err.name === 'AbortError' || err.code === 'TIMEOUT'));
      return createUnifiedResponse({
        ok: false,
        providerId: this.providerId,
        modelId,
        scenarioId,
        latencyMs: Date.now() - startedAt,
        httpStatus: isTimeout ? 504 : (Number(err && err.status) || 503),
        errorCode: isTimeout ? 'TIMEOUT' : (err && err.code ? String(err.code) : 'CLOUDFLARE_MOCK_ERROR'),
        errorMessage: err && err.message ? redactSecrets(err.message) : 'Cloudflare mock execution error',
        modelMeta,
        available: false,
        isMock: true,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function extractCloudflareText(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (payload.result && typeof payload.result === 'object') {
    if (typeof payload.result.response === 'string') return payload.result.response;
    if (payload.result.response && typeof payload.result.response === 'object') {
      return JSON.stringify(payload.result.response);
    }
    if (Array.isArray(payload.result.choices) && payload.result.choices[0] && payload.result.choices[0].message) {
      return String(payload.result.choices[0].message.content || '');
    }
  }
  if (typeof payload.response === 'string') return payload.response;
  if (Array.isArray(payload.choices) && payload.choices[0] && payload.choices[0].message) {
    return String(payload.choices[0].message.content || '');
  }
  return '';
}

function uNum(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

module.exports = { CloudflareBenchmarkAdapter, DEFAULT_CF_MODEL };
