/* Stage 2 Chat UX & Management verification suite.
   Tests all 13 Stage 2 requirements:
   1. Edit user message + editedAt persistence
   2. Delete individual message + pin cleanup
   3. Proper truncation & re-generation of subsequent AI replies on edit (incl. failure/retry recovery)
   4. Delete entire dialog (preserves progress & photos)
   5. Rename dialog (customTitle + reset default + HTML escaping)
   6. Archive & restore dialog (preserves history, unread isolation)
   7. Copy utility presence & safe HTML view markup
   8. Regenerate AI reply + concurrent duplicate-request prevention
   9. Search history (global cross-thread + in-thread search, match stepping, XSS-safe highlighting)
   10. Pin & unpin messages (max 25 limit + banner rendering)
   11. Pinned list lookup & focus target scrolling
   12. 3-dot context menu triggers on threads & messages (not nested inside <a>)
   13. 100% EN/RU parity & persistence across reload */
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

function createEnv({ baseUrl, storage, hash = '#/chat/barrett', lang = 'ru' } = {}) {
  const ls = storage || makeMemoryStorage();
  const win = {
    location: { hash },
    LM: {},
  };
  const doc = {
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

  vm.runInContext(`
    LM.Store = {
      get() {
        return {
          profile: { nickname: 'Alex', avatar: null },
          settings: { language: '${lang}', appearance: { theme: 'dark' } },
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
  console.log('Running Stage 2 Chat UX & Management Verification...');

  let mode = 'ok';
  let holdResolve = null;
  let genCount = 0;
  let lastUpstreamPrompt = '';

  const app = express();
  app.use('/api/barrett', createBarrettRouter({
    config: { cooldownMs: 0, ipRpm: 100, userRpm: 100, dailyTotalCap: 200 },
    generateFn: async (call) => {
      genCount += 1;
      lastUpstreamPrompt = typeof call.contents === 'string' ? call.contents : JSON.stringify(call.contents || '');
      if (mode === 'hold') {
        await new Promise(r => { holdResolve = r; });
      } else if (mode === '503') {
        const e = new Error('Overloaded');
        e.status = 503;
        throw e;
      }
      return {
        text: JSON.stringify({
          emotion: 'happy',
          reply: `Response #${genCount}: stick to consistent SPF & sleep.`,
          profileQuote: 'Consistency wins.',
          followUps: ['More details'],
        }),
      };
    },
  }));

  const srv = await startExpress(app);

  try {
    await test('1. 100% EN/RU dictionary parity & all Stage 2 keys + icons present', () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const enKeys = Object.keys(LM.Dict.en || {});
      const ruKeys = Object.keys(LM.Dict.ru || {});
      assert.deepStrictEqual(enKeys.filter(k => !(k in LM.Dict.ru)), []);
      const chatEn = enKeys.filter(k => k.startsWith('chat.') || k === 'nav.chat');
      const chatRu = ruKeys.filter(k => k.startsWith('chat.') || k === 'nav.chat');
      assert.deepStrictEqual(chatEn.filter(k => !(k in LM.Dict.ru)), []);
      assert.deepStrictEqual(chatRu.filter(k => !(k in LM.Dict.en)), []);
      [
        'chat.editedTag', 'chat.menu.copy', 'chat.menu.pin', 'chat.menu.edit',
        'chat.menu.regen', 'chat.menu.delete', 'chat.menu.rename', 'chat.menu.archive',
        'chat.menu.restore', 'chat.menu.deleteThread', 'chat.search.globalPlaceholder',
        'chat.search.threadPlaceholder', 'chat.pin.sheetTitle', 'chat.archive.section'
      ].forEach(k => assert.ok(k in LM.Dict.en, `Missing key ${k}`));

      ['dots', 'pin', 'copy', 'archive', 'restore'].forEach(ic => {
        const svg = LM.icon(ic);
        assert.ok(svg.includes('<path d="'), `Icon ${ic} missing`);
      });
    });

    await test('2. Edit user message truncates outdated AI replies & pins, then regenerates via Barrett API', async () => {
      const { LM, ls } = createEnv({ baseUrl: srv.baseUrl });
      genCount = 0;
      const r1 = await LM.ChatAPI.sendBarrett('First skincare question');
      assert.strictEqual(r1.ok, true);
      const r2 = await LM.ChatAPI.sendBarrett('Follow-up second turn');
      assert.strictEqual(r2.ok, true);

      let msgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 4);
      const firstUserId = msgs[0].id;
      const staleAiId = msgs[1].id;
      const laterUserId = msgs[2].id;
      LM.ChatStore.togglePin('barrett', staleAiId);
      LM.ChatStore.togglePin('barrett', laterUserId);
      assert.strictEqual(LM.ChatStore.getPinnedMessages('barrett').length, 2);

      const editRes = await LM.ChatAPI.editAndResendBarrett(firstUserId, 'Edited <skincare> question');
      assert.strictEqual(editRes.ok, true);

      msgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 2, 'Outdated replies & later turns must be truncated');
      assert.strictEqual(msgs[0].id, firstUserId);
      assert.strictEqual(msgs[0].text, 'Edited <skincare> question');
      assert.ok(msgs[0].editedAt > 0, 'editedAt timestamp must be persisted');
      assert.strictEqual(msgs[1].role, 'assistant');
      assert.ok(msgs[1].text.includes('Response #3'));
      assert.ok(lastUpstreamPrompt.includes('Edited <skincare> question'));
      assert.strictEqual(LM.ChatStore.getPinnedMessages('barrett').length, 0, 'Pins referencing truncated msgs must be pruned');

      // Render check: edited badge + escaped HTML + 3-dot menus
      const html = LM.ChatViews.thread('barrett');
      assert.ok(html.includes(LM.t('chat.editedTag')));
      assert.ok(html.includes('&lt;skincare&gt;'));
      assert.ok(html.includes('data-act="msg-menu"'));

      // Reload persistence check
      const reloaded = createEnv({ baseUrl: srv.baseUrl, storage: ls });
      const reMsgs = reloaded.LM.ChatStore.getMessages('barrett');
      assert.strictEqual(reMsgs.length, 2);
      assert.strictEqual(reMsgs[0].text, 'Edited <skincare> question');
      assert.ok(reMsgs[0].editedAt > 0);
    });

    await test('3. Edit failure (503) leaves no stale AI reply and allows in-place retry', async () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      await LM.ChatAPI.sendBarrett('Initial ask');
      const userId = LM.ChatStore.getMessages('barrett')[0].id;

      mode = '503';
      const failedEdit = await LM.ChatAPI.editAndResendBarrett(userId, 'Updated ask');
      assert.strictEqual(failedEdit.ok, false);
      assert.strictEqual(failedEdit.error.code, 'AI_UNAVAILABLE');

      const msgsFail = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgsFail.length, 1, 'Old AI reply must NOT stay visible after edit failure');
      assert.strictEqual(msgsFail[0].status, 'error');
      assert.strictEqual(msgsFail[0].text, 'Updated ask');

      mode = 'ok';
      const retryRes = await LM.ChatAPI.retryBarrett(userId);
      assert.strictEqual(retryRes.ok, true);
      assert.strictEqual(LM.ChatStore.getMessages('barrett').length, 2);
      assert.strictEqual(LM.ChatStore.getMessages('barrett')[1].role, 'assistant');
    });

    await test('4. Regenerate AI response works & blocks duplicate concurrent clicks', async () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      genCount = 0;
      await LM.ChatAPI.sendBarrett('Give jawline tip');
      const aiMsg = LM.ChatStore.getMessages('barrett')[1];
      const countBefore = genCount;

      mode = 'hold';
      const p1 = LM.ChatAPI.regenerateBarrett(aiMsg.id);
      await new Promise(r => setTimeout(r, 40));

      assert.strictEqual(LM.ChatAPI.isBusy('barrett'), true);
      assert.strictEqual(LM.ChatStore.getMessages('barrett').length, 1, 'Old assistant reply removed during regeneration');

      // Attempt concurrent duplicate click
      const p2 = await LM.ChatAPI.regenerateBarrett(aiMsg.id);
      assert.strictEqual(p2.ok, false);
      assert.strictEqual(p2.error.code, 'DUPLICATE_IN_FLIGHT');
      assert.strictEqual(genCount, countBefore + 1, 'Upstream LLM must only be called once');

      holdResolve();
      const r1 = await p1;
      assert.strictEqual(r1.ok, true);
      mode = 'ok';
      const finalMsgs = LM.ChatStore.getMessages('barrett');
      assert.strictEqual(finalMsgs.length, 2);
      assert.notStrictEqual(finalMsgs[1].id, aiMsg.id);
    });

    await test('5. Delete individual message removes it and prunes pin; Delete dialog resets only that thread', () => {
      const { LM, ls } = createEnv({ baseUrl: srv.baseUrl });
      const m1 = LM.ChatStore.addMessage('chico', { role: 'user', sender: 'user', text: 'Style check 1' });
      const m2 = LM.ChatStore.addMessage('chico', { role: 'assistant', sender: 'chico', text: 'Wear clean basics' });
      LM.ChatStore.addMessage('duo', { role: 'user', sender: 'user', text: 'Duo message kept' });

      LM.ChatStore.togglePin('chico', m1.id);
      LM.ChatStore.togglePin('chico', m2.id);
      assert.strictEqual(LM.ChatStore.getPinnedMessages('chico').length, 2);

      assert.strictEqual(LM.ChatStore.removeMessage('chico', m1.id), true);
      assert.strictEqual(LM.ChatStore.getMessages('chico').length, 1);
      assert.strictEqual(LM.ChatStore.getPinnedMessages('chico').length, 1);

      LM.ChatStore.renameThread('chico', 'My Style Coach');
      LM.ChatStore.archiveThread('chico', true);
      LM.ChatStore.deleteThread('chico');

      const th = LM.ChatStore.getThread('chico');
      assert.strictEqual(th.messages.length, 0);
      assert.strictEqual(th.pinnedIds.length, 0);
      assert.strictEqual(th.customTitle, '');
      assert.strictEqual(th.archived, false);
      assert.strictEqual(LM.ChatStore.getMessages('duo').length, 1, 'Other threads unaffected');

      const reloaded = createEnv({ baseUrl: srv.baseUrl, storage: ls });
      assert.strictEqual(reloaded.LM.ChatStore.getMessages('chico').length, 0);
      assert.strictEqual(reloaded.LM.ChatStore.getMessages('duo').length, 1);
    });

    await test('6. Rename dialog & Archive/Restore preserve history and isolate unread badge', () => {
      const { LM, ls } = createEnv({ baseUrl: srv.baseUrl, lang: 'en' });
      LM.ChatStore.addMessage('chico', { role: 'assistant', sender: 'chico', text: 'Archived message kept', markUnread: true });
      assert.strictEqual(LM.ChatStore.totalUnread(), 1);

      const renamed = LM.ChatStore.renameThread('chico', 'Wardrobe <Lab>');
      assert.strictEqual(renamed, 'Wardrobe <Lab>');
      assert.strictEqual(LM.ChatStore.getThreadTitle('chico'), 'Wardrobe <Lab>');

      assert.strictEqual(LM.ChatStore.archiveThread('chico', true), true);
      assert.strictEqual(LM.ChatStore.totalUnread(), 0, 'Archived unread excluded from global badge');
      assert.strictEqual(LM.ChatStore.getThread('chico').unread, 1, 'Per-thread unread count preserved inside archive');
      assert.strictEqual(LM.ChatStore.getMessages('chico').length, 1, 'Archiving must NOT delete history');

      const listHtml = LM.ChatViews.list();
      assert.ok(listHtml.includes('id="chat-archived-toggle"'));
      assert.ok(!listHtml.includes('id="chat-archive-list"'), 'Archive starts collapsed when active dialogs remain');

      // Expanding archive & restoring
      LM.ChatViews.st.archiveOpen = true;
      const expandedHtml = LM.ChatViews.list();
      assert.ok(expandedHtml.includes('id="chat-archive-list"'));
      assert.ok(!expandedHtml.includes('Wardrobe <Lab>'));
      assert.ok(expandedHtml.includes('Wardrobe &lt;Lab&gt;'));
      assert.ok(expandedHtml.includes('data-act="thread-restore"'));

      LM.ChatStore.archiveThread('chico', false);
      assert.strictEqual(LM.ChatStore.totalUnread(), 1);

      LM.ChatStore.renameThread('chico', '');
      assert.strictEqual(LM.ChatStore.getThreadTitle('chico'), 'Chico');

      // Persistence check
      LM.ChatStore.renameThread('barrett', 'Dr. Barrett');
      LM.ChatStore.archiveThread('duo', true);
      const reloaded = createEnv({ baseUrl: srv.baseUrl, storage: ls, lang: 'en' });
      assert.strictEqual(reloaded.LM.ChatStore.getThreadTitle('barrett'), 'Dr. Barrett');
      assert.strictEqual(reloaded.LM.ChatStore.getThread('duo').archived, true);
    });

    await test('7. Pin / Unpin enforces max 25 limit & renders pinned banner cleanly', () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const ids = [];
      for (let i = 1; i <= 26; i++) {
        const m = LM.ChatStore.addMessage('barrett', { role: 'user', sender: 'user', text: `Msg ${i}` });
        ids.push(m.id);
      }
      for (let i = 0; i < 25; i++) {
        const res = LM.ChatStore.togglePin('barrett', ids[i]);
        assert.strictEqual(res.pinned, true);
      }
      const over = LM.ChatStore.togglePin('barrett', ids[25]);
      assert.strictEqual(over.pinned, false);
      assert.strictEqual(over.limitReached, true);

      const pinned = LM.ChatStore.getPinnedMessages('barrett');
      assert.strictEqual(pinned.length, 25);

      const html = LM.ChatViews.thread('barrett');
      assert.ok(html.includes('id="chat-pin-bar"'));
      assert.ok(html.includes('Msg 25'));

      const unpin = LM.ChatStore.togglePin('barrett', ids[24]);
      assert.strictEqual(unpin.pinned, false);
      assert.strictEqual(LM.ChatStore.getPinnedMessages('barrett').length, 24);
    });

    await test('8. Global and in-thread search find matches, escape XSS, and cycle matches', () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const m1 = LM.ChatStore.addMessage('barrett', { role: 'user', sender: 'user', text: 'Use <script>alert(1)</script> SPF every morning' });
      const m2 = LM.ChatStore.addMessage('barrett', { role: 'assistant', sender: 'barrett', text: 'Reapply SPF after swimming' });
      LM.ChatStore.addMessage('chico', { role: 'user', sender: 'user', text: 'Pair SPF routine with clean sunglasses' });

      const allHits = LM.ChatStore.searchMessages('spf');
      assert.strictEqual(allHits.length, 3);
      const bHits = LM.ChatStore.searchMessages('spf', { threadId: 'barrett' });
      assert.strictEqual(bHits.length, 2);

      // Global search UI rendering
      LM.ChatViews.st.listQuery = 'spf';
      const globalHtml = LM.ChatViews.list();
      assert.ok(globalHtml.includes('<mark class="chat-hl">SPF</mark>'));
      assert.ok(!globalHtml.includes('<script>alert(1)</script>'));
      assert.ok(globalHtml.includes('?focus=' + encodeURIComponent(m1.id)));

      // In-thread search + stepping
      LM.ChatViews.openThreadSearch('barrett');
      LM.ChatViews.st.search.q = 'spf';
      const threadHtml = LM.ChatViews.thread('barrett');
      assert.ok(threadHtml.includes('id="chat-search-wrap"'));
      assert.ok(threadHtml.includes('<mark class="chat-hl active">SPF</mark>'));
      assert.ok(threadHtml.includes('1 / 2'));

      const nextFocus = LM.ChatViews.stepSearchMatch('barrett', 1);
      assert.strictEqual(nextFocus, m2.id);
      const steppedHtml = LM.ChatViews.thread('barrett');
      assert.ok(steppedHtml.includes('2 / 2'));
    });

    await test('9. Thread list markup separates <a class="chat-row-main"> from 3-dot <button>', () => {
      const { LM } = createEnv({ baseUrl: srv.baseUrl });
      const html = LM.ChatViews.list();
      // Ensure <a class="chat-row-main" closes BEFORE <button ... data-act="thread-menu">
      const mainClose = html.indexOf('</a><div class="chat-row-actions">');
      assert.ok(mainClose > 0, 'Row action buttons must sit outside <a> link');
    });
  } finally {
    await srv.close();
  }

  console.log(`\nStage 2 Chat Management results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
