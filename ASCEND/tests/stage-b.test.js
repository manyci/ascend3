/* Stage B regression test suite (Playwright + Chromium).
   Verifies all 6 post-audit defect groups + dual-mode progression, undo/streak integrity,
   dynamic vs historical achievements, level-up race guard, practice pause/resume timer lifecycle,
   all 14 rich SVG phases, per-guide angle isolation, RU/EN parity, layouts, and backup round-trip.

   Run: SCRATCH=/tmp/ascend-b node tests/stage-b.test.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const start = require('./server');

const PORT = 8124, BASE = 'http://127.0.0.1:' + PORT;
const SCRATCH = process.env.SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'ascend-b-'));
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(SCRATCH, 'shots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const results = [];
let cur = null;
function check(desc, ok, detail) {
  cur.checks.push({ desc, ok: !!ok, detail: ok ? undefined : detail });
  if (!ok) console.log('   ✗', desc, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : '');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));

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

const jsClick = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s);
  if (!e) throw new Error('no element ' + s);
  e.click();
}, sel);

async function openApp(ctx, hash) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/new/index.html' + (hash || '#/home'));
  await page.waitForFunction(() => window.__bootReport);
  await sleep(160);
  return page;
}

const TESTS = [];
const test = (name, fn) => TESTS.push({ name, fn });

/* ───────── B1: Looksmaxxing Progression & XP Boundaries ───────── */
test('B1 Looksmaxxing progression boundaries (L1-L35), UI display, persistence', async (br) => {
  const ctx = await newCtx(br);
  const page = await openApp(ctx);
  const matrix = await page.evaluate(() => {
    const cases = [
      { xp: 0, expLevel: 1, expTier: 'SUB 3' },
      { xp: 100, expLevel: 2, expTier: 'SUB 3' },
      { xp: 225, expLevel: 3, expTier: 'SUB 3' },
      { xp: 1050, expLevel: 7, expTier: 'SUB 3' },
      { xp: 1300, expLevel: 8, expTier: 'SUB 5' },
      { xp: 2600, expLevel: 12, expTier: 'SUB 5' },
      { xp: 2975, expLevel: 13, expTier: 'LTN' },
      { xp: 4675, expLevel: 17, expTier: 'LTN' },
      { xp: 5125, expLevel: 18, expTier: 'MTN' },
      { xp: 7350, expLevel: 22, expTier: 'MTN' },
      { xp: 7975, expLevel: 23, expTier: 'HTN' },
      { xp: 10725, expLevel: 27, expTier: 'HTN' },
      { xp: 11475, expLevel: 28, expTier: 'CHADLITE' },
      { xp: 14725, expLevel: 32, expTier: 'CHADLITE' },
      { xp: 15600, expLevel: 33, expTier: 'CHAD' },
      { xp: 17425, expLevel: 35, expTier: 'CHAD' }
    ];
    LM.setProgressionMode('looksmaxxing');
    return cases.map(c => {
      const pv = LM.progressionView(c.xp);
      return {
        xp: c.xp,
        gotLevel: pv.li.level,
        expLevel: c.expLevel,
        gotTier: pv.primaryLabel,
        expTier: c.expTier,
        xpExact: LM.Game.xpToReach(c.expLevel)
      };
    });
  });
  check('All 16 boundary points match formula & tier table', matrix.every(m => m.gotLevel === m.expLevel && m.gotTier === m.expTier), matrix.filter(m => m.gotLevel !== m.expLevel || m.gotTier !== m.expTier));

  await page.evaluate(() => { LM.Store.update(s => { s.xp = 1300; }); });
  await page.evaluate(() => { location.hash = '#/settings'; });
  await sleep(150);
  await jsClick(page, '[data-act=set-prog-mode][data-mode=looksmaxxing]');
  await sleep(150);
  await page.reload();
  await page.waitForFunction(() => window.__bootReport);
  await page.evaluate(() => { location.hash = '#/home'; });
  await sleep(200);
  const homeTxt = await page.evaluate(() => document.querySelector('.level-card').textContent);
  check('Looksmaxxing mode persists after reload and displays SUB 5 on Home', /SUB 5/.test(homeTxt), homeTxt);
  await page.evaluate(() => { location.hash = '#/profile'; });
  await sleep(180);
  check('Profile displays SUB 5 tier', /SUB 5/.test(await page.evaluate(() => document.getElementById('view').textContent)));
  await page.evaluate(() => { location.hash = '#/progress'; });
  await sleep(180);
  check('Progress displays SUB 5 tier', /SUB 5/.test(await page.evaluate(() => document.getElementById('view').textContent)));
  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── B2: streak.best Preservation & Multi-Scenario Undo ───────── */
test('B2 streak.best integrity across all 8 undo/re-complete scenarios', async (br) => {
  const ctx = await newCtx(br);
  const page = await openApp(ctx);

  const res = await page.evaluate(() => {
    const today = LM.Game.dateKey();
    const yest = LM.Game.addDays(today, -1);
    const oldDay = LM.Game.addDays(today, -4);
    const out = {};

    // Scenario 1: Fresh best:0 cur:0 -> complete -> undo -> best:0 cur:0 lastDate:null
    LM.Store.resetProgress();
    LM.Game.ensureToday();
    const firstHabit = LM.Game.todayTasks().find(t => t.kind === 'habit').id;
    LM.Game.completeTask(firstHabit);
    out.s1Mid = cloneStreak();
    LM.Game.uncompleteTask(firstHabit);
    out.s1End = cloneStreak();

    // Scenario 2: best:1 cur:0 (historical day -4) -> complete -> undo -> stays best:1 cur:0 lastDate:oldDay
    LM.Store.resetProgress();
    LM.Store.update(s => {
      s.xp = 40; s.days[oldDay] = { xp: 40, tasks: 1, guides: 0 };
      s.history.push({ ts: 1, date: oldDay, type: 'task', title: 'Old', xp: 40 });
      s.streak = { current: 0, best: 1, lastDate: oldDay };
    });
    LM.Game.ensureToday();
    LM.Game.completeTask(LM.Game.todayTasks().find(t => t.kind === 'habit').id);
    out.s2Mid = cloneStreak();
    LM.Game.uncompleteTask(LM.Game.todayTasks().find(t => t.kind === 'habit').id);
    out.s2End = cloneStreak();

    // Scenario 3: best:3 cur:2 (yesterday) -> complete (cur:3,best:3) -> undo -> stays best:3 cur:2 lastDate:yest
    LM.Store.resetProgress();
    LM.Store.update(s => {
      const d5 = LM.Game.addDays(today, -8), d4 = LM.Game.addDays(today, -7), d3 = LM.Game.addDays(today, -6);
      const d2 = LM.Game.addDays(today, -2);
      [d5, d4, d3, d2, yest].forEach(d => {
        s.days[d] = { xp: 20, tasks: 1, guides: 0 };
        s.history.push({ ts: 1, date: d, type: 'task', title: 'Old', xp: 20 });
      });
      s.xp = 100;
      s.streak = { current: 2, best: 3, lastDate: yest };
    });
    LM.Game.ensureToday();
    LM.Game.completeTask(LM.Game.todayTasks().find(t => t.kind === 'habit').id);
    out.s3Mid = cloneStreak();
    LM.Game.uncompleteTask(LM.Game.todayTasks().find(t => t.kind === 'habit').id);
    out.s3End = cloneStreak();

    // Scenario 4: best:7 cur:6 -> complete -> undo -> best:7 cur:6
    LM.Store.resetProgress();
    LM.Store.update(s => {
      for (let i = 1; i <= 6; i++) {
        const d = LM.Game.addDays(today, -i);
        s.days[d] = { xp: 20, tasks: 1, guides: 0 };
      }
      s.xp = 120;
      s.streak = { current: 6, best: 7, lastDate: yest };
    });
    LM.Game.ensureToday();
    LM.Game.completeTask(LM.Game.todayTasks().find(t => t.kind === 'habit').id);
    LM.Game.uncompleteTask(LM.Game.todayTasks().find(t => t.kind === 'habit').id);
    out.s4End = cloneStreak();

    // Scenario 5: best === cur === 5 -> complete hits new record 6/6 -> undo rolls back to 5/5
    LM.Store.resetProgress();
    LM.Store.update(s => {
      for (let i = 1; i <= 5; i++) {
        const d = LM.Game.addDays(today, -i);
        s.days[d] = { xp: 20, tasks: 1, guides: 0 };
      }
      s.xp = 100;
      s.streak = { current: 5, best: 5, lastDate: yest };
    });
    LM.Game.ensureToday();
    LM.Game.completeTask(LM.Game.todayTasks().find(t => t.kind === 'habit').id);
    out.s5Mid = cloneStreak();
    LM.Game.uncompleteTask(LM.Game.todayTasks().find(t => t.kind === 'habit').id);
    out.s5End = cloneStreak();

    // Scenario 6 & 7: Multi-habit complete + undo partial + undo last + re-complete
    const habits = LM.Game.todayTasks().filter(t => t.kind === 'habit').map(t => t.id);
    LM.Game.completeTask(habits[0]);
    LM.Game.completeTask(habits[1]);
    LM.Game.uncompleteTask(habits[0]);
    out.s6Half = cloneStreak();
    LM.Game.uncompleteTask(habits[1]);
    out.s6Empty = cloneStreak();
    LM.Game.completeTask(habits[0]);
    out.s7Recomplete = cloneStreak();

    // Scenario 8: Pre-audit fallback when daily.streakBefore is absent (v2/pre-fix save)
    LM.Store.resetProgress();
    LM.Store.update(s => {
      [LM.Game.addDays(today, -6), LM.Game.addDays(today, -5), LM.Game.addDays(today, -4), LM.Game.addDays(today, -2), yest].forEach(d => {
        s.days[d] = { xp: 25, tasks: 1, guides: 0 };
      });
      s.xp = 125;
      s.streak = { current: 2, best: 3, lastDate: yest };
      s.daily = LM.Game.generateDaily(s, today);
      delete s.daily.streakBefore;
    });
    const h8 = LM.Game.todayTasks().find(t => t.kind === 'habit').id;
    LM.Game.completeTask(h8);
    // wipe lazy streakBefore to explicitly force fallback priorStats branch
    LM.Store.update(s => { delete s.daily.streakBefore; });
    LM.Game.uncompleteTask(h8);
    out.s8Fallback = cloneStreak();

    function cloneStreak() {
      const s = LM.Store.get();
      return { current: s.streak.current, best: s.streak.best, lastDate: s.streak.lastDate, xp: s.xp };
    }
    return { out, today, yest, oldDay };
  });

  const { out, today, yest, oldDay } = res;
  check('S1 fresh: 1/1 -> undo -> 0/0 null', out.s1Mid.current === 1 && out.s1Mid.best === 1 && out.s1End.current === 0 && out.s1End.best === 0 && out.s1End.lastDate === null, out);
  check('S2 best:1/cur:0 -> complete -> undo preserves best:1/cur:0/oldDay', out.s2Mid.best === 1 && out.s2End.best === 1 && out.s2End.current === 0 && out.s2End.lastDate === oldDay, out.s2End);
  check('S3 best:3/cur:2 -> complete(3/3) -> undo restores best:3/cur:2/yest', out.s3Mid.current === 3 && out.s3Mid.best === 3 && out.s3End.current === 2 && out.s3End.best === 3 && out.s3End.lastDate === yest, out.s3End);
  check('S4 best:7/cur:6 -> complete -> undo restores best:7/cur:6', out.s4End.current === 6 && out.s4End.best === 7 && out.s4End.lastDate === yest, out.s4End);
  check('S5 best===cur===5 -> new record 6/6 -> undo rolls back to 5/5', out.s5Mid.current === 6 && out.s5Mid.best === 6 && out.s5End.current === 5 && out.s5End.best === 5 && out.s5End.lastDate === yest, out.s5End);
  check('S6 multi-habit partial undo keeps today streak, full undo restores 5/5', out.s6Half.current === 6 && out.s6Half.lastDate === today && out.s6Empty.current === 5 && out.s6Empty.best === 5, { h: out.s6Half, e: out.s6Empty });
  check('S7 re-complete restores 6/6 and XP', out.s7Recomplete.current === 6 && out.s7Recomplete.best === 6 && out.s7Recomplete.xp > 100, out.s7Recomplete);
  check('S8 legacy save without streakBefore still preserves best:3/cur:2', out.s8Fallback.current === 2 && out.s8Fallback.best === 3 && out.s8Fallback.lastDate === yest, out.s8Fallback);

  // Also test reload between UI click & undo
  await page.evaluate(() => { LM.Store.resetProgress(); LM.Game.ensureToday(); });
  await page.reload();
  await page.waitForFunction(() => window.__bootReport);
  await jsClick(page, 'button.task[data-act=task]:not(.done)');
  await sleep(160);
  await page.reload();
  await page.waitForFunction(() => window.__bootReport);
  await jsClick(page, 'button.task[data-act=task].done');
  await sleep(160);
  const afterReloadUndo = await page.evaluate(() => ({ xp: LM.Store.get().xp, st: LM.Store.get().streak }));
  check('UI complete -> reload -> UI undo persists zero state cleanly', afterReloadUndo.xp === 0 && afterReloadUndo.st.current === 0 && afterReloadUndo.st.best === 0, afterReloadUndo);

  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── B3 & B4: Perfect Day + Achievements Reconciliation + Prior History ───────── */
test('B3/B4 Perfect Day revert + history intact + dynamic vs historical achievements', async (br) => {
  const ctx = await newCtx(br);
  const page = await openApp(ctx);
  const data = await page.evaluate(() => {
    const today = LM.Game.dateKey();
    const yest = LM.Game.addDays(today, -1);
    const d2 = LM.Game.addDays(today, -2);
    const d3 = LM.Game.addDays(today, -3);
    LM.Store.resetProgress();
    LM.Store.update(s => {
      // Seed 3-day historical streak from before today + historical a-s3
      [d3, d2].forEach(d => {
        s.days[d] = { xp: 20, tasks: 1, guides: 0 };
        s.history.push({ ts: 1000, date: d, type: 'task', title: 'Legacy entry', xp: 20 });
      });
      s.xp = 40;
      s.streak = { current: 0, best: 3, lastDate: d2 };
      s.achievements['a-s3'] = 1700000000000; // historical streak achievement
    });
    LM.Game.ensureToday();
    // Favorite 5 guides to earn a-fav5 (historical milestone)
    ['face-jawline', 'body-posture', 'face-smile', 'skin-sunscreen', 'hair-care'].forEach(g => LM.Game.toggleFavorite(g));
    // Study 1 guide (today's guide task) + complete all 3 habits -> triggers Perfect Day + a-g1 + a-first + a-xp100 + a-perfect
    const gTask = LM.Game.todayTasks().find(t => t.kind === 'guide');
    LM.Game.studyGuide(gTask.id.slice(6));
    const habits = LM.Game.todayTasks().filter(t => t.kind === 'habit');
    habits.forEach(h => LM.Game.completeTask(h.id));
    const atPerfect = {
      xp: LM.Store.get().xp,
      perfectPaid: LM.Store.get().daily.perfectPaid,
      perfectStat: LM.Store.get().stats.perfect,
      histLen: LM.Store.get().history.length,
      ach: Object.keys(LM.Store.get().achievements).sort()
    };
    // Undo all 3 habits
    habits.forEach(h => LM.Game.uncompleteTask(h.id));
    const afterAllUndo = {
      xp: LM.Store.get().xp,
      perfectPaid: LM.Store.get().daily.perfectPaid,
      perfectStat: LM.Store.get().stats.perfect,
      hist: clone(LM.Store.get().history),
      ach: Object.keys(LM.Store.get().achievements).sort(),
      s3Ts: LM.Store.get().achievements['a-s3'],
      streak: clone(LM.Store.get().streak)
    };
    // Re-complete all 3 habits
    habits.forEach(h => LM.Game.completeTask(h.id));
    const afterRecomplete = {
      xp: LM.Store.get().xp,
      perfectPaid: LM.Store.get().daily.perfectPaid,
      histLen: LM.Store.get().history.length,
      bonusCount: LM.Store.get().history.filter(h => h.ref === 'bonus:perfect').length
    };
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    return { atPerfect, afterAllUndo, afterRecomplete };
  });

  check('Perfect Day reached + dynamic/historical achievements unlocked', data.atPerfect.perfectPaid === true && data.atPerfect.perfectStat === 1 && data.atPerfect.ach.includes('a-perfect') && data.atPerfect.ach.includes('a-first') && data.atPerfect.ach.includes('a-g1') && data.atPerfect.ach.includes('a-fav5'), data.atPerfect);
  check('Undo revokes Perfect bonus, reverts XP to 40, keeps 2 prior-day entries intact', data.afterAllUndo.xp === 40 && !data.afterAllUndo.perfectPaid && data.afterAllUndo.perfectStat === 0 && data.afterAllUndo.hist.length === 2, data.afterAllUndo);
  check('Undo revokes dynamic a-perfect/a-xp100 while preserving historical a-g1/a-fav5/a-s3 (and a-first while studied guide task counts as 1 done task)', !data.afterAllUndo.ach.includes('a-perfect') && !data.afterAllUndo.ach.includes('a-xp100') && data.afterAllUndo.ach.includes('a-first') && data.afterAllUndo.ach.includes('a-g1') && data.afterAllUndo.ach.includes('a-fav5') && data.afterAllUndo.s3Ts === 1700000000000 && data.afterAllUndo.streak.best === 3, data.afterAllUndo);
  check('Re-completing restores XP identically with single bonus entry (no duplication)', data.afterRecomplete.xp === data.atPerfect.xp && data.afterRecomplete.perfectPaid && data.afterRecomplete.bonusCount === 1, data.afterRecomplete);

  // Also test standalone a-first + today-only a-s3 revocation when all tasks undone
  const s3Today = await page.evaluate(() => {
    const today = LM.Game.dateKey();
    const y1 = LM.Game.addDays(today, -1), y2 = LM.Game.addDays(today, -2);
    LM.Store.resetProgress();
    LM.Store.update(s => {
      s.days[y1] = { xp: 20, tasks: 1, guides: 0 };
      s.days[y2] = { xp: 20, tasks: 1, guides: 0 };
      s.streak = { current: 2, best: 2, lastDate: y1 };
      s.xp = 40;
    });
    LM.Game.ensureToday();
    const h = LM.Game.todayTasks().find(t => t.kind === 'habit').id;
    LM.Game.completeTask(h);
    const unlockedNow = !!LM.Store.get().achievements['a-s3'] && !!LM.Store.get().achievements['a-first'];
    LM.Game.uncompleteTask(h);
    const afterUndo = !LM.Store.get().achievements['a-s3'] && !LM.Store.get().achievements['a-first'];
    return { unlockedNow, afterUndo, best: LM.Store.get().streak.best };
  });
  check('a-first & a-s3 earned strictly today revoke cleanly when all tasks undone (best returns to 2)', s3Today.unlockedNow === true && s3Today.afterUndo === true && s3Today.best === 2, s3Today);

  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── B5: Level Up Overlay 700ms Race & Non-Stacking ───────── */
test('B5 Level Up overlay cancels on quick undo and never stacks on double level-up', async (br) => {
  const ctx = await newCtx(br);
  const page = await openApp(ctx);

  // Quick undo within 700ms cancels level-up overlay
  await page.evaluate(() => {
    LM.Store.resetProgress();
    LM.Store.update(s => { s.xp = 90; });
    LM.Game.ensureToday();
    const h = LM.Game.todayTasks().find(t => t.kind === 'habit').id;
    LM.Game.completeTask(h);
    setTimeout(() => LM.Game.uncompleteTask(h), 120);
  });
  await sleep(950);
  const raceCnt = await page.evaluate(() => document.querySelectorAll('#app .lvl').length);
  check('Quick undo within 700ms cancels pending levelup overlay', raceCnt === 0, { raceCnt });

  // Visible overlay closed immediately when undone past level threshold
  await page.evaluate(() => {
    LM.Store.resetProgress();
    LM.Store.update(s => { s.xp = 90; });
    LM.Game.ensureToday();
    window.__hTest = LM.Game.todayTasks().find(t => t.kind === 'habit').id;
    LM.Game.completeTask(window.__hTest);
  });
  await sleep(850);
  const visibleBeforeUndo = await page.evaluate(() => document.querySelector('#app .lvl .n') && document.querySelector('#app .lvl .n').textContent);
  await page.evaluate(() => LM.Game.uncompleteTask(window.__hTest));
  await sleep(60);
  const visibleAfterUndo = await page.evaluate(() => document.querySelectorAll('#app .lvl').length);
  check('Visible L2 overlay removed immediately when undone back to L1', visibleBeforeUndo === '2' && visibleAfterUndo === 0, { visibleBeforeUndo, visibleAfterUndo });

  // Rapid crossing L1 -> L2 -> L3 creates at most 1 overlay showing live L3
  await page.evaluate(() => {
    LM.Store.resetProgress();
    LM.Store.update(s => { s.xp = 85; }); // task1 (+>=15) -> >=100 (L2), then boost +130 -> L3
    LM.Game.ensureToday();
    const habits = LM.Game.todayTasks().filter(t => t.kind === 'habit');
    LM.Game.completeTask(habits[0].id);
    setTimeout(() => {
      LM.Store.update(s => { s.xp = 215; });
      LM.Game.completeTask(habits[1].id);
    }, 150);
  });
  await sleep(1050);
  const doubleRes = await page.evaluate(() => ({
    count: document.querySelectorAll('#app .lvl').length,
    levelText: document.querySelector('#app .lvl .n') ? document.querySelector('#app .lvl .n').textContent : null
  }));
  check('Rapid double level-up renders single non-stacked overlay with live L3', doubleRes.count === 1 && doubleRes.levelText === '3', doubleRes);

  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── B6: Practice Timer Pause/Resume Lifecycle (All 8 Scenarios) ───────── */
test('B6 Practice timer pause/resume lifecycle across all 8 edge scenarios', async (br) => {
  const ctx = await newCtx(br);
  // Open face-jawline step 2 (jaw-relax, timed hold 20s)
  const page = await openApp(ctx, '#/practice/face-jawline');
  await jsClick(page, '[data-act=pr-next]');
  await sleep(100);
  await jsClick(page, '[data-act=pr-next]');
  await sleep(150);

  // 1. Pause at 20s, wait 2.2s, resume -> remaining should still be >= 18s (not 17!)
  await jsClick(page, '#pr-toggle'); // pause
  const remPaused = await page.evaluate(() => LM.Views.st.pr.remaining);
  await sleep(2200);
  const remStillPaused = await page.evaluate(() => LM.Views.st.pr.remaining);
  await jsClick(page, '#pr-toggle'); // resume
  await sleep(350);
  const remAfterResume = await page.evaluate(() => LM.Views.st.pr.remaining);
  check('S1 pause preserves remaining (never subtracts paused wall-clock)', remPaused === remStillPaused && remAfterResume >= remPaused - 1, { remPaused, remStillPaused, remAfterResume });

  // 2. Pause -> switch phase (0, 1, 2) -> stays paused, wait 1.4s -> resume -> preserved
  await jsClick(page, '#pr-toggle'); // pause again
  const remBeforePhase = await page.evaluate(() => LM.Views.st.pr.remaining);
  await jsClick(page, '[data-act=pr-phase][data-phase="0"]');
  await sleep(120);
  const pausedAfterP0 = await page.evaluate(() => LM.Views.st.pr.paused);
  await jsClick(page, '[data-act=pr-phase][data-phase="1"]');
  await sleep(1200);
  await jsClick(page, '[data-act=pr-phase][data-phase="2"]');
  const stAfterPhases = await page.evaluate(() => ({ paused: LM.Views.st.pr.paused, rem: LM.Views.st.pr.remaining, lbl: document.querySelector('.demo-state-lbl').textContent }));
  await jsClick(page, '#pr-toggle'); // resume
  await sleep(250);
  const remPostPhaseResume = await page.evaluate(() => LM.Views.st.pr.remaining);
  check('S2 phase inspection preserves paused state & remaining time', pausedAfterP0 === true && stAfterPhases.paused === true && stAfterPhases.rem === remBeforePhase && /Пауза|Paused/i.test(stAfterPhases.lbl) && remPostPhaseResume >= remBeforePhase - 1, { remBeforePhase, stAfterPhases, remPostPhaseResume });

  // 3. Pause -> wait 1.5s -> Replay -> preserves remaining (no wall-clock jump)
  await jsClick(page, '#pr-toggle'); // pause
  const remBeforeReplay = await page.evaluate(() => LM.Views.st.pr.remaining);
  await sleep(1500);
  await jsClick(page, '[data-act=pr-replay]');
  await sleep(300);
  const stAfterReplay = await page.evaluate(() => ({ paused: LM.Views.st.pr.paused, phase: LM.Views.st.pr.phase, rem: LM.Views.st.pr.remaining }));
  check('S3 Replay from pause resumes cleanly without subtracting pause time', stAfterReplay.paused === false && stAfterReplay.phase === 'all' && stAfterReplay.rem >= remBeforeReplay - 1, { remBeforeReplay, stAfterReplay });

  // 4. Multiple replays + pause/resume cycles don't stack setIntervals (1s wall-clock drops ~1s, not 2-3s)
  for (let i = 0; i < 4; i++) {
    await jsClick(page, '[data-act=pr-replay]');
    await sleep(60);
  }
  const rStart = await page.evaluate(() => LM.Views.st.pr.remaining);
  await sleep(1100);
  const rEnd = await page.evaluate(() => LM.Views.st.pr.remaining);
  check('S4 Repeated replays leave single clean 1x countdown rate', rStart - rEnd <= 2 && rStart - rEnd >= 1, { rStart, rEnd });

  // 5. Rapid phase switching while paused + running
  for (const ph of ['0', '1', '2', 'all', '2', '0', 'all']) {
    await jsClick(page, `[data-act=pr-phase][data-phase="${ph}"]`);
  }
  await sleep(100);
  check('S5 Rapid phase switching completes cleanly', await page.evaluate(() => LM.Views.st.pr.phase === 'all'));

  // 6. Step switching prev/next resets paused=false and loads target step cleanly
  await jsClick(page, '[data-act=pr-prev]');
  await sleep(120);
  const prevSt = await page.evaluate(() => ({ step: LM.Views.st.pr.step, paused: LM.Views.st.pr.paused, view: LM.Views.st.pr.view }));
  check('S6 Step switching resets pause & loads step 1 (jaw-neck-flex)', prevSt.step === 1 && prevSt.paused === false && prevSt.view === 'profile', prevSt);

  // 7. visibilitychange while paused keeps timer frozen
  await jsClick(page, '[data-act=pr-next]');
  await sleep(100);
  await jsClick(page, '#pr-toggle'); // pause step 2
  const remVis0 = await page.evaluate(() => LM.Views.st.pr.remaining);
  await sleep(1200);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(100);
  const remVis1 = await page.evaluate(() => LM.Views.st.pr.remaining);
  check('S7 visibilitychange never subtracts paused time', remVis0 === remVis1 && (await page.evaluate(() => LM.Views.st.pr.paused)) === true, { remVis0, remVis1 });

  // 8. Pause at 00:01 -> stays frozen at 00:01 (never prematurely flips ready until resumed)
  await page.evaluate(() => { LM.Views.st.pr.remaining = 1; document.getElementById('pr-time').textContent = '00:01'; });
  await sleep(1500);
  const stillOne = await page.evaluate(() => ({
    rem: LM.Views.st.pr.remaining,
    readyCls: document.querySelector('.pr-timer-box').classList.contains('ready')
  }));
  check('S8 Pause at 00:01 stays at 1s and not ready until resumed', stillOne.rem === 1 && stillOne.readyCls === false, stillOne);
  await jsClick(page, '#pr-toggle'); // resume -> counts down to 0
  await sleep(1300);
  check('S8 After resuming from 00:01 completes to ready', await page.evaluate(() => LM.Views.st.pr.remaining === 0 && document.querySelector('.pr-timer-box').classList.contains('ready')));

  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── B7: All 14 Rich SVG Rigs — Phase Differentiation & Zero Fake Controls ───────── */
test('B7 All 14 rich SVG models have verified distinct visual phases across all steps/views', async (br) => {
  const ctx = await newCtx(br, { width: 390, height: 844 });
  const page = await openApp(ctx, '#/home');

  const val = await page.evaluate(() => LM.DemoEngine.validatePhases(LM.PRACTICES));
  check('DemoEngine.validatePhases checks >= 14 rigs with 0 issues', val.ok === true && val.checkedRigs >= 14 && val.issues.length === 0, val);

  // Measure visual computed-style + bounding box signatures for every step & view across phase-0, phase-1, phase-2
  const diffReport = await page.evaluate(() => {
    // Enable reduce-motion during measurement so CSS transforms settle immediately without transition mid-frame
    document.documentElement.dataset.motion = 'off';
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:360px;z-index:-1;';
    document.body.appendChild(host);

    const guides = ['face-jawline', 'body-posture', 'face-smile', 'skin-sunscreen'];
    const out = [];

    function captureSignature() {
      const svg = host.querySelector('svg.demo-svg-rich');
      if (!svg) return 'MISSING';
      const els = svg.querySelectorAll('g, path, circle, rect, ellipse, line, text');
      const parts = [];
      els.forEach((el, idx) => {
        const cs = getComputedStyle(el);
        parts.push([
          idx,
          cs.transform,
          cs.opacity,
          cs.strokeWidth,
          cs.strokeDashoffset,
          cs.stroke,
          cs.fill
        ].join('|'));
      });
      return parts.join(';');
    }

    guides.forEach(gid => {
      const pr = LM.PRACTICES[gid];
      pr.steps.forEach((step, sIdx) => {
        const views = LM.DemoEngine.viewsFor(step);
        views.forEach(view => {
          const sigs = [0, 1, 2].map(ph => {
            host.innerHTML = LM.DemoEngine.render(step, { view, phase: ph, paused: false, animKey: 1 });
            return captureSignature();
          });
          out.push({
            guide: gid,
            step: sIdx,
            rig: step.rig.id,
            view,
            d01: sigs[0] !== sigs[1],
            d12: sigs[1] !== sigs[2],
            d02: sigs[0] !== sigs[2]
          });
        });
      });
    });

    host.remove();
    document.documentElement.dataset.motion = 'on';
    return out;
  });

  const failed = diffReport.filter(r => !r.d01 || !r.d12 || !r.d02);
  check('All 17 rig+view combinations (14 rigs) have distinct visual CSS state in phase 0 vs 1 vs 2', diffReport.length === 17 && failed.length === 0, failed);

  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── B8: Unified Default Angle & Per-Guide Isolation ───────── */
test('B8 Unified default view angles & isolated per-guide demo state', async (br) => {
  const ctx = await newCtx(br);
  const page = await openApp(ctx, '#/guide/face-jawline');

  const jawGD = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  check('face-jawline Guide Detail opens on profile view', /view-profile/.test(jawGD), jawGD);

  await jsClick(page, '[data-act=gd-view][data-view=front]');
  await jsClick(page, '[data-act=gd-phase][data-phase="1"]');
  await sleep(100);
  check('face-jawline Guide Detail switches to view-front & phase-1', await page.evaluate(() => /view-front/.test(document.querySelector('.demo-stage-rich').className) && /phase-1/.test(document.querySelector('.demo-stage-rich').className)));

  // Navigate to body-posture Guide Detail -> must NOT inherit face-jawline view/phase
  await page.evaluate(() => { location.hash = '#/guide/body-posture'; });
  await sleep(200);
  const postGD = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  check('body-posture Guide Detail opens clean on front + phase-all (no state leak)', /view-front/.test(postGD) && /phase-all/.test(postGD), postGD);

  // Return to face-jawline -> preserves its own isolated front + phase-1
  await page.evaluate(() => { location.hash = '#/guide/face-jawline'; });
  await sleep(200);
  const jawReturn = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  check('face-jawline keeps its own isolated view-front & phase-1', /view-front/.test(jawReturn) && /phase-1/.test(jawReturn), jawReturn);

  // Switch to step 2 (jaw-relax, views: ['profile']) -> resolves cleanly to view-profile
  await jsClick(page, '[data-act=gd-demo][data-step="2"]');
  await sleep(120);
  check('Single-view step auto-resolves to supported profile angle', await page.evaluate(() => /view-profile/.test(document.querySelector('.demo-stage-rich').className)));

  // Check Practice default views match Guide defaults
  await page.evaluate(() => { LM.Store.resetProgress(); location.hash = '#/home'; });
  await page.evaluate(() => { LM.PracticeStore.reset(); LM.Views.st.pr = null; });
  await page.evaluate(() => { location.hash = '#/practice/face-jawline'; });
  await sleep(200);
  const jawPR = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  await page.evaluate(() => { location.hash = '#/practice/body-posture'; });
  await sleep(200);
  const postPR = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  check('Practice default views match Guide defaults (jawline=profile, posture=front)', /view-profile/.test(jawPR) && /view-front/.test(postPR), { jawPR, postPR });

  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── B9: RU/EN Parity, Layouts, Themes, Backup Round-trip, Screenshots ───────── */
test('B9 RU/EN parity, 390x844 & 1440x900 dark/light zero overflow, backup round-trip, screenshots', async (br) => {
  // Check RU/EN dictionary parity & screenshots across viewports
  for (const [tag, vp, theme] of [
    ['390x844-dark', { width: 390, height: 844 }, 'dark'],
    ['390x844-light', { width: 390, height: 844 }, 'light'],
    ['1440x900-dark', { width: 1440, height: 900 }, 'dark']
  ]) {
    const ctx = await newCtx(br, vp);
    const page = await openApp(ctx, '#/home');
    await page.evaluate(th => {
      LM.setProgressionMode('looksmaxxing');
      LM.Store.update(s => {
        s.xp = 1350;
        s.streak = { current: 4, best: 7, lastDate: LM.Game.dateKey() };
        s.settings.appearance.theme = th;
      });
    }, theme);
    await sleep(160);

    if (tag === '390x844-dark') {
      const parity = await page.evaluate(() => {
        const ru = Object.keys(LM.Dict.ru || {});
        const en = Object.keys(LM.Dict.en || {});
        return {
          extraInEn: en.filter(k => !(k in LM.Dict.ru)),
          enCount: en.length,
          ruCount: ru.length
        };
      });
      check('Zero orphaned EN dictionary keys missing from RU', parity.extraInEn.length === 0, parity);
    }

    for (const [name, h] of [
      ['home', '#/home'],
      ['guide-jawline', '#/guide/face-jawline'],
      ['practice-jawline', '#/practice/face-jawline'],
      ['practice-posture', '#/practice/body-posture'],
      ['practice-smile', '#/practice/face-smile'],
      ['practice-sunscreen', '#/practice/skin-sunscreen'],
      ['progress', '#/progress'],
      ['profile', '#/profile']
    ]) {
      await page.evaluate(x => { location.hash = x; }, h);
      await sleep(240);
      if (name === 'practice-jawline') {
        await jsClick(page, '[data-act=pr-phase][data-phase="1"]');
        await sleep(150);
      }
      const m = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        vw: document.getElementById('view').scrollWidth,
        vc: document.getElementById('view').clientWidth
      }));
      check(`${tag} ${name}: no horizontal overflow`, m.w <= m.iw && m.vw <= m.vc + 1, m);
      await page.screenshot({ path: path.join(SHOTS_DIR, `fix_${tag}_${name}.png`) });
    }

    // Check EN switch renders cleanly without missing-key markers
    if (tag === '390x844-dark') {
      await page.evaluate(() => LM.I18n.set('en'));
      await page.evaluate(() => { location.hash = '#/practice/face-jawline'; });
      await sleep(200);
      const enTxt = await page.evaluate(() => document.getElementById('view').textContent);
      check('EN switch renders Practice UI cleanly', /Chin Tuck/i.test(enTxt) && /Zone:/i.test(enTxt), enTxt.slice(0, 120));
    }

    check(`${tag}: zero console errors`, ctx._errors.length === 0, ctx._errors);
    await ctx.close();
  }

  // Backup export -> erase -> import round-trip + v2/pre-fix save import compatibility
  const ctx = await newCtx(br);
  const page = await openApp(ctx, '#/home');
  await jsClick(page, 'button.task[data-act=task]:not(.done)');
  await sleep(160);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ascend.state')));
  const expFile = path.join(SCRATCH, 'fix-backup.json');
  await page.evaluate(() => { location.hash = '#/settings'; });
  await sleep(150);
  await jsClick(page, '[data-act=open-setting][data-k=data]');
  await page.waitForSelector('#d-exp');
  const [dl] = await Promise.all([page.waitForEvent('download'), jsClick(page, '#d-exp')]);
  await dl.saveAs(expFile);
  await jsClick(page, '#d-erase');
  await page.waitForSelector('#cf-in');
  await page.fill('#cf-in', 'ERASE');
  await jsClick(page, '#cf-ok');
  await sleep(350);
  await jsClick(page, '[data-act=open-setting][data-k=data]');
  await page.waitForSelector('#d-imp', { state: 'attached' });
  await page.setInputFiles('#d-imp', expFile);
  await page.waitForSelector('#cf-ok');
  await jsClick(page, '#cf-ok');
  await sleep(500);
  const afterImp = await page.evaluate(() => JSON.parse(localStorage.getItem('ascend.state')));
  check('Backup export -> erase -> import preserves XP, streak, tasks', afterImp.xp === before.xp && afterImp.streak.best === before.streak.best && afterImp.daily.tasks.filter(t => t.done).length === before.daily.tasks.filter(t => t.done).length, { before: before.xp, after: afterImp.xp });

  // Also undo imported completed habit cleanly
  await page.evaluate(() => { location.hash = '#/home'; });
  await sleep(150);
  await jsClick(page, 'button.task[data-act=task].done');
  await sleep(150);
  check('Imported completed task can be cleanly undone', await page.evaluate(() => LM.Store.get().xp === 0 && LM.Store.get().streak.best === 0));
  check('Backup test zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── runner ───────── */
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
  console.log(`\nStage B: ${total - failed}/${total} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(failed ? 1 : 0);
})();
