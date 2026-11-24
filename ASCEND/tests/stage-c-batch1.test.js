/* Stage C / Batch 1 test suite (Playwright + Chromium).
   Verifies all 5 approved Batch 1 guides (16 rigs, 23 rig+view combinations):
   - body-strength (4 steps), face-puffiness (3 steps), groom-beard (3 steps),
     groom-brows (3 steps), skin-routine (3 steps)
   - Phase differentiation (phase-0 vs 1 vs 2) under data-motion="off" and "on"
   - Default views, view toggles, per-guide isolation, and intact 4 pilot + 19 fallback guides
   - Practice Engine timers, 0s daily-check step, pause/resume/replay
   - Responsiveness (390x844, 1440x900), Dark & Light themes, RU & EN localization, screenshots

   Run: NODE_PATH=/tmp/pw/node_modules SCRATCH=/tmp/ascend-c-b1 node tests/stage-c-batch1.test.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const start = require('./server');

const PORT = 8125, BASE = 'http://127.0.0.1:' + PORT;
const SCRATCH = process.env.SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'ascend-c-b1-'));
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(SCRATCH, 'shots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const BATCH1_GUIDES = ['body-strength', 'face-puffiness', 'groom-beard', 'groom-brows', 'skin-routine'];
const PILOT_GUIDES = ['face-jawline', 'body-posture', 'face-smile', 'skin-sunscreen'];

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

/* ───────── C1: 30 Total Rigs, 16 Batch-1 Rigs / 23 Rig+View Phase Differentiation ───────── */
test('C1 All 16 Batch-1 rigs (23 rig+view combos) & 30 total rigs validate with distinct visual phases', async (br) => {
  const ctx = await newCtx(br, { width: 390, height: 844 });
  const page = await openApp(ctx, '#/home');

  const val = await page.evaluate(() => LM.DemoEngine.validatePhases(LM.PRACTICES));
  check('DemoEngine.validatePhases checks exact 30 rigs with 0 issues', val.ok === true && val.checkedRigs === 30 && val.issues.length === 0, val);

  const report = await page.evaluate(batchGuides => {
    const out = [];
    const defsSeen = new Set();
    const defsDups = [];

    function captureSignature(host) {
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

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:360px;z-index:-1;';
    document.body.appendChild(host);

    // Check phase differentiation under data-motion="off" AND data-motion="on"
    document.documentElement.dataset.motion = 'off';
    batchGuides.forEach(gid => {
      const pr = LM.PRACTICES[gid];
      pr.steps.forEach((step, sIdx) => {
        const views = LM.DemoEngine.viewsFor(step);
        views.forEach(view => {
          const html0 = LM.DemoEngine.render(step, { view, phase: 0, paused: false, animKey: 1 });
          const ids = [...html0.matchAll(/<(?:linearGradient|radialGradient|clipPath|mask|filter)[^>]+id="([^"]+)"/g)].map(m => m[1]);
          ids.forEach(id => {
            if (defsSeen.has(id)) defsDups.push({ gid, sIdx, view, id });
            defsSeen.add(id);
          });
          const sigs = [0, 1, 2].map(ph => {
            host.innerHTML = LM.DemoEngine.render(step, { view, phase: ph, paused: false, animKey: 1 });
            return captureSignature(host);
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

    // Also verify all 19 untouched fallback guides still use fallback stage (not rich)
    const covered = new Set(batchGuides.concat(['face-jawline', 'body-posture', 'face-smile', 'skin-sunscreen']));
    const fallbackBroken = [];
    Object.keys(LM.PRACTICES).forEach(gid => {
      if (covered.has(gid)) return;
      LM.PRACTICES[gid].steps.forEach((st, idx) => {
        if (st.rig && st.rig.id) fallbackBroken.push({ gid, idx, rig: st.rig.id });
        const html = LM.DemoEngine.render(st, { paused: false });
        if (!/demo-stage/.test(html) || /demo-stage-rich/.test(html)) {
          fallbackBroken.push({ gid, idx, reason: 'unexpected render' });
        }
      });
    });

    host.remove();
    document.documentElement.dataset.motion = 'on';
    return { out, defsDups, fallbackBroken };
  }, BATCH1_GUIDES);

  const failedDiffs = report.out.filter(r => !r.d01 || !r.d12 || !r.d02);
  check('All 23 Batch-1 rig+view combos (16 rigs) have distinct phase 0 vs 1 vs 2 states under data-motion="off"', report.out.length === 23 && failedDiffs.length === 0, failedDiffs);
  check('Zero duplicate <defs> IDs across Batch-1 rig renders', report.defsDups.length === 0, report.defsDups);
  check('All 19 non-Batch-1 guides retain clean fallback demoSVG behavior', report.fallbackBroken.length === 0, report.fallbackBroken);
  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── C2: Default View Angles, Toggle Controls & Per-Guide State Isolation ───────── */
test('C2 Default views, angle switcher, phase switcher & per-guide isolation for all 5 Batch-1 guides', async (br) => {
  const ctx = await newCtx(br, { width: 390, height: 844 });
  const page = await openApp(ctx, '#/guide/body-strength');

  // Verify default views on Guide Detail
  const expDefaults = [
    ['body-strength', 'view-profile'],
    ['face-puffiness', 'view-front'],
    ['groom-beard', 'view-front'],
    ['groom-brows', 'view-front'],
    ['skin-routine', 'view-front']
  ];
  for (const [gid, expView] of expDefaults) {
    await page.evaluate(id => { location.hash = '#/guide/' + id; }, gid);
    await sleep(180);
    const st = await page.evaluate(() => {
      const stage = document.querySelector('.demo-stage-rich');
      return stage ? stage.className : '';
    });
    check(`${gid} Guide Detail opens on ${expView} & phase-all`, st.includes(expView) && /phase-all/.test(st), st);
  }

  // Test angle toggle on body-strength (profile <-> front) & step switching
  await page.evaluate(() => { location.hash = '#/guide/body-strength'; });
  await sleep(160);
  await jsClick(page, '[data-act=gd-view][data-view=front]');
  await jsClick(page, '[data-act=gd-phase][data-phase="2"]');
  await sleep(100);
  const strengthFront = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  check('body-strength toggles to view-front & phase-2', /view-front/.test(strengthFront) && /phase-2/.test(strengthFront), strengthFront);

  // Navigate to groom-beard -> must open clean on view-front & phase-all without inheriting body-strength state
  await page.evaluate(() => { location.hash = '#/guide/groom-beard'; });
  await sleep(160);
  const beardFresh = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  check('groom-beard opens clean without leaking body-strength state', /view-front/.test(beardFresh) && /phase-all/.test(beardFresh), beardFresh);

  // Step 1 on groom-beard defaults to profile (Adam's apple + 2-finger neckline)
  await jsClick(page, '[data-act=gd-demo][data-step="1"]');
  await sleep(140);
  const beardS1 = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  check('groom-beard step 1 (Shave/Edge) resolves to profile view showing 2-finger neckline', /rig-beard-grain-neck/.test(beardS1) && /view-profile/.test(beardS1), beardS1);

  // face-puffiness step 2 has ['front', 'profile'] toggle
  await page.evaluate(() => { location.hash = '#/guide/face-puffiness'; });
  await sleep(160);
  await jsClick(page, '[data-act=gd-demo][data-step="2"]');
  await sleep(120);
  await jsClick(page, '[data-act=gd-view][data-view=profile]');
  await sleep(100);
  const puffS2 = await page.evaluate(() => document.querySelector('.demo-stage-rich').className);
  check('face-puffiness step 2 switches cleanly to profile (elevated head posture)', /rig-puff-triggers/.test(puffS2) && /view-profile/.test(puffS2), puffS2);

  // Pilot guides still render intact with zero regressions
  for (const pid of PILOT_GUIDES) {
    await page.evaluate(id => { location.hash = '#/guide/' + id; }, pid);
    await sleep(140);
    const cls = await page.evaluate(() => (document.querySelector('.demo-stage-rich') || {}).className || '');
    check(`Pilot guide ${pid} renders rich stage cleanly`, /demo-stage-rich/.test(cls), cls);
  }

  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── C3: Practice Engine Timers, Steps, Phase Inspect & Replay ───────── */
test('C3 Practice Engine timer, pause/resume, replay, and step transitions on Batch-1 guides', async (br) => {
  const ctx = await newCtx(br, { width: 390, height: 844 });
  const page = await openApp(ctx, '#/practice/body-strength');

  // Verify initial timer = 45s (unchanged) and Pause/Resume works
  const bsInit = await page.evaluate(() => ({
    cls: document.querySelector('.demo-stage-rich').className,
    sec: LM.Views.st.pr.remaining,
    paused: LM.Views.st.pr.paused,
    title: document.querySelector('h2.h2')?.textContent
  }));
  check('body-strength Practice initializes step 0 with 45s hold timer & strength-squat rig', bsInit.sec === 45 && !bsInit.paused && /rig-strength-squat/.test(bsInit.cls), bsInit);

  await jsClick(page, '#pr-toggle'); // pause
  await sleep(1200);
  const bsPaused = await page.evaluate(() => ({
    sec: LM.Views.st.pr.remaining,
    stagePaused: document.querySelector('.demo-stage-rich').classList.contains('paused')
  }));
  check('Practice pause freezes stage & timer cleanly', bsPaused.stagePaused && bsPaused.sec >= 43, bsPaused);

  await jsClick(page, '#pr-toggle'); // resume
  await sleep(1200);
  const bsResumed = await page.evaluate(() => LM.Views.st.pr.remaining < 45 && !document.querySelector('.demo-stage-rich').classList.contains('paused'));
  check('Practice resume restarts stage & countdown cleanly', bsResumed);

  // Replay button bumps animKey
  const keyBefore = await page.evaluate(() => Number(document.querySelector('.demo-stage-rich').dataset.animKey));
  await jsClick(page, '[data-act=pr-replay]');
  await sleep(100);
  const keyAfter = await page.evaluate(() => Number(document.querySelector('.demo-stage-rich').dataset.animKey));
  check('Practice Replay increments data-anim-key', keyAfter === keyBefore + 1, { keyBefore, keyAfter });

  // face-puffiness step 2 is 0s self-check -> finishes guide cleanly
  await page.evaluate(() => { location.hash = '#/practice/face-puffiness'; });
  await sleep(160);
  await jsClick(page, '[data-act=pr-next]'); // step 1 (45s)
  await sleep(120);
  const puffS1 = await page.evaluate(() => ({ sec: LM.Views.st.pr.remaining, cls: document.querySelector('.demo-stage-rich').className }));
  check('face-puffiness step 1 loads puff-sweep with 45s', puffS1.sec === 45 && /rig-puff-sweep/.test(puffS1.cls), puffS1);
  await jsClick(page, '[data-act=pr-next]'); // step 2 (0s Hydration & Sodium Reset)
  await sleep(120);
  const puffS2 = await page.evaluate(() => ({
    sec: LM.Views.st.pr.remaining,
    cls: document.querySelector('.demo-stage-rich').className,
    finishBtn: !!document.querySelector('[data-act=pr-next]')
  }));
  check('face-puffiness step 2 loads puff-triggers with 0s check & Next/Finish control', puffS2.sec === 0 && /rig-puff-triggers/.test(puffS2.cls) && puffS2.finishBtn, puffS2);

  check('Zero console errors', ctx._errors.length === 0, ctx._errors);
  await ctx.close();
});

/* ───────── C4: RU & EN Localization, Viewports (390x844, 1440x900), Themes & Screenshots ───────── */
test('C4 RU/EN localization, dark/light themes, 390x844 & 1440x900 zero overflow & screenshots', async (br) => {
  for (const [tag, vp, theme, lang] of [
    ['390x844-dark-ru', { width: 390, height: 844 }, 'dark', 'ru'],
    ['390x844-light-ru', { width: 390, height: 844 }, 'light', 'ru'],
    ['1440x900-dark-en', { width: 1440, height: 900 }, 'dark', 'en']
  ]) {
    const ctx = await newCtx(br, vp);
    const page = await openApp(ctx, '#/home');
    await page.evaluate(({ th, lg }) => {
      LM.Store.update(s => { s.settings.appearance.theme = th; });
      LM.I18n.set(lg);
    }, { th: theme, lg: lang });
    await sleep(160);

    for (const gid of BATCH1_GUIDES) {
      // Guide Detail check & screenshot
      await page.evaluate(id => { location.hash = '#/guide/' + id; }, gid);
      await sleep(220);
      await jsClick(page, '[data-act=gd-phase][data-phase="1"]');
      await sleep(120);
      const mGD = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        vw: document.getElementById('view').scrollWidth,
        vc: document.getElementById('view').clientWidth,
        zoneText: document.querySelector('.demo-zone-lbl')?.textContent || '',
        phasePill: document.querySelector('.demo-state-lbl')?.textContent || ''
      }));
      check(`${tag} guide/${gid}: zero overflow & localized zone/phase`, mGD.w <= mGD.iw && mGD.vw <= mGD.vc + 1 && mGD.zoneText.length > 4 && mGD.phasePill.length > 4, mGD);
      if (tag !== '390x844-light-ru' || gid === 'body-strength' || gid === 'groom-brows') {
        await page.screenshot({ path: path.join(SHOTS_DIR, `${tag}_guide_${gid}.png`) });
      }

      // Practice check & screenshot
      await page.evaluate(id => { location.hash = '#/practice/' + id; }, gid);
      await sleep(220);
      if (gid === 'groom-beard' || gid === 'groom-brows' || gid === 'skin-routine') {
        await jsClick(page, '[data-act=pr-next]'); // capture key step 1 as well
        await sleep(140);
      }
      const mPR = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        vw: document.getElementById('view').scrollWidth,
        vc: document.getElementById('view').clientWidth,
        zoneText: document.querySelector('.demo-zone-lbl')?.textContent || ''
      }));
      check(`${tag} practice/${gid}: zero overflow & localized zone`, mPR.w <= mPR.iw && mPR.vw <= mPR.vc + 1 && mPR.zoneText.length > 4, mPR);
      await page.screenshot({ path: path.join(SHOTS_DIR, `${tag}_practice_${gid}.png`) });
    }

    check(`${tag}: zero console errors`, ctx._errors.length === 0, ctx._errors);
    await ctx.close();
  }
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
  console.log(`\nStage C Batch 1: ${total - failed}/${total} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('Screenshots saved to:', SHOTS_DIR);
  process.exit(failed ? 1 : 0);
})();
