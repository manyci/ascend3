/* ASCEND — Isolated Benchmark Runner
   Executes identical scenarios & Barrett context across candidate providers/models. */
'use strict';

const crypto = require('crypto');
const { createBenchmarkConfig } = require('./config');
const { listAllTargets, getModelMeta } = require('./registry');
const { listScenarios } = require('./scenarios');
const { buildUnifiedRequestForTarget } = require('./context-builder');
const { resolveAdapter } = require('./providers');
const { discoverProviderModels } = require('./discovery');
const { scoreScenarioResponse, aggregateTargetReport } = require('./evaluator');
const { saveBenchmarkReport } = require('./storage');

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBenchmark({
  config: configOverrides = {},
  targets = null,
  scenarioIds = null,
  scenarioCategories = null,
  manualScores = {},
  env = process.env,
  faultInjector = null,
  latencyFn = null,
  controlProxyUrl = 'http://127.0.0.1:3000',
  includeDiscovery = undefined,
} = {}) {
  const cfg = createBenchmarkConfig(configOverrides);
  const selectedTargets = Array.isArray(targets) && targets.length
    ? targets
    : listAllTargets({ includePlaceholders: true });
  const scenarios = listScenarios({ ids: scenarioIds, categories: scenarioCategories });

  const shouldDiscover = includeDiscovery !== undefined ? Boolean(includeDiscovery) : (cfg.mode === 'live' && cfg.allowLiveRequests);
  const discovery = shouldDiscover
    ? await discoverProviderModels({ env, controlProxyUrl })
    : null;

  const runId = `bench_${new Date().toISOString().replace(/[:.]/g, '-')}_${crypto.randomBytes(3).toString('hex')}`;
  const resultsByTarget = [];
  const summary = [];

  for (const target of selectedTargets) {
    const adapter = resolveAdapter(target.providerId, {
      mode: cfg.mode,
      env,
      faultInjector,
      latencyFn,
      controlProxyUrl,
    });
    const modelMeta = getModelMeta(target.providerId, target.modelId);
    const runs = [];

    for (let i = 0; i < scenarios.length; i += 1) {
      const scenario = scenarios[i];
      const unifiedReq = buildUnifiedRequestForTarget(scenario, target.providerId, target.modelId, {
        timeoutMs: cfg.timeoutMs,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
      });

      const response = await adapter.invoke(unifiedReq, {
        mode: cfg.mode,
        allowLiveRequests: cfg.allowLiveRequests,
      });

      const overrideKey = `${target.providerId}:${target.modelId}:${scenario.id}`;
      const evaluation = scoreScenarioResponse(scenario, response, manualScores[overrideKey] || null);
      runs.push({
        scenarioId: scenario.id,
        category: scenario.category,
        lang: scenario.lang,
        plansRelevant: unifiedReq.systemInstruction.includes('Auxiliary ASCEND ActivePlans'),
        response,
        evaluation,
      });

      // Only pace between live calls when an actual API call succeeded or hit remote upstream
      if (cfg.delayBetweenCallsMs > 0 && i < scenarios.length - 1 && response.metrics.errorCode !== 'MISSING_PROVIDER_API_KEY') {
        await sleep(cfg.delayBetweenCallsMs);
      }
    }

    const aggregated = aggregateTargetReport({
      providerId: target.providerId,
      modelId: target.modelId,
      runs,
      modelMeta,
    });
    summary.push(aggregated);
    resultsByTarget.push({
      providerId: target.providerId,
      modelId: target.modelId,
      aggregated,
      runs,
    });
  }

  const report = {
    runId,
    createdAt: new Date().toISOString(),
    config: {
      mode: cfg.mode,
      allowLiveRequests: cfg.allowLiveRequests,
      timeoutMs: cfg.timeoutMs,
      delayBetweenCallsMs: cfg.delayBetweenCallsMs,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
    },
    discovery,
    scenariosCount: scenarios.length,
    scenariosMeta: scenarios.map((s) => ({
      id: s.id,
      category: s.category,
      lang: s.lang,
      title: s.title,
    })),
    summary,
    resultsByTarget,
  };

  let savedFiles = null;
  if (cfg.saveReports) {
    savedFiles = saveBenchmarkReport(report, cfg.reportsDir);
  }

  return { report, savedFiles };
}

module.exports = { runBenchmark };
