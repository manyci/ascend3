/* ASCEND — Google Gemini Benchmark Adapter (Control Provider)
   Reads strictly GEMINI_API_KEY when present in env; optionally uses local control server
   (http://127.0.0.1:3000/api/barrett/chat) ONLY for the Gemini control test when shell env lacks the key.
   Never modifies production server/barrett.js state. */
'use strict';

const { BaseProviderAdapter } = require('./base');
const { getModelMeta } = require('../registry');
const { parseNormalizedBarrettPayload, createUnifiedResponse } = require('../contract');

class GeminiBenchmarkAdapter extends BaseProviderAdapter {
  constructor(opts = {}) {
    super({ providerId: 'google-gemini', env: opts.env });
    this._sdkLoader = opts.sdkLoader || (() => import('@google/genai'));
    this._fetch = opts.fetchFn || globalThis.fetch;
    this.controlProxyUrl = opts.controlProxyUrl !== undefined ? opts.controlProxyUrl : 'http://127.0.0.1:3000';
  }

  buildHttpRequest(unifiedReq) {
    return {
      sdk: '@google/genai',
      model: unifiedReq.modelId,
      contents: unifiedReq.contents,
      config: {
        systemInstruction: unifiedReq.systemInstruction,
        responseMimeType: 'application/json',
        temperature: unifiedReq.options.temperature,
        maxOutputTokens: unifiedReq.options.maxTokens,
      },
    };
  }

  async invoke(unifiedReq, runtimeOpts = {}) {
    const mode = runtimeOpts.mode === 'live' ? 'live' : 'mock';
    const allowLive = Boolean(runtimeOpts.allowLiveRequests);

    if (mode !== 'live' || !allowLive) {
      return super.invoke(unifiedReq, runtimeOpts);
    }

    if (this.hasCredentials()) {
      return this.invokeLive(unifiedReq, runtimeOpts);
    }

    if (this.controlProxyUrl && runtimeOpts.allowControlProxy !== false) {
      return this.invokeViaControlProxy(unifiedReq);
    }

    return super.invoke(unifiedReq, runtimeOpts);
  }

  async invokeViaControlProxy(unifiedReq) {
    const startedAt = Date.now();
    const modelMeta = getModelMeta(this.providerId, unifiedReq.modelId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), unifiedReq.options.timeoutMs);
    const base = String(this.controlProxyUrl).replace(/\/+$/, '');

    try {
      const res = await this._fetch(`${base}/api/barrett/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ascend-client': 'ascend_bench_ctrl_01',
        },
        body: JSON.stringify({
          clientId: 'ascend_bench_ctrl_01',
          lang: unifiedReq.lang,
          message: unifiedReq.currentMessage,
          messages: unifiedReq.history,
          profile: unifiedReq.profile,
          activePlans: unifiedReq.activePlans,
          barrettSettings: unifiedReq.barrettSettings,
          memorySummary: '',
          updateSummary: false,
        }),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);
      const latencyMs = Date.now() - startedAt;

      if (!res.ok || !json || json.ok !== true || !json.data) {
        const errObj = (json && json.error) || {};
        return createUnifiedResponse({
          ok: false,
          providerId: this.providerId,
          modelId: unifiedReq.modelId,
          scenarioId: unifiedReq.scenarioId,
          latencyMs,
          httpStatus: res.status,
          errorCode: errObj.code || `HTTP_${res.status}`,
          errorMessage: errObj.detail || errObj.message || `Control server HTTP ${res.status}`,
          modelMeta,
          available: res.status !== 404,
          isMock: false,
        });
      }

      const rawText = JSON.stringify({
        emotion: json.data.emotion || 'neutral',
        reply: json.data.reply || '',
        profileQuote: json.data.profileQuote || '',
        followUps: Array.isArray(json.data.followUps) ? json.data.followUps : [],
      });
      const parsedOut = parseNormalizedBarrettPayload(rawText);

      return createUnifiedResponse({
        ok: parsedOut.ok,
        providerId: this.providerId,
        modelId: (json.meta && json.meta.model) || unifiedReq.modelId,
        scenarioId: unifiedReq.scenarioId,
        rawText,
        parsed: parsedOut.parsed,
        latencyMs,
        httpStatus: parsedOut.ok ? 200 : 502,
        errorCode: parsedOut.errorCode,
        errorMessage: parsedOut.errorMessage,
        usage: null, // /api/barrett/chat intentionally does not expose raw SDK usageMetadata
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
        errorMessage: err && err.message ? err.message : 'Control proxy request failed',
        modelMeta,
        available: false,
        isMock: false,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async invokeLive(unifiedReq) {
    const startedAt = Date.now();
    const modelMeta = getModelMeta(this.providerId, unifiedReq.modelId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), unifiedReq.options.timeoutMs);

    try {
      const { GoogleGenAI } = await this._sdkLoader();
      const ai = new GoogleGenAI({ apiKey: this.getApiKey() });
      const reqPayload = this.buildHttpRequest(unifiedReq);
      const response = await ai.models.generateContent({
        model: reqPayload.model,
        contents: reqPayload.contents,
        config: {
          ...reqPayload.config,
          abortSignal: controller.signal,
        },
      });
      const rawText = typeof response.text === 'string' ? response.text : '';
      const parsedOut = parseNormalizedBarrettPayload(rawText);
      const usageMeta = response.usageMetadata || null;
      const usage = usageMeta
        ? {
            promptTokens: usageMeta.promptTokenCount || 0,
            completionTokens: usageMeta.candidatesTokenCount || 0,
            totalTokens: usageMeta.totalTokenCount || 0,
          }
        : null;

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
        usage,
        modelMeta,
        available: true,
        isMock: false,
      });
    } catch (err) {
      const isAbort = err && err.name === 'AbortError';
      const status = isAbort ? 504 : (Number(err && (err.status || err.statusCode)) || 503);
      return createUnifiedResponse({
        ok: false,
        providerId: this.providerId,
        modelId: unifiedReq.modelId,
        scenarioId: unifiedReq.scenarioId,
        latencyMs: Date.now() - startedAt,
        httpStatus: status,
        errorCode: isAbort ? 'TIMEOUT' : `UPSTREAM_${status}`,
        errorMessage: err && err.message ? err.message : 'Gemini call failed',
        modelMeta,
        available: status !== 404,
        isMock: false,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { GeminiBenchmarkAdapter };
