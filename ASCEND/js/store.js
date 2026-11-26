/* ASCEND — persistence layer (storage schema v3).

   Keys
     NEW     localStorage 'ascend.state'   + IndexedDB 'ascend-photos'  + marker 'ascend.migration'
     LEGACY  localStorage 'looksmax.v1'    + IndexedDB 'looksmax-photos' (LOOKSMAX v0.1.0 data)

   Migration LEGACY -> NEW (Store.boot), in this order, aborting at the first failure:
     1. parse legacy state            2. save automatic backup (localStorage)
     3. copy photos to the new DB     4. write the new state under the NEW key
     5. verify state + photos field by field against the legacy data
     6. only then write the marker; the app switches to the NEW keys.
   On any failure the half-written NEW data is removed and the app keeps running on the
   LEGACY keys (compatibility mode). LEGACY data is never deleted by the migration
   (it is the permanent backup); only "Erase all data" removes it.

   Future schema changes: add MIGRATIONS[n] (n -> n+1) and bump VERSION. Each run is
   preceded by an automatic backup. Photos (large blobs) never go through localStorage. */
window.LM = window.LM || {};

(function () {
  const VERSION = 3;
  const OLD_DEFAULT_NICK = 'LooksMaxxer', NEW_DEFAULT_NICK = 'Ascender';
  const LEGACY = { state: 'looksmax.v1', db: 'looksmax-photos', reminder: 'looksmax.lastReminder' };
  const NEW = { state: 'ascend.state', db: 'ascend-photos', reminder: 'ascend.lastReminder' };
  const MARKER = 'ascend.migration';
  const LANG_KEY = 'ascend.language';   // language pref while on legacy keys (keeps looksmax.v1 pure v1)
  const BK = 'ascend.backup.';
  const KEEP_BACKUPS = 3;

  let K = NEW;                 // active keys
  let state = null;
  let memoryOnly = false;
  let mode = 'normal';         // normal | legacy | memory
  let report = {};
  const listeners = new Set();

  /* ───────── low-level localStorage ───────── */
  function readRaw(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writeRaw(key, val) { localStorage.setItem(key, val); }          // throws on quota
  function removeKey(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function readJSON(key) { const r = readRaw(key); if (!r) return null; try { return JSON.parse(r); } catch (e) { return null; } }
  function allKeys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) {} return out; }
  function storageWorks() { try { localStorage.setItem('ascend.__t', '1'); localStorage.removeItem('ascend.__t'); return true; } catch (e) { return false; } }

  /* ───────── state shape ───────── */
  function defaults() {
    return {
      version: VERSION,
      createdAt: Date.now(),
      profile: { nickname: NEW_DEFAULT_NICK, avatar: null },
      xp: 0,
      streak: { current: 0, best: 0, lastDate: null },
      stats: { tasks: 0, guides: 0, perfect: 0, photos: 0 },
      days: {},            // 'YYYY-MM-DD' -> { xp, tasks, guides }
      daily: { date: null, tasks: [], guideId: null, perfectPaid: false },
      history: [],         // newest first: { ts, date, type, title, xp, ref }
      studied: {},         // guideId -> timestamp
      favorites: [],
      achievements: {},    // id -> timestamp
      lastLevel: 1,
      settings: {
        language: 'ru',
        notifications: { enabled: false, time: '20:00' },
        appearance: { theme: 'dark', grain: true, reduceMotion: false },
        privacy: { blurPhotos: true, cloudflareFallback: false }
      }
    };
  }

  const BAD_KEYS = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };
  function merge(base, saved) {
    if (Array.isArray(base)) return saved;
    const out = Object.assign({}, base);
    for (const k in saved) {
      if (BAD_KEYS[k]) continue;
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k])) {
        out[k] = merge(base[k], saved[k]);
      } else {
        out[k] = saved[k];
      }
    }
    return out;
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ───────── schema migrations: MIGRATIONS[n] upgrades version n -> n+1 ───────── */
  const MIGRATIONS = {
    /* v1 (LOOKSMAX 0.1.0) -> v2 (ASCEND): language setting; history entries get a language-neutral `ref`.
       `title` is kept as the fallback text, nothing is removed or rewritten. */
    1: function (s) {
      s.settings = s.settings || {};
      if (!s.settings.language) s.settings.language = 'ru';
      const guides = LM.GUIDES || [], tasks = LM.TASK_POOL || [];
      (Array.isArray(s.history) ? s.history : []).forEach(h => {
        if (!h || typeof h !== 'object' || h.ref) return;
        const t = String(h.title || '');
        if (h.type === 'guide') {
          const g = guides.find(x => 'Studied: ' + x.title === t); if (g) h.ref = 'guide:' + g.id;
        } else if (h.type === 'task') {
          const d = tasks.find(x => x.title === t);
          if (d) h.ref = 'task:' + d.id;
          else { const g = guides.find(x => 'Study: ' + x.title === t); if (g) h.ref = 'task:guide:' + g.id; }
        } else if (h.type === 'bonus') h.ref = 'bonus:perfect';
        else if (h.type === 'photo') h.ref = 'photo:checkin';
      });
      return s;
    },
    /* v2 -> v3 (rebrand): the untouched default nickname 'LooksMaxxer' becomes 'Ascender'.
       Any nickname the user chose is left alone. */
    2: function (s) {
      if (s.profile && s.profile.nickname === OLD_DEFAULT_NICK) s.profile.nickname = NEW_DEFAULT_NICK;
      return s;
    }
  };

  function migrateState(s) {
    let v = Number(s.version) || 1;
    while (v < VERSION) {
      const fn = MIGRATIONS[v];
      if (!fn) throw new Error('No migration from schema ' + v);
      s = fn(s) || s;
      v += 1;
      s.version = v;
    }
    return s;
  }

  /* ───────── automatic backups (progress only; photos stay in IndexedDB) ───────── */
  const Backups = {
    create(kind, st) {
      const ts = Date.now();
      const key = BK + kind + '.' + ts;
      writeRaw(key, JSON.stringify({ ts: ts, kind: kind, schema: Number(st.version) || 1, xp: st.xp || 0, state: st }));
      this.prune(kind);
      return key;
    },
    list() {
      const out = [];
      allKeys().forEach(k => {
        if (!k || k.indexOf(BK) !== 0) return;
        const o = readJSON(k);
        if (o && o.state && typeof o.state === 'object') out.push({ key: k, kind: o.kind, ts: o.ts, xp: o.xp || 0, schema: o.schema });
      });
      return out.sort((a, b) => b.ts - a.ts);
    },
    has(kind) { return this.list().some(b => b.kind === kind); },
    prune(kind) {
      if (kind === 'pre-migration') return;      // the upgrade backup is never rotated away
      this.list().filter(b => b.kind === kind).slice(KEEP_BACKUPS).forEach(b => removeKey(b.key));
    },
    read(key) { const o = readJSON(key); return o && o.state ? o.state : null; }
  };

  /* ───────── persist ───────── */
  /* The legacy key must stay readable by LOOKSMAX 0.1.0: write the exact v1 shape (no schema-2 additions). */
  function toLegacyShape(st) {
    const o = clone(st);
    o.version = 1;
    if (o.settings) delete o.settings.language;
    if (Array.isArray(o.history)) o.history.forEach(h => { if (h && typeof h === 'object') delete h.ref; });
    return o;
  }

  function persist() {
    if (memoryOnly) return false;
    try {
      if (K === LEGACY) {
        writeRaw(LEGACY.state, JSON.stringify(toLegacyShape(state)));
        writeRaw(LANG_KEY, (state.settings && state.settings.language) || 'ru');
      } else writeRaw(K.state, JSON.stringify(state));
      return true;
    }
    catch (e) { memoryOnly = true; mode = 'memory'; console.warn('ASCEND: cannot write localStorage', e); return false; }
  }
  const notify = () => listeners.forEach(l => { try { l(state); } catch (e) { console.error(e); } });

  /* ───────── verification helpers ───────── */
  function isSubset(a, b) {            // every field of a exists in b with the same value
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => isSubset(x, b[i]));
    if (a && typeof a === 'object') return !!b && typeof b === 'object' && !Array.isArray(b) && Object.keys(a).every(k => isSubset(a[k], b[k]));
    return a === b;
  }
  function verifyState(legacy, migrated) {
    const L = clone(legacy), N = clone(migrated), problems = [];
    delete L.version; delete N.version;
    if (N.settings) delete N.settings.language;
    if (L.profile && N.profile && L.profile.nickname === OLD_DEFAULT_NICK && N.profile.nickname === NEW_DEFAULT_NICK) N.profile.nickname = OLD_DEFAULT_NICK;   // intended rebrand
    if (Array.isArray(N.history)) N.history.forEach(h => { if (h && typeof h === 'object') delete h.ref; });
    Object.keys(L).forEach(k => { if (!isSubset(L[k], N[k])) problems.push(k); });
    return problems;
  }

  /* ───────── boot / migration ───────── */
  async function legacyDbExists() {
    try {
      if (indexedDB.databases) { const l = await indexedDB.databases(); return l.some(d => d.name === LEGACY.db); }
    } catch (e) {}
    return false;
  }

  async function startFresh(opts) {
    K = NEW; state = defaults(); mode = 'normal';
    if (opts && opts.adoptPhotos) {
      try { report.photos = await LM.Photos.copy(LEGACY.db, NEW.db); } catch (e) { console.warn('ASCEND: could not adopt old photos', e); }
    }
    persist();
    try { writeRaw(MARKER, JSON.stringify({ verified: true, fresh: true, at: Date.now(), schema: VERSION })); } catch (e) {}
  }

  async function migrateLegacy(legacyRaw) {
    let legacy;
    try { legacy = JSON.parse(legacyRaw); if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) throw new Error('not an object'); }
    catch (e) {
      try { writeRaw('ascend.corrupt.' + Date.now(), legacyRaw); } catch (_) {}
      report.corrupt = true;
      await startFresh({ adoptPhotos: true });
      return;
    }

    const original = clone(legacy);     // pristine copy: migration must never be able to alter what we verify against
    let migrated = null;
    try {
      // 1+2: automatic backup BEFORE anything is written (aborts the migration if it fails)
      if (!Backups.has('pre-migration')) Backups.create('pre-migration', legacy);
      // 3: state upgrade in memory
      const merged = merge(defaults(), clone(legacy));
      merged.version = Number(legacy.version) || 1;
      migrated = migrateState(merged);
      // 4: photos -> new DB (IndexedDB to IndexedDB, never through localStorage)
      const copied = await LM.Photos.copy(LEGACY.db, NEW.db);
      // 5: write candidate state under the NEW key and read it back
      writeRaw(NEW.state, JSON.stringify(migrated));
      const back = JSON.parse(readRaw(NEW.state));
      const problems = verifyState(original, back);
      const pv = await LM.Photos.verifyCopy(LEGACY.db, NEW.db);
      if (pv.length) problems.push('photos: ' + pv.join(', '));
      if (problems.length) throw new Error('verification failed: ' + problems.join(', '));
      // 6: switch
      const rem = readRaw(LEGACY.reminder); if (rem) { try { writeRaw(NEW.reminder, rem); } catch (e) {} }
      writeRaw(MARKER, JSON.stringify({ verified: true, at: Date.now(), from: Number(legacy.version) || 1, schema: VERSION, xp: legacy.xp, photos: copied, history: (legacy.history || []).length }));
      K = NEW; state = back; mode = 'normal';
      report.migrated = true; report.photos = copied;
    } catch (e) {
      // roll back the half-written NEW data; LEGACY data was never touched
      removeKey(NEW.state); removeKey(MARKER);
      try { await LM.Photos.clearDb(NEW.db); } catch (_) {}
      K = LEGACY; mode = 'legacy';
      if (!migrated) { migrated = merge(defaults(), clone(original)); migrated.version = Number(legacy.version) || 1; try { migrated = migrateState(migrated); } catch (_) {} }
      state = migrated;
      const lg = readRaw(LANG_KEY); if (lg === 'ru' || lg === 'en') state.settings.language = lg;
      report.error = (e && e.message) || String(e);
      console.error('ASCEND: migration failed, running in compatibility mode', e);
    }
  }

  function loadNew(raw) {
    let st = defaults();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      const oldV = Number(parsed.version) || 1;
      st = merge(defaults(), parsed);
      st.version = oldV;
      if (oldV < VERSION) {
        try { Backups.create('pre-schema', parsed); } catch (e) { throw new Error('backup failed: ' + e.message); }
        st = migrateState(st);
      }
      st.version = oldV > VERSION ? oldV : VERSION;
    } catch (e) {
      try { writeRaw('ascend.corrupt.' + Date.now(), raw); } catch (_) {}
      report.corrupt = true;
      console.warn('ASCEND: state corrupted, copy kept', e);
      st = defaults();
    }
    return st;
  }

  /* ───────── public Store ───────── */
  LM.Store = {
    VERSION: VERSION,
    async boot() {
      report = { migrated: false, error: null, corrupt: false, photos: 0 };
      if (!storageWorks()) {
        memoryOnly = true; mode = 'memory'; K = NEW; state = defaults();
        return this.report();
      }
      const marker = readJSON(MARKER);
      const newRaw = readRaw(NEW.state);
      const legacyRaw = readRaw(LEGACY.state);
      if (marker && marker.verified && newRaw != null) {
        K = NEW; mode = 'normal'; state = loadNew(newRaw); persist();
      } else if (legacyRaw != null) {
        await migrateLegacy(legacyRaw);
      } else if (newRaw != null) {
        K = NEW; mode = 'normal'; state = loadNew(newRaw); persist();
        try { writeRaw(MARKER, JSON.stringify({ verified: true, at: Date.now(), schema: VERSION })); } catch (e) {}
      } else {
        await startFresh({ adoptPhotos: await legacyDbExists() });
      }
      return this.report();
    },
    report() { return Object.assign({ mode: mode }, report); },
    mode() { return mode; },
    get() { return state; },
    isPersistent() { return !memoryOnly; },
    update(fn, silent) {
      fn(state);
      persist();
      if (!silent) notify();
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /* Replace the whole state (import/restore). strict: throw and keep the old state if it cannot be saved. */
    replaceAll(newState, opts) {
      const prev = state, prevMem = memoryOnly, prevMode = mode;
      const inV = Number(newState.version) || VERSION;
      let next = merge(defaults(), newState);
      next.version = inV;
      next = migrateState(next);
      state = next;
      if (!persist() && opts && opts.strict) { state = prev; memoryOnly = prevMem; mode = prevMode; throw new Error('storage'); }
      notify();
    },
    backups: Backups,
    restoreBackup(key) {
      const st = Backups.read(key);
      if (!st) throw new Error('backup missing');
      try { Backups.create('pre-restore', state); } catch (e) {}
      this.replaceAll(st, { strict: true });
    },
    /* Reset game progress, keep profile, favorites, settings, photos. A safety copy is saved first. */
    resetProgress() {
      try { Backups.create('pre-reset', state); } catch (e) { console.warn('ASCEND: pre-reset backup failed', e); }
      const d = defaults();
      this.update(s => {
        s.xp = 0; s.streak = d.streak; s.stats = d.stats; s.days = {};
        s.daily = d.daily; s.history = []; s.studied = {};
        s.achievements = {}; s.lastLevel = 1;
      });
    },
    /* Remove everything on this device: state, photos (both generations), legacy keys and all backups. */
    async eraseAll() {
      allKeys().forEach(k => { if (k && (k.indexOf('ascend.') === 0 || k.indexOf('looksmax.') === 0)) removeKey(k); });
      try { await LM.Photos.clearDb(NEW.db); } catch (e) {}
      try { if (await legacyDbExists()) await LM.Photos.clearDb(LEGACY.db); } catch (e) {}
      K = NEW; mode = memoryOnly ? 'memory' : 'normal';
      state = defaults();
      persist();
      try { writeRaw(MARKER, JSON.stringify({ verified: true, fresh: true, at: Date.now(), schema: VERSION })); } catch (e) {}
      notify();
    },
    reminderKey() { return K.reminder; },
    storageEstimate() { return (readRaw(K.state) || '').length * 2; }
  };

  /* ───────── Photos (IndexedDB) ─────────
     Active DB follows the active keys. Methods with a db argument are used by the migration. */
  const dbs = {};
  function open(name) {
    if (dbs[name]) return dbs[name];
    dbs[name] = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB not available'));
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('full')) db.createObjectStore('full', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { delete dbs[name]; reject(req.error); };
      req.onblocked = () => { delete dbs[name]; reject(new Error('IndexedDB blocked')); };
    });
    return dbs[name];
  }
  function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  function txDone(t) { return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('transaction aborted')); }); }

  async function listIn(name) {
    const db = await open(name);
    const all = await reqP(db.transaction('meta').objectStore('meta').getAll());
    return all.sort((a, b) => b.ts - a.ts);
  }
  async function blobIn(name, id) {
    const db = await open(name);
    const row = await reqP(db.transaction('full').objectStore('full').get(id));
    return row ? row.blob : null;
  }
  async function putIn(name, rec, blob) {
    const db = await open(name);
    const t = db.transaction(['meta', 'full'], 'readwrite');
    t.objectStore('meta').put(rec);
    if (blob) t.objectStore('full').put({ id: rec.id, blob: blob });
    await txDone(t);
  }

  LM.Photos = {
    /* rec: { id, ts, label, note, thumb(dataURL) }  blob: full image */
    async add(rec, blob) { await putIn(K.db, rec, blob); return rec; },
    list() { return listIn(K.db); },
    getBlob(id) { return blobIn(K.db, id); },
    async remove(id) {
      const db = await open(K.db);
      const t = db.transaction(['meta', 'full'], 'readwrite');
      t.objectStore('meta').delete(id); t.objectStore('full').delete(id);
      await txDone(t);
    },
    clear() { return this.clearDb(K.db); },
    async clearDb(name) {
      const db = await open(name);
      const t = db.transaction(['meta', 'full'], 'readwrite');
      t.objectStore('meta').clear(); t.objectStore('full').clear();
      await txDone(t);
    },
    async count() { const db = await open(K.db); return reqP(db.transaction('meta').objectStore('meta').count()); },

    /* Copy every photo from one DB to another (blobs are copied IndexedDB -> IndexedDB). */
    async copy(from, to) {
      const metas = await listIn(from);
      for (const m of metas) await putIn(to, m, await blobIn(from, m.id));
      return metas.length;
    },
    /* Returns a list of problems (empty = identical). */
    async verifyCopy(from, to) {
      const a = await listIn(from), b = await listIn(to), problems = [];
      if (a.length !== b.length) problems.push('count ' + a.length + '/' + b.length);
      const byId = {}; b.forEach(x => { byId[x.id] = x; });
      for (const m of a) {
        const n = byId[m.id];
        if (!n || !isSubset(m, n)) { problems.push('meta ' + m.id); continue; }
        const x = await blobIn(from, m.id), y = await blobIn(to, m.id);
        if ((x ? x.size : -1) !== (y ? y.size : -1) || (x && y && x.type !== y.type)) problems.push('blob ' + m.id);
      }
      return problems;
    },

    /* In-memory snapshot [{rec, blob}] and ATOMIC replacement (one transaction: all or nothing). */
    async snapshot() {
      const metas = await listIn(K.db), out = [];
      for (const m of metas) out.push({ rec: m, blob: await blobIn(K.db, m.id) });
      return out;
    },
    async replaceAll(items) {
      const db = await open(K.db);
      const t = db.transaction(['meta', 'full'], 'readwrite');
      const done = txDone(t);
      t.objectStore('meta').clear(); t.objectStore('full').clear();
      items.forEach(it => {
        t.objectStore('meta').put(it.rec);
        if (it.blob) t.objectStore('full').put({ id: it.rec.id, blob: it.blob });
      });
      await done;
    },

    /* For export */
    async exportAll() {
      const metas = await this.list(), out = [];
      for (const m of metas) {
        const blob = await this.getBlob(m.id);
        out.push(Object.assign({}, m, { data: blob ? await LM.blobToDataURL(blob) : null }));
      }
      return out;
    }
  };

  LM.blobToDataURL = function (blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  };

  /* Resize an image File to a JPEG Blob. opts: {max, quality, square} */
  LM.resizeImage = function (file, opts) {
    const max = (opts && opts.max) || 1280;
    const quality = (opts && opts.quality) || 0.85;
    const square = !!(opts && opts.square);
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0, w, h;
        if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; w = h = Math.min(max, s); }
        else { const k = Math.min(1, max / Math.max(sw, sh)); w = Math.round(sw * k); h = Math.round(sh * k); }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error('Could not encode image')), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a readable image')); };
      img.src = url;
    });
  };
})();
