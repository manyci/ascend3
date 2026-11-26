/* ASCEND — backup export / import.
   File format 2:  { app:'ascend', format:2, schema:2, exportedAt, state, photos:[{id,ts,label,note,thumb,data}] }
   Imports also accept LOOKSMAX files: { app:'looksmax', format:1, state, photos }.

   Import is validate-first: nothing on the device is touched until the whole file has been
   parsed, sanitized and every photo decoded. Applying it is then:
     safety copy of current progress -> snapshot of current photos (memory)
     -> atomic photo replace (one IndexedDB transaction) -> save state (strict)
   and any failure restores the snapshot. */
window.LM = window.LM || {};

(function () {
  const FORMAT = 2;
  const MAX_PHOTOS = 500;
  const MAX_AVATAR = 400 * 1024;
  const APPS = ['ascend', 'looksmax'];

  class BackupError extends Error {
    constructor(key, vars) { super(key); this.i18n = key; this.vars = vars || {}; }
    get userMessage() { return LM.t(this.i18n, this.vars); }
  }
  const fail = (key, vars) => { throw new BackupError(key, vars); };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const isNum = v => typeof v === 'number' && isFinite(v);

  function checkState(s) {
    if (!isObj(s)) fail('err.state', { field: 'state' });
    if (!isNum(s.xp) || s.xp < 0) fail('err.state', { field: 'xp' });
    if (s.createdAt != null && !isNum(s.createdAt)) fail('err.state', { field: 'createdAt' });
    if (s.lastLevel != null && !isNum(s.lastLevel)) fail('err.state', { field: 'lastLevel' });
    if (s.profile != null) {
      if (!isObj(s.profile)) fail('err.state', { field: 'profile' });
      if (s.profile.nickname != null && typeof s.profile.nickname !== 'string') fail('err.state', { field: 'nickname' });
      const av = s.profile.avatar;
      if (av != null && (typeof av !== 'string' || !/^data:image\//.test(av) || av.length > MAX_AVATAR)) fail('err.state', { field: 'avatar' });
    }
    if (s.streak != null) {
      if (!isObj(s.streak)) fail('err.state', { field: 'streak' });
      ['current', 'best'].forEach(k => { if (s.streak[k] != null && (!isNum(s.streak[k]) || s.streak[k] < 0)) fail('err.state', { field: 'streak.' + k }); });
      if (s.streak.lastDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(s.streak.lastDate))) fail('err.state', { field: 'streak.lastDate' });
    }
    if (s.stats != null) {
      if (!isObj(s.stats)) fail('err.state', { field: 'stats' });
      Object.keys(s.stats).forEach(k => { if (!isNum(s.stats[k])) fail('err.state', { field: 'stats.' + k }); });
    }
    ['days', 'studied', 'achievements', 'settings', 'daily'].forEach(k => { if (s[k] != null && !isObj(s[k])) fail('err.state', { field: k }); });
    ['history', 'favorites'].forEach(k => { if (s[k] != null && !Array.isArray(s[k])) fail('err.state', { field: k }); });
    if (s.history) {
      if (s.history.length > 5000) fail('err.state', { field: 'history' });
      s.history.forEach(h => { if (!isObj(h) || !isNum(h.xp) || !isNum(h.ts)) fail('err.state', { field: 'history' }); });
    }
    if (s.favorites && s.favorites.some(f => typeof f !== 'string')) fail('err.state', { field: 'favorites' });
    if (s.days) Object.keys(s.days).forEach(k => { if (!isObj(s.days[k])) fail('err.state', { field: 'days' }); });
    [s.studied, s.achievements].forEach(o => { if (o) Object.keys(o).forEach(k => { if (!isNum(o[k])) fail('err.state', { field: 'timestamps' }); }); });
    if (s.settings) {
      const st = s.settings;
      if (st.language != null && LM.I18n.LANGS.indexOf(st.language) < 0) delete st.language;     // unknown language -> default
      if (st.appearance != null && !isObj(st.appearance)) fail('err.state', { field: 'settings.appearance' });
      if (st.appearance && st.appearance.theme != null && ['dark', 'light'].indexOf(st.appearance.theme) < 0) fail('err.state', { field: 'settings.theme' });
      if (st.notifications != null) {
        if (!isObj(st.notifications)) fail('err.state', { field: 'settings.notifications' });
        if (st.notifications.time != null && !/^\d{2}:\d{2}$/.test(String(st.notifications.time))) fail('err.state', { field: 'settings.time' });
      }
    }
  }

  function dataUrlToBlob(url) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url || '');
    if (!m) throw new Error('bad data url');
    const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (!bytes.length) throw new Error('empty');
    return new Blob([bytes], { type: m[1] });
  }

  LM.Backup = {
    FORMAT: FORMAT,
    BackupError: BackupError,

    async build() {
      const photos = await LM.Photos.exportAll();
      return { app: 'ascend', format: FORMAT, schema: LM.Store.VERSION, exportedAt: new Date().toISOString(), state: LM.Store.get(), photos: photos };
    },
    filename() { return 'ascend-backup-' + LM.Game.dateKey() + '.json'; },

    /* Validate and decode a backup file. Throws BackupError. Does not touch any stored data. */
    parse(text) {
      let data;
      try { data = JSON.parse(text); } catch (e) { fail('err.notJson'); }
      if (!isObj(data) || APPS.indexOf(data.app) < 0 || !isObj(data.state)) fail('err.notBackup');
      if (data.format != null && (!isNum(data.format) || data.format > FORMAT)) fail('err.newer');
      const state = clone(data.state);
      if (state.version != null && !isNum(state.version)) fail('err.state', { field: 'version' });
      if ((Number(state.version) || 1) > LM.Store.VERSION) fail('err.newer');
      checkState(state);

      const rawPhotos = data.photos == null ? [] : data.photos;
      if (!Array.isArray(rawPhotos)) fail('err.photo', { n: 1 });
      if (rawPhotos.length > MAX_PHOTOS) fail('err.photoCount');
      const seen = new Set(), items = [];
      rawPhotos.forEach((p, i) => {
        const n = i + 1;
        if (!isObj(p) || typeof p.id !== 'string' || !p.id || seen.has(p.id) || !isNum(p.ts) || typeof p.thumb !== 'string' || !/^data:image\//.test(p.thumb)) fail('err.photo', { n: n });
        seen.add(p.id);
        let blob;
        try { blob = dataUrlToBlob(p.data); } catch (e) { fail('err.photo', { n: n }); }
        items.push({ rec: { id: p.id, ts: p.ts, label: String(p.label || 'PROGRESS').slice(0, 20), note: String(p.note || '').slice(0, 200), thumb: p.thumb }, blob: blob });
      });
      return { state: state, photos: items, summary: { xp: Math.round(state.xp), photos: items.length, app: data.app } };
    },

    /* Apply a parsed backup. Rolls everything back on failure. */
    async apply(parsed) {
      const S = LM.Store;
      const before = JSON.parse(JSON.stringify(S.get()));
      try { S.backups.create('pre-import', before); } catch (e) { fail('err.storage'); }   // no safety copy -> no import
      const snap = await LM.Photos.snapshot();
      try {
        await LM.Photos.replaceAll(parsed.photos);
        S.replaceAll(parsed.state, { strict: true });
      } catch (e) {
        let restored = true;
        // state: Store.replaceAll(strict) already put the previous state back and left the stored copy untouched;
        // photos: restore the snapshot in one atomic transaction
        try { await LM.Photos.replaceAll(snap); } catch (e2) { restored = false; console.error('ASCEND: rollback failed', e2); }
        const err = new Error(e && e.message === 'storage' ? LM.t('err.storage') : (e && e.message) || 'error');
        err.rolledBack = restored;
        throw err;
      }
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
})();
