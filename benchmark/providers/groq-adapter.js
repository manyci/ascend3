/* ASCEND — Groq Benchmark Adapter (Stage 0 Prepared, OpenAI-compatible)
   Reads strictly GROQ_API_KEY — never reads GEMINI_API_KEY. */
'use strict';

const { BaseProviderAdapter } = require('./base');
const { getModelMeta } = require('../registry');
const { parseNormalizedBarrettPayload, createUnifiedResponse } = require('../contract');

class GroqBenchmarkAdapter extends BaseProviderAdapter {
  constructor(opts = {}) {
    super({ providerId: 'groq', env: opts.env });
    this._fetch = opts.fetchFn || globalThis.fetch;
  }

  buildHttpRequest(unifiedReq) {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKey()}`,
      },
      body: {
        model: unifiedReq.modelId,
        messages: this.toChatMessages(unifiedReq),
        temperature: unifiedReq.options.temperature,
        max_tokens: unifiedReq.options.maxTokens,
        response_format: { type: 'json_object' },
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
          errorMessage: json && json.error && json.error.message ? json.error.message : `Groq HTTP ${res.status}`,
          modelMeta,
          available: res.status !== 404,
          isMock: false,
        });
      }
      const rawText = json && json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : '';
      const parsedOut = parseNormalizedBarrettPayload(rawText);
      const u = json && json.usage ? {
        promptTokens: uNum(json.usage.prompt_tokens),
        completionTokens: uNum(json.usage.completion_tokens),
        totalTokens: uNum(json.usage.total_tokens),
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
        errorMessage: err && err.message ? err.message : 'Groq network error',
        modelMeta,
        available: false,
        isMock: false,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

function uNum(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

module.exports = { GroqBenchmarkAdapter };
