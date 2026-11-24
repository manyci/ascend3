/* ASCEND — OpenRouter Benchmark Adapter (Stage 0 Prepared, OpenAI-compatible)
   Reads strictly OPENROUTER_API_KEY — never reads GEMINI_API_KEY. */
'use strict';

const { BaseProviderAdapter } = require('./base');
const { getModelMeta } = require('../registry');
const { parseNormalizedBarrettPayload, createUnifiedResponse } = require('../contract');

class OpenRouterBenchmarkAdapter extends BaseProviderAdapter {
  constructor(opts = {}) {
    super({ providerId: 'openrouter', env: opts.env });
    this._fetch = opts.fetchFn || globalThis.fetch;
  }

  buildHttpRequest(unifiedReq) {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKey()}`,
        'X-Title': 'ASCEND AI Model Benchmark',
      },
      body: {
        model: unifiedReq.modelId,
        messages: this.toChatMessages(unifiedReq),
        temperature: unifiedReq.options.temperature,
        max_tokens: unifiedReq.options.maxTokens,
      },
    };
  }

  async invokeLive(unifiedReq) {
    const startedAt = Date.now();
    const modelMeta = getModelMeta(this.providerId, unifiedReq.modelId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), unifiedReq.options.timeoutMs);

    try {
      const reqSpec = this.buildHttpRequest(unifiedReq);
      const res = await this._fetch(reqSpec.url, {
        method: reqSpec.method,
        headers: reqSpec.headers,
        body: JSON.stringify(reqSpec.body),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        return createUnifiedResponse({
          ok: false,
          providerId: this.providerId,
          modelId: unifiedReq.modelId,
          scenarioId: unifiedReq.scenarioId,
          latencyMs: Date.now() - startedAt,
          httpStatus: res.status,
          errorCode: `HTTP_${res.status}`,
          errorMessage: json && json.error && json.error.message ? json.error.message : `OpenRouter HTTP ${res.status}`,
          modelMeta,
          available: res.status !== 404,
          isMock: false,
        });
      }
      const rawText = json && json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : '';
      const parsedOut = parseNormalizedBarrettPayload(rawText);
      const u = json && json.usage ? {
        promptTokens: Number(json.usage.prompt_tokens) || 0,
        completionTokens: Number(json.usage.completion_tokens) || 0,
        totalTokens: Number(json.usage.total_tokens) || 0,
      } : null;

      return createUnifiedResponse({
        ok: parsedOut.ok,
        providerId: this.providerId,
        modelId: unifiedReq.modelId,
        scenarioId: unifiedReq.scenarioId,
        rawText,
        parsed: parsedOut.parsed,
        latencyMs: Date.now() - startedAt,
        httpStatus: parsedOut.ok ? 200 : 502,
        errorCode: parsedOut.errorCode,
        errorMessage: parsedOut.errorMessage,
        usage: u,
        modelMeta,
        available: true,
        isMock: false,
      });
    } catch (err) {
      const isAbort = err && err.name === 'AbortError';
      return createUnifiedResponse({
        ok: false,
        providerId: this.providerId,
        modelId: unifiedReq.modelId,
        scenarioId: unifiedReq.scenarioId,
        latencyMs: Date.now() - startedAt,
        httpStatus: isAbort ? 504 : 0,
        errorCode: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: err && err.message ? err.message : 'OpenRouter network error',
        modelMeta,
        available: false,
        isMock: false,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { OpenRouterBenchmarkAdapter };
