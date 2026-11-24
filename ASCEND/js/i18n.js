/* ASCEND — i18n core. Dictionaries live in js/i18n/<lang>.js (LM.Dict.<lang>).
   Language is saved in state.settings.language (survives restarts, backups, imports).
   To add a language: create js/i18n/<code>.js, add the code to LANGS below. */
window.LM = window.LM || {};

(function () {
  const LANGS = ['ru', 'en'];
  const DEFAULT = 'ru';
  const FALLBACK = 'en';
  const LOCALES = { ru: 'ru-RU', en: 'en-US' };
  let lang = DEFAULT;
  const warned = new Set();

  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }
  function lookup(key) {
    const d = LM.Dict || {};
    if (d[lang] && key in d[lang]) return d[lang][key];
    if (d[FALLBACK] && key in d[FALLBACK]) {
      if (!warned.has(key)) { warned.add(key); console.warn('i18n: missing "' + key + '" for ' + lang); }
      return d[FALLBACK][key];
    }
    return null;
  }

  const I18n = LM.I18n = {
    LANGS: LANGS, DEFAULT: DEFAULT,
    lang() { return lang; },
    locale() { return LOCALES[lang] || LOCALES[DEFAULT]; },
    has(key) { const d = LM.Dict || {}; return !!(d[lang] && key in d[lang]); },
    t(key, vars) {
      const s = lookup(key);
      return interpolate(s == null ? key : s, vars);
    },
    /* plural: keys key.one / key.few / key.many / key.other */
    tn(key, n, vars) {
      const cat = new Intl.PluralRules(I18n.locale()).select(n);
      const k = lookup(key + '.' + cat) != null ? key + '.' + cat : key + '.other';
      return I18n.t(k, Object.assign({ n: n }, vars || {}));
    },
    /* Content lookup with fallback to the source text (guides/tasks stay usable before translation). */
    content(key, fallback) { return I18n.has(key) ? I18n.t(key) : fallback; },
    apply() {
      document.documentElement.lang = lang;
      document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = I18n.t(el.dataset.i18n); });
    },
    /* Read the saved language from state (call after Store.boot) */
    init() {
      const saved = LM.Store.get().settings.language;
      lang = LANGS.indexOf(saved) >= 0 ? saved : DEFAULT;
      I18n.apply();
    },
    set(l) {
      if (LANGS.indexOf(l) < 0) return false;
      lang = l;
      I18n.apply();
      LM.Store.update(s => { s.settings.language = l; });   // persists + triggers re-render
      return true;
    }
  };

  LM.t = I18n.t;
  LM.tn = I18n.tn;
})();
