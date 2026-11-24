/* ASCEND — Benchmark Provider Factory & Extensible Adapter Registry
   Allows plugging in new AI providers without changing Barrett or benchmark runner core. */
'use strict';

const { GeminiBenchmarkAdapter } = require('./gemini-adapter');
const { GroqBenchmarkAdapter } = require('./groq-adapter');
const { OpenRouterBenchmarkAdapter } = require('./openrouter-adapter');
const { MistralBenchmarkAdapter } = require('./mistral-adapter');
const { CloudflareBenchmarkAdapter } = require('./cloudflare-adapter');
const { MockBenchmarkAdapter } = require('./mock-adapter');

const ADAPTER_CONSTRUCTORS = new Map([
  ['google-gemini', GeminiBenchmarkAdapter],
  ['groq', GroqBenchmarkAdapter],
  ['openrouter', OpenRouterBenchmarkAdapter],
  ['mistral', MistralBenchmarkAdapter],
  ['cloudflare-workers-ai', CloudflareBenchmarkAdapter],
]);

function registerAdapter(providerId, AdapterClass) {
  if (!providerId || typeof AdapterClass !== 'function') {
    throw new Error('registerAdapter requires (providerId, AdapterClass)');
  }
  ADAPTER_CONSTRUCTORS.set(String(providerId), AdapterClass);
}

function listRegisteredProviders() {
  return Array.from(ADAPTER_CONSTRUCTORS.keys());
}

function resolveAdapter(providerId, opts = {}) {
  const mode = opts.mode === 'live' ? 'live' : 'mock';
  if (mode === 'mock') {
    return new MockBenchmarkAdapter({
      providerId,
      env: opts.env,
      faultInjector: opts.faultInjector,
      latencyFn: opts.latencyFn,
    });
  }
  const Ctor = ADAPTER_CONSTRUCTORS.get(providerId);
  if (!Ctor) {
    throw new Error(`No benchmark adapter registered for provider "${providerId}"`);
  }
  return new Ctor(opts);
}

module.exports = {
  registerAdapter,
  listRegisteredProviders,
  resolveAdapter,
};
