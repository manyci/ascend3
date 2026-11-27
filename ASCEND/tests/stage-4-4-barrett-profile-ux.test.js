/* Stage 4.4 — Barrett Profile, Personality & Chat Experience Upgrade Test Suite.
   Covers:
   1. 100% EN/RU dictionary parity for chat.profile.* and chat.followupAria keys
   2. Extensible LM.MENTOR_PROFILES & LM.getMentorProfile('barrett' | 'chico') + asset existence on disk
   3. Telegram-style Barrett Profile Overlay opened via avatar/header trigger in chat-head
   4. Exact scroll position, dialogue history, and composer input draft preservation on open/close (Back button, Escape, popstate)
   5. Interactive follow-up prompts (chat-followup): clicking populates #chat-input without auto-sending; manual edit + submit sends edited text
   6. Barrett personality upgrade (Jordan Barrett inspiration, first-person initiative, strict identity boundary, preserved safety & ASCEND rules) */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const express = require('express');
const {
  createBarrettRouter,
  buildBarrettSystemInstruction,
  buildCloudflareFallbackInstruction,
} = require('../../server/barrett');

const ROOT = path.join(__dirname, '..');

function loadScript(ctx, relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  vm.runInContext(code, ctx, { filename: relPath });
}

function makeMemoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] || null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
  };
}

function createInteractiveDomEnv({ baseUrl, storage, hash = '#/chat/barrett', lang = 'ru' } = {}) {
  const ls = storage || makeMemoryStorage();
  const docListeners = new Map();
  const docCaptureListeners = new Map();
  const winListeners = new Map();
  const observers = [];
  const timers = new Set();
  const intervals = new Set();
  const historyStack = [{ state: null }];
  let historyIdx = 0;

  function parseAttrs(str) {
    const out = {};
    const re = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let m;
    while ((m = re.exec(str))) {
      const k = m[1].toLowerCase();
      if (k === 'disabled' || k === 'hidden' || k === 'checked') {
        out[k] = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : '');
      } else {
        out[k] = m[2] ?? m[3] ?? m[4] ?? '';
      }
    }
    return out;
  }

  function matchesSel(node, sel) {
    return sel.split(',').some((rawPart) => {
      const part = rawPart.trim();
      if (!part) return false;
      const simple = part.split(/\s+/).pop();
      let rest = simple;
      let tag = '';
      const tm = rest.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
      if (tm) { tag = tm[0].toLowerCase(); rest = rest.slice(tag.length); }
      if (tag && node.tagName !== tag) return false;
      for (const m of rest.matchAll(/#([a-zA-Z0-9_-]+)/g)) {
        if (node.id !== m[1]) return false;
      }
      for (const m of rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        if (!node.classList.contains(m[1])) return false;
      }
      for (const m of rest.matchAll(/\[([^\]=]+)(?:="([^"]*)"|='([^']*)')?\]/g)) {
        const attrName = m[1].toLowerCase();
        const want = m[2] ?? m[3];
        if (!node.hasAttribute(attrName)) return false;
        if (want !== undefined && node.getAttribute(attrName) !== want) return false;
      }
      return true;
    });
  }

  function makeEl(tag, initialAttrs = {}) {
    const children = [];
    const attrs = {};
    const classSet = new Set();
    const dataset = {};
    const listeners = new Map();
    let inner = '';
    let textVal = '';
    const el = {
      tagName: String(tag || 'div').toLowerCase(),
      parentNode: null,
      children,
      style: { height: '' },
      value: '',
      checked: false,
      disabled: false,
      hidden: false,
      scrollHeight: 68,
      scrollTop: 0,
      selectionStart: 0,
      selectionEnd: 0,
      dataset,
      get id() { return attrs.id || ''; },
      set id(v) { attrs.id = String(v); },
      get className() { return Array.from(classSet).join(' '); },
      set className(v) {
        classSet.clear();
        String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
        attrs.class = Array.from(classSet).join(' ');
      },
      classList: {
        add(...cs) { cs.forEach((c) => c && classSet.add(c)); attrs.class = Array.from(classSet).join(' '); },
        remove(...cs) { cs.forEach((c) => classSet.delete(c)); attrs.class = Array.from(classSet).join(' '); },
        contains(c) { return classSet.has(c); },
        toggle(c, force) {
          const on = force !== undefined ? Boolean(force) : !classSet.has(c);
          if (on) classSet.add(c); else classSet.delete(c);
          attrs.class = Array.from(classSet).join(' ');
          return on;
        },
      },
      setAttribute(k, v) {
        const lk = String(k).toLowerCase();
        attrs[lk] = String(v);
        if (lk === 'class') el.className = String(v);
        if (lk.startsWith('data-')) {
          const camel = lk.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
          dataset[camel] = String(v);
        }
        if (lk === 'value') el.value = String(v);
        if (lk === 'disabled') el.disabled = true;
        if (lk === 'hidden') el.hidden = true;
      },
      getAttribute(k) {
        const lk = String(k).toLowerCase();
        return Object.prototype.hasOwnProperty.call(attrs, lk) ? attrs[lk] : null;
      },
      hasAttribute(k) { return el.getAttribute(k) !== null; },
      appendChild(child) {
        children.push(child);
        child.parentNode = el;
        observers.forEach((o) => { if (!o.disconnected && o.target === el) queueMicrotask(o.cb); });
        return child;
      },
      remove() {
        if (!el.parentNode) return;
        const p = el.parentNode;
        const idx = p.children.indexOf(el);
        if (idx >= 0) p.children.splice(idx, 1);
        el.parentNode = null;
        observers.forEach((o) => { if (!o.disconnected && o.target === p) queueMicrotask(o.cb); });
      },
      contains(target) {
        if (target === el) return true;
        return children.some((c) => c.contains(target));
      },
      closest(sel) {
        let cur = el;
        while (cur) {
          if (matchesSel(cur, sel)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (node) => {
          for (const c of node.children) {
            if (matchesSel(c, sel)) out.push(c);
            walk(c);
          }
        };
        walk(el);
        return out;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        const arr = listeners.get(type);
        if (arr) listeners.set(type, arr.filter((f) => f !== fn));
      },
      dispatchEvent(ev) {
        const event = Object.assign({
          type: 'click',
          target: el,
          defaultPrevented: false,
          preventDefault() { event.defaultPrevented = true; },
          stopPropagation() { event._stopped = true; },
        }, ev);
        const capFns = docCaptureListeners.get(event.type) || [];
        for (const fn of capFns) {
          if (event._stopped) break;
          fn(event);
        }
        let cur = el;
        while (cur && !event._stopped) {
          const fns = cur._listeners.get(event.type) || [];
          for (const fn of fns) fn(event);
          cur = cur.parentNode;
        }
        if (!event._stopped) {
          const docFns = docListeners.get(event.type) || [];
          for (const fn of docFns) fn(event);
        }
        return !event.defaultPrevented;
      },
      click() { return el.dispatchEvent({ type: 'click', target: el }); },
      focus() { doc.activeElement = el; },
      select() {},
      setSelectionRange(s, e) { el.selectionStart = s; el.selectionEnd = e; },
      scrollIntoView() {},
      _listeners: listeners,
      _addText(t) { textVal += t; },
      get textContent() { return textVal; },
      set textContent(v) { textVal = String(v == null ? '' : v); },
      get innerHTML() { return inner; },
      set innerHTML(html) {
        inner = String(html || '');
        children.length = 0;
        textVal = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const voidTags = new Set(['input', 'img', 'br', 'hr', 'path', 'circle', 'line', 'rect', 'polygon', 'stop']);
        const stack = [el];
        const tagRe = /<\/?([a-zA-Z0-9_-]+)([^>]*)>|([^<]+)/g;
        let m;
        while ((m = tagRe.exec(inner))) {
          if (m[3]) {
            if (stack.length > 1) stack[stack.length - 1]._addText(m[3]);
            continue;
          }
          const full = m[0];
          const tName = m[1].toLowerCase();
          if (full.startsWith('</')) {
            if (stack.length > 1) stack.pop();
            continue;
          }
          const selfClose = full.endsWith('/>') || voidTags.has(tName);
          const child = makeEl(tName, parseAttrs(m[2] || ''));
          stack[stack.length - 1].appendChild(child);
          if (!selfClose) stack.push(child);
        }
      },
    };
    for (const [k, v] of Object.entries(initialAttrs)) el.setAttribute(k, v);
    return el;
  }

  const bodyEl = makeEl('body');
  const shellEl = makeEl('div', { class: 'shell' });
  const appEl = makeEl('div', { id: 'app', class: 'app' });
  const viewEl = makeEl('main', { id: 'view', class: 'view' });
  const navEl = makeEl('nav', { id: 'nav', class: 'nav' });
  const toastsEl = makeEl('div', { id: 'toasts', class: 'toasts' });
  appEl.appendChild(viewEl);
  appEl.appendChild(navEl);
  appEl.appendChild(toastsEl);
  shellEl.appendChild(appEl);
  bodyEl.appendChild(shellEl);

  const doc = {
    title: 'ASCEND',
    body: bodyEl,
    documentElement: { lang, dataset: {}, setAttribute() {}, style: {} },
    activeElement: null,
    createElement: (tag) => makeEl(tag),
    getElementById: (id) => bodyEl.querySelector(`#${id}`),
    querySelector: (sel) => bodyEl.querySelector(sel),
    querySelectorAll: (sel) => bodyEl.querySelectorAll(sel),
    addEventListener: (type, fn, capture = false) => {
      const target = capture ? docCaptureListeners : docListeners;
      if (!target.has(type)) target.set(type, []);
      target.get(type).push(fn);
    },
    dispatchEvent: (ev) => bodyEl.dispatchEvent(ev),
  };

  const win = {
    LM: {},
    innerWidth: 390,
    scrollTo() {},
    history: {
      get state() { return historyStack[historyIdx] ? historyStack[historyIdx].state : null; },
      pushState(state) {
        historyStack.splice(historyIdx + 1);
        historyStack.push({ state: state || null });
        historyIdx = historyStack.length - 1;
      },
      back() {
        if (historyIdx > 0) {
          historyIdx -= 1;
          (winListeners.get('popstate') || []).forEach((fn) => fn({ state: win.history.state }));
        }
      },
    },
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    location: {
      _hash: hash,
      get hash() { return this._hash; },
      set hash(v) {
        this._hash = v;
        (winListeners.get('hashchange') || []).forEach((fn) => fn());
      },
    },
  };

  class FakeMutationObserver {
    constructor(cb) { this.cb = cb; this.rec = null; }
    observe(target) {
      this.rec = { target, cb: this.cb, disconnected: false };
      observers.push(this.rec);
    }
    disconnect() {
      if (this.rec) this.rec.disconnected = true;
    }
  }

  const ctx = vm.createContext({
    window: win,
    document: doc,
    location: win.location,
    LM: win.LM,
    localStorage: ls,
    MutationObserver: FakeMutationObserver,
    Intl,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Promise,
    Error,
    AbortController,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout: (fn, ms) => {
      const id = setTimeout(fn, ms);
      if (id.unref) id.unref();
      timers.add(id);
      return id;
    },
    clearTimeout: (id) => { timers.delete(id); clearTimeout(id); },
    setInterval: (fn, ms) => {
      const id = setInterval(fn, ms);
      if (id.unref) id.unref();
      intervals.add(id);
      return id;
    },
    clearInterval: (id) => { intervals.delete(id); clearInterval(id); },
    console,
    fetch: async (url, init) => {
      const target = String(url).startsWith('http') ? url : `${baseUrl}${url}`;
      return fetch(target, init);
    },
  });

  [
    'js/data.js',
    'js/practices.js',
    'js/demos.js',
    'js/i18n/en.js',
    'js/i18n/ru.js',
    'js/i18n.js',
    'js/store.js',
    'js/backup.js',
    'js/game.js',
    'js/ui.js',
    'js/views.js',
    'js/chat-store.js',
    'js/chat-api.js',
    'js/chat-views.js',
    'js/app.js',
  ].forEach((p) => loadScript(ctx, p));

  return {
    ctx,
    win,
    doc,
    LM: ctx.LM,
    ls,
    dispose() {
      timers.forEach((id) => clearTimeout(id));
      intervals.forEach((id) => clearInterval(id));
    },
  };
}

function startExpress(app) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(app);
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => srv.close(() => r())),
      });
    });
  });
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error('       ', err && err.stack ? err.stack : err);
    failed += 1;
  }
}

(async () => {
  console.log('Running Stage 4.4 Barrett Profile, Personality & Follow-up UX tests...');

  const upstreamRequests = [];
  const app = express();
  app.use('/api/barrett', createBarrettRouter({
    config: { cooldownMs: 0, ipRpm: 100, userRpm: 100, dailyTotalCap: 200 },
    generateFn: async (call) => {
      upstreamRequests.push(call);
      const lastMsg = Array.isArray(call.contents)
        ? call.contents[call.contents.length - 1]?.parts?.map((p) => p.text).join(' ')
        : String(call.contents || '');
      return {
        text: JSON.stringify({
          emotion: 'happy',
          reply: `Ответ на: ${lastMsg}`,
          profileQuote: '',
          followUps: ['Уточни про вечерний уход', 'Подбери мягкий SPF на каждый день'],
        }),
      };
    },
  }));

  const srv = await startExpress(app);

  try {
    await test('1. 100% EN/RU dictionary parity & extensible LM.MENTOR_PROFILES (Barrett + Chico ready) + portrait asset on disk', async () => {
      const env = createInteractiveDomEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      await new Promise((r) => setTimeout(r, 30));

      const enKeys = Object.keys(env.LM.Dict.en || {});
      const ruKeys = Object.keys(env.LM.Dict.ru || {});
      assert.deepStrictEqual(enKeys.filter((k) => !(k in env.LM.Dict.ru)), []);
      const chatEn = enKeys.filter((k) => k.startsWith('chat.') || k === 'nav.chat');
      const chatRu = ruKeys.filter((k) => k.startsWith('chat.') || k === 'nav.chat');
      assert.deepStrictEqual(chatEn.filter((k) => !(k in env.LM.Dict.ru)), []);
      assert.deepStrictEqual(chatRu.filter((k) => !(k in env.LM.Dict.en)), []);

      assert.ok(env.LM.MENTOR_PROFILES && env.LM.MENTOR_PROFILES.barrett && env.LM.MENTOR_PROFILES.chico);
      const barrettRu = env.LM.getMentorProfile('barrett');
      assert.strictEqual(barrettRu.displayName, 'Jordan Barrett');
      assert.strictEqual(barrettRu.profileEnabled, true);
      assert.strictEqual(barrettRu.photo, '/assets/avatars/barrett-portrait.png');
      assert.ok(fs.existsSync(path.join(ROOT, 'assets/avatars/barrett-portrait.png')), 'barrett-portrait.png must exist in ASCEND/assets/avatars');
      assert.ok(barrettRu.status.includes('Виртуальный AI-персонаж'));
      assert.ok(barrettRu.personality.length > 30);
      assert.ok(barrettRu.bio.length > 30);
      assert.ok(barrettRu.quote.length > 15);
      assert.strictEqual(barrettRu.interests.length, 5);
      assert.strictEqual(barrettRu.specializations.length, 4);
      assert.strictEqual(barrettRu.principles.length, 4);

      const chicoRu = env.LM.getMentorProfile('chico');
      assert.strictEqual(chicoRu.displayName, 'Chico');
      assert.strictEqual(chicoRu.profileEnabled, false, 'Chico profile hook ready without activating incomplete Chico mentor');
      assert.ok(chicoRu.specializations.length >= 2);
      assert.ok(chicoRu.principles.length >= 2);

      env.LM.I18n.set('en');
      const barrettEn = env.LM.getMentorProfile('barrett');
      assert.strictEqual(barrettEn.displayName, 'Jordan Barrett');
      assert.ok(barrettEn.status.includes('Virtual AI character'));
      assert.ok(barrettEn.specializations.length === 4);

      env.dispose();
    });

    await test('2. Header trigger renders ONLY on Barrett, opens Telegram-style overlay, and closes via Back button / Escape / popstate with exact scroll & draft preservation', async () => {
      const env = createInteractiveDomEnv({ baseUrl: srv.baseUrl, hash: '#/chat/barrett', lang: 'ru' });
      await new Promise((r) => setTimeout(r, 35));

      // Seed history so chat feed is populated and scrolled
      env.LM.ChatStore.addMessage('barrett', { role: 'user', sender: 'user', text: 'Сообщение 1' });
      env.LM.ChatStore.addMessage('barrett', {
        role: 'assistant',
        sender: 'barrett',
        text: 'Ответ 1 с деталями по уходу',
        emotion: 'neutral',
        followUps: ['Проверить SPF', 'Разобрать очищение'],
      });

      // Verify Barrett header has clickable profile trigger wrapping avatar + info, Chico/Duo do not
      const headBtn = env.doc.getElementById('chat-head-profile-btn');
      assert.ok(headBtn, 'Barrett header must have clickable profile trigger');
      assert.strictEqual(headBtn.dataset.act, 'mentor-profile');
      assert.strictEqual(headBtn.dataset.mentorId, 'barrett');
      assert.ok(headBtn.querySelector('.chat-av img'), 'Avatar image must remain inside .chat-head .chat-av img');
      assert.ok(!env.LM.ChatViews.thread('chico').includes('data-act="mentor-profile"'));
      assert.ok(!env.LM.ChatViews.thread('duo').includes('data-act="mentor-profile"'));

      // Set exact scroll position and unsent composer draft before opening profile
      const feed = env.doc.getElementById('chat-feed');
      const input = env.doc.getElementById('chat-input');
      assert.ok(feed && input);
      feed.scrollTop = 342;
      input.value = 'Мой неотправленный черновик';

      // Click avatar/header trigger -> opens overlay on #app without touching #view
      const viewHtmlBefore = env.doc.getElementById('view').innerHTML;
      headBtn.click();

      const overlay = env.doc.getElementById('mentor-profile-overlay');
      assert.ok(overlay, '#mentor-profile-overlay must mount on click');
      assert.strictEqual(env.LM.ChatViews.isMentorProfileOpen(), true);
      assert.strictEqual(env.doc.getElementById('view').innerHTML, viewHtmlBefore, '#view DOM must NOT reset when profile opens');

      // Verify all Telegram-style profile fields are displayed
      const profText = overlay.textContent;
      assert.ok(profText.includes('Jordan Barrett'));
      assert.ok(profText.includes('Виртуальный AI-персонаж'));
      assert.ok(overlay.innerHTML.includes('/assets/avatars/barrett-portrait.png'));
      assert.ok(profText.includes('Сильная подача не шумит'));
      assert.ok(profText.includes('Ясность сильнее сложности'));
      assert.ok(profText.includes('Доказательные базовые рутины'));

      // Close via Back button -> preserves exact scrollTop and unsent composer draft
      const backBtn = env.doc.getElementById('mentor-profile-back');
      assert.ok(backBtn);
      backBtn.click();

      assert.strictEqual(env.doc.getElementById('mentor-profile-overlay'), null);
      assert.strictEqual(env.LM.ChatViews.isMentorProfileOpen(), false);
      assert.strictEqual(env.doc.getElementById('chat-feed').scrollTop, 342, 'Exact scrollTop must be preserved after closing via Back button');
      assert.strictEqual(env.doc.getElementById('chat-input').value, 'Мой неотправленный черновик', 'Unsent draft must be preserved');
      assert.strictEqual(env.LM.ChatStore.getMessages('barrett').length, 2, 'Chat history must stay intact');

      // Re-open and close via Escape key -> preserves scroll & draft
      env.doc.getElementById('chat-feed').scrollTop = 198;
      headBtn.click();
      assert.strictEqual(env.LM.ChatViews.isMentorProfileOpen(), true);
      env.doc.dispatchEvent({ type: 'keydown', key: 'Escape', target: env.doc.body });
      assert.strictEqual(env.LM.ChatViews.isMentorProfileOpen(), false);
      assert.strictEqual(env.doc.getElementById('chat-feed').scrollTop, 198, 'Exact scrollTop must be preserved after closing via Escape');
      assert.strictEqual(env.doc.getElementById('chat-input').value, 'Мой неотправленный черновик');

      // Re-open and close via browser Back (popstate) -> preserves scroll & draft
      env.doc.getElementById('chat-feed').scrollTop = 275;
      headBtn.click();
      assert.strictEqual(env.LM.ChatViews.isMentorProfileOpen(), true);
      env.win.history.back();
      assert.strictEqual(env.LM.ChatViews.isMentorProfileOpen(), false);
      assert.strictEqual(env.doc.getElementById('chat-feed').scrollTop, 275, 'Exact scrollTop must be preserved after browser Back (popstate)');

      env.dispose();
    });

    await test('3. Interactive follow-ups populate #chat-input WITHOUT auto-sending; user can edit and manually submit', async () => {
      upstreamRequests.length = 0;
      const env = createInteractiveDomEnv({ baseUrl: srv.baseUrl, hash: '#/chat/barrett', lang: 'ru' });
      await new Promise((r) => setTimeout(r, 35));

      // First get a real Barrett reply with followUps
      const r1 = await env.LM.ChatAPI.sendBarrett('С чего начать базовый уход?');
      assert.strictEqual(r1.ok, true);
      assert.strictEqual(upstreamRequests.length, 1);

      const chip = env.doc.querySelector('.chat-chip[data-act="chat-followup"]');
      assert.ok(chip, 'Follow-up chip must be rendered after Barrett reply');
      const suggestedPrompt = chip.dataset.prompt;
      assert.strictEqual(suggestedPrompt, 'Уточни про вечерний уход');

      // Click follow-up chip -> fills #chat-input, focuses it, does NOT send!
      await chip.click();
      await new Promise((r) => setTimeout(r, 25));

      const inp = env.doc.getElementById('chat-input');
      assert.strictEqual(inp.value, suggestedPrompt, 'Follow-up text must be inserted into #chat-input');
      assert.strictEqual(env.doc.activeElement, inp, '#chat-input must receive focus for immediate editing');
      assert.strictEqual(upstreamRequests.length, 1, 'Clicking follow-up must NOT auto-send request');
      assert.strictEqual(env.LM.ChatStore.getMessages('barrett').length, 2, 'No new message should be added until user clicks Send');

      // User edits the prompt in #chat-input and manually submits #chat-form
      inp.value = `${suggestedPrompt} — у меня сухая кожа`;
      const form = env.doc.getElementById('chat-form');
      form.dispatchEvent({ type: 'submit', target: form });
      await new Promise((r) => setTimeout(r, 60));

      assert.strictEqual(upstreamRequests.length, 2, 'Manual form submit must send the edited prompt');
      const msgs = env.LM.ChatStore.getMessages('barrett');
      assert.strictEqual(msgs.length, 4);
      assert.strictEqual(msgs[2].text, `${suggestedPrompt} — у меня сухая кожа`);

      env.dispose();
    });

    await test('4. Barrett personality system instructions enforce Jordan Barrett inspiration, first-person style, identity boundary, and preserved safety guardrails', () => {
      const adultRu = buildBarrettSystemInstruction('ru', { nickname: 'Alex', age: 24, ageGroup: '18-24', goals: ['skin'] }, 'chat', {
        barrettSettings: { directness: 80, humor: 60, detail: 70, strictness: 70 },
        memorySummary: 'Комбинированная кожа, цель — стабильный SPF.',
        activePlans: [],
        updateSummary: true,
      });
      assert.ok(adultRu.includes('Jordan Barrett'), 'Must reference Jordan Barrett inspiration');
      assert.ok(adultRu.includes('NEVER claim to be the real-world person Jordan Barrett'), 'Must forbid impersonating real person');
      assert.ok(adultRu.includes('NEVER fabricate private real-life events'), 'Must forbid inventing real-life memories');
      assert.ok(adultRu.includes('Speak naturally in the first person'), 'Must enforce first-person voice');
      assert.ok(adultRu.includes('NEVER assign numerical attractiveness ratings'));
      assert.ok(adultRu.includes('Long-term user memory summary'));

      const minorEn = buildBarrettSystemInstruction('en', { nickname: 'Teen', age: 16, ageGroup: '16-17', goals: [] }, 'chat');
      assert.ok(minorEn.includes('STRICT MINOR SAFETY (<18)'));
      assert.ok(minorEn.includes('Always respond in English.'));

      const cfInstruction = buildCloudflareFallbackInstruction('ru', { age: 22, ageGroup: '18-24' }, {});
      assert.ok(cfInstruction.includes('Jordan Barrett'));
      assert.ok(cfInstruction.includes('NEVER claim to be the real Jordan Barrett'));
      assert.ok(cfInstruction.includes('first person'));
    });
  } finally {
    await srv.close();
  }

  console.log(`\nStage 4.4 Barrett Profile & Follow-up UX results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();
