/* Stage 2 Chat Foundation Playwright verification suite.
   Run: NODE_PATH=/tmp/pw/node_modules SCRATCH=/tmp/verify-chat-s2 node ASCEND/tests/stage-chat-stage2.test.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const start = require('./server');

const PORT = 8126, BASE = 'http://127.0.0.1:' + PORT;
const SCRATCH = process.env.SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'ascend-chat-s2-'));
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(SCRATCH, 'shots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const results = [];
let cur = null;
function check(desc, ok, detail) {
  cur.checks.push({ desc, ok: !!ok, detail: ok ? undefined : detail });
  if (!ok) console.log('   ✗', desc, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : '');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newCtx(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp || { width: 390, height: 844 }, acceptDownloads: true });
  ctx._errors = [];
  ctx.on('page', p => {
    p.on('console', m => {
      if (m.type() !== 'error') return;
      if (/favicon\.ico/.test(m.location().url || '')) return;
      ctx._errors.push(m.text());
    });
    p.on('pageerror', e => ctx._errors.push('pageerror: ' + e.message));
  });
  return ctx;
}

async function openApp(ctx, hash) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/new/index.html' + (hash || '#/home'));
  await page.waitForFunction(() => window.__bootReport);
  await sleep(160);
  return page;
}

const TESTS = [];
const test = (name, fn) => TESTS.push({ name, fn });

test('S2-1 5-tab navigation centered Chat + mobile/desktop geometry + EN/RU parity', async (br) => {
  for (const [tag, vp, theme, lang] of [
    ['390x844-dark-ru', { width: 390, height: 844 }, 'dark', 'ru'],
    ['390x844-light-en', { width: 390, height: 844 }, 'light', 'en'],
    ['1440x900-dark-ru', { width: 1440, height: 900 }, 'dark', 'ru'],
    ['1440x900-light-en', { width: 1440, height: 900 }, 'light', 'en']
  ]) {
    const ctx = await newCtx(br, vp);
    const page = await openApp(ctx, '#/chat');
    await page.evaluate(({ th, lg }) => {
      LM.I18n.set(lg);
      LM.Store.update(s => { s.settings.appearance.theme = th; });
    }, { th: theme, lg: lang });
    await sleep(180);

    const nav = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('#nav a'));
      const navBox = document.getElementById('nav').getBoundingClientRect();
      return {
        hrefs: links.map(a => a.getAttribute('href')),
        activeIndex: links.findIndex(a => a.classList.contains('on')),
        minHeightOk: links.every(a => a.getBoundingClientRect().height >= 44),
        labels: links.map(a => a.querySelector('span')?.textContent.trim()),
        wrapped: links.some(a => {
          const sp = a.querySelector('span');
          return sp && sp.getBoundingClientRect().height > 20;
        }),
        noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        navOverflow: document.getElementById('nav').scrollWidth <= navBox.width + 1
      };
    });
    check(`${tag}: 5 tabs in exact order with Chat centered (index 2)`, JSON.stringify(nav.hrefs) === '["#/home","#/guides","#/chat","#/progress","#/profile"]' && nav.activeIndex === 2, nav);
    check(`${tag}: nav hit targets >= 44px, single-line labels, no overflow`, nav.minHeightOk && !nav.wrapped && nav.noOverflow && nav.navOverflow, nav);

    const listCheck = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#chat-list .chat-row'));
      return rows.map(r => {
        const img = r.querySelector('.chat-av img');
        return {
          id: r.dataset.chatId,
          src: img ? img.getAttribute('src') : '',
          complete: !!(img && img.complete),
          nw: img ? img.naturalWidth : 0,
          nh: img ? img.naturalHeight : 0,
          name: r.querySelector('.chat-row-name')?.textContent.trim()
        };
      });
    });
    check(`${tag}: 3 dialogs (barrett, chico, duo) with loaded original avatars`,
      listCheck.length === 3 &&
      listCheck.map(x => x.id).join(',') === 'barrett,chico,duo' &&
      listCheck.every(x => x.src === `assets/avatars/${x.id}.jpg` && x.complete && x.nw > 0 && x.nh > 0),
      listCheck);

    await page.screenshot({ path: path.join(SHOTS_DIR, `s2_list_${tag}.png`) });
    check(`${tag}: zero console/page errors`, ctx._errors.length === 0, ctx._errors);
    await ctx.close();
  }

  // EN/RU parity for all keys including chat.*
  const ctx = await newCtx(br);
  const page = await openApp(ctx, '#/chat');
  const parity = await page.evaluate(() => {
    const ru = Object.keys(LM.Dict.ru || {});
    const en = Object.keys(LM.Dict.en || {});
    const chatEn = en.filter(k => k.startsWith('chat.') || k === 'nav.chat');
    const chatRu = ru.filter(k => k.startsWith('chat.') || k === 'nav.chat');
    return {
      extraInEn: en.filter(k => !(k in LM.Dict.ru)),
      chatExtraInEn: chatEn.filter(k => !(k in LM.Dict.ru)),
      chatExtraInRu: chatRu.filter(k => !(k in LM.Dict.en)),
      chatKeys: chatEn
    };
  });
  check('100% EN/RU dictionary parity for chat.* keys & zero missing EN keys in RU', parity.extraInEn.length === 0 && parity.chatExtraInEn.length === 0 && parity.chatExtraInRu.length === 0 && parity.chatKeys.length >= 15, parity);
  await ctx.close();
});

test('S2-2 Dialog open, message send, Enter shortcut, persistence across reload, layout geometry', async (br) => {
  for (const [tag, vp, theme] of [
    ['mobile-dark', { width: 390, height: 844 }, 'dark'],
    ['mobile-light', { width: 390, height: 844 }, 'light'],
    ['desktop-dark', { width: 1440, height: 900 }, 'dark']
  ]) {
    const ctx = await newCtx(br, vp);
    const page = await openApp(ctx, '#/chat');
    await page.evaluate(th => LM.Store.update(s => { s.settings.appearance.theme = th; }), theme);
    await sleep(120);

    await page.click('.chat-row[data-chat-id="barrett"]');
    await sleep(180);
    const emptyCheck = await page.evaluate(() => ({
      hash: location.hash,
      hasEmpty: !!document.querySelector('.chat-empty-state'),
      avatarOk: (document.querySelector('.chat-head .chat-av img')?.naturalWidth || 0) > 0,
      composerBox: document.getElementById('chat-form')?.getBoundingClientRect(),
      navBox: document.getElementById('nav')?.getBoundingClientRect(),
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth
    }));
    check(`${tag}: Barrett thread opens cleanly above nav with no overflow`,
      emptyCheck.hash === '#/chat/barrett' &&
      emptyCheck.hasEmpty &&
      emptyCheck.avatarOk &&
      emptyCheck.composerBox.bottom <= emptyCheck.navBox.top + 1 &&
      emptyCheck.noOverflow,
      emptyCheck);

    await page.fill('#chat-input', 'Check jawline plan today');
    await page.press('#chat-input', 'Enter');
    await sleep(160);

    await page.fill('#chat-input', 'Second message via button');
    await page.click('#chat-send');
    await sleep(160);

    const sentCheck = await page.evaluate(() => ({
      bubbles: Array.from(document.querySelectorAll('#chat-feed .chat-msg.out .chat-txt')).map(n => n.textContent),
      raw: JSON.parse(localStorage.getItem('ascend.chat.v1') || '{}')
    }));
    check(`${tag}: Enter & send button append outgoing messages and persist to ascend.chat.v1`,
      sentCheck.bubbles.length === 2 &&
      sentCheck.bubbles[0] === 'Check jawline plan today' &&
      sentCheck.bubbles[1] === 'Second message via button' &&
      sentCheck.raw.threads?.barrett?.messages?.length === 2,
      sentCheck);

    await page.screenshot({ path: path.join(SHOTS_DIR, `s2_thread_barrett_${tag}.png`) });

    // Reload persistence + list preview update
    await page.reload();
    await page.waitForFunction(() => window.__bootReport);
    await sleep(180);
    const afterReload = await page.evaluate(() => Array.from(document.querySelectorAll('#chat-feed .chat-msg.out .chat-txt')).map(n => n.textContent));
    check(`${tag}: messages survive full reload`, afterReload.length === 2 && afterReload[1] === 'Second message via button', afterReload);

    await page.click('.chat-back');
    await sleep(160);
    const listAfterBack = await page.evaluate(() => ({
      hash: location.hash,
      preview: document.querySelector('.chat-row[data-chat-id="barrett"] .chat-row-prev')?.textContent || ''
    }));
    check(`${tag}: back returns to #/chat and shows updated preview`, listAfterBack.hash === '#/chat' && /Second message via button/.test(listAfterBack.preview), listAfterBack);

    // Check Chico & Duo empty states and unread badge clearing
    await page.evaluate(() => {
      LM.ChatStore.addMessage('chico', { role: 'assistant', sender: 'chico', text: 'Yo bro, check lighting', markUnread: true });
      LM.ChatStore.addMessage('duo', { role: 'assistant', sender: 'barrett', text: 'Stop overthinking posture', markUnread: true });
      LM.ChatStore.addMessage('duo', { role: 'assistant', sender: 'chico', text: 'Keep it relaxed though', markUnread: true });
    });
    await sleep(150);
    const unreadState = await page.evaluate(() => ({
      navDot: !!document.querySelector('#nav a[href="#/chat"] .nav-dot'),
      chicoBadge: document.querySelector('.chat-row[data-chat-id="chico"] .chat-unread')?.textContent,
      duoBadge: document.querySelector('.chat-row[data-chat-id="duo"] .chat-unread')?.textContent
    }));
    check(`${tag}: nav unread dot and per-thread unread badges render`, unreadState.navDot && unreadState.chicoBadge === '1' && unreadState.duoBadge === '2', unreadState);

    await page.click('.chat-row[data-chat-id="duo"]');
    await sleep(180);
    const duoState = await page.evaluate(() => ({
      senders: Array.from(document.querySelectorAll('#chat-feed .chat-msg.in .chat-sender')).map(n => n.textContent),
      unreadAfterOpen: LM.ChatStore.getThread('duo').unread
    }));
    check(`${tag}: Duo renders distinct Barrett & Chico incoming sender bubbles and clears unread`, duoState.senders.join(',') === 'Barrett,Chico' && duoState.unreadAfterOpen === 0, duoState);
    if (tag === 'mobile-dark') await page.screenshot({ path: path.join(SHOTS_DIR, 's2_thread_duo_mobile.png') });

    check(`${tag}: zero console/page errors`, ctx._errors.length === 0, ctx._errors);
    await ctx.close();
  }
});

test('S2-3 Strict storage independence (photos / progress reset vs chat store)', async (br) => {
  const ctx = await newCtx(br);
  const page = await openApp(ctx, '#/chat/chico');
  await page.fill('#chat-input', 'Chico persistence guard');
  await page.click('#chat-send');
  await sleep(150);

  // Add a photo to LM.Photos, then delete it -> chat message MUST remain untouched
  const afterPhotoDelete = await page.evaluate(async () => {
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const rec = await LM.Photos.add({ id: 'p-s2-test', ts: Date.now(), label: 'PROGRESS', note: '', thumb: '' }, blob);
    await LM.Photos.remove(rec.id);
    const photos = await LM.Photos.list();
    return {
      photoCount: photos.length,
      chicoMsgs: LM.ChatStore.getMessages('chico').map(m => m.text),
      storeVer: LM.Store.VERSION
    };
  });
  check('Deleting photo from LM.Photos does NOT delete chat messages & keeps Store.VERSION=3',
    afterPhotoDelete.photoCount === 0 &&
    afterPhotoDelete.chicoMsgs.length === 1 &&
    afterPhotoDelete.chicoMsgs[0] === 'Chico persistence guard' &&
    afterPhotoDelete.storeVer === 3,
    afterPhotoDelete);

  // Progress reset MUST NOT delete chat messages
  const afterProgReset = await page.evaluate(() => {
    LM.Store.update(s => { s.xp = 450; });
    LM.Store.resetProgress();
    return {
      xp: LM.Store.get().xp,
      chicoMsgs: LM.ChatStore.getMessages('chico').map(m => m.text)
    };
  });
  check('LM.Store.resetProgress() resets XP without wiping LM.ChatStore',
    afterProgReset.xp === 0 && afterProgReset.chicoMsgs.length === 1 && afterProgReset.chicoMsgs[0] === 'Chico persistence guard',
    afterProgReset);

  check('Zero console/page errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

(async () => {
  const srv = await start(PORT);
  const br = await chromium.launch();
  const t0 = Date.now();
  try {
    for (const t of TESTS) {
      cur = { name: t.name, checks: [] };
      console.log('•', t.name);
      try { await t.fn(br); }
      catch (e) { check('UNCAUGHT ERROR: ' + e.message, false, e.stack); }
      const bad = cur.checks.filter(c => !c.ok).length;
      console.log(' ', bad ? `FAIL (${cur.checks.length - bad}/${cur.checks.length})` : `PASS (${cur.checks.length}/${cur.checks.length})`);
      results.push(cur);
    }
  } finally {
    await br.close();
    srv.close();
  }
  const total = results.reduce((a, r) => a + r.checks.length, 0);
  const failed = results.reduce((a, r) => a + r.checks.filter(c => !c.ok).length, 0);
  console.log(`\nStage 2 Chat Foundation: ${total - failed}/${total} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(failed ? 1 : 0);
})();
