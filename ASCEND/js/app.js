/* ASCEND — app bootstrap: router, action handlers, settings sheets, photos, reminders. */
(function () {
  LM.VERSION = '0.4.6-redesign';
  const E = LM.esc, I = LM.icon, V = LM.Views, T = LM.t;
  const view = () => document.getElementById('view');
  const playSVG = '<svg class="i fill" viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg>';
  const pauseSVG = '<svg class="i fill" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

  const NAV = [
    { id: 'home', key: 'nav.home', icon: 'home' },
    { id: 'guides', key: 'nav.guides', icon: 'guides' },
    { id: 'chat', key: 'nav.chat', icon: 'chat' },
    { id: 'progress', key: 'nav.progress', icon: 'progress' },
    { id: 'profile', key: 'nav.profile', icon: 'profile' }
  ];

  const photoTagLabel = l => l === 'BEFORE'
    ? T('sheet.photoTagBefore')
    : l === 'AFTER'
      ? T('sheet.photoTagAfter')
      : l === 'PROGRESS'
        ? T('sheet.photoTagProg')
        : l;

  function syncLangChrome() {
    document.title = T('brand.docTitle');
    const navEl = document.getElementById('nav');
    if (navEl) navEl.setAttribute('aria-label', T('nav.main'));
  }

  /* ───────── interactive practice timer & session lifecycle ───────── */
  let prTickId = null;

  function stopPracticeTick() {
    if (prTickId) { clearInterval(prTickId); prTickId = null; }
  }

  function syncRunningRemaining(st) {
    if (!st || st.done || st.paused || st.total <= 0 || !st.targetEnd) return;
    st.remaining = Math.max(0, Math.ceil((st.targetEnd - Date.now()) / 1000));
  }

  function syncElapsed(st) {
    if (!st || st.paused || st.done || !st.stepStartAt) return;
    const now = Date.now();
    st._elapsedMs = (st._elapsedMs != null ? st._elapsedMs : (st.elapsed || 0) * 1000) + Math.max(0, now - st.stepStartAt);
    st.elapsed = Math.floor(st._elapsedMs / 1000);
    st.stepStartAt = now;
  }

  function pausePracticeState(st) {
    if (!st || st.done || st.paused) return;
    syncRunningRemaining(st);
    syncElapsed(st);
    st.paused = true;
    st.targetEnd = 0;
    st.stepStartAt = 0;
  }

  function resumePracticeState(st) {
    if (!st || st.done || !st.paused) return;
    st.paused = false;
    if (st.total > 0) st.targetEnd = Date.now() + Math.max(0, st.remaining) * 1000;
    st.stepStartAt = Date.now();
  }

  function saveResumeSnapshot() {
    const st = V.st.pr;
    if (!st || st.done) return;
    syncRunningRemaining(st);
    syncElapsed(st);
    LM.PracticeStore.saveResume({
      id: st.id,
      step: st.step,
      remaining: st.remaining,
      elapsed: st.elapsed,
      view: st.view,
      repSet: st.repSet || 1,
      repCount: st.repCount || 0
    });
  }

  function initPractice(id, opts) {
    opts = opts || {};
    const pr = LM.guidePractice(id);
    if (!pr) { V.st.pr = null; return; }
    const resume = opts.fresh ? null : LM.PracticeStore.resumeFor(id);
    if (opts.fresh) LM.PracticeStore.clearResume();
    const stepIdx = resume ? Math.max(0, Math.min(resume.step || 0, pr.steps.length - 1)) : 0;
    const step = pr.steps[stepIdx];
    const isTimed = step.kind !== 'reps' && step.sec > 0;
    const rem = isTimed
      ? (resume && typeof resume.remaining === 'number' ? Math.max(0, Math.min(resume.remaining, step.sec)) : step.sec)
      : 0;
    const initView = (LM.DemoEngine && LM.DemoEngine.resolveView)
      ? LM.DemoEngine.resolveView(step, resume && resume.view)
      : ((step.rig && step.rig.views && step.rig.views[0]) || 'front');
    const initElapsed = resume ? (resume.elapsed || 0) : 0;
    V.st.pr = {
      id: id,
      step: stepIdx,
      total: isTimed ? step.sec : 0,
      remaining: rem,
      paused: false,
      done: false,
      elapsed: initElapsed,
      _elapsedMs: initElapsed * 1000,
      targetEnd: isTimed ? Date.now() + rem * 1000 : 0,
      stepStartAt: Date.now(),
      view: initView,
      phase: 'all',
      animKey: 0,
      repSet: resume && resume.repSet ? Math.max(1, Math.min(resume.repSet, step.sets || 1)) : 1,
      repCount: resume && typeof resume.repCount === 'number' ? Math.max(0, resume.repCount) : 0
    };
  }

  function ensurePractice(id) {
    if (!V.st.pr || V.st.pr.id !== id) initPractice(id, { fresh: false });
  }

  function updatePracticeDOM() {
    const st = V.st.pr;
    if (route.path !== 'practice' || !st || st.done || st.paused || st.total <= 0) return;
    const rem = Math.max(0, Math.ceil((st.targetEnd - Date.now()) / 1000));
    st.remaining = rem;
    const timeEl = document.getElementById('pr-time');
    const barEl = document.getElementById('pr-bar');
    const ringEl = document.getElementById('pr-ring');
    const statusEl = document.getElementById('pr-status');
    const boxEl = document.querySelector('.pr-timer-box');
    const frac = st.total > 0 ? Math.max(0, Math.min(1, (st.total - rem) / st.total)) : 1;
    if (timeEl) timeEl.textContent = V.fmtClock(rem);
    if (barEl) barEl.style.width = Math.round(frac * 100) + '%';
    if (ringEl) ringEl.style.strokeDashoffset = (213.63 * (1 - frac)).toFixed(2);
    if (rem === 0) {
      if (boxEl) boxEl.classList.add('ready');
      if (statusEl) statusEl.textContent = T('practice.statusReady');
    }
  }

  function syncPracticeTick() {
    stopPracticeTick();
    const st = V.st.pr;
    if (route.path === 'practice' && st && !st.done && !st.paused && st.total > 0) {
      prTickId = setInterval(updatePracticeDOM, 250);
    }
  }

  function loadPracticeStep(idx) {
    const st = V.st.pr; if (!st) return;
    const pr = LM.guidePractice(st.id); if (!pr) return;
    syncElapsed(st);
    const nextIdx = Math.max(0, Math.min(idx, pr.steps.length - 1));
    const step = pr.steps[nextIdx];
    const isTimed = step.kind !== 'reps' && step.sec > 0;
    st.step = nextIdx;
    st.total = isTimed ? step.sec : 0;
    st.remaining = isTimed ? step.sec : 0;
    st.paused = false;
    st.done = false;
    st.targetEnd = isTimed ? Date.now() + step.sec * 1000 : 0;
    st.stepStartAt = Date.now();
    st.phase = 'all';
    st.view = (LM.DemoEngine && LM.DemoEngine.resolveView)
      ? LM.DemoEngine.resolveView(step, st.view)
      : ((step.rig && step.rig.views && step.rig.views[0]) || 'front');
    st.repSet = 1;
    st.repCount = 0;
    st.animKey = (st.animKey || 0) + 1;
    LM.PracticeStore.saveResume({
      id: st.id,
      step: st.step,
      remaining: st.remaining,
      elapsed: st.elapsed,
      view: st.view,
      repSet: 1,
      repCount: 0
    });
    rerender();
  }

  function togglePracticePause() {
    const st = V.st.pr;
    if (!st || st.done) return;
    const pr = LM.guidePractice(st.id);
    const step = pr && pr.steps[st.step];
    const hasRichDemo = !!(step && step.rig && LM.DemoEngine && LM.DemoEngine.hasRich(step.rig.id));
    if (st.total <= 0 && !hasRichDemo) return;
    if (st.paused) {
      resumePracticeState(st);
    } else {
      pausePracticeState(st);
      saveResumeSnapshot();
    }
    const stage = document.querySelector('.pr-stage-card .demo-stage');
    if (stage) stage.classList.toggle('paused', st.paused);
    const btn = document.getElementById('pr-toggle');
    if (btn) btn.innerHTML = st.paused ? playSVG + ' ' + E(T('practice.resume')) : pauseSVG + ' ' + E(T('practice.pause'));
    const demoBtn = document.getElementById('pr-demo-pause');
    if (demoBtn) {
      demoBtn.innerHTML = st.paused ? playSVG : pauseSVG;
      demoBtn.setAttribute('aria-label', st.paused ? T('practice.resume') : T('practice.pause'));
    }
    const stateLbl = document.querySelector('.demo-state-lbl');
    if (stateLbl) {
      const hasPhase = st.phase !== 'all' && st.phase !== undefined;
      const phaseTitle = hasPhase
        ? T('demo.phaseInspect', { n: Number(st.phase) + 1 }) + (step && step.phases && step.phases[Number(st.phase)] ? ' · ' + step.phases[Number(st.phase)] : '')
        : '';
      stateLbl.textContent = hasPhase
        ? (st.paused ? phaseTitle + ' · ' + T('practice.statusPaused') : phaseTitle)
        : (st.paused ? T('practice.statusPaused') : T('demo.liveTechnique'));
    }
    const statusEl = document.getElementById('pr-status');
    if (statusEl && st.total > 0) {
      statusEl.textContent = st.remaining <= 0
        ? T('practice.statusReady')
        : st.paused
          ? T('practice.statusPaused')
          : T('practice.statusActive');
    }
    syncPracticeTick();
  }

  function finishPractice() {
    const st = V.st.pr; if (!st) return;
    stopPracticeTick();
    syncElapsed(st);
    st.done = true;
    st.paused = true;
    LM.PracticeStore.recordComplete(st.id, st.elapsed);
    rerender();
  }

  function exitPractice() {
    const st = V.st.pr;
    stopPracticeTick();
    if (st && !st.done) saveResumeSnapshot();
    location.hash = st ? '#/guide/' + st.id : '#/guides';
  }

  /* ───────── router ───────── */
  let route = { path: 'home', arg: null, params: {}, key: '' };

  function parseHash() {
    const raw = (location.hash || '#/home').replace(/^#\/?/, '');
    const qi = raw.indexOf('?');
    const pathPart = qi >= 0 ? raw.slice(0, qi) : raw;
    const params = {};
    if (qi >= 0) raw.slice(qi + 1).split('&').forEach(kv => { const p = kv.split('='); if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    const parts = pathPart.split('/');
    return { path: parts[0] || 'home', arg: parts[1] || null, params: params };
  }

  function renderNav(active) {
    const chatUnread = LM.ChatStore ? LM.ChatStore.totalUnread() : 0;
    document.getElementById('nav').innerHTML = NAV.map(n => {
      const solid = n.id === active && (n.id === 'home' || n.id === 'guides' || n.id === 'chat');
      const badge = (n.id === 'chat' && chatUnread > 0)
        ? '<span class="nav-dot" aria-label="' + E(T('chat.unreadAria', { n: chatUnread })) + '"></span>'
        : '';
      return '<a href="#/' + n.id + '" class="' + (n.id === active ? 'on' : '') + '"' + (n.id === active ? ' aria-current="page"' : '') + '>' + I(n.icon, { fill: solid }) + badge + '<span>' + E(T(n.key)) + '</span></a>';
    }).join('');
  }

  function paint(opts) {
    opts = opts || {};
    syncLangChrome();
    const el = view(), top = el.scrollTop;
    const isThread = route.path === 'chat' && !!(route.arg && LM.ChatStore && LM.ChatStore.isValidThread(route.arg));
    const prevThreadEl = el.querySelector('.chat-thread');
    const sameThread = isThread && prevThreadEl && prevThreadEl.dataset.threadId === route.arg;
    const prevInput = document.getElementById('chat-input');
    const wasFocused = !!(sameThread && prevInput && document.activeElement === prevInput);
    const draftVal = sameThread && prevInput ? prevInput.value : null;
    const draftHeight = sameThread && prevInput ? prevInput.style.height : '';
    const draftSelStart = wasFocused && prevInput ? prevInput.selectionStart : null;
    const draftSelEnd = wasFocused && prevInput ? prevInput.selectionEnd : null;
    const activeEl = document.activeElement;
    const searchFocusId = (activeEl && (activeEl.id === 'chat-thread-q' || activeEl.id === 'chat-global-q')) ? activeEl.id : null;
    const searchSelStart = searchFocusId ? activeEl.selectionStart : null;
    const searchSelEnd = searchFocusId ? activeEl.selectionEnd : null;
    let html, active = route.path;
    switch (route.path) {
      case 'tasks': html = V.tasks(); active = 'home'; break;
      case 'guides': html = V.guides(); break;
      case 'guide': html = V.guide(route.arg); active = 'guides'; break;
      case 'practice': ensurePractice(route.arg); html = V.practice(route.arg); active = 'guides'; break;
      case 'chat':
        if (route.arg) {
          if (LM.ChatStore && LM.ChatStore.isValidThread(route.arg)) LM.ChatStore.markRead(route.arg);
          html = LM.ChatViews ? LM.ChatViews.thread(route.arg) : '';
        } else {
          html = LM.ChatViews ? LM.ChatViews.list() : '';
        }
        active = 'chat';
        break;
      case 'progress': html = V.progress(route.arg); active = 'progress'; break;
      case 'profile': html = V.profile(); break;
      case 'settings': html = V.settings(); break;
      default: html = V.home(); active = 'home'; route.path = 'home';
    }
    el.classList.toggle('view-chat-thread', isThread);
    el.innerHTML = html;
    el.classList.toggle('enter', !!opts.animate);
    renderNav(active);
    syncPracticeTick();
    if (isThread && LM.ChatViews) {
      LM.ChatViews.scrollAfterPaint(route.arg);
      const nextInp = document.getElementById('chat-input');
      if (nextInp && draftVal != null) {
        nextInp.value = draftVal;
        if (draftHeight) nextInp.style.height = draftHeight;
        if (wasFocused) {
          nextInp.focus();
          if (draftSelStart != null && draftSelEnd != null) {
            try { nextInp.setSelectionRange(draftSelStart, draftSelEnd); } catch (e) {}
          }
        }
      }
    } else if (opts.animate) {
      el.scrollTop = 0;
    } else {
      el.scrollTop = top;
    }
    if (searchFocusId) {
      const nextSearch = document.getElementById(searchFocusId);
      if (nextSearch) {
        nextSearch.focus();
        if (searchSelStart != null && searchSelEnd != null) {
          try { nextSearch.setSelectionRange(searchSelStart, searchSelEnd); } catch (e) {}
        }
      }
    }
  }

  function navigate() {
    const r = parseHash();
    if (route.path === 'practice' && r.path !== 'practice') {
      stopPracticeTick();
      if (V.st.pr && !V.st.pr.done) saveResumeSnapshot();
    }
    const prevArg = route.arg;
    const changed = r.path !== route.path || r.arg !== route.arg || JSON.stringify(r.params) !== JSON.stringify(route.params);
    const pathChanged = r.path !== route.path;
    route = r;
    if (r.path === 'guides') {
      const f = V.st.gf;
      if (r.params.cat || r.params.fav) { f.cat = r.params.cat || 'all'; f.fav = !!r.params.fav; f.q = ''; f.showAll = false; f.searchOpen = false; }
      else if (pathChanged) { f.cat = 'all'; f.fav = false; f.q = ''; f.showAll = false; f.searchOpen = false; }
    }
    if (r.path === 'chat' && LM.ChatViews) {
      if (r.arg && LM.ChatViews.st.search.threadId !== r.arg) {
        LM.ChatViews.resetThreadSearch(r.arg);
      } else if (!r.arg && prevArg) {
        LM.ChatViews.resetThreadSearch('');
      }
      LM.ChatViews.setFocusMessage(r.arg && r.params && r.params.focus ? r.params.focus : null);
    }
    LM.Game.ensureToday();
    paint({ animate: changed || pathChanged });
  }

  function rerender() { paint({ animate: false }); }

  /* ───────── global state sync ───────── */
  function applyAppearance() {
    const a = LM.Store.get().settings.appearance, root = document.documentElement;
    root.dataset.theme = a.theme === 'light' ? 'light' : 'dark';
    root.dataset.grain = a.grain ? 'on' : 'off';
    root.dataset.motion = a.reduceMotion ? 'off' : 'on';
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = a.theme === 'light' ? '#f4f4f1' : '#070709';
  }

  async function refreshPhotos() {
    try { V.st.photos = await LM.Photos.list(); } catch (e) { V.st.photos = []; }
  }

  /* ───────── game events -> feedback ───────── */
  let lvlTimer = null;
  let lvlShown = 0;
  LM.Events.on('xp', d => LM.toast('<span class="xpn">+' + d.xp + '</span><span class="tx">XP · ' + E(LM.toastTaskTitle(d.title)) + '</span>', 1500));
  LM.Events.on('taskUndo', d => {
    if (lvlTimer) { clearTimeout(lvlTimer); lvlTimer = null; }
    const curLvl = d && typeof d.level === 'number' ? d.level : LM.Game.levelInfo(LM.Store.get().xp).level;
    if (curLvl < lvlShown) {
      document.querySelectorAll('#app .lvl').forEach(node => node.remove());
      lvlShown = curLvl;
    }
    LM.toast('<span class="tx">' + E(T('toast.taskUndone', { xp: d.xp })) + '</span>', 1500);
  });
  LM.Events.on('studied', () => LM.toast('<span class="tx">' + E(T('guide.studied')) + '</span>', 1400));
  LM.Events.on('perfect', () => LM.toast('<span class="tx">' + E(T('toast.perfect')) + '</span>', 2000));
  LM.Events.on('achievement', a => LM.toast(LM.hexHTML(a, true) + '<span class="tx">' + E(T('toast.ach')) + '<br>' + E(LM.achName(a)) + '</span>', 2600));
  LM.Events.on('levelup', d => {
    if (lvlTimer) { clearTimeout(lvlTimer); lvlTimer = null; }
    lvlTimer = setTimeout(() => {
      lvlTimer = null;
      const cur = LM.Game.levelInfo(LM.Store.get().xp).level;
      if (cur >= d.level) {
        lvlShown = cur;
        LM.showLevelUp(cur);
      }
    }, 700);
  });

  /* ───────── settings sheets ───────── */
  function toggleRow(id, title, sub, on) {
    return '<button class="toggle" id="' + id + '" aria-pressed="' + on + '"><span><div class="t">' + E(title) + '</div>' + (sub ? '<div class="s">' + E(sub) + '</div>' : '') + '</span><span class="sw ' + (on ? 'on' : '') + '"></span></button>';
  }
  function bindToggle(root, id, fn) {
    const b = root.querySelector('#' + id);
    b.addEventListener('click', () => {
      const sw = b.querySelector('.sw'), on = !sw.classList.contains('on');
      sw.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      fn(on);
    });
  }

  const SETTINGS = {
    nick() {
      LM.sheet(T('sheet.nickTitle'), '<label class="field"><span>' + E(T('sheet.nickField')) + '</span><input class="input" id="nk" maxlength="20" autocomplete="off" value="' + E(LM.Store.get().profile.nickname) + '"></label><div id="nk-err"></div><button class="btn" id="nk-save">' + E(T('common.save')) + '</button>', body => {
        const inp = body.querySelector('#nk'), err = body.querySelector('#nk-err');
        const save = () => {
          const v = inp.value.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
          if (v.length < 2) { err.innerHTML = '<div class="err">' + E(T('sheet.nickErr')) + '</div>'; return; }
          LM.Store.update(s => { s.profile.nickname = v; });
          LM.closeSheet();
        };
        body.querySelector('#nk-save').addEventListener('click', save);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
        setTimeout(() => { inp.focus(); inp.select(); }, 250);
      });
    },
    avatar() {
      const s = LM.Store.get();
      LM.sheet(T('sheet.avatarTitle'), '<div style="display:grid;place-items:center;margin-bottom:16px" id="av-prev">' + LM.avatarHTML('xl') + '</div><div class="stack"><label class="btn" style="cursor:pointer">' + I('upload') + ' ' + E(T('sheet.avatarChoose')) + '<input type="file" id="av-file" accept="image/*" hidden></label>' + (s.profile.avatar ? '<button class="btn ghost" id="av-rm">' + E(T('sheet.avatarRemove')) + '</button>' : '') + '</div><div id="av-err"></div><p class="note">' + E(T('sheet.avatarNote')) + '</p>', body => {
        body.querySelector('#av-file').addEventListener('change', async e => {
          const f = e.target.files[0]; if (!f) return;
          try {
            const blob = await LM.resizeImage(f, { max: 192, quality: .85, square: true });
            const url = await LM.blobToDataURL(blob);
            LM.Store.update(st => { st.profile.avatar = url; });
            LM.closeSheet();
          } catch (err) { body.querySelector('#av-err').innerHTML = '<div class="err">' + E(T('sheet.avatarErr')) + '</div>'; }
        });
        const rm = body.querySelector('#av-rm');
        if (rm) rm.addEventListener('click', () => { LM.Store.update(st => { st.profile.avatar = null; }); LM.closeSheet(); });
      });
    },
    look() {
      const a = LM.Store.get().settings.appearance;
      LM.sheet(T('settings.themeSheet'), '<span class="mono dim">' + E(T('settings.themeLabel')) + '</span><div class="seg" style="margin:8px 0 16px"><button data-theme="dark" class="' + (a.theme === 'dark' ? 'on' : '') + '">' + E(T('settings.themeDark')) + '</button><button data-theme="light" class="' + (a.theme === 'light' ? 'on' : '') + '">' + E(T('settings.themeLight')) + '</button></div>' +
        toggleRow('t-grain', T('settings.filmGrain'), T('settings.grainSub'), a.grain) + toggleRow('t-motion', T('settings.reduceMotion'), T('settings.motionSub'), a.reduceMotion), body => {
        body.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => {
          body.querySelectorAll('[data-theme]').forEach(x => x.classList.toggle('on', x === b));
          LM.Store.update(s => { s.settings.appearance.theme = b.dataset.theme; });
        }));
        bindToggle(body, 't-grain', on => LM.Store.update(s => { s.settings.appearance.grain = on; }));
        bindToggle(body, 't-motion', on => LM.Store.update(s => { s.settings.appearance.reduceMotion = on; }));
      });
    },
    notif() {
      const n = LM.Store.get().settings.notifications;
      const supported = 'Notification' in window;
      LM.sheet(T('sheet.notifTitle'), toggleRow('t-notif', T('sheet.notifDaily'), T('sheet.notifDailySub'), n.enabled) +
        '<label class="field" style="margin-top:14px"><span>' + E(T('sheet.notifTime')) + '</span><input type="time" class="input" id="n-time" value="' + E(n.time) + '"></label><div id="n-msg"></div>' +
        '<div class="stack"><button class="btn ghost" id="n-test">' + E(T('sheet.notifTest')) + '</button></div>' +
        '<p class="note">' + E(supported ? T('sheet.notifNote') : T('sheet.notifUnsupported')) + '</p>', body => {
        const msg = body.querySelector('#n-msg');
        bindToggle(body, 't-notif', async on => {
          if (on) {
            if (!supported) { msg.innerHTML = '<div class="err">' + E(T('sheet.notifUnsupported')) + '</div>'; LM.Store.update(s => { s.settings.notifications.enabled = false; }); body.querySelector('#t-notif .sw').classList.remove('on'); return; }
            let perm = Notification.permission;
            if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) {} }
            if (perm !== 'granted') {
              msg.innerHTML = '<div class="err">' + E(T('sheet.notifDenied')) + '</div>';
              body.querySelector('#t-notif .sw').classList.remove('on');
              LM.Store.update(s => { s.settings.notifications.enabled = false; });
              return;
            }
          }
          msg.innerHTML = '';
          LM.Store.update(s => { s.settings.notifications.enabled = on; });
        });
        body.querySelector('#n-time').addEventListener('change', e => { if (e.target.value) LM.Store.update(s => { s.settings.notifications.time = e.target.value; }); });
        body.querySelector('#n-test').addEventListener('click', async () => {
          if (!supported) { msg.innerHTML = '<div class="err">' + E(T('sheet.notifUnsupported')) + '</div>'; return; }
          let perm = Notification.permission;
          if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) {} }
          if (perm === 'granted') { notify('ASCEND', T('sheet.notifTestBody')); msg.innerHTML = ''; }
          else msg.innerHTML = '<div class="err">' + E(T('sheet.notifDenied')) + '</div>';
        });
      });
    },
    privacy() {
      const p = LM.Store.get().settings.privacy;
      LM.sheet(T('sheet.privacyTitle'), toggleRow('t-blur', T('sheet.privacyBlurToggle'), T('sheet.privacyBlurSub'), p.blurPhotos) +
        '<div class="note">' + T('sheet.privacyList') + '</div>', body => {
        bindToggle(body, 't-blur', on => LM.Store.update(s => { s.settings.privacy.blurPhotos = on; }));
      });
    },
    lang() {
      const cur = LM.I18n.lang();
      LM.sheet(T('lang.title'), '<div class="seg" style="margin:8px 0 16px">' + LM.I18n.LANGS.map(l => '<button data-lang="' + l + '" class="' + (l === cur ? 'on' : '') + '">' + E(T('lang.' + l)) + '</button>').join('') + '</div><p class="note">' + E(T('lang.note')) + '</p>', body => {
        body.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { LM.I18n.set(b.dataset.lang); LM.closeSheet(); }));
      });
    },
    data() {
      const cnt = V.st.photos.length, kb = Math.max(1, Math.round(LM.Store.storageEstimate() / 1024));
      const modeKey = !LM.Store.isPersistent() ? 'data.storage.memory' : LM.Store.mode() === 'legacy' ? 'data.storage.legacy' : 'data.storage.local';
      const fmtDT = ts => new Intl.DateTimeFormat(LM.I18n.locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
      const bks = LM.Store.backups.list();
      const bkHtml = bks.length ? bks.map(b => '<div class="kv" data-bkrow="' + E(b.kind) + '"><span>' + E(T('data.autoKind.' + b.kind)) + ' · ' + E(fmtDT(b.ts)) + ' · ' + LM.fmt(b.xp) + ' XP</span><button class="btn ghost" style="width:auto;min-height:0;padding:6px 12px" data-bk="' + E(b.key) + '">' + E(T('data.restore')) + '</button></div>').join('') : '<p class="note">' + E(T('data.autoNone')) + '</p>';
      LM.sheet(T('data.title'), '<div class="kv"><span>' + E(T('data.progress')) + '</span><b>' + kb + ' KB</b></div><div class="kv"><span>' + E(T('data.photos')) + '</span><b id="d-photos">' + cnt + '</b></div><div class="kv"><span>' + E(T('data.storage')) + '</span><b id="d-mode">' + E(T(modeKey)) + '</b></div>' +
        '<div class="stack" style="margin-top:16px"><button class="btn" id="d-exp">' + I('download') + ' ' + E(T('data.export')) + '</button><label class="btn ghost" style="cursor:pointer">' + I('upload') + ' ' + E(T('data.import')) + '<input type="file" id="d-imp" accept="application/json,.json" hidden></label><button class="btn danger" id="d-erase">' + I('trash') + ' ' + E(T('data.erase')) + '</button></div><div id="d-msg"></div>' +
        '<p class="note">' + E(T('data.note')) + '</p>' +
        '<div class="sec" style="margin-top:18px"><h3>' + E(T('data.autoTitle')) + '</h3></div>' + bkHtml + '<p class="note">' + E(T('data.autoNote')) + '</p>', body => {
        const msg = body.querySelector('#d-msg');
        const afterDataChange = async () => {
          await refreshPhotos(); V.st.cmp = { a: null, b: null }; V.st.revealed = new Set();
          if (LM.ChatStore && LM.ChatStore.reload) LM.ChatStore.reload();
          LM.I18n.init(); LM.Game.ensureToday(); applyAppearance(); rerender();
        };
        body.querySelector('#d-exp').addEventListener('click', async () => {
          try {
            const data = await LM.Backup.build();
            LM.download(LM.Backup.filename(), JSON.stringify(data));
            msg.innerHTML = '<div class="note">' + E(T('data.exported')) + '</div>';
          } catch (e) { msg.innerHTML = '<div class="err">' + E(T('data.exportFail', { msg: e.message })) + '</div>'; }
        });
        body.querySelector('#d-imp').addEventListener('change', async e => {
          const f = e.target.files[0]; e.target.value = ''; if (!f) return;
          let parsed;
          try { parsed = LM.Backup.parse(await f.text()); }
          catch (er) { msg.innerHTML = '<div class="err">' + E(er.userMessage || er.message) + '</div>'; return; }
          const ok = await LM.confirm({ title: T('import.title'), text: E(T('import.text', { xp: LM.fmt(parsed.summary.xp), photos: parsed.summary.photos })), ok: T('import.ok') });
          if (!ok) return;
          try {
            await LM.Backup.apply(parsed);
            await afterDataChange();
            LM.toast('<span class="tx">' + E(T('import.done')) + '</span>');
          } catch (er) {
            await afterDataChange();
            LM.toast('<span class="tx">' + E(er.rolledBack ? T('import.rolledBack', { msg: er.message }) : T('import.failed', { msg: er.message })) + '</span>', 4000);
          }
        });
        body.querySelectorAll('[data-bk]').forEach(b => b.addEventListener('click', async () => {
          const key = b.dataset.bk, info = bks.find(x => x.key === key); if (!info) return;
          const ok = await LM.confirm({ title: T('data.restoreTitle'), text: E(T('data.restoreText', { date: fmtDT(info.ts), xp: LM.fmt(info.xp) })), ok: T('data.restoreOk') });
          if (!ok) return;
          try { LM.Store.restoreBackup(key); await afterDataChange(); LM.toast('<span class="tx">' + E(T('data.restored')) + '</span>'); }
          catch (er) { LM.toast('<span class="tx">' + E(T('import.failed', { msg: er.message })) + '</span>', 3500); }
        }));
        body.querySelector('#d-erase').addEventListener('click', async () => {
          const ok = await LM.confirm({ title: T('erase.title'), text: E(T('erase.text')), ok: T('erase.ok'), type: 'ERASE' });
          if (!ok) return;
          await LM.Store.eraseAll(); await afterDataChange();
          LM.toast('<span class="tx">' + E(T('erase.done')) + '</span>');
        });
      });
    },
    reset() {
      LM.sheet(T('reset.title'), '<p>' + E(T('reset.body')) + '</p><div class="stack"><button class="btn danger" id="r-go">' + E(T('reset.go')) + '</button></div>', body => {
        body.querySelector('#r-go').addEventListener('click', async () => {
          const ok = await LM.confirm({ title: T('reset.confirmTitle'), text: E(T('reset.confirmText')), ok: T('reset.ok'), type: 'RESET' });
          if (!ok) return;
          LM.Store.resetProgress(); if (LM.PracticeStore) LM.PracticeStore.reset(); V.st.pr = null;
          LM.Game.ensureToday(); rerender();
          LM.toast('<span class="tx">' + E(T('reset.done')) + '</span>');
        });
      });
    },
    about() {
      LM.sheet('ASCEND', '<p class="mono dim">' + E(T('sheet.aboutVer', { ver: LM.VERSION })) + ' · ' + E(T('brand.slogan')) + '</p><p>' + E(T('sheet.aboutDesc')) + '</p><p class="note">' + E(T('sheet.aboutMed')) + '</p><p class="note">' + E(T('sheet.aboutFonts')) + '</p>');
    }
  };

  /* ───────── photos ───────── */
  function photoAddSheet() {
    LM.sheet(T('sheet.photoAddTitle'), '<img class="preview" id="pp" alt="" hidden><label class="btn ghost" style="cursor:pointer;margin-bottom:14px">' + I('camera') + ' <span id="pp-l">' + E(T('sheet.photoPick')) + '</span><input type="file" id="pf" accept="image/*" hidden></label>' +
      '<span class="mono dim">' + E(T('sheet.photoTag')) + '</span><div class="seg" style="margin:8px 0 14px" id="pl"><button data-l="BEFORE">' + E(T('sheet.photoTagBefore')) + '</button><button data-l="PROGRESS" class="on">' + E(T('sheet.photoTagProg')) + '</button><button data-l="AFTER">' + E(T('sheet.photoTagAfter')) + '</button></div>' +
      '<label class="field"><span>' + E(T('sheet.photoNote')) + '</span><input class="input" id="pn" maxlength="80" placeholder="' + E(T('sheet.photoPlaceholder')) + '"></label><div id="pe"></div><button class="btn" id="ps" disabled>' + E(T('sheet.photoSave')) + '</button>' +
      '<p class="note">' + I('lock', { size: 12 }) + ' ' + E(T('sheet.photoNoteDevice', { xp: LM.XP.photo })) + '</p>', body => {
      let file = null, label = 'PROGRESS';
      const prev = body.querySelector('#pp'), save = body.querySelector('#ps'), err = body.querySelector('#pe');
      body.querySelectorAll('#pl button').forEach(b => b.addEventListener('click', () => { label = b.dataset.l; body.querySelectorAll('#pl button').forEach(x => x.classList.toggle('on', x === b)); }));
      body.querySelector('#pf').addEventListener('change', e => {
        file = e.target.files[0]; if (!file) return;
        const url = URL.createObjectURL(file); prev.src = url; prev.hidden = false; save.disabled = false;
        body.querySelector('#pp-l').textContent = T('sheet.photoPickOther');
      });
      save.addEventListener('click', async () => {
        if (!file) return;
        save.disabled = true; save.textContent = T('sheet.photoSaving'); err.innerHTML = '';
        try {
          const full = await LM.resizeImage(file, { max: 1280, quality: .85 });
          const thumbB = await LM.resizeImage(file, { max: 480, quality: .78 });
          const thumb = await LM.blobToDataURL(thumbB);
          const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          await LM.Photos.add({ id: id, ts: Date.now(), label: label, note: body.querySelector('#pn').value.trim(), thumb: thumb }, full);
          await refreshPhotos();
          LM.closeSheet();
          LM.Game.photoAdded();
        } catch (e) {
          err.innerHTML = '<div class="err">' + E(T('sheet.photoErr', { msg: e.message || T('err.storage') })) + '</div>';
          save.disabled = false; save.textContent = T('sheet.photoSave');
        }
      });
    });
  }

  async function photoViewer(id) {
    const p = V.st.photos.find(x => x.id === id); if (!p) return;
    LM.sheet(photoTagLabel(p.label), '<img class="viewer" id="vi" alt="" src="' + p.thumb + '"><div class="kv"><span>' + E(T('sheet.photoDate')) + '</span><b>' + E(LM.dateLabel(LM.Game.dateKey(new Date(p.ts)))) + '</b></div>' + (p.note ? '<div class="kv"><span>' + E(T('sheet.photoNoteLbl')) + '</span><b>' + E(p.note) + '</b></div>' : '') + '<div class="stack" style="margin-top:14px"><button class="btn danger" id="pd">' + I('trash') + ' ' + E(T('sheet.photoDel')) + '</button></div>', body => {
      LM.Photos.getBlob(id).then(b => { if (b) { const u = URL.createObjectURL(b); const im = body.querySelector('#vi'); if (im) im.src = u; } });
      body.querySelector('#pd').addEventListener('click', async () => {
        const ok = await LM.confirm({ title: T('sheet.photoDelTitle'), text: E(T('sheet.photoDelText')), ok: T('common.delete') });
        if (!ok) return;
        await LM.Photos.remove(id);
        if (V.st.cmp.a === id) V.st.cmp.a = null; if (V.st.cmp.b === id) V.st.cmp.b = null;
        await refreshPhotos(); LM.closeSheet(); rerender();
      });
    });
  }

  function cmpPicker(slot) {
    const ph = V.st.photos;
    LM.sheet(slot === 'a' ? T('sheet.cmpPickA') : T('sheet.cmpPickB'), '<div class="pick">' + ph.map(p => '<button class="frame" data-pick="' + p.id + '"><img alt="" src="' + p.thumb + '" style="' + (LM.Store.get().settings.privacy.blurPhotos ? 'filter:grayscale(1) blur(10px)' : '') + '"><span class="cap">' + E(LM.dateLabel(LM.Game.dateKey(new Date(p.ts)))) + '</span></button>').join('') + '</div>', body => {
      body.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
        V.st.cmp[slot] = b.dataset.pick; LM.closeSheet(); rerender();
      }));
    });
  }

  function achievementsSheet(focusId) {
    const s = LM.Store.get();
    LM.sheet(T('sheet.achTitle'), LM.ACHIEVEMENTS.map(a => {
      const got = s.achievements[a.id], pr = LM.Game.achievementProgress(a);
      return '<div class="ach">' + LM.hexHTML(a, !!got, 'sm') + '<div class="grow"><div class="n" style="' + (focusId === a.id ? 'text-decoration:underline' : '') + '">' + E(LM.achName(a)) + '</div><div class="d">' + E(LM.achDesc(a)) + '</div>' +
        (got ? '<span class="tag solid">' + E(T('progress.unlocked', { date: LM.dateLabel(LM.Game.dateKey(new Date(got))) })) + '</span>' : '<div class="bar" style="height:8px"><i style="width:' + Math.round(pr.cur / pr.goal * 100) + '%"></i></div><div class="mono dim" style="margin-top:5px">' + LM.fmt(pr.cur) + ' / ' + LM.fmt(pr.goal) + '</div>') + '</div></div>';
    }).join(''));
  }

  /* ───────── reminders (works while the page is open) ───────── */
  function notify(title, body) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      new Notification(title, { body: body, icon: undefined, tag: 'ascend' });
    } catch (e) { /* some mobile browsers require a service worker */ }
  }
  function reminderTick() {
    const s = LM.Store.get(), n = s.settings.notifications;
    if (!n.enabled) return;
    const now = new Date(), today = LM.Game.dateKey(now);
    const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (hm < n.time) return;
    if (localStorage.getItem(LM.Store.reminderKey()) === today) return;
    try { localStorage.setItem(LM.Store.reminderKey(), today); } catch (e) {}
    const left = s.daily.tasks.filter(t => !t.done).length;
    if (left > 0) notify('ASCEND', T('sheet.notifLeft', { n: left }));
  }

  /* ───────── action delegation ───────── */
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    switch (act) {
      case 'close-sheet': LM.closeSheet(); break;
      case 'task': LM.Game.toggleTask(id); break;
      case 'study': LM.Game.studyGuide(id); break;
      case 'fav': {
        const now = LM.Game.toggleFavorite(id);
        LM.toast('<span class="tx">' + E(T(now ? 'guides.favAddedToast' : 'guides.favRemovedToast')) + '</span>', 1100);
        break;
      }
      case 'gcat': {
        const nextCat = el.dataset.cat;
        V.st.gf.cat = nextCat;
        V.st.gf.fav = false;
        if (el.dataset.reset) {
          V.st.gf.q = '';
          V.st.gf.showAll = false;
          const gq = document.getElementById('gq'); if (gq) gq.value = '';
          const clr = document.getElementById('gq-clear'); if (clr) clr.hidden = true;
        } else if (nextCat !== 'all') {
          V.st.gf.showAll = false;
        }
        refreshGuides();
        break;
      }
      case 'gall': V.st.gf.showAll = !V.st.gf.showAll; refreshGuides(); break;
      case 'gfav': V.st.gf.fav = !V.st.gf.fav; if (V.st.gf.fav) { V.st.gf.cat = 'all'; V.st.gf.showAll = false; } refreshGuides(); break;
      case 'range': V.st.range = Number(el.dataset.n); rerender(); break;
      case 'more-hist': V.st.histN += 15; rerender(); break;
      case 'open-setting': if (SETTINGS[el.dataset.k]) SETTINGS[el.dataset.k](); break;
      case 'quick-lang': {
        const nextLang = el.dataset.setLang;
        if (nextLang && LM.I18n.LANGS.includes(nextLang) && nextLang !== LM.I18n.lang()) LM.I18n.set(nextLang);
        break;
      }
      case 'toggle-theme': {
        e.stopPropagation();
        LM.Store.update(s => { s.settings.appearance.theme = s.settings.appearance.theme === 'light' ? 'dark' : 'light'; });
        break;
      }
      case 'toggle-search': {
        const wrap = document.getElementById('gsearch-wrap');
        const gq = document.getElementById('gq');
        const clr = document.getElementById('gq-clear');
        const nextOpen = !V.st.gf.searchOpen;
        if (!nextOpen && V.st.gf.q) {
          V.st.gf.q = '';
          if (gq) gq.value = '';
          if (clr) clr.hidden = true;
          refreshGuides();
        }
        V.st.gf.searchOpen = nextOpen;
        el.classList.toggle('active', nextOpen);
        el.setAttribute('aria-expanded', nextOpen);
        if (wrap) {
          wrap.hidden = !nextOpen;
          wrap.classList.toggle('open', nextOpen);
        }
        if (nextOpen && gq) setTimeout(() => gq.focus(), 40);
        break;
      }
      case 'clear-search': {
        V.st.gf.q = '';
        const gq = document.getElementById('gq');
        const clr = document.getElementById('gq-clear');
        if (gq) { gq.value = ''; gq.focus(); }
        if (clr) clr.hidden = true;
        refreshGuides();
        break;
      }
      case 'focus-search': {
        const gq = document.getElementById('gq');
        const wrap = document.getElementById('gsearch-wrap');
        V.st.gf.searchOpen = true;
        if (wrap) { wrap.hidden = false; wrap.classList.add('open'); }
        if (gq) gq.focus();
        break;
      }
      case 'set-prog-mode': {
        LM.setProgressionMode(el.dataset.mode);
        rerender();
        break;
      }
      case 'gd-demo': {
        const gid = id || route.arg;
        if (gid) {
          V.st.gdStep[gid] = Number(el.dataset.step) || 0;
          V.st.gdPhase[gid] = 'all';
          V.st.gdAnimKey = (V.st.gdAnimKey || 0) + 1;
        }
        rerender();
        break;
      }
      case 'gd-view': {
        const gid = id || route.arg;
        if (gid) V.st.gdView[gid] = el.dataset.view || 'front';
        rerender();
        break;
      }
      case 'gd-phase': {
        const gid = id || route.arg;
        if (gid) V.st.gdPhase[gid] = el.dataset.phase === 'all' ? 'all' : Number(el.dataset.phase);
        rerender();
        break;
      }
      case 'gd-replay': {
        const gid = id || route.arg;
        if (gid) V.st.gdPhase[gid] = 'all';
        V.st.gdAnimKey = (V.st.gdAnimKey || 0) + 1;
        rerender();
        break;
      }
      case 'practice-start': {
        initPractice(id, { fresh: false });
        location.hash = '#/practice/' + id;
        break;
      }
      case 'pr-toggle': togglePracticePause(); break;
      case 'pr-view': {
        const st = V.st.pr;
        if (st) {
          syncRunningRemaining(st);
          const pr = LM.guidePractice(st.id);
          const step = pr && pr.steps[st.step];
          st.view = (LM.DemoEngine && LM.DemoEngine.resolveView && step)
            ? LM.DemoEngine.resolveView(step, el.dataset.view)
            : (el.dataset.view || 'front');
          rerender();
        }
        break;
      }
      case 'pr-phase': {
        const st = V.st.pr;
        if (st) {
          syncRunningRemaining(st);
          st.phase = el.dataset.phase === 'all' ? 'all' : Number(el.dataset.phase);
          rerender();
        }
        break;
      }
      case 'pr-replay': {
        const st = V.st.pr;
        if (st) {
          st.phase = 'all';
          if (st.paused) resumePracticeState(st);
          else syncRunningRemaining(st);
          st.animKey = (st.animKey || 0) + 1;
          rerender();
        }
        break;
      }
      case 'pr-rep-add': {
        const st = V.st.pr;
        if (st && !st.done) {
          const pr = LM.guidePractice(st.id);
          const step = pr && pr.steps[st.step];
          if (step && step.kind === 'reps' && (st.repCount || 0) < step.repsTarget) {
            st.repCount = (st.repCount || 0) + 1;
            saveResumeSnapshot();
            rerender();
          }
        }
        break;
      }
      case 'pr-next-set': {
        const st = V.st.pr;
        if (st && !st.done) {
          const pr = LM.guidePractice(st.id);
          const step = pr && pr.steps[st.step];
          if (step && step.kind === 'reps' && (st.repSet || 1) < (step.sets || 1)) {
            st.repSet = (st.repSet || 1) + 1;
            st.repCount = 0;
            saveResumeSnapshot();
            rerender();
          }
        }
        break;
      }
      case 'pr-rep-reset': {
        const st = V.st.pr;
        if (st && !st.done) {
          st.repSet = 1;
          st.repCount = 0;
          saveResumeSnapshot();
          rerender();
        }
        break;
      }
      case 'pr-risks': {
        const g = LM.Game.guideById(id || (V.st.pr && V.st.pr.id));
        if (g) {
          LM.sheet(
            T('practice.risksSheetTitle'),
            '<div class="warn" style="margin-top:0"><h4>' + I('warning') + ' ' + E(T('guide.risksTitle')) + '</h4><p>' + E(LM.guideField(g, 'risks')) + '</p></div><p class="fine">' + E(T('guide.disclaimer')) + '</p>'
          );
        }
        break;
      }
      case 'pr-reset-step': {
        if (V.st.pr) loadPracticeStep(V.st.pr.step);
        break;
      }
      case 'pr-prev': {
        if (V.st.pr && V.st.pr.step > 0) loadPracticeStep(V.st.pr.step - 1);
        break;
      }
      case 'pr-next': {
        if (V.st.pr) {
          const pr = LM.guidePractice(V.st.pr.id);
          if (pr && V.st.pr.step < pr.steps.length - 1) loadPracticeStep(V.st.pr.step + 1);
          else finishPractice();
        }
        break;
      }
      case 'pr-restart': {
        initPractice(id || (V.st.pr && V.st.pr.id), { fresh: true });
        rerender();
        break;
      }
      case 'pr-exit': exitPractice(); break;
      case 'ach': achievementsSheet(id); break;
      case 'ach-all': achievementsSheet(); break;
      case 'photo-add': photoAddSheet(); break;
      case 'photo-open': photoViewer(id); break;
      case 'reveal': V.st.revealed.add(id); rerender(); break;
      case 'cmp-pick': cmpPicker(el.dataset.slot); break;
      case 'chat-attach': {
        if (route.path !== 'chat' || route.arg !== 'barrett') break;
        if (LM.ChatAPI && LM.ChatAPI.isBusy('barrett')) {
          LM.toast('<span class="tx">' + E(T('chat.err.inFlight')) + '</span>', 2000);
          break;
        }
        const fileIn = document.getElementById('chat-file-input');
        if (fileIn) fileIn.click();
        break;
      }
      case 'chat-attach-clear': {
        if (LM.ChatViews) {
          LM.ChatViews.clearDraftAttachment();
          LM.ChatViews.refreshAttachSlot('barrett');
        }
        const fileIn = document.getElementById('chat-file-input');
        if (fileIn) fileIn.value = '';
        break;
      }
      case 'chat-retry': {
        if (LM.ChatAPI) {
          const msgId = el.dataset.msgId;
          const res = await LM.ChatAPI.retryBarrett(msgId);
          if (res && !res.ok && res.error && (res.cooldown || res.error.code === 'DUPLICATE_IN_FLIGHT')) {
            LM.toast('<span class="tx">' + E(res.error.message) + '</span>', 2200);
          }
        }
        break;
      }
      case 'chat-followup':
      case 'chat-starter': {
        const prompt = (el.dataset.prompt || '').trim();
        if (!prompt || route.path !== 'chat' || route.arg !== 'barrett') break;
        if (LM.ChatViews) LM.ChatViews.setFocusMessage(null);
        if (LM.ChatAPI) {
          if (LM.ChatAPI.isBusy('barrett')) {
            LM.toast('<span class="tx">' + E(T('chat.err.inFlight')) + '</span>', 2000);
            break;
          }
          await LM.ChatAPI.sendBarrett(prompt);
        }
        break;
      }
      case 'chat-toggle-archive': {
        if (!LM.ChatViews) break;
        LM.ChatViews.st.archiveOpen = !LM.ChatViews.st.archiveOpen;
        LM.ChatViews.refreshList();
        break;
      }
      case 'chat-global-clear': {
        if (!LM.ChatViews) break;
        LM.ChatViews.st.listQuery = '';
        const gq = document.getElementById('chat-global-q');
        if (gq) { gq.value = ''; gq.focus(); }
        LM.ChatViews.refreshList();
        break;
      }
      case 'chat-search-toggle': {
        if (!LM.ChatViews || !route.arg) break;
        const wasOpen = LM.ChatViews.st.search.open && LM.ChatViews.st.search.threadId === route.arg;
        if (wasOpen) {
          LM.ChatViews.resetThreadSearch(route.arg);
          LM.ChatViews.setFocusMessage(null);
        } else {
          LM.ChatViews.openThreadSearch(route.arg);
        }
        const openNow = LM.ChatViews.st.search.open && LM.ChatViews.st.search.threadId === route.arg;
        const wrap = document.getElementById('chat-search-wrap');
        const inp = document.getElementById('chat-thread-q');
        el.classList.toggle('active', openNow);
        el.setAttribute('aria-expanded', String(openNow));
        if (wrap) {
          wrap.hidden = !openNow;
          wrap.classList.toggle('open', openNow);
        }
        if (!openNow && inp) inp.value = '';
        LM.ChatViews.refreshFeed(route.arg);
        if (openNow && inp) setTimeout(() => inp.focus(), 30);
        break;
      }
      case 'chat-search-clear': {
        if (!LM.ChatViews || !route.arg) break;
        LM.ChatViews.st.search.q = '';
        LM.ChatViews.st.search.activeIdx = 0;
        LM.ChatViews.setFocusMessage(null);
        const inp = document.getElementById('chat-thread-q');
        if (inp) { inp.value = ''; inp.focus(); }
        LM.ChatViews.refreshFeed(route.arg);
        break;
      }
      case 'chat-match-prev': {
        if (!LM.ChatViews || !route.arg) break;
        LM.ChatViews.stepSearchMatch(route.arg, -1);
        LM.ChatViews.refreshFeed(route.arg);
        break;
      }
      case 'chat-match-next': {
        if (!LM.ChatViews || !route.arg) break;
        LM.ChatViews.stepSearchMatch(route.arg, 1);
        LM.ChatViews.refreshFeed(route.arg);
        break;
      }
      case 'chat-pinned-list': {
        const tid = el.dataset.threadId || route.arg;
        if (tid) openPinnedSheet(tid);
        break;
      }
      case 'thread-menu': {
        const tid = el.dataset.threadId || route.arg;
        if (tid) openThreadMenuSheet(tid);
        break;
      }
      case 'thread-restore': {
        const tid = el.dataset.threadId || route.arg;
        if (!tid || !LM.ChatStore) break;
        LM.ChatStore.archiveThread(tid, false);
        LM.toast('<span class="tx">' + E(T('chat.archive.restored')) + '</span>', 1500);
        break;
      }
      case 'msg-menu': {
        const mid = el.dataset.msgId;
        if (route.arg && mid) openMsgMenuSheet(route.arg, mid);
        break;
      }
    }
  });

  /* ───────── Stage 2 Chat Management Helpers & Sheets ───────── */
  async function copyToClipboard(text) {
    const val = String(text || '');
    if (!val) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(val);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = val;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  function msgSenderLabel(threadId, msg) {
    if (!msg) return '';
    if (msg.role === 'user') return T('chat.youPrefix');
    if (msg.sender === 'chico') return T('chat.char.chico.name');
    if (msg.sender === 'barrett') return T('chat.char.barrett.name');
    return LM.ChatStore ? LM.ChatStore.getThreadTitle(threadId) : threadId;
  }

  function openMsgMenuSheet(threadId, msgId) {
    if (!LM.ChatStore) return;
    const msgs = LM.ChatStore.getMessages(threadId);
    const idx = msgs.findIndex(m => m && m.id === msgId);
    if (idx < 0) return;
    const msg = msgs[idx];
    const isBusy = !!(LM.ChatAPI && LM.ChatAPI.isBusy(threadId));
    const isPinned = LM.ChatStore.isPinned(threadId, msgId);
    const isUser = msg.role === 'user';
    let hasPrecedingUser = false;
    if (threadId === 'barrett' && msg.role === 'assistant') {
      for (let i = idx - 1; i >= 0; i--) {
        if (msgs[i] && msgs[i].role === 'user') { hasPrecedingUser = true; break; }
      }
    }
    const previewSrc = msg.text || (msg.attachment ? ('[' + T('chat.attach.photoTag') + ']') : '');
    const preview = previewSrc.length > 140 ? previewSrc.slice(0, 140) + '…' : previewSrc;
    const html =
      '<div class="chat-menu-preview"><div class="chat-menu-sender">' + E(msgSenderLabel(threadId, msg)) + '</div><div class="chat-menu-snippet">' + E(preview) + '</div></div>' +
      '<div class="chat-menu-list">' +
        (msg.text ? '<button type="button" class="chat-menu-btn" id="cm-copy">' + I('copy', { size: 17 }) + '<span>' + E(T('chat.menu.copy')) + '</span></button>' : '') +
        '<button type="button" class="chat-menu-btn" id="cm-pin">' + I('pin', { size: 17 }) + '<span>' + E(T(isPinned ? 'chat.menu.unpin' : 'chat.menu.pin')) + '</span></button>' +
        (isUser && msg.text
          ? '<button type="button" class="chat-menu-btn" id="cm-edit"' + (isBusy ? ' disabled' : '') + '>' + I('pencil', { size: 17 }) + '<span>' + E(T('chat.menu.edit')) + '</span></button>'
          : '') +
        (hasPrecedingUser
          ? '<button type="button" class="chat-menu-btn" id="cm-regen"' + (isBusy ? ' disabled' : '') + '>' + I('refresh', { size: 17 }) + '<span>' + E(T('chat.menu.regen')) + '</span></button>'
          : '') +
        '<button type="button" class="chat-menu-btn danger" id="cm-del"' + (msg.status === 'sending' ? ' disabled' : '') + '>' + I('trash', { size: 17 }) + '<span>' + E(T('chat.menu.delete')) + '</span></button>' +
      '</div>';

    LM.sheet(T('chat.msgMenuAria'), html, body => {
      const copyBtn = body.querySelector('#cm-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          LM.closeSheet();
          const ok = await copyToClipboard(msg.text);
          LM.toast('<span class="tx">' + E(T(ok ? 'chat.copy.done' : 'chat.copy.fail')) + '</span>', 1500);
        });
      }
      body.querySelector('#cm-pin').addEventListener('click', () => {
        LM.closeSheet();
        const res = LM.ChatStore.togglePin(threadId, msgId);
        if (res && res.limitReached) {
          LM.toast('<span class="tx">' + E(T('chat.pin.limit')) + '</span>', 2200);
        } else {
          LM.toast('<span class="tx">' + E(T(res && res.pinned ? 'chat.pin.added' : 'chat.pin.removed')) + '</span>', 1500);
        }
      });
      const editBtn = body.querySelector('#cm-edit');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          if (LM.ChatAPI && LM.ChatAPI.isBusy(threadId)) {
            LM.toast('<span class="tx">' + E(T('chat.err.inFlight')) + '</span>', 2000);
            return;
          }
          openEditMsgSheet(threadId, msgId);
        });
      }
      const regenBtn = body.querySelector('#cm-regen');
      if (regenBtn) {
        regenBtn.addEventListener('click', async () => {
          if (!LM.ChatAPI) return;
          if (LM.ChatAPI.isBusy(threadId)) {
            LM.toast('<span class="tx">' + E(T('chat.err.inFlight')) + '</span>', 2000);
            return;
          }
          LM.closeSheet();
          if (LM.ChatViews) LM.ChatViews.setFocusMessage(null);
          const res = await LM.ChatAPI.regenerateBarrett(msgId);
          if (res && !res.ok && res.error && res.error.code === 'DUPLICATE_IN_FLIGHT') {
            LM.toast('<span class="tx">' + E(res.error.message) + '</span>', 2200);
          }
        });
      }
      body.querySelector('#cm-del').addEventListener('click', async () => {
        if (msg.status === 'sending') return;
        const ok = await LM.confirm({
          title: T('chat.deleteMsg.title'),
          text: E(T('chat.deleteMsg.text')),
          ok: T('common.delete')
        });
        if (!ok) return;
        LM.ChatStore.removeMessage(threadId, msgId);
        if (LM.ChatAPI && LM.ChatAPI.clearSessionMedia) LM.ChatAPI.clearSessionMedia(msgId);
        LM.toast('<span class="tx">' + E(T('chat.deleteMsg.done')) + '</span>', 1500);
      });
    });
  }

  function openEditMsgSheet(threadId, msgId) {
    if (!LM.ChatStore) return;
    const msgs = LM.ChatStore.getMessages(threadId);
    const idx = msgs.findIndex(m => m && m.id === msgId && m.role === 'user');
    if (idx < 0) return;
    const msg = msgs[idx];
    const hasFollowing = idx < msgs.length - 1;
    const warnText = (threadId === 'barrett' && hasFollowing)
      ? T('chat.edit.warnBarrett')
      : (hasFollowing ? T('chat.edit.warnLocal') : '');
    const saveLbl = (threadId === 'barrett') ? T('chat.edit.saveResend') : T('chat.edit.save');
    const html =
      '<label class="field"><span>' + E(T('chat.edit.label')) + '</span>' +
        '<textarea class="input chat-edit-in" id="em-in" rows="4" maxlength="1500">' + E(msg.text) + '</textarea>' +
      '</label>' +
      (warnText ? '<p class="note">' + E(warnText) + '</p>' : '') +
      '<div id="em-err"></div>' +
      '<div class="stack">' +
        '<button type="button" class="btn" id="em-save">' + E(saveLbl) + '</button>' +
        '<button type="button" class="btn ghost" id="em-cancel">' + E(T('common.cancel')) + '</button>' +
      '</div>';

    LM.sheet(T('chat.edit.title'), html, body => {
      const inp = body.querySelector('#em-in');
      const err = body.querySelector('#em-err');
      body.querySelector('#em-cancel').addEventListener('click', LM.closeSheet);
      const submitEdit = async () => {
        const val = inp.value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
        if (!val) {
          err.innerHTML = '<div class="err">' + E(T('chat.edit.emptyErr')) + '</div>';
          return;
        }
        if (val === msg.text && !hasFollowing && threadId !== 'barrett') {
          LM.closeSheet();
          return;
        }
        if (val === msg.text && msg.status === 'sent' && !hasFollowing) {
          LM.closeSheet();
          return;
        }
        if (LM.ChatAPI && LM.ChatAPI.isBusy(threadId)) {
          LM.toast('<span class="tx">' + E(T('chat.err.inFlight')) + '</span>', 2000);
          return;
        }
        LM.closeSheet();
        if (LM.ChatViews) LM.ChatViews.setFocusMessage(null);
        if (threadId === 'barrett' && LM.ChatAPI) {
          const res = await LM.ChatAPI.editAndResendBarrett(msgId, val);
          if (res && !res.ok && res.error && res.error.code === 'DUPLICATE_IN_FLIGHT') {
            LM.toast('<span class="tx">' + E(res.error.message) + '</span>', 2200);
          }
        } else {
          LM.ChatStore.editUserMessage(threadId, msgId, val, { truncateAfter: true });
        }
      };
      body.querySelector('#em-save').addEventListener('click', submitEdit);
      setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 180);
    });
  }

  function openRenameThreadSheet(threadId) {
    if (!LM.ChatStore) return;
    const th = LM.ChatStore.getThread(threadId);
    const meta = LM.CHAT_CHARS[threadId];
    if (!th || !meta) return;
    const defName = T(meta.nameKey);
    const html =
      '<label class="field"><span>' + E(T('chat.rename.field')) + '</span>' +
        '<input class="input" id="rn-in" maxlength="48" autocomplete="off" value="' + E(th.customTitle || '') + '" placeholder="' + E(T('chat.rename.placeholder', { name: defName })) + '">' +
      '</label>' +
      '<div class="stack">' +
        '<button type="button" class="btn" id="rn-save">' + E(T('common.save')) + '</button>' +
        (th.customTitle ? '<button type="button" class="btn ghost" id="rn-reset">' + E(T('chat.rename.resetDefault')) + '</button>' : '') +
      '</div>';

    LM.sheet(T('chat.rename.title'), html, body => {
      const inp = body.querySelector('#rn-in');
      const save = () => {
        LM.ChatStore.renameThread(threadId, inp.value);
        LM.closeSheet();
        LM.toast('<span class="tx">' + E(T('chat.rename.done')) + '</span>', 1500);
      };
      body.querySelector('#rn-save').addEventListener('click', save);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      const resetBtn = body.querySelector('#rn-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          LM.ChatStore.renameThread(threadId, '');
          LM.closeSheet();
          LM.toast('<span class="tx">' + E(T('chat.rename.done')) + '</span>', 1500);
        });
      }
      setTimeout(() => { inp.focus(); inp.select(); }, 180);
    });
  }

  function openPinnedSheet(threadId) {
    if (!LM.ChatStore) return;
    const renderPinnedBody = () => {
      const pins = LM.ChatStore.getPinnedMessages(threadId);
      if (!pins.length) {
        return '<div class="empty"><b>' + E(T('chat.pin.sheetTitle')) + '</b>' + E(T('chat.pin.empty')) + '</div>';
      }
      return '<div class="chat-pinned-list">' +
        pins.slice().reverse().map(msg =>
          '<div class="chat-pinned-item" data-pin-id="' + E(msg.id) + '">' +
            '<div class="chat-pinned-head">' +
              '<span class="chat-pinned-author">' + E(msgSenderLabel(threadId, msg)) + '</span>' +
              '<span class="chat-row-time">' + E(new Intl.DateTimeFormat(LM.I18n.locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(msg.ts))) + '</span>' +
            '</div>' +
            '<div class="chat-pinned-txt">' + E(msg.text || ('[' + T('chat.attach.photoTag') + ']')) + '</div>' +
            '<div class="chat-pinned-acts">' +
              '<button type="button" class="btn ghost sm-btn" data-pin-jump="' + E(msg.id) + '">' + E(T('chat.pin.jump')) + '</button>' +
              '<button type="button" class="btn ghost sm-btn" data-pin-unpin="' + E(msg.id) + '">' + E(T('chat.pin.unpin')) + '</button>' +
            '</div>' +
          '</div>'
        ).join('') +
      '</div>';
    };

    const bind = body => {
      body.querySelectorAll('[data-pin-jump]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mid = btn.dataset.pinJump;
          LM.closeSheet();
          if (route.path === 'chat' && route.arg === threadId) {
            if (LM.ChatViews) {
              LM.ChatViews.setFocusMessage(mid);
              LM.ChatViews.refreshFeed(threadId);
            }
          } else {
            location.hash = '#/chat/' + encodeURIComponent(threadId) + '?focus=' + encodeURIComponent(mid);
          }
        });
      });
      body.querySelectorAll('[data-pin-unpin]').forEach(btn => {
        btn.addEventListener('click', () => {
          LM.ChatStore.togglePin(threadId, btn.dataset.pinUnpin);
          LM.toast('<span class="tx">' + E(T('chat.pin.removed')) + '</span>', 1400);
          body.innerHTML = renderPinnedBody();
          bind(body);
        });
      });
    };

    LM.sheet(T('chat.pin.sheetTitle'), renderPinnedBody(), bind);
  }

  function openThreadMenuSheet(threadId) {
    if (!LM.ChatStore || !LM.ChatStore.isValidThread(threadId)) return;
    const th = LM.ChatStore.getThread(threadId);
    const title = LM.ChatStore.getThreadTitle(threadId);
    const pinCount = Array.isArray(th.pinnedIds) ? th.pinnedIds.length : 0;
    const isBusy = !!(LM.ChatAPI && LM.ChatAPI.isBusy(threadId));
    const html =
      '<div class="chat-menu-list">' +
        '<button type="button" class="chat-menu-btn" id="tm-rename">' + I('pencil', { size: 17 }) + '<span>' + E(T('chat.menu.rename')) + '</span></button>' +
        '<button type="button" class="chat-menu-btn" id="tm-pins">' + I('pin', { size: 17 }) + '<span>' + E(T('chat.menu.pinnedList', { n: pinCount })) + '</span></button>' +
        '<button type="button" class="chat-menu-btn" id="tm-search">' + I('search', { size: 17 }) + '<span>' + E(T('chat.menu.searchInChat')) + '</span></button>' +
        '<button type="button" class="chat-menu-btn" id="tm-archive">' + I(th.archived ? 'restore' : 'archive', { size: 17 }) + '<span>' + E(T(th.archived ? 'chat.menu.restore' : 'chat.menu.archive')) + '</span></button>' +
        '<button type="button" class="chat-menu-btn danger" id="tm-delete"' + (isBusy ? ' disabled' : '') + '>' + I('trash', { size: 17 }) + '<span>' + E(T('chat.menu.deleteThread')) + '</span></button>' +
      '</div>';

    LM.sheet(title, html, body => {
      body.querySelector('#tm-rename').addEventListener('click', () => openRenameThreadSheet(threadId));
      body.querySelector('#tm-pins').addEventListener('click', () => openPinnedSheet(threadId));
      body.querySelector('#tm-search').addEventListener('click', () => {
        LM.closeSheet();
        if (LM.ChatViews) LM.ChatViews.openThreadSearch(threadId);
        if (route.path === 'chat' && route.arg === threadId) {
          rerender();
        } else {
          location.hash = '#/chat/' + encodeURIComponent(threadId);
        }
        setTimeout(() => {
          const inp = document.getElementById('chat-thread-q');
          if (inp) inp.focus();
        }, 60);
      });
      body.querySelector('#tm-archive').addEventListener('click', () => {
        const nextArchived = LM.ChatStore.archiveThread(threadId, !th.archived);
        LM.closeSheet();
        LM.toast('<span class="tx">' + E(T(nextArchived ? 'chat.archive.done' : 'chat.archive.restored')) + '</span>', 1600);
        if (nextArchived && route.path === 'chat' && route.arg === threadId) {
          location.hash = '#/chat';
        }
      });
      body.querySelector('#tm-delete').addEventListener('click', async () => {
        if (LM.ChatAPI && LM.ChatAPI.isBusy(threadId)) {
          LM.toast('<span class="tx">' + E(T('chat.err.inFlight')) + '</span>', 2000);
          return;
        }
        const ok = await LM.confirm({
          title: T('chat.deleteThread.title'),
          text: E(T('chat.deleteThread.text', { name: title })),
          ok: T('common.delete')
        });
        if (!ok) return;
        LM.ChatStore.deleteThread(threadId);
        if (threadId === 'barrett' && LM.ChatAPI && LM.ChatAPI.clearSessionMedia) {
          LM.ChatAPI.clearSessionMedia();
        }
        if (LM.ChatViews) {
          LM.ChatViews.resetThreadSearch(threadId);
          LM.ChatViews.setFocusMessage(null);
          if (threadId === 'barrett') LM.ChatViews.clearDraftAttachment();
        }
        LM.toast('<span class="tx">' + E(T('chat.deleteThread.done')) + '</span>', 1600);
        if (route.path === 'chat' && route.arg === threadId) {
          location.hash = '#/chat';
        }
      });
    });
  }

  function refreshGuides() {
    const l = document.getElementById('glist'), c = document.getElementById('gchips');
    if (l) l.innerHTML = V.guideList();
    if (c) c.innerHTML = V.guideChips();
  }

  async function handleChatFileSelection(file) {
    if (route.path !== 'chat' || route.arg !== 'barrett' || !LM.ChatAPI || !LM.ChatViews || !file) return;
    const res = await LM.ChatAPI.readAndValidateImageFile(file);
    if (!res.ok) {
      LM.ChatViews.setAttachError(res.error || T('chat.attach.errInvalid'));
      LM.ChatViews.refreshAttachSlot('barrett');
      return;
    }
    LM.ChatViews.setDraftAttachment(res.attachment);
    LM.ChatViews.refreshAttachSlot('barrett');
  }

  async function submitChatComposer() {
    if (route.path !== 'chat' || !route.arg || !LM.ChatStore || !LM.ChatStore.isValidThread(route.arg)) return;
    const inp = document.getElementById('chat-input');
    if (!inp) return;
    const text = inp.value.trim();
    const draftAtt = (route.arg === 'barrett' && LM.ChatViews && LM.ChatViews.st)
      ? LM.ChatViews.st.draftAttachment
      : null;

    if (!text && !draftAtt) return;

    if (LM.ChatViews) LM.ChatViews.setFocusMessage(null);

    if (route.arg === 'barrett' && LM.ChatAPI) {
      if (LM.ChatAPI.isBusy('barrett')) {
        LM.toast('<span class="tx">' + E(T('chat.err.inFlight')) + '</span>', 2000);
        return;
      }
      if (draftAtt && !draftAtt.consent) {
        const ok = await LM.confirm({
          title: T('chat.attach.consentTitle'),
          text: E(T('chat.attach.consentText')),
          ok: T('chat.attach.consentOk')
        });
        if (!ok) {
          if (LM.ChatViews) {
            LM.ChatViews.setAttachError(T('chat.attach.errConsent'));
            LM.ChatViews.refreshAttachSlot('barrett');
          }
          return;
        }
        if (LM.ChatViews) LM.ChatViews.setDraftConsent(true);
      }

      const sendAtt = draftAtt ? Object.assign({}, draftAtt) : null;
      inp.value = '';
      inp.style.height = 'auto';
      if (LM.ChatViews) {
        LM.ChatViews.clearDraftAttachment();
        LM.ChatViews.refreshAttachSlot('barrett');
      }
      LM.ChatAPI.sendBarrett(
        text,
        sendAtt ? { image: sendAtt, previewUrl: sendAtt.previewUrl, explicitConsent: true } : undefined
      );
      const nextInp = document.getElementById('chat-input');
      if (nextInp) nextInp.focus();
      return;
    }

    if (!text) return;
    inp.value = '';
    inp.style.height = 'auto';
    LM.ChatStore.addMessage(route.arg, {
      role: 'user',
      sender: 'user',
      text: text,
      ts: Date.now()
    });
    const nextInp = document.getElementById('chat-input');
    if (nextInp) nextInp.focus();
  }

  document.addEventListener('submit', e => {
    if (e.target && e.target.id === 'chat-form') {
      e.preventDefault();
      submitChatComposer();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target && e.target.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submitChatComposer();
    } else if (e.target && e.target.id === 'chat-thread-q' && e.key === 'Enter' && LM.ChatViews && route.arg) {
      e.preventDefault();
      LM.ChatViews.stepSearchMatch(route.arg, e.shiftKey ? -1 : 1);
      LM.ChatViews.refreshFeed(route.arg);
    }
  });

  document.addEventListener('change', e => {
    if (e.target && e.target.id === 'chat-file-input') {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) handleChatFileSelection(f);
    } else if (e.target && e.target.id === 'chat-attach-consent' && LM.ChatViews) {
      LM.ChatViews.setDraftConsent(e.target.checked);
      LM.ChatViews.refreshAttachSlot('barrett');
    }
  });

  let chatDragDepth = 0;
  function hasDraggedFiles(e) {
    const types = e && e.dataTransfer && e.dataTransfer.types;
    if (!types) return false;
    return Array.prototype.indexOf.call(types, 'Files') >= 0;
  }

  document.addEventListener('dragenter', e => {
    if (route.path !== 'chat' || route.arg !== 'barrett' || !hasDraggedFiles(e)) return;
    e.preventDefault();
    chatDragDepth += 1;
    const thEl = document.querySelector('.chat-thread[data-thread-id="barrett"]');
    if (thEl) thEl.classList.add('is-dragover');
  });

  document.addEventListener('dragover', e => {
    if (route.path !== 'chat' || route.arg !== 'barrett' || !hasDraggedFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('dragleave', e => {
    if (route.path !== 'chat' || route.arg !== 'barrett') return;
    if (chatDragDepth > 0) chatDragDepth -= 1;
    if (chatDragDepth === 0) {
      const thEl = document.querySelector('.chat-thread[data-thread-id="barrett"]');
      if (thEl) thEl.classList.remove('is-dragover');
    }
  });

  document.addEventListener('drop', e => {
    chatDragDepth = 0;
    const thEl = document.querySelector('.chat-thread[data-thread-id="barrett"]');
    if (thEl) thEl.classList.remove('is-dragover');
    if (route.path !== 'chat' || route.arg !== 'barrett') return;
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    e.preventDefault();
    handleChatFileSelection(files[0]);
  });

  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'gq') {
      V.st.gf.q = e.target.value;
      const clr = document.getElementById('gq-clear');
      if (clr) clr.hidden = !V.st.gf.q;
      const l = document.getElementById('glist');
      if (l) l.innerHTML = V.guideList();
    } else if (e.target && e.target.id === 'chat-input') {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    } else if (e.target && e.target.id === 'chat-global-q' && LM.ChatViews) {
      LM.ChatViews.st.listQuery = e.target.value;
      LM.ChatViews.refreshList();
    } else if (e.target && e.target.id === 'chat-thread-q' && LM.ChatViews && route.arg) {
      LM.ChatViews.st.search.open = true;
      LM.ChatViews.st.search.threadId = route.arg;
      LM.ChatViews.st.search.q = e.target.value;
      LM.ChatViews.st.search.activeIdx = 0;
      LM.ChatViews.setFocusMessage(null);
      LM.ChatViews.refreshFeed(route.arg);
    }
  });

  /* ───────── boot ───────── */
  async function boot() {
    const rep = await LM.Store.boot();
    if (LM.ChatStore) LM.ChatStore.get();
    LM.I18n.init();
    syncLangChrome();
    applyAppearance();
    await refreshPhotos();
    LM.Game.ensureToday();
    window.__bootReport = rep;
    if (rep.migrated) LM.toast('<span class="tx">' + E(T('migrate.done')) + '</span>', 3500);
    if (rep.error) LM.toast('<span class="tx">' + E(T('migrate.failed', { msg: rep.error })) + '</span>', 8000);
    if (rep.corrupt) LM.toast('<span class="tx">' + E(T('migrate.corrupt')) + '</span>', 6000);

    let lastSettings = JSON.stringify(LM.Store.get().settings.appearance);
    LM.Store.subscribe(() => {
      const cur = JSON.stringify(LM.Store.get().settings.appearance);
      if (cur !== lastSettings) { lastSettings = cur; applyAppearance(); }
      // don't wipe the guide search box while typing
      const ae = document.activeElement;
      if (ae && ae.id === 'gq') { refreshGuides(); return; }
      rerender();
    });
    if (LM.ChatStore) {
      LM.ChatStore.subscribe(() => {
        if (route.path === 'chat') {
          const ae = document.activeElement;
          if (ae && ae.id === 'chat-global-q' && LM.ChatViews) { LM.ChatViews.refreshList(); return; }
          if (ae && ae.id === 'chat-thread-q' && route.arg && LM.ChatViews) { LM.ChatViews.refreshFeed(route.arg); return; }
          rerender();
        } else {
          const activeNav = route.path === 'tasks' ? 'home'
            : (route.path === 'guide' || route.path === 'practice') ? 'guides'
            : route.path;
          renderNav(activeNav);
        }
      });
    }

    window.addEventListener('hashchange', navigate);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        const before = LM.Store.get().daily.date;
        LM.Game.ensureToday();
        if (before !== LM.Store.get().daily.date) rerender();
        else updatePracticeDOM();
      }
    });
    // midnight rollover while the app stays open + reminders
    setInterval(() => {
      if (LM.Store.get().daily.date !== LM.Game.dateKey()) LM.Game.ensureToday();
      reminderTick();
    }, 30000);

    if (!location.hash) location.hash = '#/home';
    navigate();
    reminderTick();
  }

  window.addEventListener('error', e => console.error('ASCEND error:', e.message));
  boot();
})();
