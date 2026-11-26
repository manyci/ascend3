/* Stage 4.3 verification suite — Barrett Long-Term Memory & Isolation
   Covers:
   1. Local persistence, sanitization, length clamping, invalid-write protection, and reload survival of memory.barrettSummary
   2. Backward compatibility with legacy ascend.chat.v1 saves lacking barrettSummary or memory object
   3. Transmitting memorySummary & updateSummary=true when memory.sharedEnabled=true
   4. Suppressing memorySummary ('') & updateSummary=false when memory.sharedEnabled=false
   5. Saving validated updatedSummary only after Gemini success with sharedEnabled=true (including in-flight revocation guard & non-empty protection)
   6. Never updating or returning Barrett memory on Cloudflare Workers AI fallback
   7. Strict exclusion of memorySummary, updateSummary, and updatedSummary from Cloudflare fallback payload & response_format JSON schema
   8. Strict exclusion of Barrett memory and fallback from /api/barrett/analyze and /api/barrett/guide */
'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const express = require('express');

const { createBarrettRouter } = require('../../server/barrett');

const ROOT = path.join(__dirname, '..');

const VALID_PNG_B64 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
).toString('base64');

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

function createFrontendEnv({ baseUrl = 'http://127.0.0.1:0', storage, hash = '#/chat/barrett', lang = 'ru' } = {}) {
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
    console.error(err);
    failed += 1;
  }
}

(async () => {
  console.log('Running Stage 4.3 Barrett Memory & Resilience tests...');

  await test('1. ChatStore persists, sanitizes, clamps, guards against empty overwrites, and restores barrettSummary after reload', async () => {
    const ls = makeMemoryStorage();
    const env1 = createFrontendEnv({ storage: ls });
    assert.strictEqual(env1.LM.ChatStore.isSharedMemoryEnabled(), true);
    assert.strictEqual(env1.LM.ChatStore.getBarrettSummary(), '');

    // Sanitization & clamping to 600 chars
    const dirty = '  Goal:\u0007 clear skin\n\n\n\nand 8h sleep.  ' + 'x'.repeat(700);
    assert.strictEqual(env1.LM.ChatStore.setBarrettSummary(dirty), true);
    const saved = env1.LM.ChatStore.getBarrettSummary();
    assert.ok(saved.length <= 600, 'barrettSummary must be clamped to <= 600 chars');
    assert.ok(!saved.includes('\u0007'), 'control characters must be stripped');
    assert.ok(saved.startsWith('Goal: clear skin'));

    // Empty / invalid writes must NOT erase existing memory
    for (const bad of ['', '   ', 'null', 'undefined', 'N/A', '{}', '[]', null, 123, {}]) {
      assert.strictEqual(env1.LM.ChatStore.setBarrettSummary(bad), false);
      assert.strictEqual(env1.LM.ChatStore.getBarrettSummary(), saved);
    }

    // Update with clean summary & toggle sharedEnabled -> reload from same localStorage
    assert.strictEqual(env1.LM.ChatStore.setBarrettSummary('Goal: clear skin, 8h sleep, prefers morning workouts.'), true);
    assert.strictEqual(env1.LM.ChatStore.setSharedMemoryEnabled(false), false);

    const env2 = createFrontendEnv({ storage: ls });
    assert.strictEqual(env2.LM.ChatStore.isSharedMemoryEnabled(), false);
    assert.strictEqual(
      env2.LM.ChatStore.getBarrettSummary(),
      'Goal: clear skin, 8h sleep, prefers morning workouts.'
    );

    // Explicit clearBarrettSummary clears safely
    env2.LM.ChatStore.clearBarrettSummary();
    assert.strictEqual(env2.LM.ChatStore.getBarrettSummary(), '');
  });

  await test('2. Backward compatibility: legacy ascend.chat.v1 localStorage without barrettSummary loads cleanly', async () => {
    const legacyPayload = {
      version: 1,
      clientId: 'asc_legacy_user_01',
      threads: {
        barrett: {
          messages: [
            { id: 'm1', role: 'user', sender: 'user', text: 'Старое сообщение', ts: 1700000000000, status: 'sent' },
            { id: 'm2', role: 'assistant', sender: 'barrett', text: 'Старый ответ', emotion: 'neutral', ts: 1700000001000, status: 'sent' },
          ],
          unread: 1,
          pinnedIds: ['m2'],
          customTitle: 'Coach B',
        },
        chico: { messages: [] },
        duo: { messages: [] },
      },
      memory: {
        sharedEnabled: true,
        shared: ['Likes morning sunlight'],
        private: { barrett: ['Prefers short steps'], chico: ['Minimalist wardrobe'] },
        duo: ['Active week'],
      },
    };
    const ls = makeMemoryStorage({ 'ascend.chat.v1': JSON.stringify(legacyPayload) });
    const env = createFrontendEnv({ storage: ls });
    const state = env.LM.ChatStore.get();
    assert.strictEqual(state.clientId, 'asc_legacy_user_01');
    assert.strictEqual(state.threads.barrett.messages.length, 2);
    assert.strictEqual(state.threads.barrett.customTitle, 'Coach B');
    assert.deepStrictEqual(state.memory.shared, ['Likes morning sunlight']);
    assert.deepStrictEqual(state.memory.private.barrett, ['Prefers short steps']);
    assert.strictEqual(env.LM.ChatStore.isSharedMemoryEnabled(), true);
    assert.strictEqual(env.LM.ChatStore.getBarrettSummary(), '');
    assert.strictEqual(env.LM.ChatStore.setBarrettSummary('New durable summary'), true);
    assert.strictEqual(env.LM.ChatStore.get().threads.barrett.messages.length, 2);
  });

  // Backend + Frontend integration server for scenarios 3-8
  let mode = 'gemini_ok';
  let geminiCalls = [];
  let cfFetchCalls = [];
  let nextGeminiSummary = 'User prefers concise morning skincare and 3x/week bodyweight training.';
  let onGeminiCallHook = null;

  const app = express();
  app.use('/api/barrett', createBarrettRouter({
    apiKey: 'AIzaTestStage43Key123456',
    cloudflare: { accountId: 'acc_secret_43', apiToken: 'tok_secret_43' },
    config: { cooldownMs: 0, retryDelaysMs: [], timeoutMs: 4000, primaryFallbackTimeoutMs: 1500, cloudflareTimeoutMs: 1500 },
    logFn: () => {},
    logFallbackFn: () => {},
    logEventFn: () => {},
    generateFn: async (args) => {
      geminiCalls.push(args);
      if (typeof onGeminiCallHook === 'function') {
        const hook = onGeminiCallHook;
        onGeminiCallHook = null;
        hook(args);
      }
      if (mode === 'gemini_503') {
        const err = new Error('Gemini 503 unavailable');
        err.status = 503;
        throw err;
      }
      return {
        text: JSON.stringify({
          emotion: 'neutral',
          reply: 'Ответ Барретта от Gemini на ты.',
          profileQuote: '',
          followUps: [],
          updatedSummary: nextGeminiSummary,
        }),
      };
    },
    fetchFn: async (url, init) => {
      const body = JSON.parse(init.body);
      cfFetchCalls.push({ url, body });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            success: true,
            result: {
              response: JSON.stringify({
                emotion: 'neutral',
                reply: 'Резервный ответ от Cloudflare.',
                updatedSummary: 'ROGUE_CF_SUMMARY_MUST_NEVER_BE_USED',
              }),
            },
          });
        },
      };
    },
  }));

  const srv = await startServer(app);
  try {
    await test('3 & 5. Sends memorySummary + updateSummary=true when sharedEnabled=true, saves Gemini updatedSummary, and passes it on next turn', async () => {
      mode = 'gemini_ok';
      geminiCalls = [];
      cfFetchCalls = [];
      const ls = makeMemoryStorage();
      const env = createFrontendEnv({ baseUrl: srv.baseUrl, storage: ls });
      await env.LM.Store.boot();

      // Seed initial memory
      env.LM.ChatStore.setSharedMemoryEnabled(true);
      env.LM.ChatStore.setBarrettSummary('Initial summary: oily T-zone, beginner.');
      nextGeminiSummary = 'Updated summary: oily T-zone, uses gentle cleanser and SPF 30+.';

      const r1 = await env.LM.ChatAPI.sendBarrett('Подскажи по уходу утром');
      assert.strictEqual(r1.ok, true);
      assert.strictEqual(r1.meta.provider, 'gemini');
      assert.strictEqual(r1.meta.fallbackUsed, false);
      assert.strictEqual(geminiCalls.length, 1);
      assert.ok(geminiCalls[0].systemInstruction.includes('Initial summary: oily T-zone, beginner.'));
      assert.ok(geminiCalls[0].systemInstruction.includes('updatedSummary'));
      assert.strictEqual(
        env.LM.ChatStore.getBarrettSummary(),
        'Updated summary: oily T-zone, uses gentle cleanser and SPF 30+.'
      );

      // Reload & send second message -> must transmit the updated summary
      const envReloaded = createFrontendEnv({ baseUrl: srv.baseUrl, storage: ls });
      await envReloaded.LM.Store.boot();
      nextGeminiSummary = ''; // empty response must NOT overwrite existing memory!
      const r2 = await envReloaded.LM.ChatAPI.sendBarrett('А что вечером?');
      assert.strictEqual(r2.ok, true);
      assert.strictEqual(geminiCalls.length, 2);
      assert.ok(geminiCalls[1].systemInstruction.includes('Updated summary: oily T-zone, uses gentle cleanser and SPF 30+.'));
      assert.strictEqual(
        envReloaded.LM.ChatStore.getBarrettSummary(),
        'Updated summary: oily T-zone, uses gentle cleanser and SPF 30+.',
        'Empty updatedSummary from Gemini must NOT erase existing saved summary'
      );
    });

    await test('4. Suppresses memorySummary and updateSummary when sharedEnabled=false and does not update memory', async () => {
      mode = 'gemini_ok';
      geminiCalls = [];
      const ls = makeMemoryStorage();
      const env = createFrontendEnv({ baseUrl: srv.baseUrl, storage: ls });
      await env.LM.Store.boot();

      env.LM.ChatStore.setBarrettSummary('PRIVATE_MEMORY_DO_NOT_SEND');
      env.LM.ChatStore.setSharedMemoryEnabled(false);
      nextGeminiSummary = 'SHOULD_NOT_BE_SAVED_WHEN_DISABLED';

      const r = await env.LM.ChatAPI.sendBarrett('Привет, как дела?');
      assert.strictEqual(r.ok, true);
      assert.strictEqual(geminiCalls.length, 1);
      assert.ok(!geminiCalls[0].systemInstruction.includes('PRIVATE_MEMORY_DO_NOT_SEND'), 'memorySummary must not be sent when sharedEnabled=false');
      assert.ok(!geminiCalls[0].systemInstruction.includes('updatedSummary'), 'updateSummary must not be requested when sharedEnabled=false');
      assert.strictEqual(r.data.updatedSummary, '');
      assert.strictEqual(env.LM.ChatStore.getBarrettSummary(), 'PRIVATE_MEMORY_DO_NOT_SEND');

      // In-flight race guard: if sharedEnabled is turned off while request is in flight, updatedSummary must NOT be saved
      env.LM.ChatStore.setSharedMemoryEnabled(true);
      nextGeminiSummary = 'LATE_ARRIVAL_MUST_NOT_SAVE';
      onGeminiCallHook = () => {
        env.LM.ChatStore.setSharedMemoryEnabled(false);
      };
      const rRace = await env.LM.ChatAPI.sendBarrett('Ещё вопрос по режиму');
      assert.strictEqual(rRace.ok, true);
      assert.strictEqual(env.LM.ChatStore.getBarrettSummary(), 'PRIVATE_MEMORY_DO_NOT_SEND');
    });

    await test('6 & 7. Cloudflare fallback payload completely excludes memorySummary, updateSummary, and updatedSummary schema and never updates memory', async () => {
      mode = 'gemini_503';
      geminiCalls = [];
      cfFetchCalls = [];
      const ls = makeMemoryStorage();
      const env = createFrontendEnv({ baseUrl: srv.baseUrl, storage: ls });
      await env.LM.Store.boot();

      // Enable both shared memory and opt-in Cloudflare consent
      env.LM.Store.update((s) => { s.settings.privacy.cloudflareFallback = true; });
      env.LM.ChatStore.setSharedMemoryEnabled(true);
      env.LM.ChatStore.setBarrettSummary('SECRET_BARRETT_SUMMARY_STAGE43');

      const r = await env.LM.ChatAPI.sendBarrett('Составь короткий вечерний чеклист.');
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.meta.provider, 'cloudflare-workers-ai');
      assert.strictEqual(r.meta.fallbackUsed, true);
      assert.strictEqual(r.data.updatedSummary, '', 'Server must strip updatedSummary on fallback');

      // Verify exact HTTP body sent to Cloudflare Workers AI
      assert.strictEqual(cfFetchCalls.length, 1);
      const cfBodyStr = JSON.stringify(cfFetchCalls[0].body);
      assert.ok(!cfBodyStr.includes('SECRET_BARRETT_SUMMARY_STAGE43'), 'memorySummary must NEVER appear in Cloudflare payload');
      assert.ok(!cfBodyStr.includes('updateSummary'), 'updateSummary must NEVER appear in Cloudflare payload');
      assert.ok(!cfBodyStr.includes('updatedSummary'), 'updatedSummary must NEVER appear in Cloudflare system prompt or response_format');
      assert.ok(!('updatedSummary' in (cfFetchCalls[0].body.response_format?.json_schema?.properties || {})), 'response_format schema for Cloudflare must omit updatedSummary');

      // Stored summary must remain unchanged (never overwritten by rogue fallback updatedSummary)
      assert.strictEqual(env.LM.ChatStore.getBarrettSummary(), 'SECRET_BARRETT_SUMMARY_STAGE43');
    });

    await test('8. /api/barrett/analyze and /api/barrett/guide never use Barrett memory, updateSummary, or Cloudflare fallback', async () => {
      mode = 'gemini_ok';
      geminiCalls = [];
      cfFetchCalls = [];

      // Even if a caller sends memorySummary or updateSummary to /analyze or /guide, server ignores them completely
      const analyzeRes = await reqJson(srv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 'client_mem_43',
          lang: 'ru',
          explicitConsent: true,
          allowCloudflareFallback: true,
          focus: 'skin',
          memorySummary: 'SECRET_BARRETT_SUMMARY_ANALYZE',
          updateSummary: true,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      // Note: generateFn mock returns chat-shaped JSON, which fails analyze validatorSpec with 502 OR succeeds; check prompt sent to Gemini in either case!
      assert.strictEqual(geminiCalls.length, 1);
      const analyzePromptStr = JSON.stringify(geminiCalls[0]);
      assert.ok(!analyzePromptStr.includes('SECRET_BARRETT_SUMMARY_ANALYZE'), '/analyze must NOT forward Barrett memorySummary to Gemini');
      assert.ok(!analyzePromptStr.includes('updatedSummary'), '/analyze must NOT request updatedSummary');
      assert.strictEqual(cfFetchCalls.length, 0, '/analyze must NOT call Cloudflare');
      assert.ok(!analyzeRes.json?.data?.updatedSummary, '/analyze must NOT return updatedSummary');

      // Same check for /guide (also verify with mode = gemini_503 -> Cloudflare still 0 calls)
      geminiCalls = [];
      const guideRes = await reqJson(srv.baseUrl, '/api/barrett/guide', {
        method: 'POST',
        body: {
          clientId: 'client_mem_43_g',
          lang: 'ru',
          category: 'skin',
          goal: 'Утренний уход без раздражения',
          allowCloudflareFallback: true,
          memorySummary: 'SECRET_BARRETT_SUMMARY_GUIDE',
          updateSummary: true,
        },
      });
      assert.strictEqual(geminiCalls.length, 1);
      const guidePromptStr = JSON.stringify(geminiCalls[0]);
      assert.ok(!guidePromptStr.includes('SECRET_BARRETT_SUMMARY_GUIDE'), '/guide must NOT forward Barrett memorySummary to Gemini');
      assert.ok(!guidePromptStr.includes('updatedSummary'), '/guide must NOT request updatedSummary');
      assert.strictEqual(cfFetchCalls.length, 0, '/guide must NOT call Cloudflare');
      assert.ok(!guideRes.json?.data?.updatedSummary, '/guide must NOT return updatedSummary');

      // Confirm Gemini 503 on /analyze and /guide never falls back to Cloudflare
      mode = 'gemini_503';
      cfFetchCalls = [];
      const a503 = await reqJson(srv.baseUrl, '/api/barrett/analyze', {
        method: 'POST',
        body: {
          clientId: 'client_mem_43_a503',
          explicitConsent: true,
          allowCloudflareFallback: true,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        },
      });
      const g503 = await reqJson(srv.baseUrl, '/api/barrett/guide', {
        method: 'POST',
        body: {
          clientId: 'client_mem_43_g503',
          goal: 'Базовый уход',
          allowCloudflareFallback: true,
        },
      });
      assert.strictEqual(a503.status, 503);
      assert.strictEqual(g503.status, 503);
      assert.strictEqual(cfFetchCalls.length, 0, '/analyze and /guide must never fall back to Cloudflare');
    });

    await test('9 & 10. Privacy UI: Barrett memory toggle persists across reload, prevents Gemini/Cloudflare leakage when OFF, and clear-memory confirms cleanly', async () => {
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
                for (const fn of fns) fn(event);
                cur = cur.parentNode;
              }
              if (!event._stopped) {
                const docFns = docListeners.get(event.type) || [];
                for (const fn of docFns) fn(event);
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

      const sharedStorage = makeMemoryStorage();
      let env1 = null;
      let env2 = null;
      let envEn = null;
      try {
        env1 = createInteractiveDomEnv({ baseUrl: srv.baseUrl, storage: sharedStorage, hash: '#/settings', lang: 'ru' });
        await new Promise((r) => setTimeout(r, 35));

        // Seed memory & chat thread message before opening Privacy UI
        env1.LM.ChatStore.setBarrettSummary('UI_MEMORY_SECRET_STAGE43');
        env1.LM.ChatStore.addMessage('barrett', { role: 'user', sender: 'user', text: 'История диалога должна сохраниться' });

        // Open Privacy sheet in RU UI
        const privRow = env1.doc.querySelector('[data-act="open-setting"][data-k="privacy"]');
        assert.ok(privRow, 'Settings screen must render Privacy button');
        await privRow.click();

        const memToggle = env1.doc.getElementById('t-barrett-memory');
        const memNote = env1.doc.getElementById('privacy-mem-note');
        const clearBtn = env1.doc.getElementById('p-clear-memory');
        assert.ok(memToggle, 'Privacy sheet must render Barrett memory toggle');
        assert.ok(memNote, 'Privacy sheet must render Barrett memory note');
        assert.ok(clearBtn, 'Privacy sheet must render Clear Barrett memory button');
        assert.strictEqual(memToggle.getAttribute('aria-pressed'), 'true');
        assert.ok(memToggle.querySelector('.t').textContent.includes('Память Barrett'));
        assert.ok(clearBtn.textContent.includes('Очистить память Barrett'));

        // Toggle OFF via UI -> ChatStore.isSharedMemoryEnabled() becomes false
        await memToggle.click();
        assert.strictEqual(env1.LM.ChatStore.isSharedMemoryEnabled(), false);
        assert.strictEqual(memToggle.getAttribute('aria-pressed'), 'false');
        assert.ok(!memToggle.querySelector('.sw').classList.contains('on'));

        // Simulate full reload with same localStorage -> toggle state persists as false
        env1.dispose();
        env1 = null;
        env2 = createInteractiveDomEnv({ baseUrl: srv.baseUrl, storage: sharedStorage, hash: '#/settings', lang: 'ru' });
        await new Promise((r) => setTimeout(r, 35));
        assert.strictEqual(env2.LM.ChatStore.isSharedMemoryEnabled(), false, 'Disabled memory state must persist across reload');
        assert.strictEqual(env2.LM.ChatStore.getBarrettSummary(), 'UI_MEMORY_SECRET_STAGE43');

        await env2.doc.querySelector('[data-act="open-setting"][data-k="privacy"]').click();
        assert.strictEqual(env2.doc.getElementById('t-barrett-memory').getAttribute('aria-pressed'), 'false');

        // Verify with memory OFF: Gemini does NOT receive memorySummary or updateSummary
        mode = 'gemini_ok';
        geminiCalls = [];
        cfFetchCalls = [];
        nextGeminiSummary = 'MUST_NOT_OVERWRITE_WHILE_OFF';
        const rOffGem = await env2.LM.ChatAPI.sendBarrett('Проверка выключенной памяти на Gemini');
        assert.strictEqual(rOffGem.ok, true);
        assert.strictEqual(geminiCalls.length, 1);
        assert.ok(!geminiCalls[0].systemInstruction.includes('UI_MEMORY_SECRET_STAGE43'));
        assert.ok(!geminiCalls[0].systemInstruction.includes('updatedSummary'));

        // Verify with memory OFF + Cloudflare consent ON + Gemini 503: Cloudflare NEVER gets memory
        env2.LM.Store.update((s) => { s.settings.privacy.cloudflareFallback = true; });
        mode = 'gemini_503';
        cfFetchCalls = [];
        const rOffCf = await env2.LM.ChatAPI.sendBarrett('Проверка выключенной памяти на Cloudflare');
        assert.strictEqual(rOffCf.ok, true);
        assert.strictEqual(rOffCf.meta.provider, 'cloudflare-workers-ai');
        assert.strictEqual(cfFetchCalls.length, 1);
        assert.ok(!JSON.stringify(cfFetchCalls[0].body).includes('UI_MEMORY_SECRET_STAGE43'));
        assert.ok(!JSON.stringify(cfFetchCalls[0].body).includes('updatedSummary'));

        const beforeClearMsgCount = env2.LM.ChatStore.getMessages('barrett').length;
        assert.ok(beforeClearMsgCount >= 5, 'Prior messages must exist before clearing memory');

        // Clear memory -> Cancel keeps memory intact
        await env2.doc.getElementById('p-clear-memory').click();
        assert.ok(env2.doc.getElementById('cf-no') && env2.doc.getElementById('cf-ok'), 'LM.confirm must open for Clear Barrett memory');
        await env2.doc.getElementById('cf-no').click();
        await new Promise((r) => setTimeout(r, 15));
        assert.strictEqual(env2.LM.ChatStore.getBarrettSummary(), 'UI_MEMORY_SECRET_STAGE43', 'Cancel must keep summary intact');
        assert.ok(env2.doc.getElementById('p-clear-memory'), 'Privacy sheet should reopen after confirm cancel');

        // Clear memory -> Confirm wipes barrettSummary but keeps chat messages, shows toast, and persists across reload
        await env2.doc.getElementById('p-clear-memory').click();
        await env2.doc.getElementById('cf-ok').click();
        await new Promise((r) => setTimeout(r, 15));
        assert.strictEqual(env2.LM.ChatStore.getBarrettSummary(), '', 'Confirm must clear barrettSummary');
        assert.strictEqual(env2.LM.ChatStore.getMessages('barrett').length, beforeClearMsgCount, 'Chat messages must stay intact');
        const toastEl = env2.doc.querySelector('#toasts .toast');
        assert.ok(toastEl && toastEl.textContent.includes('Память Barrett очищена'));

        // Toggle ON again in UI -> persists across reload
        await env2.doc.getElementById('t-barrett-memory').click();
        assert.strictEqual(env2.LM.ChatStore.isSharedMemoryEnabled(), true);

        env2.dispose();
        env2 = null;
        envEn = createInteractiveDomEnv({ baseUrl: srv.baseUrl, storage: sharedStorage, hash: '#/settings', lang: 'en' });
        await new Promise((r) => setTimeout(r, 35));
        assert.strictEqual(envEn.LM.ChatStore.isSharedMemoryEnabled(), true, 'Re-enabled memory must persist across reload');
        assert.strictEqual(envEn.LM.ChatStore.getBarrettSummary(), '', 'Cleared summary must persist as empty across reload');

        // Switch language to EN and check EN localization in Privacy sheet
        envEn.LM.I18n.set('en');
        await envEn.doc.querySelector('[data-act="open-setting"][data-k="privacy"]').click();
        assert.strictEqual(envEn.doc.getElementById('t-barrett-memory').getAttribute('aria-pressed'), 'true');
        assert.ok(envEn.doc.getElementById('t-barrett-memory').querySelector('.t').textContent.includes('Barrett memory'));
        assert.ok(envEn.doc.getElementById('p-clear-memory').textContent.includes('Clear Barrett memory'));
      } finally {
        if (env1) env1.dispose();
        if (env2) env2.dispose();
        if (envEn) envEn.dispose();
      }
    });

    await test('11. .vercelignore excludes real .env files while preserving .env.example, and RU/EN i18n keys match', async () => {
      const vercelIgnore = fs.readFileSync(path.join(ROOT, '..', '.vercelignore'), 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (const expected of ['.env', '.env.*', '**/.env', '**/.env.*', '!.env.example']) {
        assert.ok(vercelIgnore.includes(expected), `.vercelignore missing rule: ${expected}`);
      }

      const envRu = createFrontendEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      const envEn = createFrontendEnv({ baseUrl: srv.baseUrl, lang: 'en' });
      await envRu.LM.Store.boot();
      await envEn.LM.Store.boot();
      envRu.LM.I18n.set('ru');
      envEn.LM.I18n.set('en');
      const memoryKeys = [
        'sheet.privacyMemoryToggle',
        'sheet.privacyMemorySub',
        'sheet.privacyMemoryNote',
        'sheet.privacyMemoryClearBtn',
        'sheet.privacyMemoryClearTitle',
        'sheet.privacyMemoryClearText',
        'sheet.privacyMemoryClearOk',
        'sheet.privacyMemoryCleared',
      ];
      for (const k of memoryKeys) {
        const ruVal = envRu.LM.I18n.t(k);
        const enVal = envEn.LM.I18n.t(k);
        assert.ok(ruVal && ruVal !== k, `Missing RU translation for ${k}`);
        assert.ok(enVal && enVal !== k, `Missing EN translation for ${k}`);
        assert.notStrictEqual(ruVal, enVal, `RU and EN translations should differ for ${k}`);
      }
    });
  } finally {
    await srv.close();
  }

  console.log(`\nStage 4.3 Barrett Memory results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
