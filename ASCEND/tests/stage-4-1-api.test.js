/* Stage 4.1 verification suite — Express server, Barrett API routes, privacy, rate guards, & error handling */
'use strict';

const assert = require('assert');
const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');

const prodApp = require('../../server');
const {
  createBarrettRouter,
  readConfig,
  getApiKey,
  getSafeRuntimeDiagnostics,
  scrubUnsafeRatings,
} = require('../../server/barrett');

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

async function reqJson(baseUrl, pathname, { method = 'GET', body, rawBody, headers = {} } = {}) {
  const init = {
    method,
    headers: {
      ...(body !== undefined || rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  };
  if (rawBody !== undefined) init.body = rawBody;
  else if (body !== undefined) init.body = JSON.stringify(body);
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
  console.log('Running Stage 4.1 Barrett Backend & API Verification...');

  // 1. Production server.js checks (respects actual env; reports honestly)
  const prod = await startServer(prodApp);
  try {
    await test('server.js serves ASCEND/index.html on GET /', async () => {
      const res = await fetch(`${prod.baseUrl}/`);
      assert.strictEqual(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('ASCEND'), 'Expected ASCEND index.html content');
    });

    await test('GET /api/barrett/health returns expected shape without leaking secrets', async () => {
      const r = await reqJson(prod.baseUrl, '/api/barrett/health');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.ok, true);
      assert.strictEqual(typeof r.json.configured, 'boolean');
      assert.ok(!('available' in r.json), 'Must report configured, not available');
      assert.strictEqual(r.json.model, 'gemini-3.5-flash-lite');
      assert.strictEqual(r.json.analyzeModel, 'gemini-3.5-flash-lite');
      assert.strictEqual(r.json.multimodalSupported, true);
      assert.strictEqual(r.json.structuredOutputSupported, true);
      assert.strictEqual(r.json.fallback.provider, 'cloudflare-workers-ai');
      assert.strictEqual(typeof r.json.fallback.configured, 'boolean');
      assert.strictEqual(r.json.fallback.model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
      assert.strictEqual(r.json.fallback.textChatOnly, true);
      assert.strictEqual(r.json.fallback.photosNeverSent, true);
      assert.strictEqual(r.json.privacy.serverPhotoRetention, false);
      assert.strictEqual(r.json.privacy.explicitConsentRequired, true);
      assert.ok(!r.text.includes('AIza'), 'Must never expose API key');
      assert.ok(!('apiKey' in r.json), 'Must not expose apiKey property');
    });

    await test('Unknown /api/barrett/* routes return clean JSON 404 (no SPA HTML fallback)', async () => {
      const rGet = await reqJson(prod.baseUrl, '/api/barrett/does-not-exist');
      assert.strictEqual(rGet.status, 404);
      assert.strictEqual(rGet.json.ok, false);
      assert.strictEqual(rGet.json.error.code, 'NOT_FOUND');

      const rPost = await reqJson(prod.baseUrl, '/api/barrett/does-not-exist', { method: 'POST', body: {} });
      assert.strictEqual(rPost.status, 404);
      assert.strictEqual(rPost.json.error.code, 'NOT_FOUND');
    });

    await test('Malformed JSON and >5MB payload are rejected cleanly with 400 and 413', async () => {
      const badJson = await reqJson(prod.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        rawBody: '{"broken":',
      });
      assert.strictEqual(badJson.status, 400);
      assert.strictEqual(badJson.json.error.code, 'INVALID_JSON');

      const huge = 'x'.repeat(5_300_000);
      const tooBig = await reqJson(prod.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        rawBody: JSON.stringify({ clientId: 'user_abc123', message: huge }),
      });
      assert.strictEqual(tooBig.status, 413);
      assert.strictEqual(tooBig.json.error.code, 'PAYLOAD_TOO_LARGE');
    });
  } finally {
    await prod.close();
  }

  // 2. Missing key guarantees honest 503 AI_NOT_CONFIGURED (never fake AI replies)
  const unconfiguredApp = express();
  unconfiguredApp.use('/api/barrett', createBarrettRouter({ apiKey: '' }));
  const uncfg = await startServer(unconfiguredApp);
  try {
    await test('Unconfigured GEMINI_API_KEY reports configured=false and 503 AI_NOT_CONFIGURED on chat/guide/analyze', async () => {
      const h = await reqJson(uncfg.baseUrl, '/api/barrett/health');
      assert.strictEqual(h.status, 200);
      assert.strictEqual(h.json.configured, false);
      assert.ok(!('available' in h.json));

      const c = await reqJson(uncfg.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'client_001', message: 'Hello Barrett' },
      });
      assert.strictEqual(c.status, 503);
      assert.strictEqual(c.json.ok, false);
      assert.strictEqual(c.json.error.code, 'AI_NOT_CONFIGURED');

      const a = await reqJson(uncfg.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 'client_001',
          explicitConsent: true,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      assert.strictEqual(a.status, 503);
      assert.strictEqual(a.json.error.code, 'AI_NOT_CONFIGURED');
    });
  } finally {
    await uncfg.close();
  }

  // 3. Functional contract, prompt guardrails, model switching, rating scrub, validation & privacy
  const capturedCalls = [];
  const functionalApp = express();
  functionalApp.use('/api/barrett', createBarrettRouter({
    config: {
      model: 'gemini-custom-test-model',
      analyzeModel: 'gemini-custom-vision-model',
      cooldownMs: 0,
      maxImageBytes: 2048,
    },
    generateFn: async (call) => {
      capturedCalls.push(call);
      if (call.contents && typeof call.contents === 'object' && Array.isArray(call.contents.parts)) {
        return {
          text: JSON.stringify({
            emotion: 'happy',
            reply: 'Solid base. You look 8/10 in good light, keep skin barrier calm.',
            observations: {
              skin: 'Mild T-zone shine, uniform tone.',
              hair: 'Clean volume on top, trim temple sides.',
              face: 'Balanced proportions; hydration helps morning puffiness.',
              grooming: 'Neat brows; clean up stray cheek hairs.',
              style: 'Structured collar frames jawline well.',
              presentation: 'Relax shoulders back and keep chin level.',
            },
            recommendedGuide: {
              title: 'Morning Anti-Puff & Skin Reset',
              category: 'skin',
              summary: 'Gentle cleanse, cool compress, and SPF.',
              steps: ['Cool rinse 30s', 'Gentle cleanser', 'Broad-spectrum SPF 30+'],
            },
            followUps: ['Want a 5-min AM routine?', 'Check haircut options?'],
            profileQuote: 'Keep contrast sharp and morning puff 9/10 down.',
          }),
        };
      }
      if (typeof call.contents === 'string' && call.contents.includes('Create or refine')) {
        return {
          text: JSON.stringify({
            emotion: 'excited',
            reply: 'Dialed in your 4-step posture reset.',
            guide: {
              title: 'Thoracic & Neck Reset',
              category: 'posture',
              summary: '10 minutes daily for cleaner silhouette.',
              frequency: 'Daily',
              safetyNote: 'Stop if any sharp joint pain occurs.',
              steps: [
                { title: 'Wall angels', detail: '2x10 controlled reps.' },
                { title: 'Chin tucks', detail: '2x8 gentle holds.' },
                { title: 'Doorway pec stretch', detail: '30s each side.' },
              ],
            },
            profileQuote: 'Posture adds instant frame.',
          }),
        };
      }
      return {
        text: JSON.stringify({
          emotion: 'invalid_mood_value',
          reply: 'Lock in sleep and hydration first—skip 7.5/10 myths.',
          profileQuote: 'Consistency beats intensity.',
          followUps: ['Build a sleep plan', 'Check AM skin steps'],
          updatedSummary: 'User focuses on clear skin and sleep.',
        }),
      };
    },
  }));
  const funcSrv = await startServer(functionalApp);
  try {
    await test('POST /api/barrett/chat passes separated memory/history/plans, enforces <18 safety, switches model via config, and scrubs ratings', async () => {
      const r = await reqJson(funcSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: {
          clientId: 'teen_user_01',
          lang: 'en',
          message: 'How do I fix puffy face and acne?',
          memorySummary: 'Prefers quick routines before school.',
          messages: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hey, ready to lock in?' }],
          activePlans: [{ id: 'p1', title: 'AM Skin Basics', category: 'skin', progressText: '2/3 steps' }],
          profile: { nickname: 'Alex', age: 16, goals: ['Clear skin'] },
          updateSummary: true,
        },
      });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.ok, true);
      assert.strictEqual(r.json.meta.model, 'gemini-custom-test-model');
      assert.strictEqual(r.json.data.emotion, 'neutral'); // normalized fallback
      assert.ok(!r.json.data.reply.includes('7.5/10'), 'Numeric rating must be scrubbed');
      assert.strictEqual(r.json.data.updatedSummary, 'User focuses on clear skin and sleep.');

      const lastCall = capturedCalls[capturedCalls.length - 1];
      assert.strictEqual(lastCall.model, 'gemini-custom-test-model');
      assert.ok(lastCall.systemInstruction.includes('STRICT MINOR SAFETY (<18)'));
      assert.ok(lastCall.systemInstruction.includes('NEVER assign numerical attractiveness ratings'));
      assert.ok(lastCall.systemInstruction.includes('Long-term user memory summary'));
      assert.ok(lastCall.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
      assert.ok(Array.isArray(lastCall.contents), 'contents must be multi-turn Content[] array');
      assert.deepStrictEqual(lastCall.contents.map((c) => c.role), ['user', 'model', 'user']);
      assert.strictEqual(lastCall.contents[0].parts[0].text, 'Hi');
      assert.strictEqual(lastCall.contents[1].parts[0].text, 'Hey, ready to lock in?');
      assert.strictEqual(lastCall.contents[2].parts[0].text, 'How do I fix puffy face and acne?');
    });

    await test('POST /api/barrett/analyze enforces explicitConsent, MIME, size limit, and zero photo retention', async () => {
      const noConsent = await reqJson(funcSrv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 'user_photo_1',
          explicitConsent: false,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      assert.strictEqual(noConsent.status, 400);
      assert.strictEqual(noConsent.json.error.code, 'CONSENT_REQUIRED');

      const badMime = await reqJson(funcSrv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 'user_photo_1',
          explicitConsent: true,
          image: { mimeType: 'image/svg+xml', dataBase64: VALID_PNG_B64 },
        },
      });
      assert.strictEqual(badMime.status, 400);
      assert.strictEqual(badMime.json.error.code, 'INVALID_IMAGE');

      const bigImgB64 = Buffer.alloc(2600, 1).toString('base64');
      const tooBigImg = await reqJson(funcSrv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 'user_photo_1',
          explicitConsent: true,
          image: { mimeType: 'image/jpeg', dataBase64: bigImgB64 },
        },
      });
      assert.strictEqual(tooBigImg.status, 413);
      assert.strictEqual(tooBigImg.json.error.code, 'IMAGE_TOO_LARGE');

      const okRes = await reqJson(funcSrv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 'user_photo_1',
          explicitConsent: true,
          lang: 'en',
          focus: 'all',
          image: { mimeType: 'image/png', dataBase64: `data:image/png;base64,${VALID_PNG_B64}` },
        },
      });
      assert.strictEqual(okRes.status, 200);
      assert.strictEqual(okRes.json.meta.model, 'gemini-custom-vision-model');
      assert.strictEqual(okRes.json.meta.privacy.photoRetainedOnServer, false);
      assert.deepStrictEqual(Object.keys(okRes.json.data.observations).sort(), [
        'face', 'grooming', 'hair', 'presentation', 'skin', 'style',
      ]);
      assert.ok(!okRes.json.data.reply.includes('8/10'));
      assert.ok(!okRes.json.data.profileQuote.includes('9/10'));
      assert.strictEqual(okRes.json.data.recommendedGuide.steps.length, 3);
    });

    await test('POST /api/barrett/guide creates/adjusts structured guide cleanly', async () => {
      const r = await reqJson(funcSrv.baseUrl, '/api/barrett/guide', {
        method: 'POST',
        body: {
          clientId: 'user_guide_1',
          lang: 'en',
          category: 'posture',
          goal: 'Make it shorter for mornings',
          existingGuide: {
            title: 'Old Posture Plan',
            steps: [{ title: 'Plank', done: true }],
          },
        },
      });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.json.data.emotion, 'excited');
      assert.strictEqual(r.json.data.guide.title, 'Thoracic & Neck Reset');
      assert.strictEqual(r.json.data.guide.steps.length, 3);
    });

    await test('Validation rejects missing clientId, empty message, empty goal', async () => {
      const badCid = await reqJson(funcSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'a', message: 'hi' },
      });
      assert.strictEqual(badCid.status, 400);
      assert.strictEqual(badCid.json.error.code, 'INVALID_CLIENT_ID');

      const emptyMsg = await reqJson(funcSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'valid_user_99', message: '   ' },
      });
      assert.strictEqual(emptyMsg.status, 400);
      assert.strictEqual(emptyMsg.json.error.code, 'EMPTY_MESSAGE');

      const emptyGoal = await reqJson(funcSrv.baseUrl, '/api/barrett/guide', {
        method: 'POST',
        body: { clientId: 'valid_user_99', goal: '' },
      });
      assert.strictEqual(emptyGoal.status, 400);
      assert.strictEqual(emptyGoal.json.error.code, 'EMPTY_GOAL');
    });
  } finally {
    await funcSrv.close();
  }

  // 4. Rate limits, in-flight dedup, cooldown, retry, and error mapping
  let holdResolve = null;
  let transientFailures = 0;
  let nextMode = 'ok';
  const guardApp = express();
  guardApp.use('/api/barrett', createBarrettRouter({
    config: {
      ipRpm: 25,
      userRpm: 10,
      analyzeDailyUser: 5,
      dailyTotalCap: 50,
      cooldownMs: 3000,
    },
    generateFn: async () => {
      if (nextMode === 'hold') {
        await new Promise((resolve) => { holdResolve = resolve; });
      } else if (nextMode === 'transient_once') {
        transientFailures += 1;
        if (transientFailures === 1) {
          const e = new Error('Upstream temporarily overloaded');
          e.status = 503;
          throw e;
        }
      } else if (nextMode === 'bad_json') {
        return { text: 'not valid json {{{' };
      } else if (nextMode === 'auth_403') {
        const e = new Error('API_KEY_INVALID');
        e.status = 403;
        throw e;
      } else if (nextMode === 'model_404') {
        const e = new Error('NOT_FOUND');
        e.status = 404;
        throw e;
      } else if (nextMode === 'quota_429') {
        const e = new Error('RESOURCE_EXHAUSTED');
        e.status = 429;
        throw e;
      } else if (nextMode === 'timeout') {
        const e = new Error('Timeout');
        e.code = 'AI_TIMEOUT';
        throw e;
      }
      return {
        text: JSON.stringify({
          emotion: 'neutral',
          reply: 'Steady progress.',
          profileQuote: 'Keep moving.',
          followUps: [],
          observations: { skin: 'ok', hair: 'ok', face: 'ok', grooming: 'ok', style: 'ok', presentation: 'ok' },
          recommendedGuide: { title: 'Test', category: 'skin', summary: 's', steps: ['a'] },
        }),
      };
    },
  }));
  const guardSrv = await startServer(guardApp);
  try {
    await test('In-flight identical request returns 409 DUPLICATE_IN_FLIGHT and post-success repeat returns 429 DUPLICATE_COOLDOWN', async () => {
      nextMode = 'hold';
      const p1 = reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'dedup_user_1', message: 'Same question' },
      });
      await new Promise((r) => setTimeout(r, 30));
      const p2 = await reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'dedup_user_1', message: 'Same question' },
      });
      assert.strictEqual(p2.status, 409);
      assert.strictEqual(p2.json.error.code, 'DUPLICATE_IN_FLIGHT');

      holdResolve();
      const res1 = await p1;
      assert.strictEqual(res1.status, 200);

      nextMode = 'ok';
      const p3 = await reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'dedup_user_1', message: 'Same question' },
      });
      assert.strictEqual(p3.status, 429);
      assert.strictEqual(p3.json.error.code, 'DUPLICATE_COOLDOWN');
      assert.ok(Number(p3.headers.get('retry-after')) >= 1);
    });

    await test('Transient 503 retries once automatically; failed requests do not trigger duplicate cooldown', async () => {
      nextMode = 'bad_json';
      const bad = await reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'retry_user_1', message: 'Retryable query' },
      });
      assert.strictEqual(bad.status, 502);
      assert.strictEqual(bad.json.error.code, 'INVALID_AI_RESPONSE');

      nextMode = 'transient_once';
      const recovered = await reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'retry_user_1', message: 'Retryable query' },
      });
      assert.strictEqual(recovered.status, 200);
      assert.strictEqual(transientFailures, 2);
      nextMode = 'ok';
    });

    await test('Upstream errors 403, 404, 429, AI_TIMEOUT map cleanly', async () => {
      const m403 = await (async () => {
        nextMode = 'auth_403';
        return reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'err_user_1', message: 'm1' },
        });
      })();
      assert.strictEqual(m403.status, 503);
      assert.strictEqual(m403.json.error.code, 'AI_AUTH_ERROR');

      nextMode = 'model_404';
      const m404 = await reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'err_user_2', message: 'm2' },
      });
      assert.strictEqual(m404.status, 503);
      assert.strictEqual(m404.json.error.code, 'AI_MODEL_UNAVAILABLE');

      nextMode = 'quota_429';
      const m429 = await reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'err_user_3', message: 'm3' },
      });
      assert.strictEqual(m429.status, 429);
      assert.strictEqual(m429.json.error.code, 'AI_QUOTA_EXCEEDED');

      nextMode = 'timeout';
      const mTo = await reqJson(guardSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'err_user_4', message: 'm4' },
      });
      assert.strictEqual(mTo.status, 504);
      assert.strictEqual(mTo.json.error.code, 'AI_TIMEOUT');
      nextMode = 'ok';
    });
  } finally {
    await guardSrv.close();
  }

  // 5. Dedicated limit checks (userRpm, ipRpm, analyzeDailyUser, dailyTotalCap)
  const limitApp = express();
  limitApp.use('/api/barrett', createBarrettRouter({
    config: { ipRpm: 4, userRpm: 2, analyzeDailyUser: 1, dailyTotalCap: 4, cooldownMs: 0 },
    generateFn: async () => ({
      text: JSON.stringify({
        emotion: 'neutral',
        reply: 'ok',
        profileQuote: 'ok',
        followUps: [],
        observations: { skin: 'ok', hair: 'ok', face: 'ok', grooming: 'ok', style: 'ok', presentation: 'ok' },
        recommendedGuide: { title: 'T', category: 'skin', summary: 's', steps: ['s1'] },
      }),
    }),
  }));
  const limSrv = await startServer(limitApp);
  try {
    await test('Per-user RPM, daily analyze cap, per-IP RPM, and global daily cap enforce limits', async () => {
      // 1st analyze succeeds
      const a1 = await reqJson(limSrv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: { clientId: 'limit_u1', explicitConsent: true, image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 } },
      });
      assert.strictEqual(a1.status, 200);

      // 2nd analyze for same user hits analyzeDailyUser=1
      const a2 = await reqJson(limSrv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: { clientId: 'limit_u1', explicitConsent: true, image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 } },
      });
      assert.strictEqual(a2.status, 429);
      assert.strictEqual(a2.json.error.code, 'ANALYZE_DAILY_LIMIT');

      // 2nd request for limit_u1 (chat) hits total=2, succeeds
      const c1 = await reqJson(limSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'limit_u1', message: 'msg1' },
      });
      assert.strictEqual(c1.status, 200);

      // 3rd request for limit_u1 hits userRpm=2
      const c2 = await reqJson(limSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'limit_u1', message: 'msg2' },
      });
      assert.strictEqual(c2.status, 429);
      assert.strictEqual(c2.json.error.code, 'USER_RATE_LIMIT');

      // Different user on same IP hits dailyTotalCap=4 / ipRpm=4 after 2 more calls
      const c3 = await reqJson(limSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'limit_u2', message: 'msg3' },
      });
      assert.strictEqual(c3.status, 200);
      const c4 = await reqJson(limSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'limit_u3', message: 'msg4' },
      });
      assert.strictEqual(c4.status, 200);

      const capHit = await reqJson(limSrv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 'limit_u4', message: 'msg5' },
      });
      assert.strictEqual(capHit.status, 429);
      assert.ok(['DAILY_COST_CAP', 'IP_RATE_LIMIT'].includes(capHit.json.error.code));
    });

    await test('Deprecated model env overrides fall back safely and scrubUnsafeRatings works', () => {
      const cfg = readConfig({ model: 'gemini-1.5-flash' });
      assert.strictEqual(cfg.model, 'gemini-3.5-flash-lite');
      assert.strictEqual(cfg.analyzeModel, 'gemini-3.5-flash-lite');
      assert.strictEqual(readConfig({ thinkingLevel: 'MINIMAL' }).thinkingLevel, 'MINIMAL');
      assert.strictEqual(getApiKey({ apiKey: ' "AIzaSyTestTrim12345" ' }), 'AIzaSyTestTrim12345');
      const diag = getSafeRuntimeDiagnostics({ apiKey: 'AIzaSySecretNeverLeak123456' });
      assert.strictEqual(diag.GEMINI_API_KEY_PRESENT, true);
      assert.strictEqual(diag.model, 'gemini-3.5-flash-lite');
      assert.ok(!JSON.stringify(diag).includes('AIzaSy'));
      assert.strictEqual(scrubUnsafeRatings('Rating: 8.5/10 overall'), 'Rating: — overall');
      assert.ok(!fs.existsSync(path.join(__dirname, '..', '..', 'uploads')));

      const defaultCfg = readConfig({});
      assert.strictEqual(defaultCfg.model, 'gemini-3.5-flash-lite');
      assert.strictEqual(defaultCfg.analyzeModel, 'gemini-3.5-flash-lite');
      assert.ok(defaultCfg.timeoutMs > 0 && defaultCfg.timeoutMs < 30000, 'Default server timeout must stay strictly below client 30s timeout');
    });

    await test('Configured GEMINI_API_KEY reports configured=true and gemini-3.5-flash-lite on /health without leaking key', async () => {
      const configuredApp = express();
      configuredApp.use('/api/barrett', createBarrettRouter({
        apiKey: ' "AIzaSyFakeConfiguredKey123456" ',
        cloudflare: { accountId: 'cf_secret_acc_999', apiToken: 'cf_secret_tok_999' },
      }));
      const cfgSrv = await startServer(configuredApp);
      try {
        const h = await reqJson(cfgSrv.baseUrl, '/api/barrett/health');
        assert.strictEqual(h.status, 200);
        assert.strictEqual(h.json.ok, true);
        assert.strictEqual(h.json.configured, true);
        assert.ok(!('available' in h.json));
        assert.strictEqual(h.json.fallback.configured, true);
        assert.strictEqual(h.json.model, 'gemini-3.5-flash-lite');
        assert.strictEqual(h.json.analyzeModel, 'gemini-3.5-flash-lite');
        assert.ok(!h.text.includes('AIzaSy'));
        assert.ok(!h.text.includes('cf_secret_acc_999'));
        assert.ok(!h.text.includes('cf_secret_tok_999'));
      } finally {
        await cfgSrv.close();
      }
    });
  } finally {
    await limSrv.close();
  }

  // 6. Stage 0 reliability: bounded retries, failed requests do not consume daily quota, AbortSignal timeout, & safe logging
  let stage0Mode = 'fail_503';
  let stage0Attempts = 0;
  let observedAbortSignal = null;
  const capturedErrorLogs = [];
  const stage0App = express();
  stage0App.use('/api/barrett', createBarrettRouter({
    config: {
      ipRpm: 50,
      userRpm: 50,
      analyzeDailyUser: 1,
      dailyTotalCap: 2,
      cooldownMs: 0,
      timeoutMs: 350,
      retryDelaysMs: [20, 40],
    },
    logFn: (entry) => capturedErrorLogs.push(entry),
    generateFn: async ({ abortSignal }) => {
      stage0Attempts += 1;
      observedAbortSignal = abortSignal;
      if (stage0Mode === 'fail_503') {
        const e = new Error('UNAVAILABLE with AIzaSySecretKey1234567890ABCD');
        e.status = 503;
        throw e;
      }
      if (stage0Mode === 'hang') {
        await new Promise((resolve) => {
          if (abortSignal) abortSignal.addEventListener('abort', resolve, { once: true });
        });
        const e = new Error('Aborted');
        e.name = 'AbortError';
        throw e;
      }
      return {
        text: JSON.stringify({
          emotion: 'happy',
          reply: 'Recovered cleanly.',
          profileQuote: 'Stay steady.',
          followUps: ['Next'],
          observations: { skin: 'ok', hair: 'ok', face: 'ok', grooming: 'ok', style: 'ok', presentation: 'ok' },
          recommendedGuide: { title: 'Guide', category: 'skin', summary: 's', steps: ['step1'] },
        }),
      };
    },
  }));
  const stage0Srv = await startServer(stage0App);
  try {
    await test('Stage 0: Bounded 503 retries stop at max 3 attempts and do NOT consume dailyTotalCap or analyzeDailyUser', async () => {
      stage0Mode = 'fail_503';
      stage0Attempts = 0;
      const failChat1 = await reqJson(stage0Srv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        headers: { 'x-ascend-client': 's0_user_1' },
        body: { clientId: 's0_user_1', message: 'PRIVATE_CHAT_SECRET_TEXT' },
      });
      assert.strictEqual(failChat1.status, 503);
      assert.strictEqual(failChat1.json.error.code, 'AI_UNAVAILABLE');
      assert.strictEqual(failChat1.json.error.retryable, true);
      assert.ok(failChat1.json.error.requestId);
      assert.strictEqual(stage0Attempts, 3, 'Should perform 1 initial + 2 bounded retries');

      const failAnalyze = await reqJson(stage0Srv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 's0_user_1',
          explicitConsent: true,
          note: 'PRIVATE_PHOTO_NOTE_TEXT',
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      assert.strictEqual(failAnalyze.status, 503);

      // Now switch to OK: both analyze (limit=1) and chat (dailyTotalCap=2) must still have full unused quota
      stage0Mode = 'ok';
      const okAnalyze = await reqJson(stage0Srv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 's0_user_1',
          explicitConsent: true,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      assert.strictEqual(okAnalyze.status, 200, 'Failed analyze must not consume analyzeDailyUser quota');

      const analyzeCapHit = await reqJson(stage0Srv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 's0_user_1',
          explicitConsent: true,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      assert.strictEqual(analyzeCapHit.status, 429);
      assert.strictEqual(analyzeCapHit.json.error.code, 'ANALYZE_DAILY_LIMIT');

      const okChat = await reqJson(stage0Srv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 's0_user_2', message: 'Still quota left?' },
      });
      assert.strictEqual(okChat.status, 200, 'Failed chat must not consume dailyTotalCap quota');

      // dailyTotalCap=2 now reached (1 analyze + 1 chat succeeded)
      const capHit = await reqJson(stage0Srv.baseUrl, '/api/barrett/chat', {
        method: 'POST',
        body: { clientId: 's0_user_3', message: 'Over daily cap' },
      });
      assert.strictEqual(capHit.status, 429);
      assert.strictEqual(capHit.json.error.code, 'DAILY_COST_CAP');
    });

    await test('Stage 0: Timeout aborts via AbortSignal within server budget and does not hang', async () => {
      const tApp = express();
      tApp.use('/api/barrett', createBarrettRouter({
        config: { cooldownMs: 0, timeoutMs: 280, retryDelaysMs: [20, 40] },
        logFn: () => {},
        generateFn: async ({ abortSignal }) => {
          observedAbortSignal = abortSignal;
          await new Promise((resolve) => {
            if (abortSignal) abortSignal.addEventListener('abort', resolve, { once: true });
          });
          const e = new Error('Aborted');
          e.name = 'AbortError';
          throw e;
        },
      }));
      const tSrv = await startServer(tApp);
      try {
        const started = Date.now();
        const r = await reqJson(tSrv.baseUrl, '/api/barrett/chat', {
          method: 'POST',
          body: { clientId: 'timeout_u1', message: 'Hang test' },
        });
        const elapsed = Date.now() - started;
        assert.strictEqual(r.status, 504);
        assert.strictEqual(r.json.error.code, 'AI_TIMEOUT');
        assert.ok(observedAbortSignal && observedAbortSignal.aborted, 'AbortSignal must be aborted on timeout');
        assert.ok(elapsed < 1500, `Expected prompt timeout, took ${elapsed}ms`);
      } finally {
        await tSrv.close();
      }
    });

    await test('Stage 0: Safe error logs include requestId/code/status and NEVER leak secrets, headers, photos, or private message text', () => {
      assert.ok(capturedErrorLogs.length >= 2);
      const serialized = JSON.stringify(capturedErrorLogs);
      for (const entry of capturedErrorLogs) {
        assert.ok(entry.requestId && entry.requestId.startsWith('req_'));
        assert.ok(entry.route && entry.code && entry.status);
      }
      assert.ok(!serialized.includes('AIza'), 'Logs must never contain API key patterns');
      assert.ok(!serialized.includes('SecretKey'), 'Logs must never contain upstream secret strings');
      assert.ok(!serialized.includes('PRIVATE_CHAT_SECRET_TEXT'), 'Logs must never contain user chat text');
      assert.ok(!serialized.includes('PRIVATE_PHOTO_NOTE_TEXT'), 'Logs must never contain user note text');
      assert.ok(!serialized.includes('s0_user_1'), 'Logs must never contain clientId/headers');
      assert.ok(!serialized.includes(VALID_PNG_B64), 'Logs must never contain base64 photo payloads');
    });
  } finally {
    await stage0Srv.close();
  }

  console.log(`\nStage 4.1 API results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
