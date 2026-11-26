/* ASCEND — Reference-aligned UI screens across Home, Guides, Progress, Profile, Settings + Practice mode. */
window.LM = window.LM || {};

(function () {
  const E = LM.esc, I = LM.icon, G = () => LM.Game, S = () => LM.Store.get(), T = LM.t;
  const playSVG = '<svg class="i fill" viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg>';
  const pauseSVG = '<svg class="i fill" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  const clockSVG = '<svg class="i" viewBox="0 0 24 24" style="font-size:12px" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  const dowList = () => [0, 1, 2, 3, 4, 5, 6].map(i => T('progress.dow.' + i));

  const GUIDE_PHOTO = {
    'face-jawline': '/assets/cats/face.jpg',
    'face-puffiness': '/assets/cats/health.jpg',
    'face-tongue': '/assets/guides/sleep-linen.jpg',
    'face-smile': '/assets/guides/dental-smile.jpg',
    'skin-sunscreen': '/assets/guides/skincare-spf.jpg',
    'skin-routine': '/assets/cats/skin.jpg',
    'skin-retinoid': '/assets/cats/hair.jpg',
    'skin-acne': '/assets/cats/health.jpg',
    'hair-care': '/assets/cats/hair.jpg',
    'hair-scalp': '/assets/cats/skin.jpg',
    'hair-loss': '/assets/guides/skincare-spf.jpg',
    'hair-style': '/assets/cats/grooming.jpg',
    'body-posture': '/assets/guides/posture-rings.jpg',
    'body-strength': '/assets/cats/body.jpg',
    'body-fat': '/assets/guides/nutrition-bowl.jpg',
    'body-walk': '/assets/guides/running-track.jpg',
    'style-fit': '/assets/cats/style.jpg',
    'style-palette': '/assets/guides/tailor-shirt.jpg',
    'style-proportions': '/assets/cats/body.jpg',
    'style-care': '/assets/guides/running-track.jpg',
    'groom-beard': '/assets/cats/grooming.jpg',
    'groom-brows': '/assets/cats/face.jpg',
    'groom-scent': '/assets/guides/fragrance-wood.jpg',
    'groom-hands': '/assets/cats/skin.jpg',
    'health-sleep': '/assets/guides/sleep-linen.jpg',
    'health-hydration': '/assets/cats/health.jpg',
    'health-smoke': '/assets/guides/running-track.jpg',
    'health-mind': '/assets/guides/nutrition-bowl.jpg'
  };

  const V = LM.Views = {
    st: {
      gf: { q: '', cat: 'all', fav: false, showAll: false, searchOpen: false },
      range: 30,
      histN: 15,
      photos: [],
      cmp: { a: null, b: null },
      revealed: new Set(),
      gdStep: {},
      gdView: {},
      gdPhase: {},
      gdAnimKey: 0,
      pr: null
    },
    fmtClock(sec) {
      const s = Math.max(0, Math.round(sec || 0));
      const m = Math.floor(s / 60), r = s % 60;
      return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
    }
  };

  /* ───────── HOME ───────── */
  V.home = function () {
    const s = S(), pv = LM.progressionView(s.xp), ss = G().streakState();
    const tasks = s.daily.tasks, done = tasks.filter(t => t.done).length;
    const hr = new Date().getHours();
    const greet = hr < 5 ? T('home.greet.night') : hr < 12 ? T('home.greet.morning') : hr < 18 ? T('home.greet.afternoon') : T('home.greet.evening');

    let p;
    if (tasks.length && done === tasks.length) p = T('home.prompt.allDone');
    else if (ss.atRisk) p = T('home.prompt.atRisk', { n: ss.current });
    else if (ss.current === 0 && s.xp === 0) p = T('home.prompt.first');
    else if (ss.current === 0) p = T('home.prompt.newStreak');
    else if (done > 0) p = T('home.prompt.keepGoing');
    else p = T('home.prompt.waiting');

    const taskRows = tasks.map(t => {
      const inner = '<span class="chk">' + I('check') + '</span><span class="grow"><span class="t">' + E(LM.taskTitle(t)) + '</span></span>' +
        (t.kind === 'guide' ? '<span class="t-go">' + I('chevron') + '</span>' : '');
      if (t.kind === 'guide') return '<a class="task link ' + (t.done ? 'done' : '') + '" href="#/guide/' + E(t.id.slice(6)) + '">' + inner + '</a>';
      return '<button class="task ' + (t.done ? 'done' : '') + '" data-act="task" data-id="' + E(t.id) + '" aria-pressed="' + t.done + '">' + inner + '</button>';
    }).join('');

    const lvLeft = pv.isLooksmaxxing
      ? '<a class="lv-link lv-link-tier" href="#/profile"><span class="tier-pill">' + E(pv.primaryLabel) + '</span><span class="lv-sub">' + E(pv.subLabel) + '</span></a>'
      : '<a class="lv-link" href="#/profile">' + E(pv.primaryLabel) + '</a>';

    return '' +
      '<section class="home-hero">' +
        '<img class="home-hero-portrait" src="/assets/avatars/barrett-portrait.png" alt="" aria-hidden="true" onerror="this.remove()">' +
        '<div class="home-hero-canvas" aria-hidden="true"></div>' +
        '<div class="home-hero-top">' +
          '<span class="home-word">ASCEND</span>' +
          '<a class="gearbtn" href="#/settings" aria-label="' + E(T('nav.settings')) + '">' + I('settings') + '</a>' +
        '</div>' +
        '<div class="home-welcome">' +
          '<h1 class="h1 hello">' + E(greet) + ', ' + E(s.profile.nickname) + '.</h1>' +
          '<p class="sub">' + E(p) + '</p>' +
        '</div>' +
      '</section>' +
      '<div class="card level-card">' +
        '<div class="level-top">' +
          lvLeft +
          '<div class="xpline">' + E(pv.xpLine) + '</div>' +
        '</div>' +
        '<div class="bar"><i style="width:' + pv.barPct + '%"></i></div>' +
      '</div>' +
      '<div class="card tasks tasks-focal">' +
        '<div class="top"><b>' + E(T('home.tasksTitle')) + '</b><span class="c">' + done + ' / ' + tasks.length + '</span></div>' +
        '<div class="tasklist">' + taskRows + '</div>' +
        '<a class="btn pill tasks-cta" href="#/tasks">' + E(T('home.viewAllTasks')) + ' ' + I('arrow') + '</a>' +
      '</div>';
  };

  /* ───────── TASKS (Daily Plan + Weekly + GOTD + Topics) ───────── */
  V.tasks = function () {
    const s = S();
    const tasks = s.daily.tasks, done = tasks.filter(t => t.done).length;
    const dow = dowList();
    const days = G().lastDays(7), max = Math.max.apply(null, days.map(d => d.xp).concat([1])), wk = G().weekStats();
    const bars = days.map((d, i) => '<i class="' + (d.xp ? '' : 'z') + (i === 6 ? ' today' : '') + '" style="height:' + Math.max(6, Math.round(d.xp / max * 100)) + '%" title="' + E(dow[d.dow]) + ' ' + d.xp + ' XP"></i>').join('');
    const pctTxt = wk.pct === null ? (wk.xp > 0 ? T('home.new') : '—') : (wk.pct >= 0 ? '+' : '') + wk.pct + '%';
    const wkSub = wk.pct !== null ? (pctTxt + ' ' + T('home.vsLastWeek')) : pctTxt;

    const cats = LM.CATEGORIES.map(c => '<a class="catpill" href="#/guides?cat=' + c.id + '">' + E(LM.catLabel(c)) + '</a>').join('') +
      '<a class="catpill all" href="#/guides">' + E(T('home.allGuides')) + ' ' + I('arrow') + '</a>';

    const g = G().guideById(s.daily.guideId);
    const gotd = g ? '<a class="card gotd" href="#/guide/' + g.id + '"><div class="grow"><div class="k">' + E(T('home.todaysGuide', { cat: LM.catLabel(LM.catById(g.cat)) })) + '</div><div class="n">' + E(LM.guideTitle(g)) + '</div><div class="d">' + E(LM.guideField(g, 'desc')) + '</div></div>' + I('chevron') + '</a>' : '';

    const fullRows = tasks.map(t => {
      const badge = t.kind === 'guide'
        ? '<span class="task-badge">' + E(T('tasks.guideBadge')) + '</span>'
        : '<span class="task-badge xp">' + E(T('tasks.xpBadge', { xp: t.xp })) + '</span>';
      const inner = '<span class="chk">' + I('check') + '</span><span class="grow"><span class="t">' + E(LM.taskTitle(t)) + '</span></span>' + badge +
        (t.kind === 'guide' ? '<span class="t-go">' + I('chevron') + '</span>' : '');
      if (t.kind === 'guide') return '<a class="task task-full link ' + (t.done ? 'done' : '') + '" href="#/guide/' + E(t.id.slice(6)) + '">' + inner + '</a>';
      return '<button class="task task-full ' + (t.done ? 'done' : '') + '" data-act="task" data-id="' + E(t.id) + '" aria-pressed="' + t.done + '">' + inner + '</button>';
    }).join('');

    return '' +
      '<div class="head"><a class="back" href="#/home">' + I('back') + ' ' + E(T('nav.home')) + '</a>' +
        '<h1 class="h1">' + E(T('tasks.title')) + '</h1><p class="sub">' + E(T('tasks.sub')) + '</p></div>' +
      '<div class="home-grid">' +
        '<div class="home-main">' +
          '<div class="card tasks tasks-focal"><div class="top"><b>' + E(T('home.tasksTitle')) + '</b><span class="c">' + done + ' / ' + tasks.length + '</span></div>' +
            '<div class="tasklist tasklist-full">' + fullRows + '</div>' +
            '<a class="btn ghost pill tasks-cta" href="#/progress/history">' + E(T('tasks.historyLink')) + ' ' + I('arrow') + '</a>' +
          '</div>' +
        '</div>' +
        '<div class="home-side">' +
          '<a class="card weekly" href="#/progress"><div class="weekly-hd"><span>' + E(T('home.weeklyActivity')) + '</span><b>+' + LM.fmt(wk.xp) + ' XP</b></div><div class="mini">' + bars + '</div><div class="weekly-ft"><small class="' + (wk.pct > 0 ? 'pos' : '') + '">' + E(wkSub) + '</small><span class="go">' + E(T('home.progress')) + ' ' + I('chevron') + '</span></div></a>' +
          gotd +
        '</div>' +
      '</div>' +
      '<div class="sec"><h3>' + E(T('home.exploreTopics')) + '</h3></div><div class="catpills">' + cats + '</div>';
  };

  /* ───────── GUIDES ───────── */
  function matchGuide(g, q) {
    if (!q) return true;
    const cat = LM.catById(g.cat);
    const hay = (
      LM.guideTitle(g) + ' ' + LM.guideField(g, 'desc') + ' ' + LM.guideField(g, 'improves') + ' ' + LM.catLabel(cat) + ' ' +
      g.title + ' ' + g.desc + ' ' + g.improves + ' ' + cat.label
    ).toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.indexOf(w) >= 0);
  }

  V.guideList = function () {
    const f = V.st.gf, s = S();
    if (f.cat === 'all' && !f.fav && !f.q && !f.showAll) {
      const catCards = LM.CATEGORIES.map(c => {
        const items = LM.GUIDES.filter(g => g.cat === c.id);
        const studiedN = items.filter(g => !!s.studied[g.id]).length;
        return '<button class="card catcard" data-act="gcat" data-cat="' + c.id + '">' +
          '<img class="catcard-img" src="/assets/cats/' + E(c.id) + '.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' +
          '<span class="catcard-scrim" aria-hidden="true"></span>' +
          '<span class="catcard-txt">' +
            '<span class="catcard-t-row"><span class="catcard-t">' + E(LM.catLabel(c)) + '</span><span class="catcard-cnt" title="' + E(T('guides.catMeta', { total: items.length, studied: studiedN })) + '">' + studiedN + '/' + items.length + '</span></span>' +
            '<span class="catcard-s">' + E(LM.catSub(c)) + '</span>' +
          '</span>' +
          '<span class="catcard-r"><span class="catcard-go">' + I('chevron') + '</span></span></button>';
      }).join('');
      const browseCard = '<button class="card catcard catcard-all" data-act="gall">' +
        '<span class="catcard-txt">' +
          '<span class="catcard-t">' + E(T('home.allGuides')) + '</span>' +
          '<span class="catcard-s">' + E(T('guides.browseAll', { n: LM.GUIDES.length })) + '</span>' +
        '</span>' +
        '<span class="catcard-r"><span class="catcard-all-ic">' + I('arrow') + '</span></span></button>';
      return '<div class="catcards">' + catCards + browseCard + '</div>';
    }

    const list = LM.GUIDES.filter(g => (f.cat === 'all' || g.cat === f.cat) && (!f.fav || s.favorites.indexOf(g.id) >= 0) && matchGuide(g, f.q));
    if (!list.length) {
      const resetBtn = (!f.fav || s.favorites.length) ? '<button class="btn sm ghost pill" style="margin-top:14px" data-act="gcat" data-cat="all" data-reset="1">' + E(T('guides.resetFilters')) + '</button>' : '';
      return '<div class="empty"><b>' + E(f.fav && !s.favorites.length ? T('guides.emptyFavTitle') : T('guides.emptySearchTitle')) + '</b>' + E(f.fav && !s.favorites.length ? T('guides.emptyFavBody') : T('guides.emptySearchBody')) + resetBtn + '</div>';
    }
    const backCats = (f.cat !== 'all' || f.showAll || f.fav) && !f.q
      ? '<button class="back guides-back" data-act="gcat" data-cat="all" data-reset="1">' + I('back') + ' ' + E(T('guides.showCategories')) + '</button>'
      : '';
    return backCats + '<div class="glist">' + list.map(g => {
      const fav = s.favorites.indexOf(g.id) >= 0, studied = !!s.studied[g.id];
      const pr = LM.guidePractice(g.id), pStats = LM.PracticeStore.stats(g.id);
      const dur = pr ? pr.durationLabel : T('common.minUnit', { m: 2 });
      const stepCount = pr ? pr.steps.length : g.steps.length;
      const photoSrc = GUIDE_PHOTO[g.id] || ('/assets/cats/' + g.cat + '.jpg');
      return '<div class="card gitem gitem-photo">' +
        '<img class="gitem-img" src="' + E(photoSrc) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' +
        '<span class="gitem-scrim" aria-hidden="true"></span>' +
        '<a class="gitem-link" href="#/guide/' + g.id + '">' +
          '<span class="grow gitem-body">' +
            '<div class="n">' + E(LM.guideTitle(g)) + '</div>' +
            '<div class="d">' + E(LM.guideField(g, 'desc')) + '</div>' +
            '<div class="meta-line"><span class="gitem-dur">' + clockSVG + ' ' + E(dur) + '</span><span aria-hidden="true">·</span><span>' + E(LM.tn('common.step', stepCount)) + '</span><span aria-hidden="true">·</span><span class="' + (g.evidence === 'STRONG' ? 'ev-strong' : '') + '">' + E(LM.evLabel(g.evidence)) + '</span>' +
            (pStats.count > 0 ? '<span aria-hidden="true">·</span><span class="ev-practiced">' + E(T('guides.doneCount', { n: pStats.count })) + '</span>' : '') +
            (studied ? '<span aria-hidden="true">·</span><span class="ev-studied">' + I('check', { size: 11 }) + ' ' + E(T('guides.studiedLabel')) + '</span>' : '') +
            '</div>' +
          '</span>' +
        '</a>' +
        '<button class="favbtn ' + (fav ? 'on' : '') + '" data-act="fav" data-id="' + g.id + '" aria-label="' + E(fav ? T('guides.favRemove') : T('guides.favAdd')) + '" aria-pressed="' + fav + '">' + I('star', { fill: fav }) + '</button>' +
      '</div>';
    }).join('') + '</div>';
  };

  V.guideChips = function () {
    const f = V.st.gf, s = S();
    return '<button class="chip ' + (f.cat === 'all' && !f.fav ? 'on' : '') + '" data-act="gcat" data-cat="all">' + E(T('guides.all')) + '</button>' +
      LM.CATEGORIES.map(c => '<button class="chip ' + (f.cat === c.id ? 'on' : '') + '" data-act="gcat" data-cat="' + c.id + '">' + E(LM.catLabel(c)) + '</button>').join('') +
      '<button class="chip ' + (f.fav ? 'on' : '') + '" data-act="gfav">' + I('star', { size: 12, fill: f.fav }) + ' ' + E(T('guides.saved')) + ' ' + s.favorites.length + '</button>';
  };

  V.guides = function () {
    const isSearchOpen = !!(V.st.gf.searchOpen || V.st.gf.q);
    return '<div class="head row guides-head"><div class="grow"><h1 class="h1">' + E(T('guides.title')) + '</h1></div>' +
      '<button class="iconbtn' + (isSearchOpen ? ' active' : '') + '" data-act="toggle-search" aria-expanded="' + isSearchOpen + '" aria-label="' + E(T('guides.searchAria')) + '">' + I('search') + '</button></div>' +
      '<div class="gsearch-wrap' + (isSearchOpen ? ' open' : '') + '" id="gsearch-wrap"' + (isSearchOpen ? '' : ' hidden') + '>' +
        '<label class="search">' + I('search') + '<input id="gq" type="search" placeholder="' + E(T('guides.searchPlaceholder')) + '" value="' + E(V.st.gf.q) + '" autocomplete="off">' +
          '<button type="button" class="search-clear" id="gq-clear" data-act="clear-search" aria-label="' + E(T('common.close')) + '"' + (V.st.gf.q ? '' : ' hidden') + '>' + I('x', { size: 14 }) + '</button>' +
        '</label>' +
      '</div>' +
      '<div class="chips" id="gchips">' + V.guideChips() + '</div><div id="glist">' + V.guideList() + '</div>';
  };

  /* ───────── GUIDE DETAIL ───────── */
  V.guide = function (id) {
    const g = G().guideById(id), s = S();
    if (!g) return '<a class="back" href="#/guides">' + I('back') + ' ' + E(T('guides.title')) + '</a><div class="empty"><b>' + E(T('guide.notFound')) + '</b>' + E(T('guide.notFoundSub')) + '</div>';
    const fav = s.favorites.indexOf(g.id) >= 0, studiedTs = s.studied[g.id];
    const pr = LM.guidePractice(g.id), pStats = LM.PracticeStore.stats(g.id), resume = LM.PracticeStore.resumeFor(g.id);
    const steps = pr ? pr.steps : [];
    const activeIdx = Math.min(V.st.gdStep[g.id] || 0, Math.max(0, steps.length - 1));
    const curStep = steps[activeIdx] || { title: LM.guideTitle(g), sec: 30, demo: 'box-breath', reps: '', cue: LM.guideField(g, 'desc') };
    const sec = (no, title, body) => '<div class="gsec"><div class="no">' + no + '</div><div><h4>' + E(title) + '</h4>' + body + '</div></div>';

    const startLabel = resume
      ? T('guide.resumePractice', { step: (resume.step + 1), total: steps.length })
      : T('guide.startPractice', { dur: pr ? pr.durationLabel : T('common.minUnit', { m: 2 }) });

    const isRichGuide = !!(curStep.rig && LM.DemoEngine && LM.DemoEngine.hasRich(curStep.rig.id));
    const viewsList = isRichGuide ? LM.DemoEngine.viewsFor(curStep) : ['front'];
    const curView = isRichGuide && LM.DemoEngine.resolveView ? LM.DemoEngine.resolveView(curStep, V.st.gdView[g.id]) : viewsList[0];
    const rawPhase = V.st.gdPhase[g.id];
    const curPhase = (rawPhase === 0 || rawPhase === 1 || rawPhase === 2) ? rawPhase : 'all';
    const stepDurTag = st => {
      if (st.kind === 'reps') return st.reps;
      return st.sec > 0 ? T('common.secShort', { s: st.sec }) : T('guide.selfPaced');
    };
    const demoTabs = steps.map((st, idx) => '<button class="' + (idx === activeIdx ? 'on' : '') + '" data-act="gd-demo" data-id="' + g.id + '" data-step="' + idx + '">' + (idx + 1) + '. ' + E(st.title) + '</button>').join('');
    const stepListHTML = steps.length
      ? steps.map(st => '<li><span><strong class="step-t">' + E(st.title) + '</strong><span class="step-meta">' + E(stepDurTag(st)) + (st.kind !== 'reps' && st.reps ? ' · ' + E(st.reps) : '') + '</span><span class="step-c">' + E(st.cue) + '</span></span></li>').join('')
      : g.steps.map(x => '<li><span>' + E(x) + '</span></li>').join('');

    const stageHTML = isRichGuide
      ? LM.DemoEngine.render(curStep, { view: curView, phase: curPhase, paused: false, animKey: V.st.gdAnimKey })
      : LM.demoSVG(curStep.demo, false);

    const richControlsHTML = isRichGuide ? (
      '<div class="demo-controls-bar">' +
        (viewsList.length > 1
          ? '<div class="demo-angle-seg">' + viewsList.map(vw =>
              '<button type="button" class="' + (vw === curView ? 'on' : '') + '" data-act="gd-view" data-id="' + g.id + '" data-view="' + vw + '">' + E(T(vw === 'front' ? 'demo.viewFront' : 'demo.viewProfile')) + '</button>'
            ).join('') + '</div>'
          : '<span></span>') +
        '<button type="button" class="demo-replay-btn" data-act="gd-replay" data-id="' + g.id + '">' + I('refresh', { size: 13 }) + ' ' + E(T('demo.replay')) + '</button>' +
      '</div>' +
      (curStep.phases && curStep.phases.length
        ? '<div class="demo-phases">' +
            '<button type="button" class="' + (curPhase === 'all' ? 'on' : '') + '" data-act="gd-phase" data-id="' + g.id + '" data-phase="all">' + E(T('demo.phaseAll')) + '</button>' +
            curStep.phases.map((ph, pi) =>
              '<button type="button" class="' + (curPhase === pi ? 'on' : '') + '" data-act="gd-phase" data-id="' + g.id + '" data-phase="' + pi + '">' + E(ph) + '</button>'
            ).join('') +
          '</div>'
        : '')
    ) : '';

    const phaseBadgeHTML = (isRichGuide && curPhase !== 'all' && curStep.phases && curStep.phases[curPhase])
      ? '<div class="pr-phase-active">' + E(T('demo.activePhase')) + ': <b>' + E(curStep.phases[curPhase]) + '</b></div>'
      : '';

    return '' +
      '<div class="gd-top"><a class="back" href="#/guides' + (V.st.gf.cat !== 'all' ? '?cat=' + V.st.gf.cat : '') + '">' + I('back') + ' ' + E(LM.catLabel(LM.catById(g.cat))) + '</a>' +
      '<button class="favbtn ' + (fav ? 'on' : '') + '" data-act="fav" data-id="' + g.id + '" aria-label="' + E(fav ? T('guides.favRemove') : T('guides.favAdd')) + '" aria-pressed="' + fav + '">' + I('star', { fill: fav, size: 22 }) + '</button></div>' +
      '<div class="gd-layout">' +
        '<div class="gd-head">' +
          '<h1 class="gd-title">' + E(LM.guideTitle(g)) + '</h1><p class="sub" style="margin:0 0 4px">' + E(LM.guideField(g, 'desc')) + '</p>' +
          '<div class="strip"><div><div class="k">' + E(T('guide.eff')) + '</div>' + LM.pips(g.eff) + '</div><div><div class="k">' + E(T('guide.evidence')) + '</div><div class="v">' + E(LM.evLabel(g.evidence)) + '</div></div>' +
          '<div><div class="k">' + E(T('guide.practice')) + '</div><div class="v sm">' + E((pr ? pr.durationLabel : T('common.minUnit', { m: 2 })) + ' · ' + LM.tn('common.step', steps.length)) + '</div></div><div><div class="k">' + E(T('guide.frequency')) + '</div><div class="v sm">' + E(LM.guideField(g, 'frequency')) + '</div></div></div>' +
          '<div class="ev">' + E(LM.evNote(g.evidence)) + (pStats.count > 0 ? '<div class="gd-practiced">' + E(T('guide.completedLocally')) + '<b>' + E(LM.tn('common.session', pStats.count)) + '</b></div>' : '') + '</div>' +
          '<button class="btn pill gd-start-btn" data-act="practice-start" data-id="' + g.id + '">' + playSVG + ' ' + E(startLabel) + '</button>' +
        '</div>' +
        '<div class="gd-body">' +
          '<div class="card gd-demo-card' + (isRichGuide ? ' is-rich' : '') + '">' +
            '<div class="gd-demo-hd"><div><div class="gd-demo-k">' + E(T('guide.demoTitle')) + '</div><div class="gd-demo-m">' + E(pr ? pr.mode : '') + '</div></div><span class="tag">' + E(stepDurTag(curStep) + (curStep.kind !== 'reps' && curStep.reps ? ' · ' + curStep.reps : '')) + '</span></div>' +
            stageHTML +
            richControlsHTML +
            '<div class="gd-demo-cap">' + phaseBadgeHTML + '<div class="gd-demo-st">' + (activeIdx + 1) + '/' + steps.length + ' · ' + E(curStep.title) + '</div><p>' + E(curStep.cue) + '</p></div>' +
            '<div class="gd-demo-tabs" role="tablist" aria-label="' + E(T('guide.demoTabsAria')) + '">' + demoTabs + '</div>' +
          '</div>' +
          sec('01', T('guide.sec01'), '<p>' + E(LM.guideField(g, 'improves')) + '</p>') +
          sec('02', T('guide.sec02'), '<p>' + E(LM.guideField(g, 'mechanism')) + '</p>') +
          sec('03', T('guide.sec03'), '<ol class="steps">' + stepListHTML + '</ol>') +
          sec('04', T('guide.sec04'), '<p>' + E(LM.guideField(g, 'frequency')) + '</p>') +
          sec('05', T('guide.sec05'), '<p>' + E(LM.guideField(g, 'timeline')) + '</p>') +
          '<div class="warn"><h4>' + I('warning') + ' ' + E(T('guide.risksTitle')) + '</h4><p>' + E(LM.guideField(g, 'risks')) + '</p></div>' +
          '<div style="margin-top:18px">' + (studiedTs
            ? '<div class="btn ghost pill" style="cursor:default">' + I('check') + ' ' + E(T('guide.studiedOn', { date: LM.dateLabel(G().dateKey(new Date(studiedTs))) })) + '</div>'
            : '<button class="btn ghost pill" data-act="study" data-id="' + g.id + '">' + E(T('guide.markStudied')) + '</button>') + '</div>' +
          '<p class="fine">' + E(T('guide.disclaimer')) + '</p>' +
        '</div>' +
      '</div>';
  };

  /* ───────── INTERACTIVE PRACTICE EXECUTION ───────── */
  V.practice = function (id) {
    const g = G().guideById(id), s = S();
    const pr = LM.guidePractice(id);
    if (!g || !pr) {
      return '<a class="back" href="#/guides">' + I('back') + ' ' + E(T('guides.title')) + '</a><div class="empty"><b>' + E(T('practice.notFound')) + '</b>' + E(T('practice.notFoundSub')) + '</div>';
    }
    const firstStep = pr.steps[0];
    const st = V.st.pr && V.st.pr.id === id ? V.st.pr : {
      id: id,
      step: 0,
      total: firstStep.kind === 'reps' ? 0 : firstStep.sec,
      remaining: firstStep.kind === 'reps' ? 0 : firstStep.sec,
      paused: false,
      done: false,
      elapsed: 0,
      view: (LM.DemoEngine && LM.DemoEngine.defaultViewFor ? LM.DemoEngine.defaultViewFor(firstStep) : ((firstStep.rig && firstStep.rig.views && firstStep.rig.views[0]) || 'front')),
      phase: 'all',
      animKey: 0,
      repSet: 1,
      repCount: 0
    };
    const steps = pr.steps;
    const stats = LM.PracticeStore.stats(id);

    if (st.done) {
      const studiedTs = s.studied[g.id];
      return '' +
        '<div class="practice-wrap">' +
          '<div class="pr-top"><a class="back" href="#/guide/' + g.id + '">' + I('back') + ' ' + E(T('practice.backToGuide')) + '</a><span class="pr-step-pill">' + E(T('practice.completedPill')) + '</span></div>' +
          '<div class="card pr-done-card">' +
            '<div class="pr-done-ic">' + I('check') + '</div>' +
            '<h1 class="h1">' + E(T('practice.completeTitle')) + '</h1>' +
            '<p class="sub">' + E(LM.guideTitle(g)) + '</p>' +
            '<div class="trio pr-done-trio">' +
              '<div><div class="v">' + E(V.fmtClock(st.elapsed)) + '</div><div class="k">' + E(T('practice.sessionTime')) + '</div></div>' +
              '<div><div class="v">' + steps.length + '/' + steps.length + '</div><div class="k">' + E(T('practice.stepsDone')) + '</div></div>' +
              '<div><div class="v">' + stats.count + '</div><div class="k">' + E(T('practice.totalSessions')) + '</div></div>' +
            '</div>' +
            '<p class="note" style="margin:14px 0 18px">' + E(T('practice.completeNote')) + '</p>' +
            '<div class="stack">' +
              (studiedTs
                ? '<div class="btn ghost pill" style="cursor:default">' + I('check') + ' ' + E(T('guide.studiedOn', { date: LM.dateLabel(G().dateKey(new Date(studiedTs))) })) + '</div>'
                : '<button class="btn pill" data-act="study" data-id="' + g.id + '">' + E(T('guide.markStudied')) + '</button>') +
              '<button class="btn ghost pill" data-act="pr-restart" data-id="' + g.id + '">' + I('refresh') + ' ' + E(T('practice.again')) + '</button>' +
              '<a class="btn ghost pill" href="#/guide/' + g.id + '">' + E(T('practice.backToGuide')) + '</a>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    const idx = Math.max(0, Math.min(st.step, steps.length - 1));
    const step = steps[idx];
    const isRich = !!(step.rig && LM.DemoEngine && LM.DemoEngine.hasRich(step.rig.id));
    const segs = steps.map((_, i) => '<i class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '"></i>').join('');

    /* ─── Unified Practice Screen (shared layout for face-jawline, 3 pilot guides, and fallback guides) ─── */
    const viewsList = isRich ? LM.DemoEngine.viewsFor(step) : ['front'];
    const curView = isRich && LM.DemoEngine.resolveView ? LM.DemoEngine.resolveView(step, st.view) : (viewsList.indexOf(st.view) >= 0 ? st.view : viewsList[0]);
    const curPhase = st.phase === 0 || st.phase === 1 || st.phase === 2 ? st.phase : 'all';
    const stageHTML = isRich
      ? LM.DemoEngine.render(step, { view: curView, phase: curPhase, paused: st.paused, animKey: st.animKey })
      : LM.demoSVG(step.demo, st.paused);

    const isReps = step.kind === 'reps';
    const isTimed = !isReps && step.sec > 0;
    const setsTotal = Math.max(1, step.sets || 1);
    const repSet = Math.max(1, Math.min(st.repSet || 1, setsTotal));
    const repTarget = Math.max(1, step.repsTarget || 1);
    const repCount = Math.max(0, Math.min(st.repCount || 0, repTarget));
    const setDone = repCount >= repTarget;
    const allSetsDone = repSet >= setsTotal && setDone;
    const repPct = Math.round((repCount / repTarget) * 100);

    let interactiveCard = '';
    if (isReps) {
      const dots = setsTotal > 1
        ? '<div class="pr-set-dots">' + Array.from({ length: setsTotal }, (_, si) =>
            '<span class="' + (si + 1 < repSet || (si + 1 === repSet && setDone) ? 'done' : si + 1 === repSet ? 'cur' : '') + '"></span>'
          ).join('') + '</div>'
        : '';
      const repStatus = allSetsDone
        ? T('practice.repsDoneStatus')
        : setDone
          ? T('practice.setCompleteStatus')
          : T('practice.repsActiveStatus');

      interactiveCard =
        '<div class="card pr-rep-card' + (allSetsDone ? ' ready' : '') + '">' +
          '<div class="pr-rep-hd">' +
            (setsTotal > 1 ? '<span class="pr-set-lbl">' + E(T('practice.setOf', { cur: repSet, total: setsTotal })) + '</span>' : '<span class="pr-set-lbl">' + E(step.reps) + '</span>') +
            dots +
          '</div>' +
          '<div class="pr-rep-main">' +
            '<div class="pr-rep-count" id="pr-rep-count"><span class="cur">' + repCount + '</span><span class="sep">/</span><span class="max">' + repTarget + '</span></div>' +
            '<div class="grow">' +
              '<div class="pr-status" id="pr-status">' + E(repStatus) + '</div>' +
              '<div class="bar pr-bar-track"><i style="width:' + repPct + '%"></i></div>' +
            '</div>' +
          '</div>' +
          '<div class="pr-rep-actions">' +
            (setDone && repSet < setsTotal
              ? '<button class="btn pill pr-rep-add" data-act="pr-next-set">' + E(T('practice.nextSet')) + ' ' + I('arrow') + '</button>'
              : '<button class="btn pill pr-rep-add" data-act="pr-rep-add"' + (allSetsDone ? ' disabled' : '') + '>' + E(T('practice.addRep')) + '</button>') +
            '<button class="btn ghost pill sm pr-rep-reset" data-act="pr-rep-reset">' + E(T('practice.resetReps')) + '</button>' +
          '</div>' +
        '</div>';
    } else {
      const isReady = isTimed && st.remaining <= 0;
      const pct = isTimed ? Math.max(0, Math.min(100, Math.round(((step.sec - st.remaining) / step.sec) * 100))) : 100;
      const dash = (213.63 * (1 - pct / 100)).toFixed(2);
      const statusText = !isTimed
        ? T('practice.statusSelfPaced')
        : isReady
          ? T('practice.statusReady')
          : st.paused
            ? T('practice.statusPaused')
            : T('practice.statusActive');

      interactiveCard =
        '<div class="card pr-timer-box' + (isReady ? ' ready' : '') + (isTimed ? '' : ' selfpaced') + '">' +
          '<div class="pr-timer-row">' +
            (isTimed
              ? '<div class="pr-ring-wrap"><svg class="pr-ring-svg" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="pr-ring-bg"/><circle id="pr-ring" cx="40" cy="40" r="34" class="pr-ring-fg" stroke-dasharray="213.63" stroke-dashoffset="' + dash + '"/></svg><span id="pr-time" class="pr-time">' + E(V.fmtClock(st.remaining)) + '</span></div>'
              : '<div class="pr-self-badge" id="pr-time">' + E(T('guide.selfPaced')) + '</div>') +
            '<div class="grow"><div class="pr-status" id="pr-status">' + E(statusText) + '</div>' +
              '<div class="bar pr-bar-track"><i id="pr-bar" style="width:' + pct + '%"></i></div>' +
            '</div>' +
          '</div>' +
          (isTimed
            ? '<div class="pr-hold-actions">' +
                '<button class="btn ghost pill pr-toggle-btn" id="pr-toggle" data-act="pr-toggle">' + (st.paused ? playSVG + ' ' + E(T('practice.resume')) : pauseSVG + ' ' + E(T('practice.pause'))) + '</button>' +
                '<button class="iconbtn pr-reset-btn" data-act="pr-reset-step" aria-label="' + E(T('practice.restartTimer')) + '" title="' + E(T('practice.restartTimer')) + '">' + I('refresh') + '</button>' +
              '</div>'
            : '') +
        '</div>';
    }

    const stageControlsHTML = isRich ? (
      '<div class="demo-controls-bar">' +
        (viewsList.length > 1
          ? '<div class="demo-angle-seg">' + viewsList.map(vw =>
              '<button type="button" class="' + (vw === curView ? 'on' : '') + '" data-act="pr-view" data-view="' + vw + '">' + E(T(vw === 'front' ? 'demo.viewFront' : 'demo.viewProfile')) + '</button>'
            ).join('') + '</div>'
          : '<span></span>') +
        '<div class="demo-stage-acts">' +
          '<button type="button" class="demo-replay-btn" data-act="pr-replay">' + I('refresh', { size: 13 }) + ' ' + E(T('demo.replay')) + '</button>' +
          '<button type="button" class="demo-pause-btn" id="pr-demo-pause" data-act="pr-toggle" aria-label="' + E(st.paused ? T('practice.resume') : T('practice.pause')) + '">' + (st.paused ? playSVG : pauseSVG) + '</button>' +
        '</div>' +
      '</div>' +
      (step.phases && step.phases.length
        ? '<div class="demo-phases">' +
            '<button type="button" class="' + (curPhase === 'all' ? 'on' : '') + '" data-act="pr-phase" data-phase="all">' + E(T('demo.phaseAll')) + '</button>' +
            step.phases.map((ph, pi) =>
              '<button type="button" class="' + (curPhase === pi ? 'on' : '') + '" data-act="pr-phase" data-phase="' + pi + '">' + E(ph) + '</button>'
            ).join('') +
          '</div>'
        : '')
    ) : '';

    const activePhaseNote = (isRich && step.phases && step.phases.length)
      ? '<div class="pr-phase-active">' + E(T('demo.activePhase')) + ': <b>' + E(curPhase === 'all' ? T('demo.phaseAll') : step.phases[curPhase]) + '</b></div>'
      : '';

    return '' +
      '<div class="practice-wrap practice-hero">' +
        '<div class="pr-top">' +
          '<button class="back" data-act="pr-exit" data-id="' + g.id + '">' + I('back') + ' ' + E(T('practice.saveExit')) + '</button>' +
          '<div class="pr-top-r">' +
            '<button class="iconbtn pr-risk-btn" data-act="pr-risks" data-id="' + g.id + '" aria-label="' + E(T('practice.risksBtn')) + '" title="' + E(T('practice.risksBtn')) + '">' + I('warning', { size: 17 }) + '</button>' +
            '<span class="pr-step-pill">' + E(T('practice.stepOf', { cur: idx + 1, total: steps.length })) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pr-hd pr-hd-hero"><h1 class="pr-gtitle">' + E(LM.guideTitle(g)) + '</h1><div class="pr-gmode">' + E(pr.mode) + '</div></div>' +
        '<div class="pr-segs" aria-label="' + E(T('practice.stepOf', { cur: idx + 1, total: steps.length })) + '">' + segs + '</div>' +
        '<div class="pr-hero-grid">' +
          '<div class="pr-hero-stage">' +
            '<div class="card pr-stage-card pr-stage-hero">' +
              stageHTML +
              stageControlsHTML +
            '</div>' +
          '</div>' +
          '<div class="pr-hero-panel">' +
            '<div class="card pr-info-card">' +
              activePhaseNote +
              '<div class="pr-step-meta" style="margin-top:0"><h2 class="h2">' + E(step.title) + '</h2><span class="tag solid">' + E(step.reps) + '</span></div>' +
              '<p class="pr-cue">' + E(step.cue) + '</p>' +
            '</div>' +
            interactiveCard +
            '<div class="pr-controls">' +
              '<button class="btn ghost pill sm" data-act="pr-prev"' + (idx === 0 ? ' disabled' : '') + '>' + I('back') + ' ' + E(T('practice.prev')) + '</button>' +
              '<button class="btn pill pr-next-btn" data-act="pr-next">' + (idx >= steps.length - 1 ? I('check') + ' ' + E(T('practice.finish')) : E(T('practice.next')) + ' ' + I('arrow')) + '</button>' +
            '</div>' +
            '<div class="pr-zero-note">' + E(T('practice.zeroXpNote')) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  /* ───────── PROGRESS ───────── */
  function frame(p, o) {
    o = o || {};
    const blur = S().settings.privacy.blurPhotos && !V.st.revealed.has(p.id);
    const act = blur ? 'reveal' : (o.act || 'photo-open');
    const tagLbl = p.label === 'BEFORE' ? T('sheet.photoTagBefore') : p.label === 'AFTER' ? T('sheet.photoTagAfter') : p.label === 'PROGRESS' ? T('sheet.photoTagProg') : p.label;
    return '<button class="frame ' + (blur ? 'blur' : '') + '" data-act="' + act + '" data-id="' + p.id + '"' + (o.slot ? ' data-slot="' + o.slot + '"' : '') + (blur ? ' data-blur-label="' + E(T('progress.tapReveal')) + '"' : '') + ' aria-label="' + E(T('progress.photoAria', { label: tagLbl })) + '"><img alt="" src="' + p.thumb + '">' + (o.cap ? '<span class="cap">' + E(o.cap) + '</span>' : '') + '</button>';
  }

  V.cmpPair = function () {
    const ph = V.st.photos, c = V.st.cmp;
    if (ph.length < 2) return null;
    let a = ph.find(p => p.id === c.a), b = ph.find(p => p.id === c.b);
    if (!a) a = ph[ph.length - 1];
    if (!b) b = ph[0];
    return { a: a, b: b };
  };

  function bucketSeries(n) {
    const raw = G().lastDays(n);
    if (n <= 7) return raw.map(d => ({ key: d.key, xp: d.xp, dow: d.dow, label: LM.dateLabel(d.key) }));
    const bucketSize = n <= 30 ? 3 : n <= 90 ? 9 : 30;
    const out = [];
    for (let i = 0; i < raw.length; i += bucketSize) {
      const slice = raw.slice(i, i + bucketSize);
      const sum = slice.reduce((acc, x) => acc + x.xp, 0);
      const tail = slice[slice.length - 1];
      out.push({ key: tail.key, xp: sum, label: LM.dateLabel(slice[0].key) + ' – ' + LM.dateLabel(tail.key) });
    }
    return out;
  }

  function realTaskRate(s) {
    const today = G().dateKey();
    const dayKeys = new Set(Object.keys(s.days || {}));
    dayKeys.add(today);
    const totalPerDay = Math.max(4, (s.daily && s.daily.tasks ? s.daily.tasks.length : 4));
    const daysSum = Object.values(s.days || {}).reduce((acc, d) => acc + (d.tasks || 0), 0);
    const totalDone = Math.max(daysSum, (s.stats && s.stats.tasks) || 0);
    if (totalDone <= 0) return 0;
    return Math.min(100, Math.round((totalDone / (dayKeys.size * totalPerDay)) * 100));
  }

  function compactXP(xp) {
    if (xp >= 1000) return (xp / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return LM.fmt(xp);
  }

  function habitPeriodPct(s, t, n) {
    const today = G().dateKey();
    const startKey = G().addDays(today, -(n - 1));
    const def = G().taskDef(t.id);
    const doneDays = new Set();
    (s.history || []).forEach(h => {
      if (h.date >= startKey && h.date <= today) {
        if (h.ref === 'task:' + t.id || (h.type === 'task' && (h.title === t.title || (def && h.title === def.title)))) {
          doneDays.add(h.date);
        }
      }
    });
    if (t.done) doneDays.add(today);
    if (!doneDays.size) return 0;
    const activeDays = new Set(doneDays);
    Object.keys(s.days || {}).forEach(k => {
      const r = s.days[k];
      if (k >= startKey && k <= today && r && (r.xp > 0 || r.tasks > 0)) activeDays.add(k);
    });
    return Math.min(100, Math.round((doneDays.size / Math.max(1, activeDays.size)) * 100));
  }

  V.progressPhotos = function () {
    const ph = V.st.photos, pair = V.cmpPair();
    let ba;
    if (pair) {
      const gap = Math.abs(G().diffDays(G().dateKey(new Date(pair.a.ts)), G().dateKey(new Date(pair.b.ts))));
      ba = '<div class="ba">' + frame(pair.a, { act: 'cmp-pick', slot: 'a', cap: T('progress.beforeCap') }) + frame(pair.b, { act: 'cmp-pick', slot: 'b', cap: T('progress.afterCap') }) + '</div><div class="gap">' + E(T('progress.daysApart', { n: gap })) + '</div>';
    } else {
      ba = '<div class="ba"><div class="frame">' + E(T('progress.beforeCap')) + '<br>' + E(ph.length ? T('progress.onePhotoAdded') : T('progress.addPhotoPrompt')) + '</div><div class="frame">' + E(T('progress.afterCap')) + '<br>' + E(ph.length ? T('progress.addOneMore') : T('progress.addPhotoPrompt')) + '</div></div>';
    }
    const grid = '<div class="pgrid"><button class="frame add" data-act="photo-add">' + I('plus') + E(T('progress.addPhoto')) + '</button>' + ph.slice(0, 11).map(p => frame(p)).join('') + '</div>' + (ph.length > 11 ? '<p class="note">' + E(T('progress.showingRecent', { total: ph.length })) + '</p>' : '');

    return '' +
      '<div class="head"><a class="back" href="#/progress">' + I('back') + ' ' + E(T('progress.title')) + '</a>' +
        '<h1 class="h1">' + E(T('progress.subPhotosTitle')) + '</h1></div>' +
      '<div class="sec" id="photos" style="margin-top:6px"><h3>' + E(T('progress.beforeAfter')) + '</h3></div>' + ba +
      '<div class="sec"><h3>' + E(T('progress.yourPhotos')) + '</h3><span class="mono dim">' + I('lock', { size: 12 }) + ' ' + E(T('progress.deviceOnly')) + '</span></div>' + grid +
      '<p class="note">' + E(T('progress.photoTip')) + '</p>';
  };

  V.progressHistory = function () {
    const s = S(), wk = G().weekStats(), today = G().dateKey(), tRec = s.days[today] || { xp: 0 };
    const hist = s.history.slice(0, V.st.histN);
    let hh = '', lastDay = '';
    hist.forEach(h => {
      if (h.date !== lastDay) { hh += '<div class="hist-day">' + E(LM.dateLabel(h.date)) + '</div>'; lastDay = h.date; }
      const ic = { task: 'check', guide: 'book', bonus: 'bolt', photo: 'camera' }[h.type] || 'check';
      hh += '<div class="hist"><span class="ic">' + I(ic) + '</span><span class="grow t">' + E(LM.historyTitle(h)) + '</span><span class="xp">+' + h.xp + '</span></div>';
    });
    if (!hist.length) hh = '<div class="empty" style="margin-top:0"><b>' + E(T('progress.noHistoryTitle')) + '</b>' + E(T('progress.noHistoryBody')) + '</div>';

    return '' +
      '<div class="head"><a class="back" href="#/progress">' + I('back') + ' ' + E(T('progress.title')) + '</a>' +
        '<h1 class="h1">' + E(T('progress.subStatsTitle')) + '</h1></div>' +
      '<div class="trio" style="margin-bottom:18px"><div><div class="v">' + tRec.xp + '</div><div class="k">' + E(T('progress.xpToday')) + '</div></div><div><div class="v">' + LM.fmt(wk.xp) + '</div><div class="k">' + E(T('progress.xp7d')) + '</div></div><div><div class="v">' + s.stats.tasks + '</div><div class="k">' + E(T('progress.tasksDone')) + '</div></div></div>' +
      '<div class="sec" id="history" style="margin-top:6px"><h3>' + E(T('progress.taskHistory')) + '</h3></div>' + hh +
      (s.history.length > V.st.histN ? '<button class="btn ghost pill" style="margin-top:14px" data-act="more-hist">' + E(T('progress.showMore')) + '</button>' : '');
  };

  V.progressMethods = function () {
    const s = S();
    const studied = Object.keys(s.studied).map(id => ({ g: G().guideById(id), ts: s.studied[id] })).filter(x => x.g).sort((a, b) => b.ts - a.ts);
    const methods = studied.length ? studied.map(x => '<a class="mrow" href="#/guide/' + x.g.id + '"><span class="mrow-dot"></span><span class="grow"><div class="t">' + E(LM.guideTitle(x.g)) + '</div><div class="mrow-m">' + E(LM.catLabel(LM.catById(x.g.cat))) + ' · ' + E(LM.dateLabel(G().dateKey(new Date(x.ts)))) + '</div></span>' + I('chevron') + '</a>').join('') : '<div class="empty" style="margin-top:0"><b>' + E(T('progress.noMethodsTitle')) + '</b>' + E(T('progress.noMethodsBody')) + '</div>';
    return '' +
      '<div class="head"><a class="back" href="#/progress">' + I('back') + ' ' + E(T('progress.title')) + '</a>' +
        '<h1 class="h1">' + E(T('progress.subMethodsTitle')) + '</h1></div>' +
      '<div class="sec" id="methods" style="margin-top:6px"><h3>' + E(T('progress.completedMethods', { n: studied.length })) + '</h3></div>' + methods;
  };

  V.progress = function (sub) {
    if (sub === 'photos') return V.progressPhotos();
    if (sub === 'history') return V.progressHistory();
    if (sub === 'methods') return V.progressMethods();

    const s = S(), pv = LM.progressionView(s.xp), ss = G().streakState();
    const n = [7, 30, 90, 365].indexOf(V.st.range) >= 0 ? V.st.range : 30;
    const series = bucketSeries(n);
    const curPeriodXp = series.reduce((acc, d) => acc + d.xp, 0);
    const prevPeriodXp = G().lastDays(n, n).reduce((acc, d) => acc + d.xp, 0);
    const hasActivity = series.some(d => d.xp > 0);
    const chart = LM.trendChartSVG(series);
    const deltaPct = prevPeriodXp > 0 ? Math.round(((curPeriodXp - prevPeriodXp) / prevPeriodXp) * 100) : null;

    let trendTag;
    if (!hasActivity && s.xp === 0) {
      trendTag = '<span class="xpdelta">' + E(T('progress.noChartEmpty')) + '</span>';
    } else if (deltaPct !== null) {
      trendTag = '<span class="xpdelta ' + (deltaPct > 0 ? 'pos' : '') + '">' + (deltaPct > 0 ? '↑ +' : '') + deltaPct + '% ' + E(T('progress.vsPrevPeriod')) + '</span>';
    } else {
      trendTag = '<span class="xpdelta">' + E(T('progress.xpRangeTag', { xp: LM.fmt(curPeriodXp), n: n })) + '</span>';
    }

    const habitTasks = (s.daily.tasks || []).filter(t => t.kind !== 'guide');
    const hDone = habitTasks.filter(t => t.done).length;
    const catIcon = { face: 'bolt', skin: 'droplet', hair: 'star', body: 'flame', style: 'crown', grooming: 'check', health: 'moon' };
    const habitRows = habitTasks.map(t => {
      const pct = habitPeriodPct(s, t, n);
      const ic = catIcon[t.cat] || 'check';
      const inner = '<span class="hab-ic-open">' + I(ic) + '</span>' +
        '<span class="grow"><span class="hab-t">' + E(LM.taskTitle(t)) + '</span><span class="bar hab-bar"><i style="width:' + pct + '%"></i></span></span>' +
        '<span class="chk">' + I('check') + '</span>';
      return '<button class="hab-row ' + (t.done ? 'done' : '') + '" data-act="task" data-id="' + E(t.id) + '" aria-pressed="' + t.done + '">' + inner + '</button>';
    }).join('');

    const unlocked = LM.ACHIEVEMENTS.filter(a => s.achievements[a.id]).length;
    const studiedCount = Object.keys(s.studied).filter(id => !!G().guideById(id)).length;
    const streakUnit = LM.tn('common.day', ss.current).replace(String(ss.current), '').trim();

    const subRow = (icon, label, href, act) =>
      (href ? '<a class="lrow" href="' + href + '">' : '<button class="lrow" data-act="' + act + '">') +
        '<span class="ic">' + I(icon) + '</span>' +
        '<span class="grow"><div class="t">' + E(label) + '</div></span>' +
        '<span class="go">' + I('chevron') + '</span>' +
      (href ? '</a>' : '</button>');

    return '' +
      '<div class="head prog-head"><h1 class="h1">' + E(T('progress.title')) + '</h1></div>' +
      '<div class="prog-seg-row">' +
        '<div class="seg prog-seg">' +
          '<button class="' + (n === 7 ? 'on' : '') + '" data-act="range" data-n="7">' + E(T('progress.range7')) + '</button>' +
          '<button class="' + (n === 30 ? 'on' : '') + '" data-act="range" data-n="30">' + E(T('progress.range30')) + '</button>' +
          '<button class="' + (n === 90 ? 'on' : '') + '" data-act="range" data-n="90">' + E(T('progress.range90')) + '</button>' +
          '<button class="' + (n === 365 ? 'on' : '') + '" data-act="range" data-n="365">' + E(T('progress.range365')) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="prog-grid">' +
        '<div class="prog-main">' +
          '<div class="card xpcard">' +
            '<div class="xpcard-hd"><div><div class="xpcard-k">' + E(T('progress.totalXp')) + '</div><div class="big">' + LM.fmt(s.xp) + '</div>' + trendTag + '</div></div>' +
            chart +
          '</div>' +
          '<div class="duo">' +
            '<div class="card stat"><div class="stat-k">' + E(T('progress.streak')) + '</div><div class="stat-val"><span class="fl">' + I('flame', { fill: true }) + '</span><span class="v">' + ss.current + '</span><span class="u">' + E(streakUnit) + '</span></div></div>' +
            '<div class="card stat"><div class="stat-k">' + E(pv.statLabel) + '</div><div class="stat-val">' + LM.hexHTML({ icon: 'trophy' }, true, 'xs') + '<span class="v' + (pv.isLooksmaxxing ? ' tier-v' : '') + '">' + E(pv.statValue) + '</span></div>' + (pv.isLooksmaxxing && pv.subLabel ? '<div class="stat-sub">' + E(pv.subLabel) + '</div>' : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="prog-side">' +
          '<div class="sec prog-hab-hd"><h3>' + E(T('progress.habits')) + '</h3><span class="c">' + hDone + ' / ' + habitTasks.length + '</span></div>' +
          '<div class="card habits-card">' + habitRows + '</div>' +
          '<div class="card flush prog-links">' +
            subRow('camera', T('progress.addPhoto'), null, 'photo-add') +
            subRow('image', T('progress.photosLink', { n: V.st.photos.length }), '#/progress/photos') +
            subRow('activity', T('progress.historyLink'), '#/progress/history') +
            subRow('trophy', T('progress.achLink', { unlocked: unlocked, total: LM.ACHIEVEMENTS.length }), null, 'ach-all') +
            subRow('book', T('progress.methodsLink', { n: studiedCount }), '#/progress/methods') +
          '</div>' +
        '</div>' +
      '</div>';
  };

  /* ───────── PROFILE ───────── */
  V.profile = function () {
    const s = S(), pv = LM.progressionView(s.xp), li = pv.li, ss = G().streakState();
    const rate = realTaskRate(s);
    const achs = LM.ACHIEVEMENTS.slice().sort((a, b) => (s.achievements[b.id] ? 1 : 0) - (s.achievements[a.id] ? 1 : 0));
    const unlocked = LM.ACHIEVEMENTS.filter(a => s.achievements[a.id]).length;
    const hexes = achs.slice(0, 5).map(a => '<button data-act="ach" data-id="' + a.id + '" aria-label="' + E(LM.achName(a)) + '">' + LM.hexHTML(a, !!s.achievements[a.id]) + '</button>').join('');
    const since = G().dateKey(new Date(s.createdAt));
    const row = (icon, t, href, act, k) => (href ? '<a class="lrow" href="' + href + '">' : '<button class="lrow" data-act="' + act + '"' + (k ? ' data-k="' + k + '"' : '') + '>') + '<span class="ic">' + I(icon) + '</span><span class="grow"><div class="t">' + E(t) + '</div></span><span class="go">' + I('chevron') + '</span>' + (href ? '</a>' : '</button>');
    const pfMeta = pv.isLooksmaxxing
      ? '<span class="tier-pill">' + E(pv.primaryLabel) + '</span> · ' + E(T('profile.meta', { level: li.level, xp: LM.fmt(s.xp) }))
      : E(T('profile.meta', { level: li.level, xp: LM.fmt(s.xp) }));
    return '' +
      '<div class="head row"><div class="grow"><h1 class="h1">' + E(T('profile.title')) + '</h1></div><a class="gearbtn" href="#/settings" aria-label="' + E(T('nav.settings')) + '">' + I('settings') + '</a></div>' +
      '<div class="pf-hero">' +
        '<div class="avatar-ring solid-ring">' + LM.avatarHTML('lg') + '</div>' +
        '<div class="pf-name-row"><div class="nm">' + E(s.profile.nickname) + '</div><button class="edit-inline" data-act="open-setting" data-k="nick" aria-label="' + E(T('profile.editAria')) + '">' + I('pencil') + '</button></div>' +
        '<div class="meta">' + pfMeta + '</div>' +
        '<div class="bar pf-bar"><i style="width:' + pv.barPct + '%"></i></div>' +
      '</div>' +
      '<div class="pf-stats-3">' +
        '<div class="card pf-stat-c"><div class="v">' + ss.current + '</div><div class="k">' + E(T('profile.dayStreak')) + '</div></div>' +
        '<div class="card pf-stat-c"><div class="v">' + rate + '%</div><div class="k">' + E(T('profile.taskRate')) + '</div></div>' +
        '<div class="card pf-stat-c"><div class="v">' + E(compactXP(s.xp)) + '</div><div class="k">' + E(T('profile.totalXp')) + '</div></div>' +
      '</div>' +
      '<div class="pf-grid">' +
        '<div class="card flush pf-links">' +
          row('trophy', T('profile.ach'), null, 'ach-all') +
          row('progress', T('profile.overview'), '#/progress') +
          row('book', T('profile.history'), '#/progress/history') +
          row('star', T('profile.favs'), '#/guides?fav=1') +
          row('image', T('profile.photos'), '#/progress/photos') +
          row('info', T('profile.about'), null, 'open-setting', 'about') +
        '</div>' +
        '<div class="pf-quote-slot" aria-label="ASCEND">' +
          '<p class="pf-quote-placeholder">' + E(T('profile.privacyNote')) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="pf-fold">' +
        '<div class="sec"><h3>' + E(T('profile.ach')) + ' (' + unlocked + ')</h3><button class="link" data-act="ach-all">' + E(T('progress.seeAll')) + ' ' + I('arrow') + '</button></div><div class="hexrow">' + hexes + '</div>' +
        '<div class="sec"><h3>' + E(T('profile.yourStats')) + '</h3></div>' +
        '<div class="statgrid"><div class="card"><div class="v">' + s.stats.tasks + '</div><div class="k">' + E(T('profile.statTasks')) + '</div></div><div class="card"><div class="v">' + s.stats.guides + '</div><div class="k">' + E(T('profile.statGuides')) + '</div></div><div class="card"><div class="v">' + V.st.photos.length + '</div><div class="k">' + E(T('profile.statPhotos')) + '</div></div><div class="card"><div class="v">' + E(LM.dateLabel(since)) + '</div><div class="k">' + E(T('profile.statStarted')) + '</div></div></div>' +
      '</div>';
  };

  /* ───────── SETTINGS ───────── */
  V.settings = function () {
    const s = S(), a = s.settings.appearance;
    const curLang = LM.I18n.lang();
    const isDark = a.theme !== 'light';
    const progMode = LM.progressionMode();
    const progSub = progMode === 'looksmaxxing' ? T('settings.progLooksmaxxingSub') : T('settings.progStandardSub');
    const row = (icon, t, k, extra) => '<button class="lrow" data-act="open-setting" data-k="' + k + '"><span class="ic">' + I(icon) + '</span><span class="grow"><div class="t">' + E(t) + (extra || '') + '</div></span><span class="go">' + I('chevron') + '</span></button>';
    return '' +
      '<div class="head settings-hd"><a class="backbtn" href="#/profile" aria-label="' + E(T('common.back')) + '">' + I('back') + '</a><h1 class="h1">' + E(T('settings.title')) + '</h1></div>' +
      '<div class="settings-list">' +
        '<div class="set-sec">' +
          '<div class="set-sec-hd"><span>' + E(T('settings.language')) + '</span><button class="lang-pill-link" data-act="open-setting" data-k="lang">' + E(T('lang.' + curLang)) + ' ' + I('chevron') + '</button></div>' +
          '<div class="seg-cards">' +
            '<button class="' + (curLang === 'ru' ? 'on' : '') + '" data-act="quick-lang" data-set-lang="ru" aria-pressed="' + (curLang === 'ru') + '">RU</button>' +
            '<button class="' + (curLang === 'en' ? 'on' : '') + '" data-act="quick-lang" data-set-lang="en" aria-pressed="' + (curLang === 'en') + '">EN</button>' +
          '</div>' +
        '</div>' +
        '<div class="set-sec" id="set-prog">' +
          '<div class="set-sec-hd"><span>' + E(T('settings.progTitle')) + '</span></div>' +
          '<div class="seg-cards">' +
            '<button class="' + (progMode === 'standard' ? 'on' : '') + '" data-act="set-prog-mode" data-mode="standard" aria-pressed="' + (progMode === 'standard') + '">' + E(T('settings.progStandard')) + '</button>' +
            '<button class="' + (progMode === 'looksmaxxing' ? 'on' : '') + '" data-act="set-prog-mode" data-mode="looksmaxxing" aria-pressed="' + (progMode === 'looksmaxxing') + '">' + E(T('settings.progLooksmaxxing')) + '</button>' +
          '</div>' +
          '<p class="set-sec-note">' + E(progSub) + '</p>' +
        '</div>' +
        '<div class="set-sec">' +
          '<div class="set-sec-hd"><span>' + E(T('settings.appearance')) + '</span></div>' +
          '<div class="card flush">' +
            '<div class="lrow look-card">' +
              '<button class="lrow-main" data-act="open-setting" data-k="look"><span class="ic">' + I('moon') + '</span><span class="grow"><div class="t">' + E(T('settings.darkMode')) + '</div></span></button>' +
              '<button class="sw-btn" data-act="toggle-theme" role="switch" aria-checked="' + isDark + '" aria-label="' + E(T('settings.darkMode')) + '"><span class="sw ' + (isDark ? 'on' : '') + '"></span></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card flush" style="margin-top:16px">' +
          row('bell', T('settings.notifications'), 'notif') +
          row('lock', T('settings.privacy'), 'privacy') +
          row('profile', T('settings.accountNick'), 'nick') +
          row('image', T('settings.avatar'), 'avatar') +
        '</div>' +
        '<div class="card flush" style="margin-top:14px">' +
          row('database', T('settings.dataMgmt'), 'data') +
          row('info', T('settings.aboutRowTitle'), 'about', curLang !== 'en' ? '<span class="sr-only"> About ASCEND</span>' : '') +
        '</div>' +
        '<button class="card reset-btn" data-act="open-setting" data-k="reset">' + E(T('settings.resetBtn')) + '</button>' +
      '</div>' +
      (LM.Store.isPersistent() ? '' : '<p class="note">' + E(T('settings.noStorageWarn')) + '</p>');
  };
})();
