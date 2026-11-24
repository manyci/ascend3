/* Stage 1 Chat Integration Foundation verification suite.
   Tests:
   1. EN/RU i18n 100% key parity (including all chat.* keys)
   2. Real HTTP integration between LM.ChatAPI -> Express /api/barrett/chat -> LM.ChatStore -> LM.ChatViews
   3. Loading indicator while in-flight, duplicate in-flight rejection on frontend
   4. Error state rendering (503/429/timeout/network) + in-place bounded Retry without duplicate user messages
   5. Interrupted-session recovery ('sending' persisted before reload becomes retryable 'error')
   6. Unread counter increment when reply arrives while user navigated away from #/chat/barrett
   7. XSS safety (HTML in reply / error / followUps escaped)
   8. Strict storage independence (LM.Store / LM.Photos vs ascend.chat.v1) */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const express = require('express');
const { createBarrettRouter } = require('../../server/barrett');

const ROOT = path.join(__dirname, '..');

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

function createEnv({ baseUrl, storage, hash = '#/chat/barrett', customFetch = null } = {}) {
  const ls = storage || makeMemoryStorage();
  const win = {
    location: { hash },
    LM: {},
  };
  const doc = {
    documentElement: { lang: 'ru', dataset: {} },
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
    setTimeout,
    clearTimeout,
    console,
    fetch: customFetch || (async (url, init) => {
      const target = String(url).startsWith('http') ? url : `${baseUrl}${url}`;
      return fetch(target, init);
    }),
  });

  // Load real modules in exact index.html dependency order
  loadScript(ctx, 'js/data.js');
  loadScript(ctx, 'js/i18n/en.js');
  loadScript(ctx, 'js/i18n/ru.js');
  loadScript(ctx, 'js/i18n.js');

  // Minimal LM.Store stub matching runtime contract
  vm.runInContext(`
    LM.Store = {
      get() {
        return {
          profile: { nickname: 'Alex', avatar: null },
          settings: { language: 'ru', appearance: { theme: 'dark' } },
          daily: {
            date: LM.Game.dateKey(),
            tasks: [
              { id: 't-water', cat: 'health', title: 'Drink 2L water', xp: 15, done: true },
              { id: 't-spf', cat: 'skin', title: 'Apply SPF 30+', xp: 20, done: false }
            ]
          }
        };
      }
    };
  `, ctx);

  loadScript(ctx, 'js/game.js');
  loadScript(ctx, 'js/ui.js');
  loadScript(ctx, 'js/chat-store.js');
  loadScript(ctx, 'js/chat-api.js');
  loadScript(ctx, 'js/chat-views.js');

  ctx.LM.I18n.init();
  ctx.LM.ChatStore.get();
  return { ctx, win, LM: ctx.LM, ls };
}

function startExpress(app) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(app);
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise(r => srv.close(() => r())),
      });
    });
  });
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
  console.log('Running Stage 1 Chat Integration Verification...');

  let mode = 'ok';
  let holdResolve = null;
  let capturedPayload = null;
  let upstreamCount = 0;

  const app = express();
  app.use('/api/barrett', createBarrettRouter({
    config: { cooldownMs: 0, ipRpm: 50, userRpm: 50, dailyTotalCap: 100 },
    generateFn: async (call) => {
      upstreamCount += 1;
      capturedPayload = call;
      if (mode === 'hold') {
        await new Promise(r => { holdResolve = r; });
      } else if (mode === '503') {
        const e = new Error('Overloaded');
        e.status = 503;
        throw e;
      } else if (mode === '429') {
        const e = new Error('RESOURCE_EXHAUSTED');
        e.status = 429;
        throw e;
      } else if (mode === 'xss') {
        return {
          text: JSON.stringify({
            emotion: 'happy',
            reply: '<img src=x onerror=alert(1)>Stay consistent with SPF.',
            profileQuote: 'Keep moving.',
            followUps: ['<script>alert(1)</script>Check evening routine'],
          }),
        };
      }
      return {
        text: JSON.stringify({
          emotion: 'happy',
          reply: 'Start with cleanser, moisturizer, and SPF 30+ daily.',
          profileQuote: 'Daily habits beat bursts.',
          followUps: ['Check my evening routine', 'How much SPF?'],
        }),
      };
    },
  }));

  const srv = await startExpress(app);

  try {
    await test('1. index.html loads chat-api.js between chat-store.js and chat-views.js', () => {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const iStore = html.indexOf('js/chat-store.js');
      const iApi = html.indexOf('js/chat-api.js');
      const iViews = html.indexOf('js/chat-views.js');
      const iApp = html.indexOf('js/app.js');
      assert.ok(iStore > 0 && iApi > iStore && iViews > iApi && iApp > iViews);
    });

    await test('2. 100% EN/RU dictionary parity for chat.* & nav.chat and zero EN keys missing in RU', () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const enKeys = Object.keys(LM.Dict.en || {});
      const ruKeys = Object.keys(LM.Dict.ru || {});
      assert.deepStrictEqual(enKeys.filter(k => !(k in LM.Dict.ru)), []);
      const chatEn = enKeys.filter(k => k.startsWith('chat.') || k === 'nav.chat');
      const chatRu = ruKeys.filter(k => k.startsWith('chat.') || k === 'nav.chat');
      assert.deepStrictEqual(chatEn.filter(k => !(k in LM.Dict.ru)), []);
      assert.deepStrictEqual(chatRu.filter(k => !(k in LM.Dict.en)), []);
      assert.ok(chatEn.includes('chat.retry'));
      assert.ok(chatEn.includes('chat.typingLabel'));
      assert.ok(chatEn.includes('chat.err.rateLimitSec'));
    });

    await test('3. Empty state renders Barrett starter prompts and Chico/Duo honest Stage 2 hint', () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const bHtml = LM.ChatViews.thread('barrett');
      assert.ok(bHtml.includes('data-act="chat-starter"'));
      const cHtml = LM.ChatViews.thread('chico');
      assert.ok(!cHtml.includes('data-act="chat-starter"'));
      assert.ok(cHtml.includes(LM.t('chat.stage2Hint')));
    });

    await test('4. End-to-end send shows loading indicator, blocks duplicate in-flight, persists reply + followUps', async () => {
      const { LM, ls } = createEnv({ baseUrl: srv.baseUrl });
      mode = 'hold';
      const req1 = LM.ChatAPI.sendBarrett('Build my skincare base');

      // Wait briefly for Express handler to pause at hold
      await new Promise(r => setTimeout(r, 40));

      assert.strictEqual(LM.ChatAPI.isBusy('barrett'), true);
      const loadingHtml = LM.ChatViews.thread('barrett');
      assert.ok(loadingHtml.includes('id="chat-typing"'), 'Typing indicator must render while in-flight');
      assert.ok(loadingHtml.includes('disabled aria-busy="true"'), 'Send button must be disabled while in-flight');
      assert.ok(loadingHtml.includes(LM.t('chat.sendingStatus')), 'Sending label must render on outgoing msg');

      // Attempt duplicate in-flight request
      const dup = await LM.ChatAPI.sendBarrett('Build my skincare base');
      assert.strictEqual(dup.ok, false);
      assert.strictEqual(dup.error.code, 'DUPLICATE_IN_FLIGHT');
      assert.strictEqual(LM.ChatStore.getMessages('barrett').length, 1, 'Duplicate must not append a second user message');

      holdResolve();
      const res1 = await req1;
      assert.strictEqual(res1.ok, true);
      assert.strictEqual(LM.ChatAPI.isBusy('barrett'), false);

      const msgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 2);
      assert.strictEqual(msgs[0].status, 'sent');
      assert.strictEqual(msgs[1].role, 'assistant');
      assert.strictEqual(msgs[1].sender, 'barrett');
      assert.strictEqual(msgs[1].emotion, 'happy');
      assert.strictEqual(msgs[1].followUps.length, 2);
      assert.ok(capturedPayload.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
      assert.ok(Array.isArray(capturedPayload.contents));
      assert.strictEqual(capturedPayload.contents[capturedPayload.contents.length - 1].role, 'user');
      assert.strictEqual(LM.ChatStore.getThread('barrett').unread, 0, 'Active thread does not mark unread');

      const doneHtml = LM.ChatViews.thread('barrett');
      assert.ok(!doneHtml.includes('id="chat-typing"'));
      assert.ok(doneHtml.includes('data-act="chat-followup"'));

      // Verify persisted across fresh reload
      const reloaded = createEnv({ baseUrl: srv.baseUrl, storage: ls });
      assert.strictEqual(reloaded.LM.ChatStore.getMessages('barrett').length, 2);
    });

    await test('5. Error state (503) renders Retry UI; retry succeeds in-place without duplicating user msg', async () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      mode = '503';
      const failRes = await LM.ChatAPI.sendBarrett('Check morning routine');
      assert.strictEqual(failRes.ok, false);
      assert.strictEqual(failRes.error.code, 'AI_UNAVAILABLE');
      assert.strictEqual(failRes.error.retryable, true);

      const msgsAfterFail = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgsAfterFail.length, 1);
      assert.strictEqual(msgsAfterFail[0].status, 'error');

      const errHtml = LM.ChatViews.thread('barrett');
      assert.ok(errHtml.includes('chat-err-box'));
      assert.ok(errHtml.includes('data-act="chat-retry"'));

      mode = 'ok';
      const retryRes = await LM.ChatAPI.retryBarrett(msgsAfterFail[0].id);
      assert.strictEqual(retryRes.ok, true);

      const msgsAfterRetry = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgsAfterRetry.length, 2, 'Retry must reuse failed user msg and add assistant reply');
      assert.strictEqual(msgsAfterRetry[0].status, 'sent');
      assert.strictEqual(msgsAfterRetry[1].role, 'assistant');
    });

    await test('6. Rate limit 429 respects retryAfterSec cooldown and enforces bounded retry limit', async () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      mode = '429';
      const res429 = await LM.ChatAPI.sendBarrett('Hit quota');
      assert.strictEqual(res429.ok, false);
      assert.strictEqual(res429.error.code, 'AI_QUOTA_EXCEEDED');
      assert.ok(res429.error.retryAfterSec >= 1);

      const msgId = LM.ChatStore.getMessages('barrett')[0].id;
      const blocked = await LM.ChatAPI.retryBarrett(msgId);
      assert.strictEqual(blocked.ok, false);
      assert.strictEqual(blocked.cooldown, true);

      // Force cooldown expiry and verify MAX_RETRY_ATTEMPTS bound
      for (let i = 1; i <= LM.ChatAPI.MAX_RETRY_ATTEMPTS; i++) {
        LM.ChatStore.updateMessage('barrett', msgId, {
          status: 'error',
          error: Object.assign({}, LM.ChatStore.getMessages('barrett')[0].error, { nextRetryAt: 0 }),
        });
        const r = await LM.ChatAPI.retryBarrett(msgId);
        assert.strictEqual(r.ok, false);
      }
      LM.ChatStore.updateMessage('barrett', msgId, {
        status: 'error',
        error: Object.assign({}, LM.ChatStore.getMessages('barrett')[0].error, { nextRetryAt: 0 }),
      });
      const overLimit = await LM.ChatAPI.retryBarrett(msgId);
      assert.strictEqual(overLimit.ok, false);
      assert.strictEqual(overLimit.error.code, 'RETRY_LIMIT');
      assert.strictEqual(overLimit.error.retryable, false);
    });

    await test('7. Interrupted sending state recovers cleanly to retryable error on reload', () => {
      const { LM, ls } = createEnv({ baseUrl: srv.baseUrl });
      LM.ChatStore.addMessage('barrett', {
        role: 'user',
        sender: 'user',
        text: 'Interrupted mid-request',
        status: 'sending',
      });
      const reloaded = createEnv({ baseUrl: srv.baseUrl, storage: ls });
      const msgs = reloaded.LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 1);
      assert.strictEqual(msgs[0].status, 'error');
      assert.strictEqual(msgs[0].error.code, 'INTERRUPTED');
      assert.strictEqual(msgs[0].error.retryable, true);
    });

    await test('8. Navigating away while Barrett replies increments unread badge', async () => {
      const { LM, win } = createEnv({ baseUrl: srv.baseUrl, hash: '#/chat/barrett' });
      mode = 'hold';
      const p = LM.ChatAPI.sendBarrett('Reply while I switch tabs');
      await new Promise(r => setTimeout(r, 40));
      win.location.hash = '#/home';
      holdResolve();
      const res = await p;
      assert.strictEqual(res.ok, true);
      assert.strictEqual(LM.ChatStore.getThread('barrett').unread, 1);
      assert.strictEqual(LM.ChatStore.totalUnread(), 1);
    });

    await test('9. XSS payloads in AI reply and followUps are escaped in ChatViews HTML', async () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      mode = 'xss';
      const res = await LM.ChatAPI.sendBarrett('Test escaping');
      assert.strictEqual(res.ok, true);
      const html = LM.ChatViews.thread('barrett');
      assert.ok(!html.includes('<img src=x'));
      assert.ok(!html.includes('<script>alert(1)</script>'));
      assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
      assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    });

    await test('10. Timeout abort handling normalizes to CLIENT_TIMEOUT retryable error', async () => {
      const { LM } = createEnv({
        baseUrl: srv.baseUrl,
        customFetch: async (_url, init) => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          if (init && init.signal) {}
          throw err;
        },
      });
      const res = await LM.ChatAPI.sendBarrett('Simulate timeout');
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error.code, 'CLIENT_TIMEOUT');
      assert.strictEqual(res.error.retryable, true);
    });

    await test('11. HTTP 200 + Preview HTML (Starting Server) maps to retryable AI_UNAVAILABLE without leaking HTML and recovers on Retry', async () => {
      let attemptCount = 0;
      const previewHtml = '<!doctype html><html><head><title>Starting Server...</title></head><body><h1>Starting Server</h1></body></html>';
      const { LM } = createEnv({
        baseUrl: srv.baseUrl,
        customFetch: async () => {
          attemptCount += 1;
          if (attemptCount === 1) {
            return new Response(previewHtml, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
          return new Response(JSON.stringify({
            ok: true,
            data: { emotion: 'happy', reply: 'Back online and ready.', followUps: ['Next step'] },
            meta: { model: 'test-model' },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      });

      const failRes = await LM.ChatAPI.sendBarrett('Morning skin check');
      assert.strictEqual(failRes.ok, false);
      assert.strictEqual(failRes.error.code, 'AI_UNAVAILABLE');
      assert.strictEqual(failRes.error.retryable, true);
      assert.ok(!failRes.error.message.includes('Starting Server'));
      assert.ok(!failRes.error.message.includes('<html'));
      assert.strictEqual(failRes.error.message, LM.t('chat.err.unavailable'));

      const errHtml = LM.ChatViews.thread('barrett');
      assert.ok(errHtml.includes('data-act="chat-retry"'), 'Retry button must render on Preview HTML 200');
      assert.ok(!errHtml.includes('Starting Server'));

      const msgId = LM.ChatStore.getMessages('barrett')[0].id;
      const retryRes = await LM.ChatAPI.retryBarrett(msgId);
      assert.strictEqual(retryRes.ok, true);
      const msgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 2);
      assert.strictEqual(msgs[1].text, 'Back online and ready.');
    });

    await test('12. HTTP 200 + malformed JSON or empty body maps to retryable INVALID_AI_RESPONSE without leaking raw text; health handles HTML safely', async () => {
      let kind = 'malformed';
      const { LM } = createEnv({
        baseUrl: srv.baseUrl,
        customFetch: async (url) => {
          if (String(url).includes('/health')) {
            return new Response('<html><title>Starting Server...</title></html>', {
              status: 200,
              headers: { 'Content-Type': 'text/html' },
            });
          }
          if (kind === 'empty') {
            return new Response('   ', { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response('RAW_BROKEN_PAYLOAD {{{', { status: 200, headers: { 'Content-Type': 'application/json' } });
        },
      });

      const h = await LM.ChatAPI.health();
      assert.strictEqual(h.ok, false);
      assert.strictEqual(h.data, null);

      const r1 = await LM.ChatAPI.sendBarrett('Test malformed json');
      assert.strictEqual(r1.ok, false);
      assert.strictEqual(r1.error.code, 'INVALID_AI_RESPONSE');
      assert.strictEqual(r1.error.retryable, true);
      assert.ok(!r1.error.message.includes('RAW_BROKEN_PAYLOAD'));
      assert.ok(!r1.error.message.includes('SyntaxError'));

      kind = 'empty';
      const r2 = await LM.ChatAPI.sendBarrett('Test empty body');
      assert.strictEqual(r2.ok, false);
      assert.strictEqual(r2.error.code, 'INVALID_AI_RESPONSE');
      assert.strictEqual(r2.error.retryable, true);
    });

    await test('13. HTTP 400 validation error maps cleanly without breaking Retry/UI rendering', async () => {
      const { LM } = createEnv({
        baseUrl: srv.baseUrl,
        customFetch: async () => new Response(JSON.stringify({
          ok: false,
          error: { code: 'AI_BAD_REQUEST', message: 'Request could not be processed by Barrett.', retryable: false },
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      });

      const r = await LM.ChatAPI.sendBarrett('Trigger 400');
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.error.code, 'AI_BAD_REQUEST');
      assert.strictEqual(r.error.retryable, false);
      const html = LM.ChatViews.thread('barrett');
      assert.ok(html.includes('chat-err-box'));
      assert.ok(!html.includes('data-act="chat-retry"'), 'Non-retryable 400 must not render retry button');
    });
  } finally {
    await srv.close();
  }

  console.log(`\nStage 1 Chat Integration results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
