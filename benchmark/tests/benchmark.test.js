/* ASCEND — Isolated Benchmark System Verification Suite (Stage 0)
   Runs 100% offline with mock providers and mocked transport — zero real external API requests. */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { listProviders, getModelMeta, listAllTargets } = require('../registry');
const { BENCHMARK_SCENARIOS } = require('../scenarios');
const { redactSecrets, parseNormalizedBarrettPayload } = require('../contract');
const { buildUnifiedRequestForTarget } = require('../context-builder');
const { BaseProviderAdapter } = require('../providers/base');
const { GeminiBenchmarkAdapter } = require('../providers/gemini-adapter');
const { GroqBenchmarkAdapter } = require('../providers/groq-adapter');
const { OpenRouterBenchmarkAdapter } = require('../providers/openrouter-adapter');
const { MistralBenchmarkAdapter } = require('../providers/mistral-adapter');
const { CloudflareBenchmarkAdapter } = require('../providers/cloudflare-adapter');
const { registerAdapter, resolveAdapter, listRegisteredProviders } = require('../providers');
const {
  checkSecretsAvailability,
  discoverProviderModels,
} = require('../discovery');
const { QUALITY_DIMENSIONS, scoreScenarioResponse } = require('../evaluator');
const { runBenchmark } = require('../runner');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error('       ', err && err.stack ? err.stack : err);
    failed += 1;
  }
}

(async () => {
  console.log('Running ASCEND Benchmark System Verification...');

  await test('1. Registry covers Gemini, Groq (GPT-OSS 120B slot), OpenRouter (:free verified IDs), Mistral, and Cloudflare (mock-only)', () => {
    const providers = listProviders();
    const ids = providers.map((p) => p.id);
    assert.deepStrictEqual(ids, ['google-gemini', 'groq', 'openrouter', 'mistral', 'cloudflare-workers-ai']);

    const gptOss = getModelMeta('groq', 'openai/gpt-oss-120b');
    assert.ok(gptOss, 'Groq registry must include openai/gpt-oss-120b candidate slot');
    assert.strictEqual(gptOss.availabilityStatus, 'unverified_requires_api_check');
    assert.strictEqual(gptOss.pricingUsdPer1MTokens, null);

    const orFree = getModelMeta('openrouter', 'google/gemma-4-31b-it:free');
    assert.ok(orFree, 'OpenRouter registry must include verified :free candidate');
    assert.strictEqual(orFree.availabilityStatus, 'verified-in-openrouter-catalog');

    const targets = listAllTargets();
    assert.ok(targets.length >= 9);
  });

  await test('2. Scenarios include >=20 synthetic cases covering all 15 required categories', () => {
    assert.ok(BENCHMARK_SCENARIOS.length >= 20, `Expected >=20 scenarios, got ${BENCHMARK_SCENARIOS.length}`);
    const categories = new Set(BENCHMARK_SCENARIOS.map((s) => s.category));
    [
      'small_talk',
      'context_understanding',
      'in_dialog_memory',
      'topic_shift',
      'complex_analytics',
      'option_comparison',
      'argumentation',
      'ambiguous_queries',
      'long_queries',
      'barrett_persona',
      'no_nagging_activeplans',
      'russian_naturalness',
      'english_quality',
      'no_hallucination',
      'response_structure',
    ].forEach((cat) => {
      assert.ok(categories.has(cat), `Missing required scenario category: ${cat}`);
    });
  });

  await test('3. Strict API key isolation: GEMINI_API_KEY never used by other providers & secrets redacted', async () => {
    const fakeEnv = {
      GEMINI_API_KEY: 'AIzaFakeGeminiSecret1234567890',
      GROQ_API_KEY: '',
      OPENROUTER_API_KEY: '',
      MISTRAL_API_KEY: '',
    };

    const groq = new GroqBenchmarkAdapter({ env: fakeEnv });
    const openrouter = new OpenRouterBenchmarkAdapter({ env: fakeEnv });
    const mistral = new MistralBenchmarkAdapter({ env: fakeEnv });
    const gemini = new GeminiBenchmarkAdapter({ env: fakeEnv, controlProxyUrl: '' });

    assert.strictEqual(groq.getRequiredEnvVar(), 'GROQ_API_KEY');
    assert.strictEqual(groq.hasCredentials(), false);
    assert.strictEqual(openrouter.getRequiredEnvVar(), 'OPENROUTER_API_KEY');
    assert.strictEqual(openrouter.hasCredentials(), false);
    assert.strictEqual(mistral.getRequiredEnvVar(), 'MISTRAL_API_KEY');
    assert.strictEqual(mistral.hasCredentials(), false);
    assert.strictEqual(gemini.hasCredentials(), true);

    // Stage 0 safety block refuses live calls when mode=mock
    const req = buildUnifiedRequestForTarget(BENCHMARK_SCENARIOS[0], 'groq', 'openai/gpt-oss-120b');
    const blocked = await groq.invoke(req, { mode: 'mock', allowLiveRequests: false });
    assert.strictEqual(blocked.ok, false);
    assert.strictEqual(blocked.metrics.errorCode, 'LIVE_MODE_DISABLED_STAGE_0');

    // Missing credential check if live mode requested without GROQ_API_KEY
    const missingKey = await groq.invoke(req, { mode: 'live', allowLiveRequests: true });
    assert.strictEqual(missingKey.ok, false);
    assert.strictEqual(missingKey.metrics.errorCode, 'MISSING_PROVIDER_API_KEY');

    // Secret redaction check
    const leaked = 'Error Bearer gsk_abcdef1234567890 and AIzaSyFakeKey1234567890 and sk-or-v1-secret12345678';
    const redacted = redactSecrets(leaked);
    assert.ok(!redacted.includes('gsk_abcdef'));
    assert.ok(!redacted.includes('AIzaSyFakeKey'));
    assert.ok(!redacted.includes('sk-or-v1-secret'));
  });

  await test('4. Context builder sends identical systemInstruction & multi-turn Content[] to every model', () => {
    const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'topic-shift-tech-05');
    const rGem = buildUnifiedRequestForTarget(scenario, 'google-gemini', 'gemini-3.5-flash-lite');
    const rGroq = buildUnifiedRequestForTarget(scenario, 'groq', 'openai/gpt-oss-120b');
    assert.strictEqual(rGem.systemInstruction, rGroq.systemInstruction);
    assert.deepStrictEqual(rGem.contents, rGroq.contents);
    assert.ok(!rGem.systemInstruction.includes('Auxiliary ASCEND ActivePlans'), 'Topic shift must not inject ActivePlans');

    const planScenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'relevant-activeplans-15');
    const rPlan = buildUnifiedRequestForTarget(planScenario, 'mistral', 'mistral-candidate-slot-1');
    assert.ok(rPlan.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
  });

  await test('5. Prepared provider adapters & local control proxy normalize mocked responses cleanly', async () => {
    const fakeEnv = {
      GEMINI_API_KEY: 'AIzaFakeGemini1234567890',
      GROQ_API_KEY: 'gsk_fake_groq_1234567890',
      OPENROUTER_API_KEY: 'sk-or-v1-fake_or_1234567890',
      MISTRAL_API_KEY: 'mistral_fake_1234567890',
    };
    const scenario = BENCHMARK_SCENARIOS[0];

    const gemAdapter = new GeminiBenchmarkAdapter({
      env: fakeEnv,
      sdkLoader: async () => ({
        GoogleGenAI: class {
          constructor() {
            this.models = {
              generateContent: async () => ({
                text: JSON.stringify({ emotion: 'happy', reply: 'Привет! Всё отлично.', profileQuote: '', followUps: [] }),
                usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 15, totalTokenCount: 135 },
              }),
            };
          }
        },
      }),
    });
    const gemReq = buildUnifiedRequestForTarget(scenario, 'google-gemini', 'gemini-3.5-flash-lite');
    const gemRes = await gemAdapter.invoke(gemReq, { mode: 'live', allowLiveRequests: true });
    assert.strictEqual(gemRes.ok, true);
    assert.strictEqual(gemRes.parsed.reply, 'Привет! Всё отлично.');
    assert.strictEqual(gemRes.metrics.usage.totalTokens, 135);

    // Control proxy fallback when shell env lacks GEMINI_API_KEY
    const proxyGem = new GeminiBenchmarkAdapter({
      env: {},
      controlProxyUrl: 'http://127.0.0.1:3000',
      fetchFn: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: { emotion: 'neutral', reply: 'Контрольный ответ.', profileQuote: '', followUps: [] },
          meta: { model: 'gemini-3.5-flash-lite' },
        }),
      }),
    });
    const proxyRes = await proxyGem.invoke(gemReq, { mode: 'live', allowLiveRequests: true });
    assert.strictEqual(proxyRes.ok, true);
    assert.strictEqual(proxyRes.parsed.reply, 'Контрольный ответ.');
    assert.strictEqual(proxyRes.modelId, 'gemini-3.5-flash-lite');

    const mockHttpOk = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ emotion: 'neutral', reply: 'Всё по плану.', profileQuote: '', followUps: [] }) } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      }),
    });
    for (const [Ctor, pid, mid] of [
      [GroqBenchmarkAdapter, 'groq', 'openai/gpt-oss-120b'],
      [OpenRouterBenchmarkAdapter, 'openrouter', 'google/gemma-4-31b-it:free'],
      [MistralBenchmarkAdapter, 'mistral', 'mistral-candidate-slot-1'],
    ]) {
      const ad = new Ctor({ env: fakeEnv, fetchFn: mockHttpOk });
      const req = buildUnifiedRequestForTarget(scenario, pid, mid);
      const httpSpec = ad.buildHttpRequest(req);
      assert.ok(httpSpec.url.startsWith('https://'));
      const res = await ad.invoke(req, { mode: 'live', allowLiveRequests: true });
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.parsed.reply, 'Всё по плану.');
      assert.strictEqual(res.metrics.usage.totalTokens, 120);
    }

    assert.strictEqual(parseNormalizedBarrettPayload('').errorCode, 'EMPTY_RESPONSE');
    assert.strictEqual(parseNormalizedBarrettPayload('{bad').errorCode, 'INVALID_JSON');
    assert.strictEqual(parseNormalizedBarrettPayload('{"reply":"  "}').errorCode, 'EMPTY_REPLY');
  });

  await test('6. Stage 1 discovery & secrets check handle missing keys gracefully without leaking secrets', async () => {
    const mockFetch = async (url) => {
      if (String(url).includes('/api/barrett/health')) {
        return { ok: true, status: 200, json: async () => ({ ok: true, available: true, model: 'gemini-3.5-flash-lite' }) };
      }
      if (String(url).includes('openrouter.ai/api/v1/models')) {
        return { ok: true, status: 200, json: async () => ({ data: [{ id: 'google/gemma-4-31b-it:free', name: 'Gemma 4', context_length: 262144, pricing: { prompt: '0', completion: '0' } }] }) };
      }
      return { ok: false, status: 401, json: async () => ({}) };
    };
    const secrets = await checkSecretsAvailability({ env: {}, controlProxyUrl: 'http://127.0.0.1:3000', fetchFn: mockFetch });
    assert.strictEqual(secrets['google-gemini'].available, true);
    assert.strictEqual(secrets['google-gemini'].source, 'local-control-server');
    assert.strictEqual(secrets.groq.available, false);
    assert.strictEqual(secrets.openrouter.available, false);
    assert.strictEqual(secrets.mistral.available, false);

    const { catalog } = await discoverProviderModels({ env: {}, controlProxyUrl: 'http://127.0.0.1:3000', fetchFn: mockFetch });
    assert.strictEqual(catalog['google-gemini'].status, 'verified_via_control_health');
    assert.strictEqual(catalog.openrouter.freeModelsCount, 1);
    assert.strictEqual(catalog.groq.status, 'skipped_missing_key');
    assert.strictEqual(catalog.mistral.status, 'skipped_missing_key');
  });

  await test('7. Extensibility: adding a custom 5th provider works without changing Barrett', async () => {
    class CustomProviderAdapter extends BaseProviderAdapter {
      constructor(opts) { super({ providerId: 'custom-test', env: opts.env }); }
    }
    registerAdapter('custom-test', CustomProviderAdapter);
    assert.ok(listRegisteredProviders().includes('custom-test'));
    const ad = resolveAdapter('custom-test', { mode: 'mock' });
    const req = buildUnifiedRequestForTarget(BENCHMARK_SCENARIOS[0], 'custom-test', 'custom-v1');
    const res = await ad.invoke(req);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.providerId, 'custom-test');
  });

  await test('8. Evaluator scores 1-10 across 7 criteria and separates technical metrics + faults', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ascend-bench-fault-'));
    try {
      const { report } = await runBenchmark({
        config: { mode: 'mock', delayBetweenCallsMs: 0, reportsDir: tmpDir, saveReports: true },
        targets: [
          { providerId: 'google-gemini', modelId: 'gemini-3.5-flash-lite' },
          { providerId: 'groq', modelId: 'openai/gpt-oss-120b' },
        ],
        scenarioIds: ['small-talk-ru-01', 'analytics-startups-06', 'no-numeric-rating-21'],
        faultInjector: (req, pid) => {
          if (pid === 'groq' && req.scenarioId === 'analytics-startups-06') {
            return { httpStatus: 503, errorCode: 'UPSTREAM_503', errorMessage: 'Overloaded' };
          }
          if (pid === 'groq' && req.scenarioId === 'no-numeric-rating-21') {
            return { rawTextOverride: '{broken json' };
          }
          return null;
        },
      });

      const groqSummary = report.summary.find((s) => s.providerId === 'groq');
      assert.strictEqual(groqSummary.technicalMetrics.totalRequests, 3);
      assert.strictEqual(groqSummary.technicalMetrics.successfulRequests, 1);
      assert.strictEqual(groqSummary.technicalMetrics.failedRequests, 2);
      assert.strictEqual(groqSummary.technicalMetrics.httpErrorCounts['503'], 1);
      assert.strictEqual(groqSummary.technicalMetrics.httpErrorCounts['502'], 1);

      for (const dim of QUALITY_DIMENSIONS) {
        const val = groqSummary.qualityEvaluation.dimensions[dim];
        assert.ok(val >= 1 && val <= 10, `Score ${dim}=${val} must stay in 1..10`);
      }

      const manualEval = scoreScenarioResponse(
        BENCHMARK_SCENARIOS[0],
        report.resultsByTarget[0].runs[0].response,
        { intelligenceReasoning: 9.5, barrettPersonaAdherence: 9.0 }
      );
      assert.strictEqual(manualEval.judgeMode, 'hybrid-manual-override');
      assert.strictEqual(manualEval.scores.intelligenceReasoning, 9.5);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await test('9. Full end-to-end mock benchmark across all 4 providers & 22 scenarios writes isolated JSON+MD reports', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ascend-bench-full-'));
    try {
      const targets = [
        { providerId: 'google-gemini', modelId: 'gemini-3.5-flash-lite' },
        { providerId: 'groq', modelId: 'openai/gpt-oss-120b' },
        { providerId: 'openrouter', modelId: 'google/gemma-4-31b-it:free' },
        { providerId: 'mistral', modelId: 'mistral-candidate-slot-1' },
      ];
      const { report, savedFiles } = await runBenchmark({
        config: { mode: 'mock', delayBetweenCallsMs: 0, reportsDir: tmpDir, saveReports: true },
        targets,
      });

      assert.strictEqual(report.scenariosCount, BENCHMARK_SCENARIOS.length);
      assert.strictEqual(report.summary.length, 4);
      assert.ok(fs.existsSync(savedFiles.jsonPath));
      assert.ok(fs.existsSync(savedFiles.mdPath));

      const md = fs.readFileSync(savedFiles.mdPath, 'utf8');
      assert.ok(md.includes('Subjective Quality Comparison (Scale 1–10)'));
      assert.ok(md.includes('Objective Technical Metrics (Separated from Quality Scores)'));
      assert.ok(md.includes('openai/gpt-oss-120b'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await test('10. Cloudflare Workers AI adapter (mock-only): normal, empty, malformed JSON, timeout, provider error, Barrett contract & live-block', async () => {
    assert.ok(listRegisteredProviders().includes('cloudflare-workers-ai'));

    const cfMeta = getModelMeta('cloudflare-workers-ai', 'cloudflare-model-unverified');
    assert.ok(cfMeta);
    assert.strictEqual(cfMeta.availabilityStatus, 'unverified_mock_only');
    assert.strictEqual(cfMeta.pricingStatus, 'UNVERIFIED');

    const scenario = BENCHMARK_SCENARIOS[0];
    const req = buildUnifiedRequestForTarget(scenario, 'cloudflare-workers-ai', 'cloudflare-model-unverified');

    const adapterCfg = new CloudflareBenchmarkAdapter({
      accountId: 'cf-acc-mock',
      apiToken: 'cf-tok-mock',
      modelId: 'cloudflare-model-unverified',
      timeoutMs: 120,
      env: { GEMINI_API_KEY: 'AIzaShouldNeverBeReadByCloudflare' },
    });
    const cfgView = adapterCfg.getConfig();
    assert.strictEqual(cfgView.mockOnly, true);
    assert.strictEqual(cfgView.liveRequestsAllowed, false);
    assert.strictEqual(cfgView.modelStatus, 'UNVERIFIED');
    assert.strictEqual(adapterCfg.hasCredentials(), false);
    const httpSpec = adapterCfg.buildHttpRequest(req);
    assert.ok(httpSpec.url.includes('https://api.cloudflare.com/client/v4/accounts/cf-acc-mock/ai/run/cloudflare-model-unverified'));
    assert.strictEqual(httpSpec.headers.Authorization, 'Bearer cf-tok-mock');
    assert.ok(!JSON.stringify(httpSpec).includes('AIzaShouldNeverBeReadByCloudflare'));

    // 10a. Normal mock reply + Barrett contract normalization
    const cfNormal = new CloudflareBenchmarkAdapter({
      mockHandler: async () => ({
        httpStatus: 200,
        body: {
          success: true,
          result: {
            response: JSON.stringify({
              emotion: 'invalid_mood_should_fallback',
              reply: '  Всё чётко, держим фокус.  ',
              profileQuote: '  Система важнее настроения. ',
              followUps: [' План на утро ', '', 'Разбор сна'],
            }),
            usage: { prompt_tokens: 70, completion_tokens: 30, total_tokens: 100 },
          },
        },
      }),
    });
    const okRes = await cfNormal.invoke(req, { mode: 'mock' });
    assert.strictEqual(okRes.ok, true);
    assert.strictEqual(okRes.providerId, 'cloudflare-workers-ai');
    assert.strictEqual(okRes.parsed.emotion, 'neutral');
    assert.strictEqual(okRes.parsed.reply, 'Всё чётко, держим фокус.');
    assert.strictEqual(okRes.parsed.profileQuote, 'Система важнее настроения.');
    assert.deepStrictEqual(okRes.parsed.followUps, ['План на утро', 'Разбор сна']);
    assert.strictEqual(okRes.metrics.usage.totalTokens, 100);
    assert.strictEqual(okRes.metrics.isMock, true);

    // 10b. Empty response
    const cfEmpty = new CloudflareBenchmarkAdapter({
      mockHandler: async () => ({ httpStatus: 200, body: { success: true, result: { response: '   ' } } }),
    });
    const emptyRes = await cfEmpty.invoke(req, { mode: 'mock' });
    assert.strictEqual(emptyRes.ok, false);
    assert.strictEqual(emptyRes.metrics.errorCode, 'EMPTY_RESPONSE');

    // 10c. Malformed JSON
    const cfBadJson = new CloudflareBenchmarkAdapter({
      mockHandler: async () => ({ httpStatus: 200, body: { success: true, result: { response: '{bad json' } } }),
    });
    const badJsonRes = await cfBadJson.invoke(req, { mode: 'mock' });
    assert.strictEqual(badJsonRes.ok, false);
    assert.strictEqual(badJsonRes.metrics.errorCode, 'INVALID_JSON');

    // 10d. Timeout simulation
    const cfTimeout = new CloudflareBenchmarkAdapter({
      timeoutMs: 30,
      mockHandler: async () => new Promise(() => {}),
    });
    const timeoutRes = await cfTimeout.invoke(
      { ...req, options: { ...req.options, timeoutMs: 30 } },
      { mode: 'mock' }
    );
    assert.strictEqual(timeoutRes.ok, false);
    assert.strictEqual(timeoutRes.metrics.httpStatus, 504);
    assert.strictEqual(timeoutRes.metrics.errorCode, 'TIMEOUT');

    // 10e. Provider error
    const cfErr = new CloudflareBenchmarkAdapter({
      mockHandler: async () => ({
        httpStatus: 503,
        body: { success: false, errors: [{ code: 7000, message: 'Workers AI unavailable' }] },
      }),
    });
    const errRes = await cfErr.invoke(req, { mode: 'mock' });
    assert.strictEqual(errRes.ok, false);
    assert.strictEqual(errRes.metrics.httpStatus, 503);
    assert.strictEqual(errRes.metrics.errorCode, 'CF_7000');

    // 10f. Hard block on ANY live request attempt & zero live discovery calls for Cloudflare
    const liveBlocked = await cfNormal.invoke(req, { mode: 'live', allowLiveRequests: true });
    assert.strictEqual(liveBlocked.ok, false);
    assert.strictEqual(liveBlocked.metrics.errorCode, 'CLOUDFLARE_LIVE_DISABLED');

    let fetchedUrls = [];
    const { secrets, catalog } = await discoverProviderModels({
      env: { CLOUDFLARE_ACCOUNT_ID: 'acc_should_be_ignored', CLOUDFLARE_API_TOKEN: 'tok_should_be_ignored' },
      controlProxyUrl: '',
      fetchFn: async (url) => {
        fetchedUrls.push(String(url));
        return { ok: false, status: 404, json: async () => ({}) };
      },
    });
    assert.strictEqual(secrets['cloudflare-workers-ai'].available, false);
    assert.strictEqual(secrets['cloudflare-workers-ai'].source, 'disabled_mock_only');
    assert.strictEqual(catalog['cloudflare-workers-ai'].status, 'mock_only_live_disabled');
    assert.strictEqual(catalog['cloudflare-workers-ai'].errorCode, 'CLOUDFLARE_LIVE_DISABLED');
    assert.ok(!fetchedUrls.some((u) => u.includes('cloudflare.com')), 'Discovery must never call Cloudflare API');
  });

  console.log(`\nBenchmark Verification results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
