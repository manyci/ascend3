/* Stage 4.2 verification suite — Universal AI Provider Router & Opt-in Cloudflare Workers AI Fallback
   Covers:
   1. Persona-independent server/ai-provider-router.js reuse for Chico / Duo without dummy routes
   2. Strict Cloudflare REST endpoint & result.response-only extraction (never choices[])
   3. Explicit user privacy consent: OFF by default, LM.confirm required to enable, immediate revocation
   4. All 4 fallback gate conditions + transient vs non-transient Gemini errors (503/502/504/429/AI_TIMEOUT/transport/502 JSON vs 400/401/403/404/AI_NOT_CONFIGURED/abort)
   5. Zero photos to Cloudflare (chat with image, /analyze, /guide stay strictly on Gemini)
   6. Data minimization for Cloudflare (omits profile.nickname, profile.goals, memorySummary, unrelated activePlans; preserves <18 minor safety rules)
   7. Strict JSON + enum validation on Cloudflare responses (invalid/empty/bad enum -> 502 INVALID_AI_RESPONSE, daily quota not consumed)
   8. Full UI integration (Store -> app.js Privacy sheet -> ChatAPI -> ChatStore -> ChatViews fallback notice + 100% EN/RU i18n parity) */
'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const express = require('express');

const {
  DEFAULT_CLOUDFLARE_MODEL,
  createAIProviderRouter,
  extractCloudflareResponseText,
  parseProviderJson,
  convertResponseSchemaToJsonSchema,
  sanitizeProviderErrorMsg,
} = require('../../server/ai-provider-router');
const {
  createBarrettRouter,
  readConfig,
  getSafeRuntimeDiagnostics,
  buildBarrettSystemInstruction,
  buildCloudflareFallbackInstruction,
} = require('../../server/barrett');

const ROOT = path.join(__dirname, '..');

function startServer(app) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function reqJson(baseUrl, pathname, { method = 'GET', body, headers = {} } = {}) {
  const init = {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${pathname}`, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, headers: res.headers, text, json };
}

const VALID_PNG_B64 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
).toString('base64');

function loadScript(ctx, relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  vm.runInContext(code, ctx, { filename: relPath });
}

function makeMemoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] || null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    _dump() { return Object.fromEntries(map.entries()); },
  };
}

function createFullFrontendEnv({ baseUrl, storage, hash = '#/chat/barrett', lang = 'ru' } = {}) {
  const ls = storage || makeMemoryStorage();
  const win = {
    location: { hash },
    LM: {},
    innerWidth: 390,
  };
  const doc = {
    title: 'ASCEND',
    documentElement: { lang, dataset: {} },
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const ctx = vm.createContext({
    window: win,
    document: doc,
    LM: win.LM,
    localStorage: ls,
    Intl,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Promise,
    Error,
    AbortController,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console,
    fetch: async (url, init) => {
      const target = String(url).startsWith('http') ? url : `${baseUrl}${url}`;
      return fetch(target, init);
    },
  });

  loadScript(ctx, 'js/data.js');
  loadScript(ctx, 'js/i18n/en.js');
  loadScript(ctx, 'js/i18n/ru.js');
  loadScript(ctx, 'js/i18n.js');
  loadScript(ctx, 'js/store.js');
  loadScript(ctx, 'js/game.js');
  loadScript(ctx, 'js/ui.js');
  loadScript(ctx, 'js/chat-store.js');
  loadScript(ctx, 'js/chat-api.js');
  loadScript(ctx, 'js/chat-views.js');

  return { ctx, win, LM: ctx.LM, ls };
}

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
  console.log('Running Stage 4.2 Cloudflare Fallback & Privacy Consent Verification...');

  await test('Universal ai-provider-router works standalone for Chico / Duo and uses strict Cloudflare REST endpoint + result.response', async () => {
    const fetchCalls = [];
    const fallbackLogs = [];
    const router = createAIProviderRouter({
      apiKey: 'AIzaTestPrimaryKey123',
      cloudflare: { accountId: 'acc_test_123', apiToken: 'cf_tok_secret_987' },
      config: { timeoutMs: 2000, primaryFallbackTimeoutMs: 600, cloudflareTimeoutMs: 800, retryDelaysMs: [] },
      logFallbackFn: (entry) => fallbackLogs.push(entry),
      generateFn: async () => {
        const err = new Error('Gemini 503 outage');
        err.status = 503;
        throw err;
      },
      fetchFn: async (url, init) => {
        fetchCalls.push({ url, init, body: JSON.parse(init.body) });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            success: true,
            errors: [],
            messages: [],
            result: {
              response: JSON.stringify({
                emotion: 'happy',
                reply: 'Neutral Earth tones and a clean overshirt will frame your shoulders well.',
                profileQuote: '',
                followUps: ['Check jacket colors?'],
              }),
            },
          }),
        };
      },
    });

    const res = await router.generate({
      task: 'chat',
      characterId: 'chico',
      requestId: 'req_chico_1',
      route: '/api/chico/chat',
      contents: [{ role: 'user', parts: [{ text: 'What palette works best?' }] }],
      systemInstruction: 'You are Chico.',
      validatorSpec: { requiredFields: ['emotion', 'reply'], nonEmptyStrings: ['reply'], enumFields: { emotion: ['neutral', 'happy', 'sad', 'excited'] } },
      allowFallback: true,
      userConsent: true,
      hasImage: false,
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.provider, 'cloudflare-workers-ai');
    assert.strictEqual(res.model, DEFAULT_CLOUDFLARE_MODEL);
    assert.strictEqual(res.fallbackUsed, true);
    assert.strictEqual(res.data.emotion, 'happy');
    assert.strictEqual(fetchCalls.length, 1);
    assert.strictEqual(
      fetchCalls[0].url,
      'https://api.cloudflare.com/client/v4/accounts/acc_test_123/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast'
    );
    assert.strictEqual(fetchCalls[0].init.headers.Authorization, 'Bearer cf_tok_secret_987');
    assert.ok(Array.isArray(fetchCalls[0].body.messages) && fetchCalls[0].body.messages[0].role === 'system');
    assert.strictEqual(fallbackLogs.length, 1);
    assert.strictEqual(fallbackLogs[0].characterId, 'chico');
    assert.strictEqual(fallbackLogs[0].toProvider, 'cloudflare-workers-ai');
    assert.ok(!JSON.stringify(fallbackLogs).includes('cf_tok_secret_987'));
    assert.ok(!JSON.stringify(fallbackLogs).includes('acc_test_123'));

    // Duo reuse check
    const duoRes = await router.generate({
      task: 'chat',
      characterId: 'duo',
      requestId: 'req_duo_1',
      route: '/api/duo/chat',
      contents: [{ role: 'user', parts: [{ text: 'Debate fade vs flow' }] }],
      systemInstruction: 'You are Duo Mode.',
      validatorSpec: { requiredFields: ['emotion', 'reply'], nonEmptyStrings: ['reply'], enumFields: { emotion: ['neutral', 'happy', 'sad', 'excited'] } },
      allowFallback: true,
      userConsent: true,
      hasImage: false,
    });
    assert.strictEqual(duoRes.fallbackUsed, true);
    assert.strictEqual(fallbackLogs[1].characterId, 'duo');

    // Strictly rejects OpenAI-compatible choices[] without result.response
    assert.throws(
      () => extractCloudflareResponseText({ choices: [{ message: { content: '{"reply":"hi"}' } }] }),
      (e) => e.code === 'INVALID_AI_RESPONSE' && e.status === 502
    );

    const routerCode = fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'ai-provider-router.js'), 'utf8');
    assert.ok(!/barrett|chico|looksmax/i.test(routerCode), 'ai-provider-router.js must stay persona-independent');
  });

  await test('Secret sanitization redacts Gemini keys, Bearer tokens, and Cloudflare accountIds', () => {
    const cleaned = sanitizeProviderErrorMsg(
      'Failed calling https://api.cloudflare.com/client/v4/accounts/acc_secret_xyz/ai/run/x with Bearer cf_super_secret_token and key=AIzaSecret123456',
      ['acc_secret_xyz', 'cf_super_secret_token']
    );
    assert.ok(!cleaned.includes('acc_secret_xyz'));
    assert.ok(!cleaned.includes('cf_super_secret_token'));
    assert.ok(!cleaned.includes('AIzaSecret'));

    const diag = getSafeRuntimeDiagnostics({
      apiKey: 'AIzaSecret123456',
      cloudflare: { accountId: 'acc_secret_xyz', apiToken: 'cf_super_secret_token' },
    });
    assert.strictEqual(diag.GEMINI_API_KEY_PRESENT, true);
    assert.strictEqual(diag.CLOUDFLARE_CONFIGURED, true);
    assert.ok(!JSON.stringify(diag).includes('acc_secret_xyz'));
    assert.ok(!JSON.stringify(diag).includes('cf_super_secret_token'));
  });

  // Backend integration scenarios with Barrett router
  let geminiMode = 'ok';
  let cfMode = 'ok';
  let geminiCalls = 0;
  let cfCalls = [];
  const fallbackLogs = [];
  const errorLogs = [];

  const app = express();
  app.use('/api/barrett', createBarrettRouter({
    config: {
      ipRpm: 100,
      userRpm: 100,
      analyzeDailyUser: 10,
      dailyTotalCap: 25,
      cooldownMs: 0,
      timeoutMs: 1200,
      primaryFallbackTimeoutMs: 450,
      cloudflareTimeoutMs: 500,
      retryDelaysMs: [10],
    },
    cloudflare: { accountId: 'cf_acc_mock', apiToken: 'cf_tok_mock' },
    logFn: (e) => errorLogs.push(e),
    logFallbackFn: (e) => fallbackLogs.push(e),
    generateFn: async ({ abortSignal }) => {
      geminiCalls += 1;
      if (geminiMode === '503') {
        const e = new Error('Gemini overloaded');
        e.status = 503;
        throw e;
      }
      if (geminiMode === '502') {
        const e = new Error('Bad Gateway');
        e.status = 502;
        throw e;
      }
      if (geminiMode === '504') {
        const e = new Error('Gateway Timeout');
        e.status = 504;
        throw e;
      }
      if (geminiMode === '429') {
        const e = new Error('RESOURCE_EXHAUSTED');
        e.status = 429;
        throw e;
      }
      if (geminiMode === 'timeout') {
        await new Promise((resolve) => {
          if (abortSignal) abortSignal.addEventListener('abort', resolve, { once: true });
        });
        const e = new Error('Aborted');
        e.name = 'AbortError';
        throw e;
      }
      if (geminiMode === 'transport') {
        const e = new Error('connect ECONNRESET');
        e.code = 'ECONNRESET';
        throw e;
      }
      if (geminiMode === 'bad_json') {
        return { text: 'not valid json {{{' };
      }
      if (geminiMode === '400') {
        const e = new Error('INVALID_ARGUMENT');
        e.status = 400;
        throw e;
      }
      if (geminiMode === '403') {
        const e = new Error('API_KEY_INVALID');
        e.status = 403;
        throw e;
      }
      if (geminiMode === '404') {
        const e = new Error('NOT_FOUND');
        e.status = 404;
        throw e;
      }
      return {
        text: JSON.stringify({
          emotion: 'neutral',
          reply: 'Gemini primary reply.',
          profileQuote: '',
          followUps: [],
        }),
      };
    },
    cloudflareFn: async (call) => {
      cfCalls.push(call);
      if (cfMode === 'bad_json') {
        return { success: true, result: { response: '{invalid json' } };
      }
      if (cfMode === 'missing_reply') {
        return { success: true, result: { response: JSON.stringify({ emotion: 'happy', reply: '' }) } };
      }
      if (cfMode === 'bad_enum') {
        return { success: true, result: { response: JSON.stringify({ emotion: 'furious', reply: 'Valid text' }) } };
      }
      if (cfMode === '503') {
        const e = new Error('Cloudflare unavailable');
        e.status = 503;
        throw e;
      }
      return {
        success: true,
        result: {
          response: JSON.stringify({
            emotion: 'neutral',
            reply: 'Cloudflare fallback answer.',
            profileQuote: '',
            followUps: ['Follow up?'],
          }),
        },
      };
    },
  }));

  const srv = await startServer(app);
  try {
    await test('When consent is NOT given (allowCloudflareFallback omitted/false), Gemini 503 NEVER triggers Cloudflare', async () => {
      geminiMode = '503';
      cfCalls = [];
      const r = await reqJson(srv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'u_no_consent', message: 'Hello Barrett' },
      });
      assert.strictEqual(r.status, 503);
      assert.strictEqual(r.json.error.code, 'AI_UNAVAILABLE');
      assert.strictEqual(cfCalls.length, 0);
    });

    await test('When consent IS true, transient Gemini errors (503/502/504/429/timeout/transport/bad_json) fall back to Cloudflare', async () => {
      const transientModes = ['503', '502', '504', '429', 'timeout', 'transport', 'bad_json'];
      for (const mode of transientModes) {
        geminiMode = mode;
        cfCalls = [];
        const r = await reqJson(srv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: {
            clientId: `u_cf_${mode}`,
            message: `Test transient ${mode}`,
            allowCloudflareFallback: true,
          },
        });
        assert.strictEqual(r.status, 200, `Expected 200 fallback recovery for Gemini mode ${mode}, got ${r.status}`);
        assert.strictEqual(r.json.meta.provider, 'cloudflare-workers-ai');
        assert.strictEqual(r.json.meta.fallbackUsed, true);
        assert.strictEqual(r.json.meta.model, DEFAULT_CLOUDFLARE_MODEL);
        assert.strictEqual(r.json.meta.privacy.textSentToFallbackProvider, true);
        assert.strictEqual(r.json.meta.privacy.imagesSentToFallbackProvider, false);
        assert.strictEqual(cfCalls.length, 1, `Cloudflare must be called once for ${mode}`);
      }
    });

    await test('Non-transient Gemini errors (400, 403, 404) and missing Gemini key NEVER fall back to Cloudflare', async () => {
      for (const mode of ['400', '403', '404']) {
        geminiMode = mode;
        cfCalls = [];
        const r = await reqJson(srv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: `u_nontrans_${mode}`, message: 'hello', allowCloudflareFallback: true },
        });
        assert.ok(r.status >= 400);
        assert.strictEqual(cfCalls.length, 0, `Mode ${mode} must NEVER trigger Cloudflare fallback`);
      }

      const noGeminiApp = express();
      let noKeyCfCount = 0;
      noGeminiApp.use('/api/barrett', createBarrettRouter({
        apiKey: '',
        cloudflare: { accountId: 'acc_1', apiToken: 'tok_1' },
        cloudflareFn: async () => { noKeyCfCount += 1; return { success: true, result: { response: '{}' } }; },
      }));
      const noGeminiSrv = await startServer(noGeminiApp);
      try {
        const r = await reqJson(noGeminiSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_nokey', message: 'hello', allowCloudflareFallback: true },
        });
        assert.strictEqual(r.status, 503);
        assert.strictEqual(r.json.error.code, 'AI_NOT_CONFIGURED');
        assert.strictEqual(noKeyCfCount, 0);
      } finally {
        await noGeminiSrv.close();
      }
    });

    await test('Images in /chat, /analyze, and /guide NEVER fall back to Cloudflare even with consent ON', async () => {
      geminiMode = '503';
      cfCalls = [];

      const photoChat = await reqJson(srv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: {
          clientId: 'u_photo_chat',
          message: 'Check my skin',
          explicitConsent: true,
          allowCloudflareFallback: true,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      assert.strictEqual(photoChat.status, 503);
      assert.strictEqual(cfCalls.length, 0, 'Photo chat must NEVER call Cloudflare');

      const analyze = await reqJson(srv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 'u_analyze',
          explicitConsent: true,
          allowCloudflareFallback: true,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      assert.strictEqual(analyze.status, 503);
      assert.strictEqual(cfCalls.length, 0, '/analyze must NEVER call Cloudflare');

      const guide = await reqJson(srv.baseUrl, '/api/barrett/guide', {
        method: 'POST',
        body: {
          clientId: 'u_guide',
          category: 'skin',
          goal: 'Build routine',
          allowCloudflareFallback: true,
        },
      });
      assert.strictEqual(guide.status, 503);
      assert.strictEqual(cfCalls.length, 0, '/guide must NEVER call Cloudflare');
    });

    await test('Data minimization: Cloudflare omits nickname, goals, memorySummary, unrelated activePlans, but preserves <18 safety', async () => {
      geminiMode = '503';
      cfMode = 'ok';
      cfCalls = [];

      // Unrelated query -> activePlans omitted too
      const r1 = await reqJson(srv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: {
          clientId: 'u_min_1',
          lang: 'en',
          message: 'What is a good strategy game to relax with?',
          allowCloudflareFallback: true,
          profile: { nickname: 'SENSITIVE_NICK_99', age: 16, goals: ['SENSITIVE_GOAL_ABC'] },
          memorySummary: 'SENSITIVE_MEMORY_XYZ',
          activePlans: [{ id: 'p1', title: 'UNRELATED_PLAN_TITLE_777', category: 'skin', progressText: 'pending' }],
        },
      });
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r1.json.meta.fallbackUsed, true);
      const sys1 = cfCalls[0].messages[0].content;
      assert.ok(!sys1.includes('SENSITIVE_NICK_99'), 'nickname must NOT be sent to Cloudflare');
      assert.ok(!sys1.includes('SENSITIVE_GOAL_ABC'), 'goals must NOT be sent to Cloudflare');
      assert.ok(!sys1.includes('SENSITIVE_MEMORY_XYZ'), 'memorySummary must NOT be sent to Cloudflare');
      assert.ok(!sys1.includes('UNRELATED_PLAN_TITLE_777'), 'unrelated activePlans must NOT be sent to Cloudflare');
      assert.ok(sys1.includes('STRICT MINOR SAFETY (<18)'), '<18 minor safety rules MUST stay enforced');
      assert.ok(sys1.includes('NEVER assign numerical attractiveness ratings'), 'Anti-rating rule MUST stay enforced');

      // Plan-relevant query -> relevant activePlans may be included, still omitting nickname/goals/memorySummary
      cfCalls = [];
      const r2 = await reqJson(srv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: {
          clientId: 'u_min_2',
          lang: 'en',
          message: 'What should I do for my skin routine today?',
          allowCloudflareFallback: true,
          profile: { nickname: 'SENSITIVE_NICK_99', age: 22, goals: ['SENSITIVE_GOAL_ABC'] },
          memorySummary: 'SENSITIVE_MEMORY_XYZ',
          activePlans: [{ id: 'p1', title: 'AM Skin Basics', category: 'skin', progressText: 'pending' }],
        },
      });
      assert.strictEqual(r2.status, 200);
      const sys2 = cfCalls[0].messages[0].content;
      assert.ok(!sys2.includes('SENSITIVE_NICK_99'));
      assert.ok(!sys2.includes('SENSITIVE_GOAL_ABC'));
      assert.ok(!sys2.includes('SENSITIVE_MEMORY_XYZ'));
      assert.ok(sys2.includes('AM Skin Basics'), 'Relevant plan context may be included');
      assert.ok(!sys2.includes('STRICT MINOR SAFETY (<18)'), 'Adult profile should not get minor-only block');

      // Russian declension ("в активном плане") must also match PLAN_TRIGGER_RE
      cfCalls = [];
      const r3 = await reqJson(srv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: {
          clientId: 'u_min_3',
          lang: 'ru',
          message: 'Что у меня в активном плане на сегодня?',
          allowCloudflareFallback: true,
          profile: { nickname: 'SENSITIVE_NICK_99', age: 22, goals: ['SENSITIVE_GOAL_ABC'] },
          activePlans: [{ id: 'p2', title: 'Утренний уход и SPF 30+', category: 'skin', progressText: '0/1 today' }],
        },
      });
      assert.strictEqual(r3.status, 200);
      assert.ok(cfCalls[0].messages[0].content.includes('Утренний уход и SPF 30+'), 'RU declension "плане" must include relevant activePlans');
    });

    await test('Invalid JSON, empty reply, or bad enum from Cloudflare returns 502 INVALID_AI_RESPONSE and does NOT consume dailyTotalCap', async () => {
      geminiMode = '503';
      // Earlier 7 transient + 2 minimization + 0 failed = 9? Wait: dailyTotalCap was 8, let's build dedicated isolated router!
      const strictCapApp = express();
      let strictCfMode = 'bad_json';
      strictCapApp.use('/api/barrett', createBarrettRouter({
        config: { dailyTotalCap: 1, cooldownMs: 0, retryDelaysMs: [] },
        cloudflare: { accountId: 'acc', apiToken: 'tok' },
        logFn: () => {},
        logFallbackFn: () => {},
        generateFn: async () => {
          const e = new Error('503');
          e.status = 503;
          throw e;
        },
        cloudflareFn: async () => {
          if (strictCfMode === 'bad_json') return { success: true, result: { response: 'not json' } };
          if (strictCfMode === 'missing_reply') return { success: true, result: { response: JSON.stringify({ emotion: 'happy', reply: '' }) } };
          if (strictCfMode === 'bad_enum') return { success: true, result: { response: JSON.stringify({ emotion: 'angry', reply: 'hi' }) } };
          return { success: true, result: { response: JSON.stringify({ emotion: 'neutral', reply: 'Valid final reply' }) } };
        },
      }));
      const capSrv = await startServer(strictCapApp);
      try {
        for (const m of ['bad_json', 'missing_reply', 'bad_enum']) {
          strictCfMode = m;
          const bad = await reqJson(capSrv.baseUrl, '/api/barrett/chat', {
            method: 'POST',
            body: { clientId: `u_bad_${m}`, message: 'hello', allowCloudflareFallback: true },
          });
          assert.strictEqual(bad.status, 502, `Expected 502 for Cloudflare ${m}`);
          assert.strictEqual(bad.json.error.code, 'INVALID_AI_RESPONSE');
        }
        strictCfMode = 'ok';
        const good = await reqJson(capSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_good_after', message: 'hello', allowCloudflareFallback: true },
        });
        assert.strictEqual(good.status, 200, 'Failed Cloudflare responses must NOT consume dailyTotalCap');
      } finally {
        await capSrv.close();
      }
    });

    await test('Frontend E2E: default consent OFF, toggle+confirm grant & revoke, fallback notice rendered, 100% EN/RU parity', async () => {
      // Fresh router without cap issues
      let liveGeminiMode = '503';
      let lastRequestBody = null;
      const e2eApp = express();
      e2eApp.use('/api/barrett', (req, res, next) => {
        if (req.method === 'POST' && req.path === '/chat') {
          let raw = '';
          req.on('data', (c) => { raw += c; });
          req.on('end', () => {
            try { lastRequestBody = JSON.parse(raw); } catch (_) {}
          });
        }
        next();
      }, createBarrettRouter({
        config: { cooldownMs: 0, retryDelaysMs: [] },
        cloudflare: { accountId: 'acc', apiToken: 'tok' },
        logFn: () => {},
        logFallbackFn: () => {},
        generateFn: async () => {
          if (liveGeminiMode === '503') {
            const e = new Error('503');
            e.status = 503;
            throw e;
          }
          return { text: JSON.stringify({ emotion: 'happy', reply: 'Primary Gemini answer' }) };
        },
        cloudflareFn: async () => ({
          success: true,
          result: {
            response: JSON.stringify({ emotion: 'neutral', reply: 'Резервный ответ Cloudflare', followUps: [] }),
          },
        }),
      }));

      const e2eSrv = await startServer(e2eApp);
      try {
        const env = createFullFrontendEnv({ baseUrl: e2eSrv.baseUrl, lang: 'ru' });
        await env.LM.Store.boot();
        env.LM.I18n.init();

        // Check EN/RU i18n parity across UI namespaces (chat.*, sheet.*, settings.*, nav.*) and zero EN keys missing in RU
        const ruKeys = Object.keys(env.LM.Dict.ru).sort();
        const enKeys = Object.keys(env.LM.Dict.en).sort();
        assert.deepStrictEqual(enKeys.filter((k) => !(k in env.LM.Dict.ru)), [], 'Every EN key must exist in RU');
        const isUiKey = (k) => k.startsWith('chat.') || k.startsWith('sheet.') || k.startsWith('settings.') || k.startsWith('nav.');
        assert.deepStrictEqual(ruKeys.filter(isUiKey), enKeys.filter(isUiKey), 'RU and EN UI dictionaries must stay 100% in parity');
        assert.strictEqual(
          env.LM.Dict.ru['sheet.privacyFallbackToggle'],
          'Разрешить резервного AI-провайдера при сбоях Gemini'
        );
        assert.strictEqual(
          env.LM.Dict.ru['chat.fallbackNotice'],
          'Ответ обработан резервным AI-провайдером Cloudflare. Передан текстовый контекст переписки; изображения не отправлялись'
        );

        // Default privacy setting MUST be false
        assert.strictEqual(env.LM.Store.get().settings.privacy.cloudflareFallback, false);

        // With default OFF, sendBarrett sends allowCloudflareFallback: false -> Gemini 503 returns error, no Cloudflare fallback
        const rOff = await env.LM.ChatAPI.sendBarrett('Привет');
        assert.strictEqual(rOff.ok, false);
        assert.strictEqual(lastRequestBody.allowCloudflareFallback, false);

        // Grant consent in Store (simulating user confirming LM.confirm in SETTINGS.privacy)
        env.LM.Store.update((s) => { s.settings.privacy.cloudflareFallback = true; });
        const rOn = await env.LM.ChatAPI.sendBarrett('Привет с резервом');
        assert.strictEqual(rOn.ok, true);
        assert.strictEqual(lastRequestBody.allowCloudflareFallback, true);
        assert.strictEqual(rOn.meta.fallbackUsed, true);

        const msgs = env.LM.ChatStore.getMessages('barrett');
        const assistantMsg = msgs[msgs.length - 1];
        assert.strictEqual(assistantMsg.role, 'assistant');
        assert.strictEqual(assistantMsg.fallbackUsed, true);

        const htmlRu = env.LM.ChatViews.thread('barrett');
        assert.ok(
          htmlRu.includes('Ответ обработан резервным AI-провайдером Cloudflare. Передан текстовый контекст переписки; изображения не отправлялись'),
          'Russian fallback disclosure notice must be rendered on assistant reply'
        );

        // Photo send even with consent ON MUST set allowCloudflareFallback/not send to Cloudflare
        const rPhoto = await env.LM.ChatAPI.sendBarrett('Оцени уход', {
          explicitConsent: true,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64, sizeBytes: 120 },
        });
        assert.strictEqual(rPhoto.ok, false, 'Photo chat must not fall back to Cloudflare on Gemini 503');
        assert.ok(!('allowCloudflareFallback' in lastRequestBody) || lastRequestBody.allowCloudflareFallback === false);

        // Revoking consent immediately stops fallback again
        env.LM.Store.update((s) => { s.settings.privacy.cloudflareFallback = false; });
        const rRevoked = await env.LM.ChatAPI.sendBarrett('После отзыва согласия');
        assert.strictEqual(rRevoked.ok, false);
        assert.strictEqual(lastRequestBody.allowCloudflareFallback, false);

        // Gemini recovery renders normal message without fallback notice
        liveGeminiMode = 'ok';
        const rPrimary = await env.LM.ChatAPI.sendBarrett('Обычный ответ');
        assert.strictEqual(rPrimary.ok, true);
        const latestAssistant = env.LM.ChatStore.getMessages('barrett').slice(-1)[0];
        assert.ok(!latestAssistant.fallbackUsed);

        // English rendering check
        env.LM.I18n.set('en');
        const htmlEn = env.LM.ChatViews.thread('barrett');
        assert.ok(htmlEn.includes(env.LM.Dict.en['chat.fallbackNotice']));
      } finally {
        await e2eSrv.close();
      }
    });

    await test('Gemini HTTP 500 and INTERNAL status trigger bounded retry and Cloudflare fallback cleanly', async () => {
      const { readProviderRouterConfig } = require('../../server/ai-provider-router');
      assert.ok(readProviderRouterConfig().jitterRatio > 0);

      // 1. Transient HTTP 500 once -> retries on Gemini and recovers without Cloudflare
      let attemptsTransient500 = 0;
      let cf500Calls = 0;
      const app500Recover = express();
      app500Recover.use('/api/barrett', createBarrettRouter({
        config: { cooldownMs: 0, ipRpm: 100, userRpm: 100, retryDelaysMs: [10, 10], jitterRatio: 0 },
        cloudflare: { accountId: 'acc_500', apiToken: 'tok_500' },
        logFn: () => {},
        logFallbackFn: () => {},
        generateFn: async () => {
          attemptsTransient500 += 1;
          if (attemptsTransient500 === 1) {
            const e = new Error(JSON.stringify({ error: { code: 500, status: 'INTERNAL', message: 'Internal error encountered.' } }));
            e.status = 500;
            throw e;
          }
          return { text: JSON.stringify({ emotion: 'happy', reply: 'Recovered from Gemini 500!' }) };
        },
        cloudflareFn: async () => { cf500Calls += 1; return {}; },
      }));
      const srv500Recover = await startServer(app500Recover);
      try {
        const resOk = await reqJson(srv500Recover.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_500_recover', message: 'Retry 500 test', allowCloudflareFallback: true },
        });
        assert.strictEqual(resOk.status, 200);
        assert.strictEqual(resOk.json.meta.provider, 'gemini');
        assert.strictEqual(resOk.json.meta.fallbackUsed, false);
        assert.strictEqual(attemptsTransient500, 2);
        assert.strictEqual(cf500Calls, 0);
      } finally {
        await srv500Recover.close();
      }

      // 2. Persistent Gemini 500 -> consent OFF returns 503 after retries; consent ON falls back to Cloudflare
      let persistentAttempts = 0;
      let persistentLogs = [];
      let persistentCfCalls = 0;
      const app500Persist = express();
      app500Persist.use('/api/barrett', createBarrettRouter({
        config: { cooldownMs: 0, ipRpm: 100, userRpm: 100, retryDelaysMs: [10, 10], jitterRatio: 0 },
        cloudflare: { accountId: 'acc_500p', apiToken: 'tok_500p' },
        logFn: (e) => persistentLogs.push(e),
        logFallbackFn: () => {},
        generateFn: async () => {
          persistentAttempts += 1;
          const e = new Error('Internal Server Error');
          e.status = 500;
          throw e;
        },
        cloudflareFn: async () => {
          persistentCfCalls += 1;
          return {
            success: true,
            result: { response: JSON.stringify({ emotion: 'neutral', reply: 'Cloudflare recovered Gemini 500.' }) },
          };
        },
      }));
      const srv500Persist = await startServer(app500Persist);
      try {
        const rOff = await reqJson(srv500Persist.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_500_off', message: 'Persistent 500 off', allowCloudflareFallback: false },
        });
        assert.strictEqual(rOff.status, 503);
        assert.strictEqual(rOff.json.error.code, 'AI_UNAVAILABLE');
        assert.strictEqual(rOff.json.error.retryable, true);
        assert.strictEqual(persistentAttempts, 3, 'Persistent 500 should execute initial + 2 retries');
        assert.strictEqual(persistentLogs[0].attempts, 3);
        assert.strictEqual(persistentCfCalls, 0);

        persistentAttempts = 0;
        const rOn = await reqJson(srv500Persist.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_500_on', message: 'Persistent 500 on', allowCloudflareFallback: true },
        });
        assert.strictEqual(rOn.status, 200);
        assert.strictEqual(rOn.json.meta.provider, 'cloudflare-workers-ai');
        assert.strictEqual(rOn.json.meta.fallbackUsed, true);
        assert.strictEqual(persistentAttempts, 3);
        assert.strictEqual(persistentCfCalls, 1);
      } finally {
        await srv500Persist.close();
      }
    });

    await test('Gemini INVALID_AI_RESPONSE (bad_json) makes strictly 1 Gemini attempt (zero bogus 502 retries)', async () => {
      let badJsonGeminiCalls = 0;
      let badJsonCfCalls = 0;
      const errLogs = [];
      const appBadJson = express();
      appBadJson.use('/api/barrett', createBarrettRouter({
        config: { cooldownMs: 0, ipRpm: 100, userRpm: 100, retryDelaysMs: [350, 350], jitterRatio: 0 },
        cloudflare: { accountId: 'acc_bj', apiToken: 'tok_bj' },
        logFn: (e) => errLogs.push(e),
        logFallbackFn: () => {},
        generateFn: async () => {
          badJsonGeminiCalls += 1;
          return { text: 'not valid json {{{' };
        },
        cloudflareFn: async () => {
          badJsonCfCalls += 1;
          return {
            success: true,
            result: { response: JSON.stringify({ emotion: 'neutral', reply: 'Fallback fixed bad JSON.' }) },
          };
        },
      }));
      const srvBadJson = await startServer(appBadJson);
      try {
        const t0 = Date.now();
        const rOff = await reqJson(srvBadJson.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_bj_off', message: 'Bad json off', allowCloudflareFallback: false },
        });
        const elapsedOff = Date.now() - t0;
        assert.strictEqual(rOff.status, 502);
        assert.strictEqual(rOff.json.error.code, 'INVALID_AI_RESPONSE');
        assert.strictEqual(rOff.json.error.retryable, true);
        assert.strictEqual(badJsonGeminiCalls, 1, 'bad_json must NOT retry on Gemini');
        assert.strictEqual(errLogs[0].attempts, 1);
        assert.strictEqual(badJsonCfCalls, 0);
        assert.ok(elapsedOff < 250, `Expected fail-fast without retry sleep, took ${elapsedOff}ms`);

        badJsonGeminiCalls = 0;
        const t1 = Date.now();
        const rOn = await reqJson(srvBadJson.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_bj_on', message: 'Bad json on', allowCloudflareFallback: true },
        });
        const elapsedOn = Date.now() - t1;
        assert.strictEqual(rOn.status, 200);
        assert.strictEqual(rOn.json.meta.provider, 'cloudflare-workers-ai');
        assert.strictEqual(badJsonGeminiCalls, 1, 'bad_json must switch to Cloudflare immediately after 1 Gemini attempt');
        assert.strictEqual(badJsonCfCalls, 1);
        assert.ok(elapsedOn < 250, `Expected immediate fallback without retry sleep, took ${elapsedOn}ms`);
      } finally {
        await srvBadJson.close();
      }
    });

    await test('Backoff jitter stays bounded (~±25%), respects deadline, and AbortSignal cancels retry sleep immediately', async () => {
      const { computeJitteredDelayMs } = require('../../server/ai-provider-router');
      assert.strictEqual(computeJitteredDelayMs(100, 0.25, () => 0), 75);
      assert.strictEqual(computeJitteredDelayMs(100, 0.25, () => 0.5), 100);
      assert.strictEqual(computeJitteredDelayMs(100, 0.25, () => 1), 125);

      // AbortSignal firing during long backoff sleep cancels promptly without hanging or calling Cloudflare
      let abortGeminiCalls = 0;
      let abortCfCalls = 0;
      const abortRouter = createAIProviderRouter({
        apiKey: 'AIzaTestKey',
        cloudflare: { accountId: 'acc_ab', apiToken: 'tok_ab' },
        config: { timeoutMs: 10000, primaryFallbackTimeoutMs: 7000, retryDelaysMs: [4000], jitterRatio: 0.25 },
        randomFn: () => 0.5,
        logFallbackFn: () => {},
        generateFn: async () => {
          abortGeminiCalls += 1;
          const e = new Error('503');
          e.status = 503;
          throw e;
        },
        cloudflareFn: async () => {
          abortCfCalls += 1;
          return { text: '{}' };
        },
      });
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 45);
      const t0 = Date.now();
      await assert.rejects(
        () => abortRouter.generate({
          contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
          allowFallback: true,
          userConsent: true,
          hasImage: false,
          clientSignal: ac.signal,
        }),
        (err) => err && err.name === 'AbortError'
      );
      const elapsed = Date.now() - t0;
      assert.ok(elapsed < 400, `AbortSignal must cancel backoff sleep immediately, took ${elapsed}ms`);
      assert.strictEqual(abortGeminiCalls, 1);
      assert.strictEqual(abortCfCalls, 0);

      // Deadline guard: when retry delay exceeds remaining deadline margin, router skips sleep and switches to fallback fast
      let deadlineGeminiCalls = 0;
      const deadlineRouter = createAIProviderRouter({
        apiKey: 'AIzaTestKey',
        cloudflare: { accountId: 'acc_dl', apiToken: 'tok_dl' },
        config: { timeoutMs: 1200, primaryFallbackTimeoutMs: 400, cloudflareTimeoutMs: 600, retryDelaysMs: [500], jitterRatio: 0 },
        logFallbackFn: () => {},
        generateFn: async () => {
          deadlineGeminiCalls += 1;
          const e = new Error('503');
          e.status = 503;
          throw e;
        },
        cloudflareFn: async () => ({
          success: true,
          result: { response: JSON.stringify({ emotion: 'neutral', reply: 'Skipped long retry cleanly' }) },
        }),
      });
      const t1 = Date.now();
      const dlRes = await deadlineRouter.generate({
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        allowFallback: true,
        userConsent: true,
        hasImage: false,
      });
      assert.strictEqual(dlRes.fallbackUsed, true);
      assert.strictEqual(deadlineGeminiCalls, 1);
      assert.ok(Date.now() - t1 < 350);
    });

    await test('Double failures & Cloudflare error variants return safe retryable errors, zero secret leak, and release concurrency/quota slots', async () => {
      let doubleGeminiMode = '503';
      let doubleCfHttpStatus = 503;
      let doubleCfMode = 'http_error';
      const secretAcct = 'acc_SECRET_DONT_LEAK_99';
      const secretTok = 'cf_SECRET_TOKEN_DONT_LEAK_88';

      const doubleApp = express();
      doubleApp.use('/api/barrett', createBarrettRouter({
        config: {
          ipRpm: 100,
          userRpm: 100,
          dailyTotalCap: 1,
          maxConcurrent: 1,
          cooldownMs: 0,
          timeoutMs: 900,
          primaryFallbackTimeoutMs: 320,
          cloudflareTimeoutMs: 320,
          retryDelaysMs: [],
        },
        cloudflare: { accountId: secretAcct, apiToken: secretTok },
        logFn: () => {},
        logFallbackFn: () => {},
        generateFn: async ({ abortSignal }) => {
          if (doubleGeminiMode === 'ok') {
            return { text: JSON.stringify({ emotion: 'happy', reply: 'Recovered slot works!' }) };
          }
          if (doubleGeminiMode === 'timeout') {
            await new Promise((resolve) => {
              if (abortSignal) abortSignal.addEventListener('abort', resolve, { once: true });
            });
            const e = new Error('Aborted');
            e.name = 'AbortError';
            throw e;
          }
          const e = new Error(`Gemini upstream ${doubleGeminiMode}`);
          e.status = Number(doubleGeminiMode) || 503;
          throw e;
        },
        fetchFn: async (url, init) => {
          if (doubleCfMode === 'timeout') {
            await new Promise((resolve) => {
              if (init && init.signal) init.signal.addEventListener('abort', resolve, { once: true });
            });
            const e = new Error('Aborted');
            e.name = 'AbortError';
            throw e;
          }
          if (doubleCfMode === 'choices_only') {
            return {
              ok: true,
              status: 200,
              text: async () => JSON.stringify({ choices: [{ message: { content: '{"emotion":"neutral","reply":"nope"}' } }] }),
            };
          }
          return {
            ok: false,
            status: doubleCfHttpStatus,
            text: async () => JSON.stringify({
              success: false,
              errors: [{ code: 10000, message: `Failed accounts/${secretAcct} with Bearer ${secretTok}` }],
            }),
          };
        },
      }));

      const doubleSrv = await startServer(doubleApp);
      try {
        const scenarios = [
          { g: '503', cfMode: 'http_error', cfStatus: 503, expStatus: 503, expCode: 'AI_UNAVAILABLE' },
          { g: '503', cfMode: 'http_error', cfStatus: 504, expStatus: 503, expCode: 'AI_UNAVAILABLE' },
          { g: '503', cfMode: 'http_error', cfStatus: 500, expStatus: 503, expCode: 'AI_UNAVAILABLE' },
          { g: '500', cfMode: 'http_error', cfStatus: 503, expStatus: 503, expCode: 'AI_UNAVAILABLE' },
          { g: '503', cfMode: 'http_error', cfStatus: 403, expStatus: 503, expCode: 'AI_UNAVAILABLE' },
          { g: '503', cfMode: 'http_error', cfStatus: 401, expStatus: 503, expCode: 'AI_UNAVAILABLE' },
          { g: '503', cfMode: 'http_error', cfStatus: 404, expStatus: 503, expCode: 'AI_UNAVAILABLE' },
          { g: '503', cfMode: 'http_error', cfStatus: 400, expStatus: 503, expCode: 'AI_UNAVAILABLE' },
          { g: '503', cfMode: 'http_error', cfStatus: 429, expStatus: 429, expCode: 'AI_QUOTA_EXCEEDED' },
          { g: '503', cfMode: 'choices_only', cfStatus: 200, expStatus: 502, expCode: 'INVALID_AI_RESPONSE' },
          { g: '503', cfMode: 'timeout', cfStatus: 504, expStatus: 504, expCode: 'AI_TIMEOUT' },
          { g: 'timeout', cfMode: 'timeout', cfStatus: 504, expStatus: 504, expCode: 'AI_TIMEOUT' },
        ];

        for (let i = 0; i < scenarios.length; i += 1) {
          const sc = scenarios[i];
          doubleGeminiMode = sc.g;
          doubleCfMode = sc.cfMode;
          doubleCfHttpStatus = sc.cfStatus;
          const r = await reqJson(doubleSrv.baseUrl, '/api/barrett/chat', {
            method: 'POST',
            body: {
              clientId: `u_dbl_${i}`,
              message: `Double failure scenario ${i}`,
              allowCloudflareFallback: true,
            },
          });
          assert.strictEqual(r.status, sc.expStatus, `Scenario ${sc.g}->${sc.cfMode}/${sc.cfStatus} status mismatch`);
          assert.strictEqual(r.json.error.code, sc.expCode, `Scenario ${sc.g}->${sc.cfMode}/${sc.cfStatus} code mismatch`);
          assert.strictEqual(r.json.error.retryable, true, `Scenario ${sc.g}->${sc.cfMode}/${sc.cfStatus} MUST stay retryable so UI Retry stays enabled`);
          assert.ok(!r.text.includes(secretAcct), 'Cloudflare accountId must never leak');
          assert.ok(!r.text.includes(secretTok), 'Cloudflare token must never leak');
          assert.ok(!r.text.includes('AI_AUTH_ERROR'), 'Backup auth error must not surface as non-retryable AI_AUTH_ERROR');
          assert.ok(!r.text.includes('AI_MODEL_UNAVAILABLE'), 'Backup 404 must not surface as non-retryable AI_MODEL_UNAVAILABLE');
        }

        // Concurrency slot (maxConcurrent: 1) AND dailyTotalCap (1) must remain free after all 12 double failures!
        doubleGeminiMode = 'ok';
        const recovered = await reqJson(doubleSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_dbl_final', message: 'Final check', allowCloudflareFallback: true },
        });
        assert.strictEqual(recovered.status, 200, 'Both concurrency slot and dailyTotalCap must be preserved after double failures');
        assert.strictEqual(recovered.json.meta.provider, 'gemini');
      } finally {
        await doubleSrv.close();
      }
    });

    await test('Tight 10s Vercel-compatible timeout budget finishes Gemini timeout -> Cloudflare fallback well within limit', async () => {
      const { readProviderRouterConfig } = require('../../server/ai-provider-router');
      const tightCfg = readProviderRouterConfig({
        timeoutMs: 8500,
        primaryFallbackTimeoutMs: 4500,
        cloudflareTimeoutMs: 3500,
        retryDelaysMs: '250,500',
      });
      assert.strictEqual(tightCfg.timeoutMs, 8500);
      assert.strictEqual(tightCfg.primaryFallbackTimeoutMs, 4500);
      assert.strictEqual(tightCfg.cloudflareTimeoutMs, 3500);
      assert.deepStrictEqual(tightCfg.retryDelaysMs, [250, 500]);

      const tightApp = express();
      tightApp.use('/api/barrett', createBarrettRouter({
        config: {
          timeoutMs: 8500,
          primaryFallbackTimeoutMs: 350, // scaled fast execution while budget clamping verified above
          cloudflareTimeoutMs: 3500,
          retryDelaysMs: [],
          cooldownMs: 0,
        },
        cloudflare: { accountId: 'acc_tight', apiToken: 'tok_tight' },
        logFn: () => {},
        logFallbackFn: () => {},
        generateFn: async ({ abortSignal }) => {
          await new Promise((resolve) => {
            if (abortSignal) abortSignal.addEventListener('abort', resolve, { once: true });
          });
          const e = new Error('Aborted');
          e.name = 'AbortError';
          throw e;
        },
        cloudflareFn: async () => ({
          success: true,
          result: { response: JSON.stringify({ emotion: 'neutral', reply: 'Completed inside tight Vercel budget.' }) },
        }),
      }));
      const tightSrv = await startServer(tightApp);
      try {
        const t0 = Date.now();
        const r = await reqJson(tightSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_tight_10s', message: 'Tight budget check', allowCloudflareFallback: true },
        });
        const elapsed = Date.now() - t0;
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.json.meta.fallbackUsed, true);
        assert.ok(elapsed < 8500 && elapsed >= 300, `Expected prompt timeout+fallback, got ${elapsed}ms`);
      } finally {
        await tightSrv.close();
      }
    });

    await test('Real app.js + ui.js DOM consent lifecycle (Cancel / Confirm / Disable / Reload) and Chico/Duo local isolation', async () => {
      let apiCallsCount = 0;
      const domApp = express();
      domApp.use('/api/barrett', (req, res, next) => {
        apiCallsCount += 1;
        next();
      }, createBarrettRouter({
        config: { cooldownMs: 0, retryDelaysMs: [] },
        cloudflare: { accountId: 'acc_dom', apiToken: 'tok_dom' },
        logFn: () => {},
        logFallbackFn: () => {},
        generateFn: async () => ({ text: JSON.stringify({ emotion: 'neutral', reply: 'Barrett live' }) }),
        cloudflareFn: async () => ({ success: true, result: { response: '{}' } }),
      }));

      function createInteractiveDomEnv({ baseUrl, storage, hash = '#/settings', lang = 'ru' }) {
        const ls = storage || makeMemoryStorage();
        const timers = new Set();
        const intervals = new Set();
        const docListeners = new Map();
        const winListeners = new Map();
        const observers = [];

        function parseAttrs(raw) {
          const attrs = {};
          const re = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
          let m;
          while ((m = re.exec(raw))) {
            attrs[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
          }
          return attrs;
        }

        function matchesSel(node, sel) {
          if (!node || !node.tagName) return false;
          const parts = sel.trim().split(/\s+/);
          if (parts.length > 1) {
            // match simple descendant chain
            if (!matchesSel(node, parts[parts.length - 1])) return false;
            let cur = node.parentNode;
            for (let i = parts.length - 2; i >= 0; i -= 1) {
              while (cur && !matchesSel(cur, parts[i])) cur = cur.parentNode;
              if (!cur) return false;
              cur = cur.parentNode;
            }
            return true;
          }
          let rem = sel.trim();
          const tagM = rem.match(/^[a-zA-Z0-9_-]+/);
          if (tagM) {
            if (node.tagName !== tagM[0].toUpperCase()) return false;
            rem = rem.slice(tagM[0].length);
          }
          while (rem.length) {
            if (rem[0] === '#') {
              const m = rem.match(/^#([a-zA-Z0-9_-]+)/);
              if (!m || node.id !== m[1]) return false;
              rem = rem.slice(m[0].length);
            } else if (rem[0] === '.') {
              const m = rem.match(/^\.([a-zA-Z0-9_-]+)/);
              if (!m || !node.classList.contains(m[1])) return false;
              rem = rem.slice(m[0].length);
            } else if (rem[0] === '[') {
              const m = rem.match(/^\[([a-zA-Z0-9_:-]+)(?:=["']?([^"'\]]*)["']?)?\]/);
              if (!m) return false;
              const val = node.getAttribute(m[1]);
              if (val === null) return false;
              if (m[2] !== undefined && val !== m[2]) return false;
              rem = rem.slice(m[0].length);
            } else {
              return false;
            }
          }
          return true;
        }

        function makeEl(tag, initialAttrs = {}) {
          const children = [];
          const listeners = new Map();
          const attrs = {};
          const dataset = {};
          const classSet = new Set();
          let inner = '';
          let textVal = '';
          const el = {
            tagName: String(tag).toUpperCase(),
            parentNode: null,
            children,
            style: {},
            value: '',
            checked: false,
            disabled: false,
            hidden: false,
            scrollHeight: 24,
            scrollTop: 0,
            dataset,
            get id() { return attrs.id || ''; },
            set id(v) { attrs.id = String(v); },
            get className() { return Array.from(classSet).join(' '); },
            set className(v) {
              classSet.clear();
              String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
              attrs.class = Array.from(classSet).join(' ');
            },
            classList: {
              add(...cs) { cs.forEach((c) => c && classSet.add(c)); attrs.class = Array.from(classSet).join(' '); },
              remove(...cs) { cs.forEach((c) => classSet.delete(c)); attrs.class = Array.from(classSet).join(' '); },
              contains(c) { return classSet.has(c); },
              toggle(c, force) {
                const on = force !== undefined ? Boolean(force) : !classSet.has(c);
                if (on) classSet.add(c); else classSet.delete(c);
                attrs.class = Array.from(classSet).join(' ');
                return on;
              },
            },
            setAttribute(k, v) {
              const lk = String(k).toLowerCase();
              attrs[lk] = String(v);
              if (lk === 'class') el.className = String(v);
              if (lk.startsWith('data-')) {
                const camel = lk.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
                dataset[camel] = String(v);
              }
              if (lk === 'value') el.value = String(v);
              if (lk === 'disabled') el.disabled = true;
            },
            getAttribute(k) {
              const lk = String(k).toLowerCase();
              return Object.prototype.hasOwnProperty.call(attrs, lk) ? attrs[lk] : null;
            },
            hasAttribute(k) { return el.getAttribute(k) !== null; },
            appendChild(child) {
              children.push(child);
              child.parentNode = el;
              observers.forEach((o) => { if (!o.disconnected && o.target === el) queueMicrotask(o.cb); });
              return child;
            },
            remove() {
              if (!el.parentNode) return;
              const p = el.parentNode;
              const idx = p.children.indexOf(el);
              if (idx >= 0) p.children.splice(idx, 1);
              el.parentNode = null;
              observers.forEach((o) => { if (!o.disconnected && o.target === p) queueMicrotask(o.cb); });
            },
            contains(target) {
              if (target === el) return true;
              return children.some((c) => c.contains(target));
            },
            closest(sel) {
              let cur = el;
              while (cur) {
                if (matchesSel(cur, sel)) return cur;
                cur = cur.parentNode;
              }
              return null;
            },
            querySelectorAll(sel) {
              const out = [];
              const walk = (node) => {
                for (const c of node.children) {
                  if (matchesSel(c, sel)) out.push(c);
                  walk(c);
                }
              };
              walk(el);
              return out;
            },
            querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
            addEventListener(type, fn) {
              if (!listeners.has(type)) listeners.set(type, []);
              listeners.get(type).push(fn);
            },
            removeEventListener(type, fn) {
              const arr = listeners.get(type);
              if (arr) listeners.set(type, arr.filter((f) => f !== fn));
            },
            dispatchEvent(ev) {
              const event = Object.assign({
                type: 'click',
                target: el,
                defaultPrevented: false,
                preventDefault() { event.defaultPrevented = true; },
                stopPropagation() { event._stopped = true; },
              }, ev);
              let cur = el;
              while (cur && !event._stopped) {
                const fns = cur._listeners.get(event.type) || [];
                for (const fn of fns) {
                  fn(event);
                }
                cur = cur.parentNode;
              }
              if (!event._stopped) {
                const docFns = docListeners.get(event.type) || [];
                for (const fn of docFns) {
                  fn(event);
                }
              }
              return !event.defaultPrevented;
            },
            click() { return el.dispatchEvent({ type: 'click', target: el }); },
            focus() {},
            select() {},
            scrollIntoView() {},
            _listeners: listeners,
            _addText(t) { textVal += t; },
            get textContent() { return textVal; },
            set textContent(v) { textVal = String(v == null ? '' : v); },
            get innerHTML() { return inner; },
            set innerHTML(html) {
              inner = String(html || '');
              children.length = 0;
              textVal = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              const voidTags = new Set(['input', 'img', 'br', 'hr', 'path', 'circle', 'line', 'rect', 'polygon', 'stop']);
              const stack = [el];
              const tagRe = /<\/?([a-zA-Z0-9_-]+)([^>]*)>|([^<]+)/g;
              let m;
              while ((m = tagRe.exec(inner))) {
                if (m[3]) {
                  if (stack.length > 1) stack[stack.length - 1]._addText(m[3]);
                  continue;
                }
                const full = m[0];
                const tName = m[1].toLowerCase();
                if (full.startsWith('</')) {
                  if (stack.length > 1) stack.pop();
                  continue;
                }
                const selfClose = full.endsWith('/>') || voidTags.has(tName);
                const child = makeEl(tName, parseAttrs(m[2] || ''));
                stack[stack.length - 1].appendChild(child);
                if (!selfClose) stack.push(child);
              }
            },
          };
          for (const [k, v] of Object.entries(initialAttrs)) el.setAttribute(k, v);
          return el;
        }

        const bodyEl = makeEl('body');
        const shellEl = makeEl('div', { class: 'shell' });
        const appEl = makeEl('div', { id: 'app', class: 'app' });
        const viewEl = makeEl('main', { id: 'view', class: 'view' });
        const navEl = makeEl('nav', { id: 'nav', class: 'nav' });
        const toastsEl = makeEl('div', { id: 'toasts', class: 'toasts' });
        appEl.appendChild(viewEl);
        appEl.appendChild(navEl);
        appEl.appendChild(toastsEl);
        shellEl.appendChild(appEl);
        bodyEl.appendChild(shellEl);

        const doc = {
          title: 'ASCEND',
          body: bodyEl,
          documentElement: { lang, dataset: {}, setAttribute() {}, style: {} },
          activeElement: null,
          createElement: (tag) => makeEl(tag),
          getElementById: (id) => bodyEl.querySelector(`#${id}`),
          querySelector: (sel) => bodyEl.querySelector(sel),
          querySelectorAll: (sel) => bodyEl.querySelectorAll(sel),
          addEventListener: (type, fn) => {
            if (!docListeners.has(type)) docListeners.set(type, []);
            docListeners.get(type).push(fn);
          },
        };

        const win = {
          LM: {},
          innerWidth: 390,
          scrollTo() {},
          addEventListener: (type, fn) => {
            if (!winListeners.has(type)) winListeners.set(type, []);
            winListeners.get(type).push(fn);
          },
          location: {
            _hash: hash,
            get hash() { return this._hash; },
            set hash(v) {
              this._hash = v;
              (winListeners.get('hashchange') || []).forEach((fn) => fn());
            },
          },
        };

        class FakeMutationObserver {
          constructor(cb) { this.cb = cb; this.rec = null; }
          observe(target) {
            this.rec = { target, cb: this.cb, disconnected: false };
            observers.push(this.rec);
          }
          disconnect() {
            if (this.rec) this.rec.disconnected = true;
          }
        }

        const ctx = vm.createContext({
          window: win,
          document: doc,
          location: win.location,
          LM: win.LM,
          localStorage: ls,
          MutationObserver: FakeMutationObserver,
          Intl,
          Date,
          Math,
          Number,
          String,
          Boolean,
          Array,
          Object,
          Set,
          Map,
          JSON,
          Promise,
          Error,
          AbortController,
          encodeURIComponent,
          decodeURIComponent,
          setTimeout: (fn, ms) => {
            const id = setTimeout(fn, ms);
            if (id.unref) id.unref();
            timers.add(id);
            return id;
          },
          clearTimeout: (id) => { timers.delete(id); clearTimeout(id); },
          setInterval: (fn, ms) => {
            const id = setInterval(fn, ms);
            if (id.unref) id.unref();
            intervals.add(id);
            return id;
          },
          clearInterval: (id) => { intervals.delete(id); clearInterval(id); },
          console,
          fetch: async (url, init) => {
            const target = String(url).startsWith('http') ? url : `${baseUrl}${url}`;
            return fetch(target, init);
          },
        });

        [
          'js/data.js',
          'js/practices.js',
          'js/demos.js',
          'js/i18n/en.js',
          'js/i18n/ru.js',
          'js/i18n.js',
          'js/store.js',
          'js/backup.js',
          'js/game.js',
          'js/ui.js',
          'js/views.js',
          'js/chat-store.js',
          'js/chat-api.js',
          'js/chat-views.js',
          'js/app.js',
        ].forEach((p) => loadScript(ctx, p));

        return {
          ctx,
          win,
          doc,
          LM: ctx.LM,
          ls,
          dispose() {
            timers.forEach((id) => clearTimeout(id));
            intervals.forEach((id) => clearInterval(id));
          },
        };
      }

      const domSrv = await startServer(domApp);
      const sharedStorage = makeMemoryStorage();
      let env1 = null;
      let env2 = null;
      try {
        env1 = createInteractiveDomEnv({ baseUrl: domSrv.baseUrl, storage: sharedStorage, hash: '#/settings', lang: 'ru' });
        await new Promise((r) => setTimeout(r, 35));

        // 1. Default OFF
        assert.strictEqual(env1.LM.Store.get().settings.privacy.cloudflareFallback, false);

        // 2. Open Privacy sheet via real UI click on Settings row
        const privRow = env1.doc.querySelector('[data-act="open-setting"][data-k="privacy"]');
        assert.ok(privRow, 'Settings screen must render Privacy button');
        await privRow.click();

        const noteEl = env1.doc.getElementById('privacy-cf-note');
        assert.ok(noteEl, 'Privacy sheet must show Cloudflare explanation note');
        assert.ok(noteEl.textContent.includes('Cloudflare') && noteEl.textContent.includes('текст сообщения') && noteEl.textContent.includes('историю переписки') && noteEl.textContent.includes('системную инструкцию'));

        // 3. Click toggle -> Confirm dialog opens -> Click Cancel (#cf-no) -> stays false
        await env1.doc.getElementById('t-cf-fallback').click();
        assert.ok(env1.doc.getElementById('cf-ok') && env1.doc.getElementById('cf-no'), 'LM.confirm sheet must open before enabling fallback');
        await env1.doc.getElementById('cf-no').click();
        await new Promise((r) => setTimeout(r, 10));
        assert.strictEqual(env1.LM.Store.get().settings.privacy.cloudflareFallback, false, 'Cancel must keep cloudflareFallback false');

        // 4. Click toggle -> Confirm (#cf-ok) -> becomes true and toggle renders .sw.on
        await env1.doc.getElementById('t-cf-fallback').click();
        await env1.doc.getElementById('cf-ok').click();
        await new Promise((r) => setTimeout(r, 10));
        assert.strictEqual(env1.LM.Store.get().settings.privacy.cloudflareFallback, true, 'Confirm must enable cloudflareFallback');
        assert.ok(env1.doc.getElementById('t-cf-fallback').querySelector('.sw').classList.contains('on'));

        // 5. Simulate full page reload with same localStorage -> persisted state remains true
        env1.dispose();
        env1 = null;
        env2 = createInteractiveDomEnv({ baseUrl: domSrv.baseUrl, storage: sharedStorage, hash: '#/settings', lang: 'ru' });
        await new Promise((r) => setTimeout(r, 35));
        assert.strictEqual(env2.LM.Store.get().settings.privacy.cloudflareFallback, true, 'Consent must persist across reload');

        // 6. Toggle OFF in Privacy sheet -> becomes false immediately without confirmation
        await env2.doc.querySelector('[data-act="open-setting"][data-k="privacy"]').click();
        await env2.doc.getElementById('t-cf-fallback').click();
        assert.strictEqual(env2.LM.Store.get().settings.privacy.cloudflareFallback, false, 'Disabling fallback must take effect immediately');
        assert.ok(!env2.doc.getElementById('t-cf-fallback').querySelector('.sw').classList.contains('on'));

        // 7. Chico & Duo local composer isolation: submit #chat-form on #/chat/chico and #/chat/duo -> 0 API calls
        apiCallsCount = 0;
        for (const threadId of ['chico', 'duo']) {
          env2.win.location.hash = `#/chat/${threadId}`;
          const chatInput = env2.doc.getElementById('chat-input');
          const chatForm = env2.doc.getElementById('chat-form');
          assert.ok(chatInput && chatForm, `Composer must render for ${threadId}`);
          const beforeCount = env2.LM.ChatStore.getMessages(threadId).length;
          chatInput.value = `Local check for ${threadId}`;
          await chatForm.dispatchEvent({ type: 'submit', target: chatForm });
          const msgs = env2.LM.ChatStore.getMessages(threadId);
          assert.strictEqual(msgs.length, beforeCount + 1);
          assert.strictEqual(msgs[msgs.length - 1].text, `Local check for ${threadId}`);
          assert.strictEqual(msgs[msgs.length - 1].sender, 'user');
        }
        assert.strictEqual(apiCallsCount, 0, 'Chico and Duo chats must stay strictly local with 0 API calls');
      } finally {
        if (env1) env1.dispose();
        if (env2) env2.dispose();
        await domSrv.close();
      }
    });

    await test('Cloudflare stabilization: forwards JSON Schema response_format, parses object/prose result.response, preserves 3400-char RU replies & ASCEND anti-hallucination rules', async () => {
      const schemaOut = convertResponseSchemaToJsonSchema({
        type: 'OBJECT',
        properties: {
          emotion: { type: 'STRING', enum: ['neutral', 'happy'] },
          reply: { type: 'STRING' },
          followUps: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['emotion', 'reply'],
      });
      assert.strictEqual(schemaOut.type, 'object');
      assert.strictEqual(schemaOut.properties.emotion.type, 'string');
      assert.strictEqual(schemaOut.properties.followUps.type, 'array');
      assert.strictEqual(schemaOut.properties.followUps.items.type, 'string');

      // Plain object result.response (as returned by Workers AI structured outputs) works cleanly
      const objStr = extractCloudflareResponseText({
        success: true,
        result: { response: { emotion: 'neutral', reply: 'Object envelope reply' } },
      });
      assert.strictEqual(JSON.parse(objStr).reply, 'Object envelope reply');
      assert.throws(() => extractCloudflareResponseText({ success: true, result: { response: {} } }), (e) => e.code === 'INVALID_AI_RESPONSE');

      // Prose-wrapped JSON parses while truncated/broken JSON still throws 502 INVALID_AI_RESPONSE
      const wrapped = parseProviderJson('Вот ответ в JSON:\n{"emotion":"happy","reply":"Привет, {друг}"}\nУдачи!');
      assert.strictEqual(wrapped.reply, 'Привет, {друг}');
      assert.throws(() => parseProviderJson('{broken json'), (e) => e.code === 'INVALID_AI_RESPONSE');

      // Prompt grounding & RU informal 'ты' tone rules live in both primary & Cloudflare instructions
      const adultProfile = { nickname: 'Ascender', age: 22, ageGroup: '18-24', goals: ['Skin'] };
      const primarySys = buildBarrettSystemInstruction('ru', adultProfile, 'chat');
      const fallbackSys = buildCloudflareFallbackInstruction('ru', adultProfile);
      for (const sys of [primarySys, fallbackSys]) {
        assert.ok(sys.includes('ASCEND App Architecture & Reality:'));
        assert.ok(sys.includes('Lux Max'));
        assert.ok(sys.includes('NEVER invent fake products'));
        assert.ok(sys.includes('ты'));
      }

      // End-to-end fetchFn test verifying response_format, max_tokens >= 1500, object result.response, and >2400 char non-clipped reply
      const capturedBodies = [];
      const longReply = 'Разбор по пунктам: ' + 'структура и практические шаги без воды. '.repeat(80);
      assert.ok(longReply.length > 3000 && longReply.length < 3600);

      const cfSchemaApp = express();
      cfSchemaApp.use('/api/barrett', createBarrettRouter({
        config: { cooldownMs: 0, retryDelaysMs: [] },
        cloudflare: { accountId: 'acc_schema', apiToken: 'tok_schema' },
        logFn: () => {},
        logFallbackFn: () => {},
        generateFn: async () => {
          const e = new Error('503');
          e.status = 503;
          throw e;
        },
        fetchFn: async (_url, init) => {
          capturedBodies.push(JSON.parse(init.body));
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              success: true,
              result: {
                response: {
                  emotion: 'neutral',
                  reply: longReply,
                  profileQuote: '',
                  followUps: ['Уточнить шаг 1?'],
                },
              },
            }),
          };
        },
      }));
      const cfSchemaSrv = await startServer(cfSchemaApp);
      try {
        const res = await reqJson(cfSchemaSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_schema_1', lang: 'ru', message: 'Объясни подробно', allowCloudflareFallback: true },
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json.meta.fallbackUsed, true);
        assert.strictEqual(res.json.data.reply.length, longReply.trim().length, 'Reply up to 3600 chars must not be clipped at 2400');
        assert.strictEqual(capturedBodies.length, 1);
        assert.ok(capturedBodies[0].max_tokens >= 1500);
        assert.strictEqual(capturedBodies[0].response_format.type, 'json_schema');
        assert.strictEqual(capturedBodies[0].response_format.json_schema.type, 'object');
      } finally {
        await cfSchemaSrv.close();
      }
    });

    await test('Safe lifecycle diagnostics emit gemini_success, gemini_failed, fallback_skipped, cloudflare_success, and cloudflare_failed without leaking secrets/text', async () => {
      const eventLogs = [];
      let evGemMode = 'ok';
      let evCfMode = 'ok';
      const secretMsg = 'TOP_SECRET_USER_PROMPT_991';
      const evApp = express();
      evApp.use('/api/barrett', createBarrettRouter({
        config: { cooldownMs: 0, retryDelaysMs: [], timeoutMs: 2000 },
        apiKey: 'AIzaSecretDiagKey987654321',
        cloudflare: { accountId: 'acc_diag_secret', apiToken: 'tok_diag_secret' },
        logFn: () => {},
        logFallbackFn: () => {},
        logEventFn: (e) => eventLogs.push(e),
        generateFn: async () => {
          if (evGemMode === '503') {
            const e = new Error('503 Unavailable');
            e.status = 503;
            throw e;
          }
          return { text: JSON.stringify({ emotion: 'neutral', reply: 'OK from Gemini' }) };
        },
        cloudflareFn: async () => {
          if (evCfMode === 'fail') {
            const e = new Error('CF 503');
            e.status = 503;
            throw e;
          }
          return { success: true, result: { response: JSON.stringify({ emotion: 'happy', reply: 'OK from CF' }) } };
        },
      }));
      const evSrv = await startServer(evApp);
      try {
        // 1. Gemini success
        await reqJson(evSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_ev_1', message: secretMsg, allowCloudflareFallback: false },
        });
        // 2. Gemini 503 + fallback disabled
        evGemMode = '503';
        await reqJson(evSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_ev_2', message: secretMsg, allowCloudflareFallback: false },
        });
        // 3. Gemini 503 + Cloudflare success
        await reqJson(evSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_ev_3', message: secretMsg, allowCloudflareFallback: true },
        });
        // 4. Gemini 503 + Cloudflare failure
        evCfMode = 'fail';
        await reqJson(evSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_ev_4', message: secretMsg, allowCloudflareFallback: true },
        });

        const names = eventLogs.map((e) => e.event);
        assert.ok(names.includes('gemini_success'));
        assert.ok(names.includes('gemini_failed'));
        assert.ok(names.includes('fallback_skipped'));
        assert.ok(names.includes('cloudflare_success'));
        assert.ok(names.includes('cloudflare_failed'));
        const skipEv = eventLogs.find((e) => e.event === 'fallback_skipped');
        assert.strictEqual(skipEv.reason, 'fallback_disabled_by_user');

        const serialized = JSON.stringify(eventLogs);
        assert.ok(!serialized.includes(secretMsg), 'Diagnostics must never log user message text');
        assert.ok(!serialized.includes('AIzaSecretDiagKey'), 'Diagnostics must never log Gemini key');
        assert.ok(!serialized.includes('acc_diag_secret'), 'Diagnostics must never log Cloudflare accountId');
        assert.ok(!serialized.includes('tok_diag_secret'), 'Diagnostics must never log Cloudflare token');
      } finally {
        await evSrv.close();
      }
    });

    await test('Parallel/concurrent requests, duplicate in-flight lock, RU minor anti-scrub & persistence across ChatStore reload', async () => {
      let activeNow = 0;
      let peakActive = 0;
      const concApp = express();
      concApp.use('/api/barrett', createBarrettRouter({
        config: { cooldownMs: 0, maxConcurrent: 2, ipRpm: 100, userRpm: 100, retryDelaysMs: [] },
        cloudflare: { accountId: 'acc_conc', apiToken: 'tok_conc' },
        logFn: () => {},
        logFallbackFn: () => {},
        logEventFn: () => {},
        generateFn: async ({ contents }) => {
          activeNow += 1;
          peakActive = Math.max(peakActive, activeNow);
          await new Promise((r) => setTimeout(r, 45));
          activeNow -= 1;
          const txt = contents[contents.length - 1]?.parts?.[0]?.text || '';
          if (txt.includes('CF_FAIL')) {
            const e = new Error('503');
            e.status = 503;
            throw e;
          }
          return { text: JSON.stringify({ emotion: 'neutral', reply: `Ответ на: ${txt.slice(0, 30)}` }) };
        },
        cloudflareFn: async () => ({
          success: true,
          result: { response: JSON.stringify({ emotion: 'neutral', reply: 'Резервный параллельный ответ на ты' }) },
        }),
      }));
      const concSrv = await startServer(concApp);
      try {
        // Concurrent requests across 3 clients when maxConcurrent = 2 -> 2 succeed, 3rd gets 429 SERVER_BUSY; duplicate same-client same-payload gets 409 DUPLICATE_IN_FLIGHT
        const pA = reqJson(concSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_par_1', message: 'Parallel prompt A' },
        });
        const pB = reqJson(concSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_par_2', message: 'Parallel prompt B CF_FAIL', allowCloudflareFallback: true },
        });
        await new Promise((r) => setTimeout(r, 15));
        const pBusy = reqJson(concSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_par_3', message: 'Parallel prompt C' },
        });
        const [rA, rB, rBusy] = await Promise.all([pA, pB, pBusy]);
        assert.strictEqual(rA.status, 200);
        assert.strictEqual(rB.status, 200);
        assert.strictEqual(rB.json.meta.fallbackUsed, true);
        assert.strictEqual(rBusy.status, 429);
        assert.strictEqual(rBusy.json.error.code, 'SERVER_BUSY');
        assert.ok(peakActive <= 2);

        // Duplicate same-client in-flight rejection (when concurrency slot available)
        const pSingle = reqJson(concSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_dup_1', message: 'Same single prompt' },
        });
        await new Promise((r) => setTimeout(r, 10));
        const pDup = reqJson(concSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'u_dup_1', message: 'Same single prompt' },
        });
        const [rSingle, rDup] = await Promise.all([pSingle, pDup]);
        assert.strictEqual(rSingle.status, 200);
        assert.strictEqual(rDup.status, 409);
        assert.strictEqual(rDup.json.error.code, 'DUPLICATE_IN_FLIGHT');

        // Prompt checks: RU 'ты' anchor + <18 anti-scrub protection in both Gemini & Cloudflare prompts
        const minorProfile = { nickname: 'Nick', age: 17, ageGroup: '16-17', goals: ['Skin'] };
        const ruPrimMinor = buildBarrettSystemInstruction('ru', minorProfile, 'chat');
        const ruCfMinor = buildCloudflareFallbackInstruction('ru', minorProfile);
        for (const s of [ruPrimMinor, ruCfMinor]) {
          assert.ok(s.includes('Русский стиль Барретта'), 'RU informal ты anchor must be present');
          assert.ok(s.includes('DO NOT recommend abrasive physical scrubs'), 'Minor skincare must forbid abrasive scrubs');
        }

        // ChatStore persistence across reload preserves fallbackUsed metadata
        const sharedStorage = makeMemoryStorage();
        const envA = createFullFrontendEnv({ baseUrl: concSrv.baseUrl, storage: sharedStorage, lang: 'ru' });
        await envA.LM.Store.boot();
        envA.LM.I18n.init();
        envA.LM.Store.update((s) => { s.settings.privacy.cloudflareFallback = true; });
        const sent = await envA.LM.ChatAPI.sendBarrett('Тест сохранения CF_FAIL');
        assert.strictEqual(sent.ok, true);
        assert.strictEqual(sent.meta.fallbackUsed, true);

        const envB = createFullFrontendEnv({ baseUrl: concSrv.baseUrl, storage: sharedStorage, lang: 'ru' });
        await envB.LM.Store.boot();
        envB.LM.I18n.init();
        const reloadedMsgs = envB.LM.ChatStore.getMessages('barrett');
        assert.strictEqual(reloadedMsgs.length, 2);
        assert.strictEqual(reloadedMsgs[1].fallbackUsed, true);
        assert.ok(envB.LM.ChatViews.thread('barrett').includes(envB.LM.Dict.ru['chat.fallbackNotice']));
      } finally {
        await concSrv.close();
      }
    });

    await test('Vercel Hobby runtime auto-applies 8500/4500/3500 safe timeout defaults when env overrides are absent', async () => {
      const prevEnv = {
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        BARRETT_TIMEOUT_MS: process.env.BARRETT_TIMEOUT_MS,
        BARRETT_PRIMARY_FALLBACK_TIMEOUT_MS: process.env.BARRETT_PRIMARY_FALLBACK_TIMEOUT_MS,
        BARRETT_CLOUDFLARE_TIMEOUT_MS: process.env.BARRETT_CLOUDFLARE_TIMEOUT_MS,
        BARRETT_RETRY_DELAYS_MS: process.env.BARRETT_RETRY_DELAYS_MS,
      };
      try {
        delete process.env.BARRETT_TIMEOUT_MS;
        delete process.env.BARRETT_PRIMARY_FALLBACK_TIMEOUT_MS;
        delete process.env.BARRETT_CLOUDFLARE_TIMEOUT_MS;
        delete process.env.BARRETT_RETRY_DELAYS_MS;
        process.env.VERCEL = '1';
        process.env.VERCEL_ENV = 'preview';
        const vercelCfg = readConfig({});
        assert.strictEqual(vercelCfg.timeoutMs, 8500);
        assert.strictEqual(vercelCfg.primaryFallbackTimeoutMs, 4500);
        assert.strictEqual(vercelCfg.cloudflareTimeoutMs, 3500);
        assert.deepStrictEqual(vercelCfg.retryDelaysMs, [250, 500]);

        delete process.env.VERCEL;
        delete process.env.VERCEL_ENV;
        const localCfg = readConfig({});
        assert.strictEqual(localCfg.timeoutMs, 25000);
        assert.strictEqual(localCfg.primaryFallbackTimeoutMs, 10500);
        assert.strictEqual(localCfg.cloudflareTimeoutMs, 13500);
      } finally {
        for (const [k, v] of Object.entries(prevEnv)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    });
  } finally {
    await srv.close();
  }

  console.log(`\nStage 4.2 Cloudflare Fallback results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
