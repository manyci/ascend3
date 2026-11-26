/* ASCEND — UI helpers: icons, escaping, toasts, level-up, sheets, shared components. */
window.LM = window.LM || {};

(function () {
  const P = {
    home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    guides: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z M4 17a3 3 0 0 1 3-3h11',
    chat: 'M21 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z',
    send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
    book: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z M4 17a3 3 0 0 1 3-3h11',
    progress: 'M5 21V11 M12 21V4 M19 21v-7',
    profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-7 8-7s8 3 8 7',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    flame: 'M12 22c4 0 7-2.8 7-7 0-3.2-1.8-5.3-3.4-7.2-.6 1.4-1.4 2.2-2.4 2.6.4-3-.6-6.4-3.7-8.4.1 3-1.4 4.6-2.8 6.2C5.4 10.2 5 12 5 15c0 4.2 3 7 7 7z',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    star: 'M12 2l3 7 7 .6-5.3 4.6 1.7 7.3L12 17.8 5.6 21.5l1.7-7.3L2 9.6 9 9z',
    crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
    trophy: 'M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v2a3 3 0 0 0 3 3 M17 6h3v2a3 3 0 0 1-3 3 M12 14v4 M8 21h8',
    dumbbell: 'M6 7v10 M3 9v6 M18 7v10 M21 9v6 M6 12h12',
    check: 'M5 12l5 5 9-10',
    camera: 'M4 8h4l2-3h4l2 3h4v12H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
    chevron: 'M9 6l6 6-6 6',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
    plus: 'M12 5v14 M5 12h14',
    x: 'M6 6l12 12 M18 6L6 18',
    pencil: 'M4 20l4-1L19 8l-3-3L5 16z',
    bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 21h4',
    moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
    image: 'M4 4h16v16H4z M4 16l5-5 5 5 2-2 4 4 M9 9h.01',
    lock: 'M6 11h12v9H6z M8 11V7a4 4 0 0 1 8 0v4',
    database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    refresh: 'M20 11a8 8 0 0 0-14-4L4 9 M4 4v5h5 M4 13a8 8 0 0 0 14 4l2-2 M20 20v-5h-5',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v6 M12 7.5h.01',
    trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
    download: 'M12 4v12 M7 11l5 5 5-5 M4 20h16',
    upload: 'M12 16V4 M7 9l5-5 5 5 M4 20h16',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    warning: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    back: 'M15 6l-6 6 6 6',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.600 3.800 5.600 3.800 9s-1.300 6.400-3.800 9c-2.500-2.600-3.800-5.600-3.800-9s1.300-6.400 3.800-9z',
    shield: 'M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z',
    droplet: 'M12 3c-4 5-6 8.2-6 11a6 6 0 0 0 12 0c0-2.8-2-6-6-11z',
    activity: 'M3 12h4l2.5-6 4 12 2.5-6H21',
    dots: 'M12 5h.01 M12 12h.01 M12 19h.01',
    pin: 'M12 17v5 M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
    copy: 'M9 9h10v10H9z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
    archive: 'M3 4h18v4H3z M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8 M10 12h4',
    restore: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5'
  };

  LM.icon = function (name, opts) {
    opts = opts || {};
    const d = P[name] || P.star;
    const style = opts.size ? ' style="font-size:' + opts.size + 'px"' : '';
    return '<svg class="i' + (opts.fill ? ' fill' : '') + '" viewBox="0 0 24 24"' + style + ' aria-hidden="true"><path d="' + d + '"/></svg>';
  };

  LM.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  LM.fmt = n => Number(n).toLocaleString(LM.I18n.locale());

  LM.dateLabel = function (key) {
    const today = LM.Game.dateKey();
    const d = LM.Game.diffDays(key, today);
    if (d === 0) return LM.t('date.today');
    if (d === 1) return LM.t('date.yesterday');
    const dt = LM.Game.parseKey(key);
    const opts = { day: 'numeric', month: 'short' };
    if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return new Intl.DateTimeFormat(LM.I18n.locale(), opts).format(dt);
  };

  /* Language-neutral labels for stored records & localized catalog helpers. */
  LM.guideTitle = g => LM.I18n.content('guide.' + g.id + '.title', g.title);
  LM.guideField = (g, f) => LM.I18n.content('guide.' + g.id + '.' + f, g[f]);
  LM.catLabel = c => LM.I18n.content('cat.' + c.id, c.label);
  LM.catSub = c => LM.I18n.content('cat.' + c.id + '.sub', '');
  LM.evLabel = key => LM.I18n.content('ev.' + key, LM.EVIDENCE[key] ? LM.EVIDENCE[key].label : key);
  LM.evNote = key => LM.I18n.content('ev.' + key + '.note', LM.EVIDENCE[key] ? LM.EVIDENCE[key].note : '');
  LM.achName = a => LM.I18n.content('ach.' + a.id + '.name', a.name);
  LM.achDesc = a => LM.I18n.content('ach.' + a.id + '.desc', a.desc);
  LM.toastTaskTitle = function (raw) {
    if (raw === 'Perfect day bonus') return LM.t('hist.perfect');
    if (raw === 'Progress photo check-in') return LM.t('hist.photo');
    const found = LM.TASK_POOL && LM.TASK_POOL.find(t => t.title === raw);
    return found ? LM.I18n.content('task.' + found.id, raw) : raw;
  };
  LM.taskTitle = function (t) {
    if (t.kind === 'guide' || String(t.id).indexOf('guide:') === 0) {
      const g = LM.Game.guideById(String(t.id).slice(6));
      return g ? LM.t('task.study', { title: LM.guideTitle(g) }) : t.title;
    }
    return LM.I18n.content('task.' + t.id, t.title);
  };
  LM.historyTitle = function (h) {
    const ref = String(h.ref || '');
    if (ref.indexOf('guide:') === 0) { const g = LM.Game.guideById(ref.slice(6)); if (g) return LM.t('hist.studied', { title: LM.guideTitle(g) }); }
    else if (ref.indexOf('task:guide:') === 0) { const g = LM.Game.guideById(ref.slice(11)); if (g) return LM.t('task.study', { title: LM.guideTitle(g) }); }
    else if (ref.indexOf('task:') === 0) { const d = LM.Game.taskDef(ref.slice(5)); if (d) return LM.I18n.content('task.' + d.id, d.title); }
    else if (ref === 'bonus:perfect') return LM.t('hist.perfect');
    else if (ref === 'photo:checkin') return LM.t('hist.photo');
    return h.title;
  };

  LM.catById = id => LM.CATEGORIES.find(c => c.id === id) || LM.CATEGORIES[0];

  /* ───────── progression display modes (Standard vs Looksmaxxing) ─────────
     Displays two views over the exact same underlying XP / game level state.
     SUB 3 begins immediately at Level 1 (0 XP, Levels 1-7), followed by SUB 5 (8-12),
     LTN (13-17), MTN (18-22), HTN (23-27), CHADLITE (28-32), CHAD (33+). */
  const PROG_KEY = 'ascend.progression';
  LM.LOOKSMAXXING_TIERS = [
    { id: 'sub3', label: 'SUB 3', minLevel: 1, maxLevel: 7 },
    { id: 'sub5', label: 'SUB 5', minLevel: 8, maxLevel: 12 },
    { id: 'ltn', label: 'LTN', minLevel: 13, maxLevel: 17 },
    { id: 'mtn', label: 'MTN', minLevel: 18, maxLevel: 22 },
    { id: 'htn', label: 'HTN', minLevel: 23, maxLevel: 27 },
    { id: 'chadlite', label: 'CHADLITE', minLevel: 28, maxLevel: 32 },
    { id: 'chad', label: 'CHAD', minLevel: 33, maxLevel: null }
  ];

  LM.progressionMode = function () {
    try {
      return localStorage.getItem(PROG_KEY) === 'looksmaxxing' ? 'looksmaxxing' : 'standard';
    } catch (e) {
      return 'standard';
    }
  };

  LM.setProgressionMode = function (mode) {
    const next = mode === 'looksmaxxing' ? 'looksmaxxing' : 'standard';
    try { localStorage.setItem(PROG_KEY, next); } catch (e) {}
    return next;
  };

  LM.progressionView = function (xp) {
    const totalXp = Math.max(0, Number(xp) || 0);
    const li = LM.Game.levelInfo(totalXp);
    const mode = LM.progressionMode();
    const xpAt = L => LM.Game.xpToReach(L);

    if (mode !== 'looksmaxxing') {
      return {
        mode: 'standard',
        li: li,
        primaryLabel: LM.t('home.level', { n: li.level }),
        statLabel: LM.t('progress.level'),
        statValue: String(li.level),
        subLabel: '',
        xpLine: LM.fmt(li.total) + ' / ' + LM.fmt(li.next) + ' XP',
        barPct: li.pct,
        isLooksmaxxing: false,
        isPreTier: false,
        isApex: false,
        tier: null,
        nextTier: null
      };
    }

    const tierIdx = LM.LOOKSMAXXING_TIERS.findIndex(t => li.level >= t.minLevel && (t.maxLevel === null || li.level <= t.maxLevel));
    const tier = LM.LOOKSMAXXING_TIERS[tierIdx >= 0 ? tierIdx : 0];
    const nextTier = tierIdx >= 0 && tierIdx + 1 < LM.LOOKSMAXXING_TIERS.length ? LM.LOOKSMAXXING_TIERS[tierIdx + 1] : null;

    if (!nextTier) {
      return {
        mode: 'looksmaxxing',
        li: li,
        primaryLabel: tier.label,
        statLabel: LM.t('prog.tierLabel'),
        statValue: tier.label,
        subLabel: LM.t('home.level', { n: li.level }),
        xpLine: LM.fmt(totalXp) + ' / ' + LM.fmt(li.next) + ' XP · ' + LM.t('home.level', { n: li.level + 1 }),
        barPct: li.pct,
        isLooksmaxxing: true,
        isPreTier: false,
        isApex: true,
        tier: tier,
        nextTier: null
      };
    }

    const baseXp = xpAt(tier.minLevel);
    const nextXp = xpAt(nextTier.minLevel);
    const pct = Math.min(100, Math.max(0, Math.round(((totalXp - baseXp) / Math.max(1, nextXp - baseXp)) * 100)));
    return {
      mode: 'looksmaxxing',
      li: li,
      primaryLabel: tier.label,
      statLabel: LM.t('prog.tierLabel'),
      statValue: tier.label,
      subLabel: LM.t('home.level', { n: li.level }),
      xpLine: LM.fmt(totalXp) + ' / ' + LM.fmt(nextXp) + ' XP · ' + nextTier.label,
      barPct: pct,
      isLooksmaxxing: true,
      isPreTier: false,
      isApex: false,
      tier: tier,
      nextTier: nextTier
    };
  };

  /* Reusable fragments */
  LM.avatarHTML = function (cls) {
    const p = LM.Store.get().profile;
    const init = LM.esc((p.nickname || '?').trim().charAt(0).toUpperCase() || '?');
    return '<div class="avatar ' + (cls || '') + '">' + (p.avatar ? '<img alt="" src="' + p.avatar + '">' : init) + '</div>';
  };

  LM.hexHTML = function (a, unlocked, size) {
    return '<div class="hex ' + (unlocked ? 'on' : 'off') + ' ' + (size || '') + '">' + LM.icon(a.icon, { fill: unlocked && (a.icon === 'star' || a.icon === 'flame' || a.icon === 'crown' || a.icon === 'bolt') }) + '</div>';
  };

  LM.glyphHTML = function (g, cls) {
    const idx = LM.CATEGORIES.findIndex(c => c.id === g.cat);
    return '<div class="glyph' + (cls ? ' ' + cls : '') + '" style="--n:' + idx + '"><span>' + LM.catById(g.cat).code + '</span></div>';
  };

  LM.pips = function (n) {
    let h = '<div class="pips" aria-label="' + LM.esc(LM.t('guide.effAria', { n: n })) + '">';
    for (let i = 1; i <= 5; i++) h += '<i class="' + (i <= n ? 'f' : '') + '"></i>';
    return h + '</div>';
  };

  /* Reference-aligned smooth XP trend spline: glowing orange curve + rich amber area gradient + clean data nodes, minimal backdrop noise. */
  LM.trendChartSVG = function (days) {
    const n = days.length || 1;
    const max = Math.max.apply(null, days.map(d => d.xp).concat([1]));
    const hasData = days.some(d => d.xp > 0);
    const W = 320, H = 96;
    const padX = 10, topY = 8, baseY = 88;
    const plotH = baseY - topY, plotW = W - padX * 2;
    const step = n > 1 ? plotW / (n - 1) : plotW;
    const areaId = 'xpAreaGrad-' + n;

    let out = '<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + LM.esc(LM.t('progress.chartAria')) + '">';
    out += '<defs>' +
      '<linearGradient id="' + areaId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.40"/>' +
        '<stop offset="65%" stop-color="var(--accent)" stop-opacity="0.12"/>' +
        '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>' +
      '</linearGradient>' +
    '</defs>';
    out += '<line class="gridline" x1="' + padX + '" y1="' + Math.round(topY + plotH * 0.5) + '" x2="' + (W - padX) + '" y2="' + Math.round(topY + plotH * 0.5) + '" stroke-dasharray="2 5"/>';
    out += '<line class="baseline" x1="' + padX + '" y1="' + baseY + '" x2="' + (W - padX) + '" y2="' + baseY + '"/>';

    const coords = days.map((d, i) => {
      const cx = n === 1 ? W / 2 : padX + step * i;
      const y = d.xp > 0 ? Math.max(topY + 4, Math.min(baseY - 6, Math.round(baseY - Math.max(10, (d.xp / max) * (plotH - 8))))) : baseY;
      return { cx, y, d, isLast: i === n - 1 };
    });

    function smoothPath(pts) {
      if (pts.length < 2) return '';
      let d = 'M' + pts[0].cx.toFixed(1) + ',' + pts[0].y.toFixed(1);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const q3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1.cx + (p2.cx - p0.cx) / 6;
        const cp1y = Math.max(topY, Math.min(baseY, p1.y + (p2.y - p0.y) / 6));
        const cp2x = p2.cx - (q3.cx - p1.cx) / 6;
        const cp2y = Math.max(topY, Math.min(baseY, p2.y - (q3.y - p1.y) / 6));
        d += ' C' + cp1x.toFixed(1) + ',' + cp1y.toFixed(1) + ' ' + cp2x.toFixed(1) + ',' + cp2y.toFixed(1) + ' ' + p2.cx.toFixed(1) + ',' + p2.y.toFixed(1);
      }
      return d;
    }

    if (coords.length > 1) {
      if (hasData) {
        const lineD = smoothPath(coords);
        const areaD = lineD + ' L' + coords[coords.length - 1].cx.toFixed(1) + ',' + baseY + ' L' + coords[0].cx.toFixed(1) + ',' + baseY + ' Z';
        out += '<path class="tarea" fill="url(#' + areaId + ')" d="' + areaD + '"/>';
        out += '<path class="tline" fill="none" d="' + lineD + '"/>';
      } else {
        out += '<line class="tline emptyline" x1="' + padX + '" y1="' + baseY + '" x2="' + (W - padX) + '" y2="' + baseY + '"/>';
      }
    }

    coords.forEach((c, i) => {
      const showDot = hasData && (c.d.xp > 0 || i === 0 || c.isLast || coords.length <= 12);
      if (showDot) {
        out += '<circle class="tdot' + (c.d.xp > 0 ? ' active' : ' zero') + (c.isLast ? ' today' : '') + '" cx="' + c.cx.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="' + (c.d.xp > 0 ? 3.8 : 2.2) + '"><title>' + LM.esc((c.d.label || c.d.key) + ': ' + c.d.xp + ' XP') + '</title></circle>';
      }
    });

    out += '</svg>';
    return out;
  };

  /* ───────── toasts ───────── */
  const toastQ = [];
  let toastBusy = false;
  function pump() {
    if (toastBusy || !toastQ.length) return;
    toastBusy = true;
    const t = toastQ.shift();
    const root = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = t.html;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); toastBusy = false; pump(); }, 260);
    }, t.ms || 1900);
  }
  LM.toast = function (html, ms) { toastQ.push({ html: html, ms: ms }); pump(); };

  LM.showLevelUp = function () {
    const app = document.getElementById('app');
    if (!app) return;
    app.querySelectorAll('.lvl').forEach(node => node.remove());
    const pv = LM.progressionView(LM.Store.get().xp);
    const tierBadge = (pv.isLooksmaxxing && pv.tier)
      ? '<div class="lvl-tier">' + LM.esc(pv.tier.label) + '</div>'
      : '';
    const el = document.createElement('div');
    el.className = 'lvl';
    el.innerHTML = '<div class="k">' + LM.esc(LM.t('lvl.tag')) + '</div><div class="w">' + LM.esc(LM.t('lvl.word')) + '</div><div class="n">' + pv.li.level + '</div>' + tierBadge + '<div class="h">' + LM.esc(LM.t('lvl.hint')) + '</div>';
    const close = () => { el.remove(); };
    el.addEventListener('click', close);
    app.appendChild(el);
    setTimeout(close, 3800);
  };

  /* ───────── sheets / dialogs ───────── */
  LM.sheet = function (title, html, onMount) {
    LM.closeSheet();
    const app = document.getElementById('app');
    const scrim = document.createElement('div');
    scrim.className = 'scrim'; scrim.id = 'sheet-scrim';
    scrim.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + LM.esc(title) + '"><div class="hd"><h2 class="h2">' + LM.esc(title) + '</h2><button class="x" data-act="close-sheet" aria-label="' + LM.esc(LM.t('common.close')) + '">' + LM.icon('x') + '</button></div><div class="sbody">' + html + '</div></div>';
    scrim.addEventListener('click', e => { if (e.target === scrim) LM.closeSheet(); });
    app.appendChild(scrim);
    if (onMount) onMount(scrim.querySelector('.sbody'), scrim);
    return scrim;
  };
  LM.closeSheet = function () { const s = document.getElementById('sheet-scrim'); if (s) s.remove(); };
  LM.sheetBody = function () { const s = document.getElementById('sheet-scrim'); return s && s.querySelector('.sbody'); };

  document.addEventListener('keydown', e => { if (e.key === 'Escape') LM.closeSheet(); });

  /* confirm(opts) -> Promise<boolean>; opts.type = 'RESET' requires typing the word */
  LM.confirm = function (o) {
    return new Promise(resolve => {
      let html = '<p>' + o.text + '</p>';
      if (o.type) html += '<label class="field"><span>' + LM.esc(LM.t('common.typeToConfirm', { word: o.type })) + '</span><input class="input" id="cf-in" autocomplete="off" autocapitalize="characters"></label>';
      html += '<div class="stack"><button class="btn" id="cf-ok"' + (o.type ? ' disabled' : '') + '>' + LM.esc(o.ok || LM.t('common.confirm')) + '</button><button class="btn ghost" id="cf-no">' + LM.esc(LM.t('common.cancel')) + '</button></div>';
      const scrim = LM.sheet(o.title || LM.t('common.confirm'), html, body => {
        const ok = body.querySelector('#cf-ok'), no = body.querySelector('#cf-no'), inp = body.querySelector('#cf-in');
        if (inp) inp.addEventListener('input', () => { ok.disabled = inp.value.trim().toUpperCase() !== o.type; });
        ok.addEventListener('click', () => { LM.closeSheet(); resolve(true); });
        no.addEventListener('click', () => { LM.closeSheet(); resolve(false); });
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(scrim)) { obs.disconnect(); resolve(false); } });
      obs.observe(document.getElementById('app'), { childList: true });
    });
  };

  LM.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
})();
