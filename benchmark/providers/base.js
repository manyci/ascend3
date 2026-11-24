/* ASCEND — Base Benchmark Provider Adapter Interface
   Enforces strict per-provider API key isolation and unified invocation contract. */
'use strict';

const { getProviderMeta, getModelMeta } = require('../registry');
const { createUnifiedResponse } = require('../contract');

class BaseProviderAdapter {
  constructor({ providerId, env = process.env } = {}) {
    if (!providerId) throw new Error('providerId is required');
    this.providerId = String(providerId);
    this.env = env;
    this.meta = getProviderMeta(this.providerId);
  }

  getRequiredEnvVar() {
    return this.meta ? this.meta.envVarKey : `${this.providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
  }

  getApiKey() {
    const keyName = this.getRequiredEnvVar();
    // Critical security rule: never allow another provider to read GEMINI_API_KEY
    if (this.providerId !== 'google-gemini' && keyName === 'GEMINI_API_KEY') {
      throw new Error(`Invalid key mapping: ${this.providerId} cannot use GEMINI_API_KEY`);
    }
    const raw = this.env && typeof this.env[keyName] === 'string' ? this.env[keyName].trim() : '';
    return raw;
  }

  hasCredentials() {
    return Boolean(this.getApiKey());
  }

  validateConfig(modelId) {
    const modelMeta = getModelMeta(this.providerId, modelId);
    return {
      providerId: this.providerId,
      modelId,
      requiredEnvVar: this.getRequiredEnvVar(),
      hasCredentials: this.hasCredentials(),
      knownModel: Boolean(modelMeta),
      availabilityStatus: modelMeta ? modelMeta.availabilityStatus : 'custom-unverified',
    };
  }

  // Convert unified request (Gemini Content[]) to OpenAI/Mistral messages array
  toChatMessages(unifiedReq) {
    const out = [];
    if (unifiedReq.systemInstruction) {
      out.push({ role: 'system', content: unifiedReq.systemInstruction });
    }
    for (const turn of unifiedReq.contents || []) {
      const role = turn.role === 'model' ? 'assistant' : 'user';
      const text = Array.isArray(turn.parts)
        ? turn.parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).filter(Boolean).join('\n')
        : '';
      if (text) {
        out.push({ role, content: text });
      }
    }
    return out;
  }

  // Implemented by concrete provider adapters for inspection & future Stage 1+ live execution
  buildHttpRequest(/* unifiedReq */) {
    throw new Error(`buildHttpRequest() not implemented for ${this.providerId}`);
  }

  async invokeLive(/* unifiedReq, runtimeOpts */) {
    throw new Error(`invokeLive() not implemented for ${this.providerId}`);
  }

  async invoke(unifiedReq, runtimeOpts = {}) {
    const mode = runtimeOpts.mode === 'live' ? 'live' : 'mock';
    const allowLive = Boolean(runtimeOpts.allowLiveRequests);

    if (mode !== 'live' || !allowLive) {
      return createUnifiedResponse({
        ok: false,
        providerId: this.providerId,
        modelId: unifiedReq.modelId,
        scenarioId: unifiedReq.scenarioId,
        latencyMs: 0,
        httpStatus: 0,
        errorCode: 'LIVE_MODE_DISABLED_STAGE_0',
        errorMessage: 'Stage 0 runs in isolated mock mode; real external API requests are disabled.',
        modelMeta: getModelMeta(this.providerId, unifiedReq.modelId),
        available: false,
        isMock: false,
      });
    }

    if (!this.hasCredentials()) {
      return createUnifiedResponse({
        ok: false,
        providerId: this.providerId,
        modelId: unifiedReq.modelId,
        scenarioId: unifiedReq.scenarioId,
        latencyMs: 0,
        httpStatus: 401,
        errorCode: 'MISSING_PROVIDER_API_KEY',
        errorMessage: `Missing server env variable ${this.getRequiredEnvVar()} for provider ${this.providerId}.`,
        modelMeta: getModelMeta(this.providerId, unifiedReq.modelId),
        available: false,
        isMock: false,
      });
    }

    return this.invokeLive(unifiedReq, runtimeOpts);
  }
}

module.exports = { BaseProviderAdapter };
