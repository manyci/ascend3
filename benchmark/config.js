/* ASCEND — AI Model Benchmark System (Stage 0: Isolated Benchmark Environment)
   Dedicated configuration isolated from production Barrett settings & environment. */
'use strict';

const path = require('path');

const DEFAULT_BENCHMARK_CONFIG = Object.freeze({
  mode: 'mock', // 'mock' | 'live' (Stage 0 defaults strictly to 'mock')
  allowLiveRequests: false,
  timeoutMs: 25000,
  maxRetries: 1,
  retryDelayMs: 500,
  delayBetweenCallsMs: 150,
  temperature: 0.4,
  maxTokens: 1200,
  reportsDir: path.join(__dirname, 'reports'),
  saveReports: true,
});

function createBenchmarkConfig(overrides = {}) {
  const mode = overrides.mode === 'live' ? 'live' : 'mock';
  return {
    mode,
    allowLiveRequests: Boolean(overrides.allowLiveRequests) && mode === 'live',
    timeoutMs: Math.max(200, Math.min(60000, Number(overrides.timeoutMs) || DEFAULT_BENCHMARK_CONFIG.timeoutMs)),
    maxRetries: Math.max(0, Math.min(3, Number(overrides.maxRetries ?? DEFAULT_BENCHMARK_CONFIG.maxRetries))),
    retryDelayMs: Math.max(0, Math.min(5000, Number(overrides.retryDelayMs ?? DEFAULT_BENCHMARK_CONFIG.retryDelayMs))),
    delayBetweenCallsMs: Math.max(0, Math.min(5000, Number(overrides.delayBetweenCallsMs ?? DEFAULT_BENCHMARK_CONFIG.delayBetweenCallsMs))),
    temperature: Number.isFinite(Number(overrides.temperature)) ? Number(overrides.temperature) : DEFAULT_BENCHMARK_CONFIG.temperature,
    maxTokens: Math.max(100, Math.min(8192, Number(overrides.maxTokens) || DEFAULT_BENCHMARK_CONFIG.maxTokens)),
    reportsDir: overrides.reportsDir ? String(overrides.reportsDir) : DEFAULT_BENCHMARK_CONFIG.reportsDir,
    saveReports: overrides.saveReports !== undefined ? Boolean(overrides.saveReports) : DEFAULT_BENCHMARK_CONFIG.saveReports,
  };
}

module.exports = {
  DEFAULT_BENCHMARK_CONFIG,
  createBenchmarkConfig,
};
