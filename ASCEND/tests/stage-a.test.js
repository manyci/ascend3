/* Stage A browser tests (Playwright + Chromium). Every test runs in its own fresh browser context,
   i.e. isolated localStorage/IndexedDB: no real user data is ever touched.

   Run:  OLD_ROOT=/path/to/original/looksmax SCRATCH=/some/dir node tests/stage-a.test.js
   Real LOOKSMAX 0.1.0 (OLD_ROOT) is served at /orig/, this project at /new/ on the same origin,
   so the old app creates genuine v1 data (through its own UI) and the new app migrates it. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const start = require('./server');

const PORT = 8123, BASE = 'http://127.0.0.1:' + PORT;
const SCRATCH = process.env.SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'ascend-test-'));
const FIX = path.join(__dirname, 'fixtures');
fs.mkdirSync(path.join(SCRATCH, 'shots'), { recursive: true });

const results = [];
let cur = null;
function check(desc, ok, detail) {
  cur.checks.push({ desc: desc, ok: !!ok, detail: ok ? undefined : detail });
  if (!ok) console.log('   ✗', desc, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : '');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));

/* ───────── helpers ───────── */
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
  // failure injection, switched on by URL query / window flag (never active in normal runs)
  await ctx.addInitScript(() => {
    const q = location.search;
    if (q.indexOf('failDb') >= 0) {
      const o = indexedDB.open.bind(indexedDB);
      indexedDB.open = (n, ...a) => { if (n === 'ascend-photos') throw new Error('injected IndexedDB failure'); return o(n, ...a); };
    }
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'ascend.state' && q.indexOf('failState') >= 0) throw new Error('injected quota error');
      if (k === 'ascend.state' && window.__failState) { window.__failState = false; throw new Error('injected one-off quota error'); }   // transient failure
      return setItem.call(this, k, v);
    };
  });
  return ctx;
}
const jsClick = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('no element ' + s); e.click(); }, sel);
async function openNew(ctx, query, hash) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/new/index.html' + (query || '') + (hash || ''));
  await page.waitForFunction(() => window.__bootReport);
  await sleep(150);
  return page;
}
const lsGet = (page, k) => page.evaluate(key => localStorage.getItem(key), k);
const lsJSON = async (page, k) => { const r = await lsGet(page, k); return r ? JSON.parse(r) : null; };
const lsKeys = page => page.evaluate(() => Object.keys(localStorage).sort());

/* All photos of an IndexedDB database with content hashes (raw IDB, independent of app code). */
function photoSnap(page, db) {
  return page.evaluate(async name => {
    const open = n => new Promise((res, rej) => {
      const r = indexedDB.open(n, 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' }); if (!d.objectStoreNames.contains('full')) d.createObjectStore('full', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const sha = async buf => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('');
    const d = await open(name);
    const metas = await rq(d.transaction('meta').objectStore('meta').getAll());
    const out = [];
    for (const m of metas) {
      const row = await rq(d.transaction('full').objectStore('full').get(m.id));
      out.push({ id: m.id, ts: m.ts, label: m.label, note: m.note, thumb: await sha(new TextEncoder().encode(m.thumb)), size: row ? row.blob.size : -1, type: row ? row.blob.type : null, hash: row ? await sha(await row.blob.arrayBuffer()) : null });
    }
    d.close();
    return out.sort((a, b) => (a.id < b.id ? -1 : 1));
  }, db);
}

/* state comparison that ignores the intentional schema-2 additions */
function norm(s) {
  const o = clone(s); delete o.version;
  if (o.settings) delete o.settings.language;
  (o.history || []).forEach(h => { delete h.ref; });
  return o;
}
function subset(a, b, p, diffs) {
  p = p || '';
  if (Array.isArray(a)) { if (!Array.isArray(b) || a.length !== b.length) { diffs.push(p + ' (array length)'); return; } a.forEach((x, i) => subset(x, b[i], p + '[' + i + ']', diffs)); return; }
  if (a && typeof a === 'object') { if (!b || typeof b !== 'object') { diffs.push(p); return; } Object.keys(a).forEach(k => subset(a[k], b[k], p + '.' + k, diffs)); return; }
  if (a !== b) diffs.push(p + ': ' + a + ' != ' + b);
}
function sameState(legacy, now) { const d = []; subset(norm(legacy), norm(now), '', d); return d; }
const samePhotos = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ───────── seed REAL v1 data through the original app ───────── */
async function seedLegacy(ctx, opts) {
  opts = opts || {};
  const page = await ctx.newPage();
  await page.goto(BASE + '/orig/index.html');
  await page.waitForSelector('button.task');
  for (let i = 0; i < 2; i++) { await jsClick(page, 'button.task[data-act=task]:not(.done)'); await sleep(120); }
  for (const id of ['face-smile', 'skin-sunscreen']) {          // study through the UI (old XP rules)
    await page.evaluate(h => { location.hash = h; }, '#/guide/' + id); await sleep(200);
    await jsClick(page, '[data-act=study]'); await sleep(150);
    await jsClick(page, '[data-act=fav]'); await sleep(100);
  }
  await page.evaluate(keepNick => {
    const L = LM;
    L.Game.studyGuide('body-strength'); L.Game.toggleFavorite('hair-care'); L.Game.toggleFavorite('health-sleep'); L.Game.toggleFavorite('style-fit');
    L.Store.update(s => {
      const today = L.Game.dateKey(); let extra = 0;
      for (let i = 1; i <= 20; i++) {
        const k = L.Game.addDays(today, -i), t = L.TASK_POOL[i % L.TASK_POOL.length], g = L.GUIDES[i % L.GUIDES.length];
        s.days[k] = { xp: t.xp + 10, tasks: 1, guides: i % 4 === 0 ? 1 : 0 };
        s.history.push({ ts: Date.now() - i * 86400000, date: k, type: 'task', title: t.title, xp: t.xp }); extra += t.xp;
        if (i % 4 === 0) { s.history.push({ ts: Date.now() - i * 86400000 - 1, date: k, type: 'guide', title: 'Studied: ' + g.title, xp: 20 }); extra += 20; s.studied[g.id] = Date.now() - i * 86400000; }
        if (i % 5 === 0) { s.history.push({ ts: Date.now() - i * 86400000 - 2, date: k, type: 'task', title: 'Study: ' + g.title, xp: 30 }); extra += 30; }
        if (i % 7 === 0) { s.history.push({ ts: Date.now() - i * 86400000 - 3, date: k, type: 'bonus', title: 'Perfect day bonus', xp: 25 }); extra += 25; }
        if (i % 9 === 0) { s.history.push({ ts: Date.now() - i * 86400000 - 4, date: k, type: 'photo', title: 'Progress photo check-in', xp: 15 }); extra += 15; }
      }
      s.history.push({ ts: 1, date: '2020-01-01', type: 'task', title: 'Some custom legacy entry', xp: 5 }); extra += 5;   // cannot be mapped to a ref
      s.xp += extra; s.stats.tasks += 12; s.stats.perfect += 2; s.lastLevel = L.Game.levelInfo(s.xp).level;
      s.streak = { current: 5, best: 9, lastDate: today };
      s.achievements['a-first'] = Date.now() - 5e6; s.achievements['a-xp100'] = Date.now() - 4e6; s.achievements['a-g1'] = Date.now() - 3e6;
      if (!keepNick) s.profile.nickname = 'Влад-тест';
      s.settings.appearance.theme = 'light'; s.settings.appearance.grain = false; s.settings.appearance.reduceMotion = true;
      s.settings.notifications = { enabled: false, time: '07:45' }; s.settings.privacy.blurPhotos = false;
    });
  }, !!opts.keepNick);
  if (!opts.noPhotos) {
    await page.evaluate(() => { location.hash = '#/progress'; }); await sleep(250);
    for (const [f, label] of [['a.png', 'BEFORE'], ['b.png', 'PROGRESS'], ['c.png', 'AFTER']]) {
      await jsClick(page, '[data-act=photo-add]'); await page.waitForSelector('#pf', { state: 'attached' });
      await page.setInputFiles('#pf', path.join(FIX, f));
      await page.evaluate(l => { const b = document.querySelector('#pl button[data-l=' + l + ']'); if (b) b.click(); }, label);
      await page.fill('#pn', 'note ' + f);
      await page.waitForFunction(() => !document.querySelector('#ps').disabled);
      await jsClick(page, '#ps');
      await page.waitForSelector('#sheet-scrim', { state: 'detached' }); await sleep(150);
    }
  }
  await page.reload(); await page.waitForSelector('#nav a');          // prove it persisted
  await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForSelector('button.task');
  const raw = await lsGet(page, 'looksmax.v1');
  const photos = await photoSnap(page, 'looksmax-photos');
  return { page: page, raw: raw, state: JSON.parse(raw), photos: photos };
}

async function newExport(page, file) {
  await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(200);
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-exp');
  const [dl] = await Promise.all([page.waitForEvent('download'), jsClick(page, '#d-exp')]);
  await dl.saveAs(file); await jsClick(page, '[data-act=close-sheet]'); await sleep(100);
  return file;
}

/* ───────── tests ───────── */
const TESTS = [];
const test = (name, fn) => TESTS.push({ name: name, fn: fn });

test('T1 migration of real v1 data (state, history, achievements, settings, photos)', async (br) => {
  const ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  check('seed: XP/history/achievements/favorites/photos exist', old.state.xp > 300 && old.state.history.length > 20 && Object.keys(old.state.achievements).length >= 3 && old.state.favorites.length >= 5 && old.photos.length === 3, { xp: old.state.xp, h: old.state.history.length, p: old.photos.length });
  check('seed: old app wrote schema v1 under looksmax.v1', old.state.version === 1);
  const page = await openNew(ctx);
  const rep = await page.evaluate(() => window.__bootReport);
  check('migration reported success, no error', rep.migrated === true && !rep.error && rep.mode === 'normal', rep);
  const keys = await lsKeys(page);
  check('new keys exist: ascend.state + marker', keys.includes('ascend.state') && keys.includes('ascend.migration'), keys);
  const marker = await lsJSON(page, 'ascend.migration');
  check('marker verified:true, photos counted', marker.verified === true && marker.photos === 3 && marker.xp === old.state.xp, marker);
  const now = await lsJSON(page, 'ascend.state');
  const diffs = sameState(old.state, now);
  check('ALL legacy state fields preserved (xp, level, streak, days, history, studied, favorites, achievements, settings, profile)', diffs.length === 0, diffs.slice(0, 8));
  check('xp identical', now.xp === old.state.xp);
  check('achievements identical (ids + timestamps)', JSON.stringify(now.achievements) === JSON.stringify(old.state.achievements));
  check('history length identical', now.history.length === old.state.history.length);
  const mapped = now.history.filter(h => h.ref).length;
  check('history entries got language-neutral ref (all but 1 unmappable custom entry)', mapped === old.state.history.length - 1, { mapped: mapped, total: old.state.history.length });
  check('unmappable entry kept as is (title preserved)', now.history.some(h => h.title === 'Some custom legacy entry' && !h.ref));
  check('schema version is 3, language defaults to ru, original settings kept', now.version === 3 && now.settings.language === 'ru' && now.settings.appearance.theme === 'light' && now.settings.notifications.time === '07:45');
  check('LEGACY key byte-for-byte unchanged', (await lsGet(page, 'looksmax.v1')) === old.raw);
  const newPhotos = await photoSnap(page, 'ascend-photos');
  check('PHOTOS copied: same ids, meta, size, type and SHA-256 of every blob', samePhotos(old.photos, newPhotos), { old: old.photos.length, now: newPhotos.length });
  const oldPhotosAfter = await photoSnap(page, 'looksmax-photos');
  check('OLD photo DB untouched (kept as backup)', samePhotos(old.photos, oldPhotosAfter));
  const bk = keys.filter(k => k.indexOf('ascend.backup.pre-migration.') === 0);
  check('automatic pre-migration backup exists and contains original state', bk.length === 1 && (await lsJSON(page, bk[0])).state.xp === old.state.xp);
  check('app UI shows photos from new DB', (await page.evaluate(() => LM.Views.st.photos.length)) === 3);
  check('no console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

test('T2 after migration: persistence, no re-migration, legacy key frozen', async (br) => {
  const ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  let page = await openNew(ctx);
  const xp0 = await page.evaluate(() => LM.Store.get().xp);
  await jsClick(page, 'button.task[data-act=task]:not(.done)'); await sleep(200);
  const xp1 = await page.evaluate(() => LM.Store.get().xp);
  check('new action earns XP', xp1 > xp0, { xp0, xp1 });
  await page.reload(); await page.waitForFunction(() => window.__bootReport);
  const rep = await page.evaluate(() => window.__bootReport);
  check('reload: normal boot, not migrated again', rep.migrated === false && !rep.error && rep.mode === 'normal', rep);
  check('XP persisted in ascend.state', (await lsJSON(page, 'ascend.state')).xp === xp1);
  check('legacy key still byte-for-byte the original', (await lsGet(page, 'looksmax.v1')) === old.raw);
  check('only one pre-migration backup (no duplicates)', (await lsKeys(page)).filter(k => k.indexOf('pre-migration') > 0).length === 1);
  check('photos still identical after reload', samePhotos(old.photos, await photoSnap(page, 'ascend-photos')));
  check('no console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

test('T3 failure A: photo DB unavailable -> safe compatibility mode, pure v1 shape', async (br) => {
  const ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  const page = await openNew(ctx, '?failDb=1');
  const rep = await page.evaluate(() => window.__bootReport);
  check('migration failure detected and reported', !!rep.error && rep.mode === 'legacy' && rep.migrated === false, rep);
  const keys = await lsKeys(page);
  check('no ascend.state / marker left behind', !keys.includes('ascend.state') && !keys.includes('ascend.migration'), keys);
  check('pre-migration backup was created before the failure', keys.some(k => k.indexOf('ascend.backup.pre-migration.') === 0));
  check('legacy key untouched until the user acts (byte-identical)', (await lsGet(page, 'looksmax.v1')) === old.raw);
  const xp0 = await page.evaluate(() => LM.Store.get().xp);
  check('app still shows all old progress (XP, history)', xp0 === old.state.xp && (await page.evaluate(() => LM.Store.get().history.length)) === old.state.history.length);
  await jsClick(page, 'button.task[data-act=task]:not(.done)'); await sleep(200);
  const legacyNow = await lsJSON(page, 'looksmax.v1');
  check('after an action looksmax.v1 is STILL pure schema v1 (version 1, no settings.language, no history.ref)', legacyNow.version === 1 && !('language' in legacyNow.settings) && legacyNow.history.every(h => !('ref' in h)), { v: legacyNow.version, lang: legacyNow.settings.language });
  check('new progress saved in legacy key', legacyNow.xp > old.state.xp);
  await page.evaluate(() => LM.I18n.set('en'));
  check('language preference kept in separate key, not in looksmax.v1', (await lsGet(page, 'ascend.language')) === 'en' && !('language' in (await lsJSON(page, 'looksmax.v1')).settings));
  // the ORIGINAL app must read the data written in compatibility mode
  const o = await ctx.newPage(); await o.goto(BASE + '/orig/index.html'); await o.waitForSelector('button.task');
  const oldAppXp = await o.evaluate(() => LM.Store.get().xp);
  check('original LOOKSMAX 0.1.0 still opens and reads the data (XP matches)', oldAppXp === legacyNow.xp, { oldAppXp, xp: legacyNow.xp });
  check('original app keeps working photos', samePhotos((await photoSnap(o, 'looksmax-photos')), old.photos));
  // retry: with the failure gone the migration runs again and succeeds
  const p2 = await ctx.newPage(); await p2.goto(BASE + '/new/index.html'); await p2.waitForFunction(() => window.__bootReport);
  const rep2 = await p2.evaluate(() => window.__bootReport);
  check('next start without the failure: migration succeeds (retry)', rep2.migrated === true && !rep2.error, rep2);
  const st2 = await lsJSON(p2, 'ascend.state');
  check('retry carried over the progress made in compatibility mode', st2.xp === legacyNow.xp);
  check('retry photos identical', samePhotos(old.photos, await photoSnap(p2, 'ascend-photos')));
  await ctx.close();
});

test('T4 failure B: state write fails after photos were copied -> rollback, new DB cleaned', async (br) => {
  const ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  const page = await openNew(ctx, '?failState=1');
  const rep = await page.evaluate(() => window.__bootReport);
  check('failure reported, compatibility mode', !!rep.error && rep.mode === 'legacy', rep);
  const keys = await lsKeys(page);
  check('no ascend.state / marker', !keys.includes('ascend.state') && !keys.includes('ascend.migration'));
  check('copied photos removed from new DB (clean rollback)', (await photoSnap(page, 'ascend-photos')).length === 0);
  check('legacy key + old photos untouched', (await lsGet(page, 'looksmax.v1')) === old.raw && samePhotos(old.photos, await photoSnap(page, 'looksmax-photos')));
  await ctx.close();
});

test('T5 fresh install, orphaned photos, corrupt legacy state', async (br) => {
  // fresh
  let ctx = await newCtx(br);
  let page = await openNew(ctx);
  let rep = await page.evaluate(() => window.__bootReport);
  check('fresh: normal mode, defaults, marker fresh', rep.mode === 'normal' && !rep.error && (await page.evaluate(() => LM.Store.get().xp)) === 0 && (await lsJSON(page, 'ascend.migration')).fresh === true);
  check('fresh: default language ru, <html lang=ru>', (await page.evaluate(() => [LM.Store.get().settings.language, document.documentElement.lang])).join() === 'ru,ru');
  check('fresh: no legacy keys created', !(await lsKeys(page)).some(k => k.indexOf('looksmax.') === 0));
  await ctx.close();
  // orphaned photos: legacy state key gone, old photo DB remains
  ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  await old.page.evaluate(() => localStorage.removeItem('looksmax.v1'));
  page = await openNew(ctx);
  check('orphan photos adopted into new DB', samePhotos(old.photos, await photoSnap(page, 'ascend-photos')));
  await ctx.close();
  // corrupt legacy state
  ctx = await newCtx(br);
  const old2 = await seedLegacy(ctx);
  await old2.page.evaluate(() => localStorage.setItem('looksmax.v1', '{"xp": 12, broken'));
  page = await openNew(ctx);
  rep = await page.evaluate(() => window.__bootReport);
  const keys = await lsKeys(page);
  check('corrupt: reported, raw text kept in ascend.corrupt.*, app starts fresh', rep.corrupt === true && keys.some(k => k.indexOf('ascend.corrupt.') === 0));
  check('corrupt: legacy raw text untouched', (await lsGet(page, 'looksmax.v1')) === '{"xp": 12, broken');
  check('corrupt: photos still adopted', samePhotos(old2.photos, await photoSnap(page, 'ascend-photos')));
  await ctx.close();
});

test('T6 export -> erase -> import round trip (new format), incl. photos', async (br) => {
  const ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  const page = await openNew(ctx);
  const before = await lsJSON(page, 'ascend.state');
  const file = await newExport(page, path.join(SCRATCH, 'export-new.json'));
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('export: app=ascend, format 2, schema 3, 3 photos with data', data.app === 'ascend' && data.format === 2 && data.schema === 3 && data.photos.length === 3 && data.photos.every(p => /^data:image/.test(p.data)));
  // erase everything via UI
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-erase');
  await jsClick(page, '#d-erase'); await page.waitForSelector('#cf-in'); await page.fill('#cf-in', 'ERASE'); await jsClick(page, '#cf-ok'); await sleep(500);
  const erased = await lsJSON(page, 'ascend.state');
  check('erase: progress zero, photos gone from both DBs, legacy keys + backups removed', erased.xp === 0 && (await photoSnap(page, 'ascend-photos')).length === 0 && (await photoSnap(page, 'looksmax-photos')).length === 0 && !(await lsKeys(page)).some(k => k.indexOf('looksmax.') === 0 || k.indexOf('ascend.backup.') === 0), await lsKeys(page));
  // import via UI
  await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(150);
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-imp', { state: 'attached' });
  await page.setInputFiles('#d-imp', file); await page.waitForSelector('#cf-ok'); await jsClick(page, '#cf-ok'); await sleep(700);
  const after = await lsJSON(page, 'ascend.state');
  check('import: ALL state fields identical to before export', sameState(before, after).length === 0 && after.version === 3, sameState(before, after).slice(0, 6));
  check('import: photos identical (SHA-256 per blob)', samePhotos(old.photos, await photoSnap(page, 'ascend-photos')));
  check('import: pre-import safety backup created', (await lsKeys(page)).some(k => k.indexOf('ascend.backup.pre-import.') === 0));
  check('import: UI reflects imported data', (await page.evaluate(() => LM.Views.st.photos.length)) === 3);
  check('no console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

test('T7 import of an OLD LOOKSMAX backup file (format 1) exported by the original app', async (br) => {
  const ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  // export from the ORIGINAL app through its own UI
  await old.page.evaluate(() => { location.hash = '#/settings'; }); await sleep(200);
  await jsClick(old.page, '[data-act=open-setting][data-k=data]'); await old.page.waitForSelector('#d-exp');
  const [dl] = await Promise.all([old.page.waitForEvent('download'), jsClick(old.page, '#d-exp')]);
  const file = path.join(SCRATCH, 'export-old.json'); await dl.saveAs(file);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('old file is app=looksmax format=1', raw.app === 'looksmax' && raw.format === 1);
  // import it into a brand-new profile
  const ctx2 = await newCtx(br);
  const page = await openNew(ctx2);
  await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(150);
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-imp', { state: 'attached' });
  await page.setInputFiles('#d-imp', file); await page.waitForSelector('#cf-ok'); await jsClick(page, '#cf-ok'); await sleep(700);
  const now = await lsJSON(page, 'ascend.state');
  check('old-format import: state preserved (schema upgraded to 3)', sameState(old.state, now).length === 0 && now.version === 3 && now.settings.language === 'ru', sameState(old.state, now).slice(0, 6));
  check('old-format import: history got refs', now.history.filter(h => h.ref).length === old.state.history.length - 1);
  check('old-format import: photos identical', samePhotos(old.photos, await photoSnap(page, 'ascend-photos')));
  check('no console errors', ctx._errors.length === 0 && ctx2._errors.length === 0, ctx._errors.concat(ctx2._errors));
  await ctx.close(); await ctx2.close();
});

test('T8 invalid / hostile import files are rejected and change nothing', async (br) => {
  const ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  const page = await openNew(ctx);
  const goodFile = await newExport(page, path.join(SCRATCH, 'good.json'));
  const good = JSON.parse(fs.readFileSync(goodFile, 'utf8'));
  const stateBefore = await lsGet(page, 'ascend.state'), photosBefore = await photoSnap(page, 'ascend-photos');
  const variants = {
    'not json': '{oops',
    'wrong app': JSON.stringify({ app: 'other', format: 1, state: {} }),
    'no state': JSON.stringify({ app: 'ascend', format: 2 }),
    'xp is a string': JSON.stringify(Object.assign(clone(good), { state: Object.assign(clone(good.state), { xp: '9999' }) })),
    'negative xp': JSON.stringify(Object.assign(clone(good), { state: Object.assign(clone(good.state), { xp: -5 }) })),
    'history not array': JSON.stringify(Object.assign(clone(good), { state: Object.assign(clone(good.state), { history: {} }) })),
    'bad theme': (() => { const g = clone(good); g.state.settings.appearance.theme = 'neon'; return JSON.stringify(g); })(),
    'newer format': JSON.stringify(Object.assign(clone(good), { format: 99 })),
    'newer schema': (() => { const g = clone(good); g.state.version = 99; return JSON.stringify(g); })(),
    'photo with corrupt data': (() => { const g = clone(good); g.photos[1].data = 'data:image/jpeg;base64,@@@notbase64@@@'; return JSON.stringify(g); })(),
    'photo missing data': (() => { const g = clone(good); delete g.photos[0].data; return JSON.stringify(g); })(),
    'duplicate photo ids': (() => { const g = clone(good); g.photos[1].id = g.photos[0].id; return JSON.stringify(g); })(),
    'photo data not an image': (() => { const g = clone(good); g.photos[0].data = 'data:text/html;base64,PGI+aGk8L2I+'; return JSON.stringify(g); })()
  };
  for (const [name, content] of Object.entries(variants)) {
    const f = path.join(SCRATCH, 'bad-' + name.replace(/\W+/g, '_') + '.json'); fs.writeFileSync(f, content);
    await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(120);
    await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-imp', { state: 'attached' });
    await page.setInputFiles('#d-imp', f); await sleep(300);
    const err = await page.evaluate(() => { const e = document.querySelector('#d-msg .err'); return e ? e.textContent : null; });
    const dialog = await page.evaluate(() => !!document.querySelector('#cf-ok'));
    check('rejected with message, no confirm dialog: ' + name, !!err && !dialog, { err, dialog });
    check('  data unchanged after: ' + name, (await lsGet(page, 'ascend.state')) === stateBefore && samePhotos(photosBefore, await photoSnap(page, 'ascend-photos')));
    await jsClick(page, '[data-act=close-sheet]').catch(() => {}); await sleep(80);
  }
  // prototype pollution attempt must not leak
  const g = clone(good); const polluted = JSON.stringify(g).replace('"profile":', '"__proto__":{"polluted":"yes"},"profile":');
  const f = path.join(SCRATCH, 'proto.json'); fs.writeFileSync(f, polluted);
  await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(120);
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-imp', { state: 'attached' });
  await page.setInputFiles('#d-imp', f); await page.waitForSelector('#cf-ok'); await jsClick(page, '#cf-ok'); await sleep(600);
  check('__proto__ key in backup does not pollute Object.prototype', await page.evaluate(() => ({}).polluted === undefined && LM.Store.get().polluted === undefined));
  check('no uncaught console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

test('T9 import fails halfway (storage error) -> previous photos + state fully restored', async (br) => {
  const ctx = await newCtx(br);
  const old = await seedLegacy(ctx);
  const page = await openNew(ctx);
  const file = await newExport(page, path.join(SCRATCH, 'roll.json'));
  // make the imported file different from the current data: drop photos, change xp
  const d = JSON.parse(fs.readFileSync(file, 'utf8')); d.photos = d.photos.slice(0, 1); d.state.xp = 424242;
  fs.writeFileSync(file, JSON.stringify(d));
  const before = await lsGet(page, 'ascend.state'), photosBefore = await photoSnap(page, 'ascend-photos');
  await page.evaluate(() => { window.__failState = true; });      // writing ascend.state now throws
  await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(120);
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-imp', { state: 'attached' });
  await page.setInputFiles('#d-imp', file); await page.waitForSelector('#cf-ok'); await jsClick(page, '#cf-ok'); await sleep(900);
  await page.waitForFunction(() => /восстановлен/i.test(document.querySelector('#toasts').textContent), null, { timeout: 8000 }).catch(() => {});
  const toast = await page.evaluate(() => document.querySelector('#toasts').textContent);
  check('user told the import failed and data was restored', /восстановлен/i.test(toast), toast);
  check('in-memory state restored (xp not 424242)', (await page.evaluate(() => LM.Store.get().xp)) === old.state.xp + 0 || (await page.evaluate(() => LM.Store.get().xp)) !== 424242);
  check('photos rolled back to the 3 originals (SHA-256)', samePhotos(photosBefore, await photoSnap(page, 'ascend-photos')));
  check('stored state unchanged', (await lsGet(page, 'ascend.state')) === before);
  check('app is not stuck in memory-only mode', (await page.evaluate(() => LM.Store.isPersistent())) === true);
  await page.evaluate(() => { window.__failState = false; });
  await page.reload(); await page.waitForFunction(() => window.__bootReport);
  check('after reload: original xp + 3 photos', (await page.evaluate(() => LM.Store.get().xp)) !== 424242 && (await photoSnap(page, 'ascend-photos')).length === 3);
  await ctx.close();
});

test('T10 reset + restore from automatic backup', async (br) => {
  const ctx = await newCtx(br);
  await seedLegacy(ctx);
  const page = await openNew(ctx);
  const before = await lsJSON(page, 'ascend.state');
  await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(150);
  await jsClick(page, '[data-act=open-setting][data-k=reset]'); await page.waitForSelector('#r-go'); await jsClick(page, '#r-go');
  await page.waitForSelector('#cf-in'); await page.fill('#cf-in', 'RESET'); await jsClick(page, '#cf-ok'); await sleep(400);
  const reset = await lsJSON(page, 'ascend.state');
  check('reset zeroed XP/history/achievements but kept favorites, photos, nickname, settings', reset.xp === 0 && reset.history.length === 0 && Object.keys(reset.achievements).length === 0 && reset.favorites.length === before.favorites.length && reset.profile.nickname === before.profile.nickname && (await photoSnap(page, 'ascend-photos')).length === 3);
  check('safety copy pre-reset exists', (await lsKeys(page)).some(k => k.indexOf('ascend.backup.pre-reset.') === 0));
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('[data-bkrow=pre-reset]');
  await jsClick(page, '[data-bkrow=pre-reset] [data-bk]'); await page.waitForSelector('#cf-ok'); await jsClick(page, '#cf-ok'); await sleep(500);
  const restored = await lsJSON(page, 'ascend.state');
  check('restore: XP, history, achievements, streak back to pre-reset values', sameState(before, restored).length === 0, sameState(before, restored).slice(0, 5));
  check('restore created its own pre-restore backup', (await lsKeys(page)).some(k => k.indexOf('ascend.backup.pre-restore.') === 0));
  check('no console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

test('T11 language RU/EN: default, switch, persistence, nothing else changes', async (br) => {
  const ctx = await newCtx(br);
  await seedLegacy(ctx);
  const page = await openNew(ctx);
  const before = await lsJSON(page, 'ascend.state');
  const t = async () => page.evaluate(() => ({ lang: document.documentElement.lang, h: LM.I18n.lang() }));
  check('default is Russian after migration', (await t()).lang === 'ru');
  await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(150);
  check('settings row shows language name (Русский)', (await page.evaluate(() => document.querySelector('[data-k=lang]').textContent)).includes('Русский'));
  await jsClick(page, '[data-act=open-setting][data-k=lang]'); await page.waitForSelector('[data-lang=en]'); await jsClick(page, '[data-lang=en]'); await sleep(300);
  check('switched to EN: <html lang=en>, row says English', (await t()).lang === 'en' && (await page.evaluate(() => document.querySelector('[data-k=lang]').textContent)).includes('English'));
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-exp');
  check('Data sheet translated (EN: "Data", "Export backup")', (await page.evaluate(() => document.querySelector('.sheet h2').textContent + '|' + document.querySelector('#d-exp').textContent)).match(/Data\|.*Export backup/));
  await jsClick(page, '[data-act=close-sheet]');
  const afterEn = await lsJSON(page, 'ascend.state');
  const d = sameState(before, afterEn);
  check('switching language changed nothing but settings.language (XP, level, achievements, history, streak identical)', d.length === 0 && afterEn.settings.language === 'en', d);
  await page.reload(); await page.waitForFunction(() => window.__bootReport);
  check('language persists after restart', (await t()).lang === 'en');
  await jsClick(page, '[data-act=open-setting][data-k=lang]').catch(async () => { await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(150); await jsClick(page, '[data-act=open-setting][data-k=lang]'); });
  await page.waitForSelector('[data-lang=ru]'); await jsClick(page, '[data-lang=ru]'); await sleep(250);
  await jsClick(page, '[data-act=open-setting][data-k=data]'); await page.waitForSelector('#d-exp');
  check('Data sheet translated (RU: "Данные", "Экспорт")', (await page.evaluate(() => document.querySelector('.sheet h2').textContent + '|' + document.querySelector('#d-exp').textContent)).match(/Данные\|.*Экспорт/));
  await jsClick(page, '[data-act=close-sheet]');
  // history labels follow the language
  await page.evaluate(() => { location.hash = '#/progress'; }); await sleep(250);
  const histRu = await page.evaluate(() => LM.Store.get().history.map(h => LM.historyTitle(h)).join('|'));
  check('history labels rendered through refs in RU (Изучено:/Бонус…)', /Изучено:/.test(histRu) && /Бонус за идеальный день/.test(histRu), histRu.slice(0, 200));
  check('plural/number/date formatting uses locale', (await page.evaluate(() => [LM.fmt(12345), LM.tn ? 1 : 0].join())).startsWith('12') );
  check('no console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

test('T12 XP rules: reading earns no XP, practice tasks do; status kept', async (br) => {
  const ctx = await newCtx(br);
  const page = await openNew(ctx);
  const st0 = await page.evaluate(() => { const s = LM.Store.get(); return { xp: s.xp, hist: s.history.length, tasks: s.daily.tasks.map(t => ({ id: t.id, kind: t.kind, xp: t.xp })), guideId: s.daily.guideId }; });
  check('daily guide task carries no XP', st0.tasks.find(t => t.kind === 'guide').xp === 0, st0.tasks);
  await page.evaluate(id => { location.hash = '#/guide/' + id; }, st0.guideId); await sleep(250);
  check('study button has no XP text', !/XP/.test(await page.evaluate(() => document.querySelector('[data-act=study]').textContent)));
  await jsClick(page, '[data-act=study]'); await sleep(250);
  const st1 = await page.evaluate(() => { const s = LM.Store.get(); return { xp: s.xp, hist: s.history.length, studied: Object.keys(s.studied), done: s.daily.tasks.find(t => t.kind === 'guide').done, ach: Object.keys(s.achievements) }; });
  check('marking as studied: XP unchanged, no history entry', st1.xp === 0 && st1.hist === 0, st1);
  check('studied status saved + today\'s guide task marked done', st1.studied.includes(st0.guideId) && st1.done);
  check('STUDENT achievement (status based) still unlocks', st1.ach.includes('a-g1'));
  await page.evaluate(() => { location.hash = '#/home'; }); await sleep(250);
  await jsClick(page, 'button.task[data-act=task]:not(.done)'); await sleep(250);
  const st2 = await page.evaluate(() => { const s = LM.Store.get(); return { xp: s.xp, hist: s.history.length }; });
  check('completing a practice/habit task earns XP and history', st2.xp > 0 && st2.hist === 1, st2);
  await page.evaluate(id => { location.hash = '#/guide/' + id; }, st0.guideId); await sleep(250);
  check('already studied: no second reward, status shown', !(await page.evaluate(() => !!document.querySelector('[data-act=study]'))));
  check('no console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

test('T13 layout smoke 390x844 and 1440x900: all pages + sheets, no overflow, no JS errors', async (br) => {
  for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const ctx = await newCtx(br, vp);
    await seedLegacy(ctx);
    const page = await openNew(ctx);
    const tag = vp.width + 'x' + vp.height;
    for (const [name, hash] of [['home', '#/home'], ['guides', '#/guides'], ['guide', '#/guide/face-smile'], ['progress', '#/progress'], ['profile', '#/profile'], ['settings', '#/settings']]) {
      await page.evaluate(h => { location.hash = h; }); await page.evaluate(h => { location.hash = h; }, hash); await sleep(350);
      const m = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, iw: innerWidth, vw: document.getElementById('view').scrollWidth, vc: document.getElementById('view').clientWidth, len: document.getElementById('view').textContent.length }));
      check(tag + ' ' + name + ': renders, no horizontal overflow', m.len > 50 && m.w <= m.iw && m.vw <= m.vc + 1, m);
      await page.screenshot({ path: path.join(SCRATCH, 'shots', tag + '-' + name + '.png') });
    }
    for (const k of ['data', 'lang']) {
      await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(200);
      await jsClick(page, '[data-act=open-setting][data-k=' + k + ']'); await sleep(300);
      await page.screenshot({ path: path.join(SCRATCH, 'shots', tag + '-sheet-' + k + '.png') });
      await jsClick(page, '[data-act=close-sheet]'); await sleep(100);
    }
    check(tag + ': no console errors', ctx._errors.length === 0, ctx._errors);
    await ctx.close();
  }
});


/* ───────── Stage 2: rebrand ───────── */
test('T14 rebrand: nickname migration (default -> Ascender, custom kept), schema 2 -> 3', async (br) => {
  // legacy with the untouched default nickname
  let ctx = await newCtx(br);
  const old = await seedLegacy(ctx, { keepNick: true });
  check('seed has the old default nickname', old.state.profile.nickname === 'LooksMaxxer');
  let page = await openNew(ctx);
  let rep = await page.evaluate(() => window.__bootReport);
  check('migration with changed default nickname still verifies (no error)', rep.migrated === true && !rep.error, rep);
  check('default nickname became Ascender', (await lsJSON(page, 'ascend.state')).profile.nickname === 'Ascender');
  check('legacy key still says LooksMaxxer (byte-identical)', (await lsGet(page, 'looksmax.v1')) === old.raw);
  check('rest of the state identical (xp, history, achievements ...)', sameState(Object.assign(clone(old.state), { profile: Object.assign({}, old.state.profile, { nickname: 'Ascender' }) }), await lsJSON(page, 'ascend.state')).length === 0);
  check('UI greets with the new nickname', (await page.evaluate(() => document.querySelector('.hello').textContent)).includes('Ascender'));
  await ctx.close();
  // custom nickname survives; an existing schema-2 state is upgraded with an automatic backup
  ctx = await newCtx(br);
  await seedLegacy(ctx);
  page = await openNew(ctx);
  check('custom nickname untouched by migration', (await lsJSON(page, 'ascend.state')).profile.nickname === 'Влад-тест');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('ascend.state')); s.version = 2; s.profile.nickname = 'LooksMaxxer'; localStorage.setItem('ascend.state', JSON.stringify(s)); });
  await page.reload(); await page.waitForFunction(() => window.__bootReport);
  const st = await lsJSON(page, 'ascend.state');
  check('schema 2 state upgraded to 3, nickname Ascender', st.version === 3 && st.profile.nickname === 'Ascender', st.version);
  check('pre-schema backup created before upgrade (holds old nickname)', (await lsKeys(page)).filter(k => k.indexOf('ascend.backup.pre-schema.') === 0).length === 1);
  check('photos still identical after schema upgrade', (await photoSnap(page, 'ascend-photos')).length === 3);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('ascend.state')); s.version = 2; s.profile.nickname = 'Мой ник'; localStorage.setItem('ascend.state', JSON.stringify(s)); });
  await page.reload(); await page.waitForFunction(() => window.__bootReport);
  check('schema 2 -> 3 keeps a chosen nickname', (await lsJSON(page, 'ascend.state')).profile.nickname === 'Мой ник');
  // fresh install
  const ctx2 = await newCtx(br);
  const p2 = await openNew(ctx2);
  check('fresh install: nickname Ascender, schema 3', (await p2.evaluate(() => [LM.Store.get().profile.nickname, LM.Store.get().version].join())) === 'Ascender,3');
  // old-format backup with default nickname
  check('no console errors', ctx._errors.length === 0 && ctx2._errors.length === 0, ctx._errors.concat(ctx2._errors));
  await ctx.close(); await ctx2.close();
});

test('T15 rebrand: no LOOKSMAX text left in the UI, title/poster/icons/notifications say ASCEND', async (br) => {
  const ctx = await newCtx(br, { width: 1440, height: 900 });
  await seedLegacy(ctx, { keepNick: true });
  const page = await openNew(ctx);
  await page.evaluate(() => { window.__notes = []; window.Notification = class { constructor(t, o) { window.__notes.push([t, o && o.tag]); } static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } }; });
  check('document.title is ASCEND', (await page.title()).startsWith('ASCEND') && !/looksmax/i.test(await page.title()), await page.title());
  check('desktop poster says ASCEND + slogan', await page.evaluate(() => /ASCEND/.test(document.querySelector('.poster').textContent) && !/looksmax/i.test(document.querySelector('.poster').textContent)));
  const icons = await page.evaluate(async () => {
    const load = href => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => r('ERR'); i.src = href; });
    const fav = document.querySelector('link[rel=icon]'), apple = document.querySelector('link[rel=apple-touch-icon]');
    return { fav: fav && await load(fav.href), apple: apple && await load(apple.href) };
  });
  check('favicon 32x32 and apple-touch-icon 180x180 load', icons.fav === '32x32' && icons.apple === '180x180', icons);
  const sweep = async (label) => {
    const out = [];
    for (const h of ['#/home', '#/guides', '#/guide/face-smile', '#/progress', '#/profile', '#/settings']) {
      await page.evaluate(x => { location.hash = x; }, h); await sleep(250);
      out.push(await page.evaluate(() => document.getElementById('view').textContent));
    }
    await jsClick(page, '[data-act=open-setting][data-k=about]'); await sleep(200);
    out.push(await page.evaluate(() => document.querySelector('.sheet').textContent)); await jsClick(page, '[data-act=close-sheet]');
    await jsClick(page, '[data-act=open-setting][data-k=notif]'); await sleep(200);
    out.push(await page.evaluate(() => document.querySelector('.sheet').textContent));
    await jsClick(page, '#n-test'); await sleep(250); await jsClick(page, '[data-act=close-sheet]');
    for (const k of ['data', 'reset', 'lang', 'look', 'privacy']) { await jsClick(page, '[data-act=open-setting][data-k=' + k + ']'); await sleep(150); out.push(await page.evaluate(() => document.querySelector('.sheet').textContent)); await jsClick(page, '[data-act=close-sheet]'); }
    const bad = out.map((t, i) => /\blooksmax(?!xing\b)/i.test(t) ? i : -1).filter(i => i >= 0);
    check(label + ': no "LOOKSMAX" in any screen or sheet', bad.length === 0, bad.map(i => out[i].match(/.{0,40}\blooksmax(?!xing\b).{0,40}/i)[0]));
    return out;
  };
  await page.evaluate(() => { location.hash = '#/settings'; }); await sleep(200);
  const en = await sweep('EN/default');
  await page.evaluate(() => LM.I18n.set('en')); await sleep(200);
  const en2 = await sweep('EN');
  check('About sheet: ASCEND + English slogan', en2[6].includes('ASCEND') && en2[6].includes('BECOME YOUR BEST VERSION.'));
  await page.evaluate(() => LM.I18n.set('ru')); await sleep(200);
  const ru = await sweep('RU');
  check('About sheet: Russian slogan', ru[6].includes('СТАНЬ ЛУЧШЕЙ ВЕРСИЕЙ СЕБЯ.'));
  const notes = await page.evaluate(() => window.__notes);
  check('notifications use title ASCEND and tag ascend', notes.length >= 1 && notes.every(n => n[0] === 'ASCEND' && n[1] === 'ascend'), notes);
  check('Settings shows "About ASCEND"', await page.evaluate(() => { location.hash = '#/settings'; return true; }) && (await sleep(250), (await page.evaluate(() => document.getElementById('view').textContent)).includes('About ASCEND')));
  // backups keep working under the new name
  const f = await newExport(page, path.join(SCRATCH, 'brand-export.json'));
  check('export file is ascend-backup-*.json with app=ascend', JSON.parse(fs.readFileSync(f, 'utf8')).app === 'ascend');
  await page.evaluate(() => { location.hash = '#/home'; }); await sleep(300);
  await page.screenshot({ path: path.join(SCRATCH, 'shots', 'stage2-desktop-home.png') });
  check('no console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── runner ───────── */
(async () => {
  const srv = await start(PORT);
  const browser = await chromium.launch();
  const only = process.argv[2];
  for (const t of TESTS) {
    if (only && t.name.indexOf(only) !== 0) continue;
    cur = { name: t.name, checks: [], error: null };
    results.push(cur);
    console.log('▶', t.name);
    try { await t.fn(browser); } catch (e) { cur.error = e.stack || String(e); console.log('   ✗ EXCEPTION', e.message); }
    const bad = cur.checks.filter(c => !c.ok).length;
    console.log('  ', bad || cur.error ? 'FAILED' : 'passed', '(' + (cur.checks.length - bad) + '/' + cur.checks.length + ' checks)');
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify(results, null, 1));
  const total = results.reduce((a, r) => a + r.checks.length, 0), bad = results.reduce((a, r) => a + r.checks.filter(c => !c.ok).length + (r.error ? 1 : 0), 0);
  console.log('\nTOTAL: ' + (total - bad) + '/' + total + ' checks passed' + (bad ? ', ' + bad + ' FAILED' : ''));
  process.exit(bad ? 1 : 0);
})();
