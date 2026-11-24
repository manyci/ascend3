/* Stage 2 Multimodal Chat Verification Suite (Synthetic / Mock-Only — ZERO live API calls).
   Verifies:
   1. EN/RU i18n 100% key parity (including chat.attach.* & multimodal errors)
   2. Plain text message backward compatibility in Barrett chat
   3. Photo-only message (no text) succeeds and passes Gemini multimodal Content[]
   4. Photo + text caption sends both inlineData and user text cleanly
   5. Multi-turn context builds alternating/clean Content[] history across text and photo turns
   6. Unsupported MIME type (GIF/SVG) rejected client-side & server-side (400 INVALID_IMAGE)
   7. File > 3.5 MB rejected client-side & server-side (413 IMAGE_TOO_LARGE)
   8. Corrupted / mismatched magic bytes rejected client-side & server-side (400 INVALID_IMAGE_DATA)
   9. Missing explicitConsent rejected client-side & server-side (400 CONSENT_REQUIRED)
   10. Transient 503 error state & Retry keeps original attached photo and succeeds on retry
   11. UI rendering: Barrett thread renders attach control, draft thumbnail/consent/remove, and bubble attachment; Chico/Duo unchanged
   12. Privacy & Zero-Leak: zero Base64/photos persisted in localStorage, LM.Backup, or server logFn; meta.privacy confirms retained=false */
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

// Valid minimal synthetic image payloads (>= 12 bytes with real headers)
const VALID_PNG_B64 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
).toString('base64');

const VALID_JPEG_BUF = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]);
const VALID_JPEG_B64 = VALID_JPEG_BUF.toString('base64');

const VALID_WEBP_BUF = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x14, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x08, 0x00, 0x00, 0x00,
]);
const VALID_WEBP_B64 = VALID_WEBP_BUF.toString('base64');

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
    Uint8Array,
    Buffer,
    JSON,
    Promise,
    Error,
    AbortController,
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    setTimeout,
    clearTimeout,
    console,
    fetch: customFetch || (async (url, init) => {
      const target = String(url).startsWith('http') ? url : `${baseUrl}${url}`;
      return fetch(target, init);
    }),
  });

  loadScript(ctx, 'js/data.js');
  loadScript(ctx, 'js/i18n/en.js');
  loadScript(ctx, 'js/i18n/ru.js');
  loadScript(ctx, 'js/i18n.js');

  vm.runInContext(`
    LM.Store = {
      get() {
        return {
          profile: { nickname: 'Alex', avatar: null },
          settings: { language: 'ru', appearance: { theme: 'dark' } },
          daily: {
            date: LM.Game.dateKey(),
            tasks: [
              { id: 't-spf', cat: 'skin', title: 'Apply SPF 30+', xp: 20, done: false }
            ]
          }
        };
      },
      snapshot() {
        return { version: 3, profile: { nickname: 'Alex' }, daily: { tasks: [] }, unlocked: [] };
      }
    };
    LM.Photos = {
      async exportAll() { return []; },
      async snapshot() { return []; },
      async replaceAll() {}
    };
  `, ctx);

  loadScript(ctx, 'js/game.js');
  loadScript(ctx, 'js/ui.js');
  loadScript(ctx, 'js/backup.js');
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
  console.log('Running Stage 2 Multimodal Chat Verification (Mock-Only)...');

  let mode = 'ok';
  let capturedCalls = [];
  const serverLogs = [];

  const app = express();
  app.use('/api/barrett', createBarrettRouter({
    config: { cooldownMs: 0, ipRpm: 100, userRpm: 100, dailyTotalCap: 200 },
    logFn: (entry) => serverLogs.push(entry),
    generateFn: async (call) => {
      capturedCalls.push(call);
      if (mode === '503') {
        const err = new Error('Model overloaded');
        err.status = 503;
        throw err;
      }
      const lastTurn = Array.isArray(call.contents) ? call.contents[call.contents.length - 1] : null;
      const hasInline = Boolean(lastTurn && Array.isArray(lastTurn.parts) && lastTurn.parts.some(p => p && p.inlineData));
      const textParts = lastTurn && Array.isArray(lastTurn.parts) ? lastTurn.parts.filter(p => p && typeof p.text === 'string') : [];
      return {
        text: JSON.stringify({
          emotion: hasInline ? 'neutral' : 'happy',
          reply: hasInline
            ? `Saw your photo (${textParts.map(p => p.text).join(' ').slice(0, 40)}). Focus on gentle cleansing and SPF.`
            : 'All good, let us keep moving.',
          profileQuote: '',
          followUps: ['How often do you cleanse?'],
        }),
      };
    },
  }));

  const srv = await startExpress(app);
  try {
    await test('1. EN/RU i18n 100% key parity (including chat.attach.* & multimodal errors)', () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const enKeys = Object.keys(LM.Dict.en);
      const ruKeys = Object.keys(LM.Dict.ru);
      assert.deepStrictEqual(enKeys.filter(k => !(k in LM.Dict.ru)), []);
      const chatEn = enKeys.filter(k => k.startsWith('chat.') || k === 'nav.chat');
      const chatRu = ruKeys.filter(k => k.startsWith('chat.') || k === 'nav.chat');
      assert.deepStrictEqual(chatEn.filter(k => !(k in LM.Dict.ru)), []);
      assert.deepStrictEqual(chatRu.filter(k => !(k in LM.Dict.en)), []);
      assert.ok('chat.attach.btnAria' in LM.Dict.en);
      assert.ok('chat.err.consentRequired' in LM.Dict.en);
    });

    await test('2. Plain text message continues to work identically without attachments', async () => {
      mode = 'ok';
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const res = await LM.ChatAPI.sendBarrett('Привет, как дела?');
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.meta.privacy.photoRetainedOnServer, false);
      assert.strictEqual(res.meta.privacy.thirdPartyAiUsed, false);
      const call = capturedCalls[0];
      assert.ok(Array.isArray(call.contents));
      assert.strictEqual(call.contents.length, 1);
      assert.strictEqual(call.contents[0].role, 'user');
      assert.deepStrictEqual(call.contents[0].parts, [{ text: 'Привет, как дела?' }]);
      const msgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 2);
      assert.strictEqual(msgs[0].attachment, undefined);
    });

    await test('3. Sending photo without text (photo-only) succeeds with inlineData + default prompt', async () => {
      mode = 'ok';
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const res = await LM.ChatAPI.sendBarrett('', {
        image: { mimeType: 'image/jpeg', dataBase64: VALID_JPEG_B64, sizeBytes: VALID_JPEG_BUF.length, name: 'selfie.jpg' },
        explicitConsent: true,
      });
      assert.strictEqual(res.ok, true, 'Expected photo-only sendBarrett to succeed');
      assert.strictEqual(res.meta.privacy.retained, false);
      assert.strictEqual(res.meta.privacy.photoRetainedOnServer, false);
      assert.strictEqual(res.meta.privacy.thirdPartyAiUsed, true);

      const call = capturedCalls[0];
      assert.strictEqual(call.contents.length, 1);
      const parts = call.contents[0].parts;
      assert.ok(parts.some(p => p.inlineData && p.inlineData.mimeType === 'image/jpeg' && p.inlineData.data === VALID_JPEG_B64));
      assert.ok(parts.some(p => typeof p.text === 'string' && p.text.length > 0));

      const msgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 2);
      assert.strictEqual(msgs[0].text, '');
      assert.strictEqual(msgs[0].status, 'sent');
      assert.deepStrictEqual(JSON.parse(JSON.stringify(msgs[0].attachment)), {
        kind: 'image',
        mimeType: 'image/jpeg',
        sizeBytes: VALID_JPEG_BUF.length,
        name: 'selfie.jpg',
      });
    });

    await test('4. Sending photo + text caption sends both inlineData and exact caption', async () => {
      mode = 'ok';
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const res = await LM.ChatAPI.sendBarrett('Что думаешь по укладке?', {
        image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64, name: 'hair.png' },
        explicitConsent: true,
      });
      assert.strictEqual(res.ok, true);
      const lastTurn = capturedCalls[0].contents[capturedCalls[0].contents.length - 1];
      assert.strictEqual(lastTurn.role, 'user');
      assert.ok(lastTurn.parts.some(p => p.inlineData && p.inlineData.mimeType === 'image/png' && p.inlineData.data === VALID_PNG_B64));
      assert.ok(lastTurn.parts.some(p => p.text === 'Что думаешь по укладке?'));
    });

    await test('5. Multi-turn context keeps prior turns and builds valid Gemini Content[] sequence', async () => {
      mode = 'ok';
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });

      await LM.ChatAPI.sendBarrett('Привет, оценим прическу?');
      await LM.ChatAPI.sendBarrett('', {
        image: { mimeType: 'image/webp', dataBase64: VALID_WEBP_B64, sizeBytes: VALID_WEBP_BUF.length, name: 'cut.webp' },
        explicitConsent: true,
      });
      await LM.ChatAPI.sendBarrett('А что с висками?');

      assert.strictEqual(capturedCalls.length, 3);
      const thirdContents = capturedCalls[2].contents;
      assert.strictEqual(thirdContents.length, 5); // user1, model1, user2(photo tag), model2, user3
      assert.strictEqual(thirdContents[0].role, 'user');
      assert.strictEqual(thirdContents[1].role, 'model');
      assert.strictEqual(thirdContents[2].role, 'user');
      assert.ok(thirdContents[2].parts[0].text.includes('фото'));
      assert.strictEqual(thirdContents[3].role, 'model');
      assert.strictEqual(thirdContents[4].role, 'user');
      assert.strictEqual(thirdContents[4].parts[0].text, 'А что с висками?');
    });

    await test('6. Unsupported MIME type is rejected on both client & server (400 INVALID_IMAGE)', async () => {
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const clientCheck = LM.ChatAPI.validateImagePayload({
        mimeType: 'image/gif',
        dataBase64: Buffer.from('GIF89a1234567890123456').toString('base64'),
      });
      assert.strictEqual(clientCheck.ok, false);
      assert.strictEqual(clientCheck.code, 'INVALID_IMAGE');

      const sendRes = await LM.ChatAPI.sendBarrett('test', {
        image: { mimeType: 'image/svg+xml', dataBase64: Buffer.from('<svg></svg>1234567890').toString('base64') },
        explicitConsent: true,
      });
      assert.strictEqual(sendRes.ok, false);
      assert.strictEqual(sendRes.error.code, 'INVALID_IMAGE');
      assert.strictEqual(capturedCalls.length, 0);

      // Direct HTTP server check
      const rawRes = await fetch(`${srv.baseUrl}/api/barrett/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'test_client_mime_1',
          lang: 'ru',
          message: '',
          explicitConsent: true,
          image: { mimeType: 'image/gif', dataBase64: VALID_JPEG_B64 },
        }),
      });
      assert.strictEqual(rawRes.status, 400);
      const rawJson = await rawRes.json();
      assert.strictEqual(rawJson.error.code, 'INVALID_IMAGE');
      assert.strictEqual(capturedCalls.length, 0);
    });

    await test('7. File > 3.5 MB is rejected on both client & server (413 IMAGE_TOO_LARGE)', async () => {
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const oversizedPayload = VALID_JPEG_B64 + 'A'.repeat(4_800_000);

      const clientRes = await LM.ChatAPI.sendBarrett('check size', {
        image: { mimeType: 'image/jpeg', dataBase64: VALID_JPEG_B64, sizeBytes: 4_000_000 },
        explicitConsent: true,
      });
      assert.strictEqual(clientRes.ok, false);
      assert.strictEqual(clientRes.error.code, 'IMAGE_TOO_LARGE');
      assert.strictEqual(clientRes.error.status, 413);

      const rawRes = await fetch(`${srv.baseUrl}/api/barrett/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'test_client_size_1',
          lang: 'ru',
          message: '',
          explicitConsent: true,
          image: { mimeType: 'image/jpeg', dataBase64: oversizedPayload },
        }),
      });
      assert.strictEqual(rawRes.status, 413);
      const rawJson = await rawRes.json();
      assert.strictEqual(rawJson.error.code, 'IMAGE_TOO_LARGE');
      assert.strictEqual(capturedCalls.length, 0);
    });

    await test('8. Corrupted / spoofed magic bytes rejected cleanly (400 INVALID_IMAGE_DATA)', async () => {
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const fakeJpegB64 = Buffer.from('THIS_IS_NOT_A_REAL_JPEG_HEADER_DATA').toString('base64');

      const clientRes = await LM.ChatAPI.sendBarrett('check magic', {
        image: { mimeType: 'image/jpeg', dataBase64: fakeJpegB64 },
        explicitConsent: true,
      });
      assert.strictEqual(clientRes.ok, false);
      assert.strictEqual(clientRes.error.code, 'INVALID_IMAGE_DATA');

      const rawRes = await fetch(`${srv.baseUrl}/api/barrett/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'test_client_magic_1',
          lang: 'ru',
          message: 'Check',
          explicitConsent: true,
          image: { mimeType: 'image/jpeg', dataBase64: fakeJpegB64 },
        }),
      });
      assert.strictEqual(rawRes.status, 400);
      const rawJson = await rawRes.json();
      assert.strictEqual(rawJson.error.code, 'INVALID_IMAGE_DATA');
      assert.strictEqual(capturedCalls.length, 0);
    });

    await test('9. Missing explicitConsent rejected with 400 CONSENT_REQUIRED on client & server', async () => {
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });

      const clientRes = await LM.ChatAPI.sendBarrett('Посмотри фото', {
        image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        explicitConsent: false,
      });
      assert.strictEqual(clientRes.ok, false);
      assert.strictEqual(clientRes.error.code, 'CONSENT_REQUIRED');

      const rawRes = await fetch(`${srv.baseUrl}/api/barrett/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'test_client_consent_1',
          lang: 'ru',
          message: 'Посмотри фото',
          explicitConsent: false,
          image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64 },
        }),
      });
      assert.strictEqual(rawRes.status, 400);
      const rawJson = await rawRes.json();
      assert.strictEqual(rawJson.error.code, 'CONSENT_REQUIRED');
      assert.strictEqual(capturedCalls.length, 0);
    });

    await test('10. API 503 marks photo message as error without duplication, and Retry succeeds with same image', async () => {
      mode = '503';
      capturedCalls = [];
      const { LM } = createEnv({ baseUrl: srv.baseUrl });

      const first = await LM.ChatAPI.sendBarrett('Оцени рутину по фото', {
        image: { mimeType: 'image/jpeg', dataBase64: VALID_JPEG_B64, sizeBytes: VALID_JPEG_BUF.length, name: 'routine.jpg' },
        explicitConsent: true,
      });
      assert.strictEqual(first.ok, false);
      assert.strictEqual(first.error.retryable, true);

      let msgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 1);
      assert.strictEqual(msgs[0].status, 'error');
      assert.strictEqual(LM.ChatAPI.hasPendingMedia(msgs[0].id), true);

      // Now API recovers and user clicks Retry
      mode = 'ok';
      capturedCalls = [];
      const retryRes = await LM.ChatAPI.retryBarrett(msgs[0].id);
      assert.strictEqual(retryRes.ok, true);
      assert.strictEqual(capturedCalls.length, 1);
      const retriedParts = capturedCalls[0].contents[0].parts;
      assert.ok(retriedParts.some(p => p.inlineData && p.inlineData.data === VALID_JPEG_B64));
      assert.ok(retriedParts.some(p => p.text === 'Оцени рутину по фото'));

      msgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 2); // No duplicate user message!
      assert.strictEqual(msgs[0].status, 'sent');
      assert.strictEqual(msgs[1].role, 'assistant');
      assert.strictEqual(LM.ChatAPI.hasPendingMedia(msgs[0].id), false); // Freed from RAM after delivery
    });

    await test('11. UI markup: Barrett thread shows attach button, draft preview + remove button, and message media; Chico/Duo untouched', async () => {
      mode = 'ok';
      const { LM } = createEnv({ baseUrl: srv.baseUrl });

      // Empty Barrett thread has attach button + file input + drop overlay
      let barrettHtml = LM.ChatViews.thread('barrett');
      assert.ok(barrettHtml.includes('id="chat-attach-btn"'));
      assert.ok(barrettHtml.includes('id="chat-file-input"'));
      assert.ok(barrettHtml.includes('id="chat-drop-overlay"'));

      // Chico and Duo remain unchanged without attach controls
      const chicoHtml = LM.ChatViews.thread('chico');
      const duoHtml = LM.ChatViews.thread('duo');
      assert.ok(!chicoHtml.includes('id="chat-attach-btn"'));
      assert.ok(!duoHtml.includes('id="chat-attach-btn"'));

      // Draft preview + consent + remove button appear when attachment staged, and disappear on clear
      LM.ChatViews.setDraftAttachment({
        kind: 'image',
        mimeType: 'image/jpeg',
        dataBase64: VALID_JPEG_B64,
        sizeBytes: VALID_JPEG_BUF.length,
        name: 'cheek.jpg',
        previewUrl: 'data:image/jpeg;base64,' + VALID_JPEG_B64,
      });
      barrettHtml = LM.ChatViews.thread('barrett');
      assert.ok(barrettHtml.includes('id="chat-attach-preview"'));
      assert.ok(barrettHtml.includes('id="chat-attach-clear"'));
      assert.ok(barrettHtml.includes('id="chat-attach-consent"'));
      assert.ok(barrettHtml.includes('cheek.jpg'));

      LM.ChatViews.clearDraftAttachment();
      barrettHtml = LM.ChatViews.thread('barrett');
      assert.ok(!barrettHtml.includes('id="chat-attach-preview"'));

      // Sent photo message renders thumbnail inside bubble in current session, and safe badge after reload
      await LM.ChatAPI.sendBarrett('', {
        image: { mimeType: 'image/png', dataBase64: VALID_PNG_B64, sizeBytes: 68, name: 'skin.png' },
        explicitConsent: true,
      });
      barrettHtml = LM.ChatViews.thread('barrett');
      assert.ok(barrettHtml.includes('class="chat-msg-img"'));

      // After simulated page reload (RAM Session previews cleared), safe non-secret metadata badge renders
      LM.ChatAPI.clearSessionMedia();
      barrettHtml = LM.ChatViews.thread('barrett');
      assert.ok(!barrettHtml.includes('class="chat-msg-img"'));
      assert.ok(barrettHtml.includes('class="chat-msg-file"'));
      assert.ok(barrettHtml.includes('PNG'));
    });

    await test('12. Zero-Leak check: NO Base64/raw photos in localStorage, LM.Backup, or server logs', async () => {
      mode = 'ok';
      const ls = makeMemoryStorage();
      const { LM } = createEnv({ baseUrl: srv.baseUrl, storage: ls });

      await LM.ChatAPI.sendBarrett('Проверь фото', {
        image: { mimeType: 'image/jpeg', dataBase64: VALID_JPEG_B64, sizeBytes: VALID_JPEG_BUF.length, name: 'check.jpg' },
        explicitConsent: true,
      });

      const rawChatStorage = ls.getItem('ascend.chat.v1') || '';
      assert.ok(rawChatStorage.length > 0);
      assert.ok(!rawChatStorage.includes(VALID_JPEG_B64), 'localStorage must NEVER contain raw Base64 image data');
      assert.ok(!rawChatStorage.includes('data:image/'), 'localStorage must NEVER contain data URLs');
      assert.ok(!rawChatStorage.includes('dataBase64'), 'localStorage must NEVER serialize dataBase64');

      // Simulate direct malicious ChatStore injection attempt with dataBase64/previewUrl
      LM.ChatStore.addMessage('barrett', {
        role: 'user',
        text: '',
        attachment: {
          kind: 'image',
          mimeType: 'image/jpeg',
          sizeBytes: 1200,
          name: 'x.jpg',
          dataBase64: VALID_JPEG_B64,
          previewUrl: 'data:image/jpeg;base64,' + VALID_JPEG_B64,
        },
      });
      const dumpedAfterInject = ls.getItem('ascend.chat.v1') || '';
      assert.ok(!dumpedAfterInject.includes(VALID_JPEG_B64), 'ChatStore sanitizer must strip injected dataBase64/previewUrl');

      const backupJson = JSON.stringify(await LM.Backup.build());
      assert.ok(!backupJson.includes(VALID_JPEG_B64), 'LM.Backup must NEVER include chat photo base64');
      assert.ok(!backupJson.includes('data:image/'), 'LM.Backup must NEVER include data URLs');

      const logBlob = JSON.stringify(serverLogs);
      assert.ok(!logBlob.includes(VALID_JPEG_B64), 'Server logs must NEVER include base64 image data');
      assert.ok(!logBlob.includes(VALID_PNG_B64), 'Server logs must NEVER include base64 image data');
      assert.ok(!logBlob.includes('AIza'), 'Server logs must NEVER expose API keys');
    });
  } finally {
    await srv.close();
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
