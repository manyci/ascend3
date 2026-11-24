/* ASCEND — game logic: XP, levels, streak, daily tasks, achievements.
   All dates are LOCAL calendar days as 'YYYY-MM-DD'. */
window.LM = window.LM || {};

(function () {
  /* ───────────── events (UI subscribes to show toasts) ───────────── */
  const handlers = {};
  LM.Events = {
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    emit(name, data) { (handlers[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
  };

  /* ───────────── dates ───────────── */
  const pad = n => String(n).padStart(2, '0');
  function dateKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
  function diffDays(a, b) { // b - a in calendar days (DST-safe)
    const A = parseKey(a), B = parseKey(b);
    return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
  }

  /* ───────────── levels ─────────────
     XP needed to go from level n to n+1 = 100 + 25*(n-1).
     Cumulative XP to REACH level L = 100(L-1) + 25(L-1)(L-2)/2  */
  function xpToReach(L) { return 100 * (L - 1) + 12.5 * (L - 1) * (L - 2); }
  function levelInfo(xp) {
    let L = 1;
    while (xpToReach(L + 1) <= xp) L++;
    const base = xpToReach(L), next = xpToReach(L + 1);
    return { level: L, base, next, into: xp - base, need: next - base, pct: Math.min(100, Math.round(((xp - base) / (next - base)) * 100)), total: xp };
  }

  /* ───────────── seeded random (deterministic daily tasks) ───────────── */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ───────────── helpers ───────────── */
  function guideById(id) { return LM.GUIDES.find(g => g.id === id); }
  function taskDef(id) { return LM.TASK_POOL.find(t => t.id === id); }

  function dayRec(s, k) { return s.days[k] || (s.days[k] = { xp: 0, tasks: 0, guides: 0 }); }

  /* Historical milestone achievements remain unlocked after subsequent metric changes;
     dynamic counter/threshold achievements recalculate when tasks are undone today. */
  const HISTORICAL_ACH = { 'a-g1': 1, 'a-g10': 1, 'a-cats': 1, 'a-photo': 1, 'a-fav5': 1 };

  function achievementStats(s) {
    const cats = new Set(Object.keys(s.studied).map(id => { const g = guideById(id); return g && g.cat; }).filter(Boolean));
    return {
      xp: s.xp, level: levelInfo(s.xp).level, streakBest: s.streak.best,
      tasks: s.stats.tasks, guides: s.stats.guides, perfect: s.stats.perfect,
      photos: s.stats.photos, favorites: s.favorites.length, cats: cats.size
    };
  }

  function checkAchievements(s) {
    const st = achievementStats(s);
    const unlocked = [];
    LM.ACHIEVEMENTS.forEach(a => {
      if (!s.achievements[a.id] && st[a.key] >= a.goal) {
        s.achievements[a.id] = Date.now();
        unlocked.push(a);
      }
    });
    return unlocked;
  }

  function reconcileAchievements(s) {
    const st = achievementStats(s);
    const revoked = [];
    LM.ACHIEVEMENTS.forEach(a => {
      if (HISTORICAL_ACH[a.id]) return;
      if (s.achievements[a.id] && st[a.key] < a.goal) {
        delete s.achievements[a.id];
        revoked.push(a.id);
      }
    });
    return revoked;
  }

  /* Compute prior streak facts strictly before `today` from days + history (fallback when no daily.streakBefore exists). */
  function priorStats(s, today) {
    const priorSet = new Set();
    Object.keys(s.days || {}).forEach(k => { if (k < today && s.days[k] && s.days[k].xp > 0) priorSet.add(k); });
    (s.history || []).forEach(h => { if (h && h.date && h.date < today && (h.xp || 0) > 0) priorSet.add(h.date); });
    const sorted = Array.from(priorSet).sort();
    const prevActive = sorted.length ? sorted[sorted.length - 1] : null;
    let curEndingYesterday = 0;
    if (prevActive && diffDays(prevActive, today) === 1) {
      let d = prevActive;
      while (priorSet.has(d)) {
        curEndingYesterday += 1;
        d = addDays(d, -1);
      }
    }
    let histBest = 0, run = 0, prevDay = null;
    for (let i = 0; i < sorted.length; i++) {
      if (prevDay && diffDays(prevDay, sorted[i]) === 1) run += 1;
      else run = 1;
      if (run > histBest) histBest = run;
      prevDay = sorted[i];
    }
    return { prevActive, curEndingYesterday, histBest };
  }

  /* Streak: counted once per calendar day, the first time the user earns XP. */
  function touchStreak(s, today) {
    const st = s.streak;
    if (st.lastDate === today) return;
    if (s.daily && !s.daily.streakBefore) {
      s.daily.streakBefore = {
        current: st.current || 0,
        best: st.best || 0,
        lastDate: st.lastDate || null
      };
    }
    if (st.lastDate && diffDays(st.lastDate, today) === 1) st.current += 1;
    else st.current = 1;
    st.lastDate = today;
    if (st.current > st.best) st.best = st.current;
  }

  /* Core award function. Mutates s; returns nothing. Emits events after state is saved. */
  function award(s, xp, type, title, queue, ref) {
    const today = dateKey();
    const before = levelInfo(s.xp).level;
    touchStreak(s, today);
    s.xp += xp;
    dayRec(s, today).xp += xp;
    s.history.unshift({ ts: Date.now(), date: today, type: type, title: title, xp: xp, ref: ref });
    if (s.history.length > 1000) s.history.length = 1000;
    queue.push({ name: 'xp', data: { xp: xp, title: title } });
    const after = levelInfo(s.xp).level;
    if (after > before) { s.lastLevel = after; queue.push({ name: 'levelup', data: { level: after, fromLevel: before, xp: s.xp } }); }
  }

  function flush(queue) { queue.forEach(e => LM.Events.emit(e.name, e.data)); }

  /* ───────────── API ───────────── */
  LM.Game = {
    dateKey, parseKey, addDays, diffDays, levelInfo, xpToReach, guideById, taskDef,
    HISTORICAL_ACHIEVEMENTS: Object.keys(HISTORICAL_ACH),

    /* Call on load, on visibility change and at midnight. Rolls the day over. */
    ensureToday() {
      const today = dateKey();
      let changed = false;
      LM.Store.update(s => {
        // streak breaks if a whole calendar day was skipped
        if (s.streak.lastDate && diffDays(s.streak.lastDate, today) > 1 && s.streak.current !== 0) { s.streak.current = 0; changed = true; }
        if (s.daily.date !== today) { s.daily = this.generateDaily(s, today); changed = true; }
      }, true);
      if (changed) LM.Store.update(() => {}); // notify subscribers once
    },

    generateDaily(s, today) {
      const rand = rng(hash('looksmax:' + today));   // seed string is historical on purpose: renaming it would re-roll today's plan for existing users
      // guide of the day: prefer a guide not studied yet
      const unstudied = LM.GUIDES.filter(g => !s.studied[g.id]);
      const pool = unstudied.length ? unstudied : LM.GUIDES;
      const guide = pool[Math.floor(rand() * pool.length)];
      const habits = shuffle(LM.TASK_POOL, rand).slice(0, 3);
      const tasks = [{ id: 'guide:' + guide.id, kind: 'guide', title: 'Study: ' + guide.title, cat: guide.cat, xp: LM.XP.guideTask, done: false }]
        .concat(habits.map(h => ({ id: h.id, kind: 'habit', title: h.title, cat: h.cat, xp: h.xp, done: false })));
      return {
        date: today,
        tasks: tasks,
        guideId: guide.id,
        perfectPaid: false,
        streakBefore: s && s.streak ? { current: s.streak.current || 0, best: s.streak.best || 0, lastDate: s.streak.lastDate || null } : null
      };
    },

    todayTasks() { return LM.Store.get().daily.tasks; },

    /* Complete a habit task (guide tasks complete by studying the guide). */
    completeTask(id) {
      const queue = [];
      let ok = false;
      LM.Store.update(s => {
        this.ensureDailyInline(s);
        const t = s.daily.tasks.find(x => x.id === id);
        if (!t || t.done || t.kind === 'guide') return;
        t.done = true; t.doneAt = Date.now();
        s.stats.tasks += 1;
        dayRec(s, dateKey()).tasks += 1;
        award(s, t.xp, 'task', t.title, queue, 'task:' + t.id);
        this.perfectCheck(s, queue);
        checkAchievements(s).forEach(a => queue.push({ name: 'achievement', data: a }));
        ok = true;
      });
      flush(queue);
      return ok;
    },

    /* Revert a completed habit task today with full XP, bonus, history, dynamic achievements, and streak restoration. */
    uncompleteTask(id) {
      const queue = [];
      let ok = false;
      LM.Store.update(s => {
        this.ensureDailyInline(s);
        const t = s.daily.tasks.find(x => x.id === id);
        if (!t || !t.done || t.kind === 'guide') return;
        const today = dateKey();
        const dToday = dayRec(s, today);

        t.done = false;
        delete t.doneAt;
        s.stats.tasks = Math.max(0, (s.stats.tasks || 0) - 1);
        dToday.tasks = Math.max(0, (dToday.tasks || 0) - 1);

        let hIdx = s.history.findIndex(h => h && h.date === today && h.type === 'task' && h.ref === 'task:' + t.id);
        if (hIdx < 0) hIdx = s.history.findIndex(h => h && h.date === today && h.type === 'task' && h.title === t.title);
        let revertedXp = Number(t.xp) || 0;
        if (hIdx >= 0) {
          if (typeof s.history[hIdx].xp === 'number') revertedXp = s.history[hIdx].xp;
          s.history.splice(hIdx, 1);
        }
        s.xp = Math.max(0, (s.xp || 0) - revertedXp);
        dToday.xp = Math.max(0, (dToday.xp || 0) - revertedXp);

        if (s.daily.perfectPaid) {
          s.daily.perfectPaid = false;
          s.stats.perfect = Math.max(0, (s.stats.perfect || 0) - 1);
          let pIdx = s.history.findIndex(h => h && h.date === today && h.type === 'bonus' && h.ref === 'bonus:perfect');
          if (pIdx < 0) pIdx = s.history.findIndex(h => h && h.date === today && h.type === 'bonus' && h.title === 'Perfect day bonus');
          let bonusXp = LM.XP.perfectDay || 25;
          if (pIdx >= 0) {
            if (typeof s.history[pIdx].xp === 'number') bonusXp = s.history[pIdx].xp;
            s.history.splice(pIdx, 1);
          }
          s.xp = Math.max(0, (s.xp || 0) - bonusXp);
          dToday.xp = Math.max(0, (dToday.xp || 0) - bonusXp);
          revertedXp += bonusXp;
        }

        const hasRemainingTodayXp = dToday.xp > 0 || s.history.some(h => h && h.date === today && (h.xp || 0) > 0);
        if (s.streak && s.streak.lastDate === today && !hasRemainingTodayXp) {
          if (s.daily && s.daily.streakBefore) {
            const prev = s.daily.streakBefore;
            s.streak.current = Math.max(0, Number(prev.current) || 0);
            s.streak.best = Math.max(s.streak.current, Number(prev.best) || 0);
            s.streak.lastDate = prev.lastDate || null;
            delete s.daily.streakBefore;
          } else {
            const ps = priorStats(s, today);
            const oldCur = s.streak.current || 0;
            const oldBest = s.streak.best || 0;
            if (ps.prevActive && diffDays(ps.prevActive, today) === 1) {
              s.streak.lastDate = ps.prevActive;
              s.streak.current = Math.max(1, ps.curEndingYesterday || (oldCur - 1));
            } else {
              s.streak.current = 0;
              s.streak.lastDate = ps.prevActive || null;
            }
            s.streak.best = Math.max(ps.histBest, s.streak.current, oldBest > oldCur ? oldBest : 0);
          }
        }

        reconcileAchievements(s);
        s.lastLevel = levelInfo(s.xp).level;
        queue.push({ name: 'taskUndo', data: { id: t.id, title: t.title, xp: revertedXp, level: s.lastLevel, xpTotal: s.xp } });
        ok = true;
      });
      flush(queue);
      return ok;
    },

    /* Toggle habit task completion immediately (done <-> undone). */
    toggleTask(id) {
      const s = LM.Store.get();
      const t = s && s.daily && s.daily.tasks ? s.daily.tasks.find(x => x.id === id) : null;
      if (!t || t.kind === 'guide') return false;
      return t.done ? this.uncompleteTask(id) : this.completeTask(id);
    },

    /* Mark a guide as studied. Status only: reading earns NO XP.
       Also completes today's guide task if it matches (that task gives no XP either).
       Achievements that count studied guides still update. */
    studyGuide(id) {
      const g = guideById(id); if (!g) return false;
      const queue = [];
      let ok = false;
      LM.Store.update(s => {
        this.ensureDailyInline(s);
        if (s.studied[id]) return;
        s.studied[id] = Date.now();
        s.stats.guides += 1;
        dayRec(s, dateKey()).guides += 1;
        const t = s.daily.tasks.find(x => x.id === 'guide:' + id);
        if (t && !t.done) {
          t.done = true; t.doneAt = Date.now();
          s.stats.tasks += 1;
          dayRec(s, dateKey()).tasks += 1;
          this.perfectCheck(s, queue);
        }
        checkAchievements(s).forEach(a => queue.push({ name: 'achievement', data: a }));
        queue.push({ name: 'studied', data: { id: id } });
        ok = true;
      });
      flush(queue);
      return ok;
    },

    perfectCheck(s, queue) {
      if (!s.daily.perfectPaid && s.daily.tasks.length && s.daily.tasks.every(t => t.done)) {
        s.daily.perfectPaid = true;
        s.stats.perfect += 1;
        award(s, LM.XP.perfectDay, 'bonus', 'Perfect day bonus', queue, 'bonus:perfect');
        queue.push({ name: 'perfect', data: {} });
      }
    },

    ensureDailyInline(s) {
      const today = dateKey();
      if (s.daily.date !== today) s.daily = this.generateDaily(s, today);
    },

    /* Photo check-in: once per calendar day gives XP. */
    photoAdded() {
      const queue = [];
      LM.Store.update(s => {
        s.stats.photos += 1;
        const today = dateKey();
        const already = s.history.some(h => h.type === 'photo' && h.date === today);
        if (!already) award(s, LM.XP.photo, 'photo', 'Progress photo check-in', queue, 'photo:checkin');
        checkAchievements(s).forEach(a => queue.push({ name: 'achievement', data: a }));
      });
      flush(queue);
    },

    toggleFavorite(id) {
      const queue = [];
      let now = false;
      LM.Store.update(s => {
        const i = s.favorites.indexOf(id);
        if (i >= 0) s.favorites.splice(i, 1); else s.favorites.push(id);
        now = i < 0;
        checkAchievements(s).forEach(a => queue.push({ name: 'achievement', data: a }));
      });
      flush(queue);
      return now;
    },

    /* Streak display state */
    streakState() {
      const s = LM.Store.get(), today = dateKey();
      const last = s.streak.lastDate;
      if (!last) return { current: 0, best: s.streak.best, activeToday: false, atRisk: false };
      const gap = diffDays(last, today);
      if (gap === 0) return { current: s.streak.current, best: s.streak.best, activeToday: true, atRisk: false };
      if (gap === 1) return { current: s.streak.current, best: s.streak.best, activeToday: false, atRisk: s.streak.current > 0 };
      return { current: 0, best: s.streak.best, activeToday: false, atRisk: false };
    },

    /* Last n days (oldest first): [{key, xp, tasks, guides, dow}] */
    lastDays(n, offset) {
      const s = LM.Store.get(), today = dateKey();
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const k = addDays(today, -(i + (offset || 0)));
        const r = s.days[k] || { xp: 0, tasks: 0, guides: 0 };
        out.push({ key: k, xp: r.xp, tasks: r.tasks, guides: r.guides, dow: parseKey(k).getDay() });
      }
      return out;
    },

    weekStats() {
      const cur = this.lastDays(7).reduce((a, d) => a + d.xp, 0);
      const prev = this.lastDays(7, 7).reduce((a, d) => a + d.xp, 0);
      let pct = null;
      if (prev > 0) pct = Math.round(((cur - prev) / prev) * 100);
      return { xp: cur, prev: prev, pct: pct };
    },

    achievementProgress(a) {
      const st = achievementStats(LM.Store.get());
      return { cur: Math.min(st[a.key], a.goal), goal: a.goal };
    }
  };
})();
