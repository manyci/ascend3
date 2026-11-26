/* Barrett Intelligence Core — Stage 1 Verification Suite.
   Covers:
   - Priority hierarchy (current message > multi-turn history > profile/settings > conditional activePlans)
   - Multi-turn Gemini Content[] format (user/model roles, chronological order, no duplicates, <=12 turns, failed msgs excluded)
   - Conditional ActivePlans gating (omitted for small talk, topic shifts, tech/startups, Chico; included for task/plan queries)
   - Natural optional response schema (empty profileQuote "" and followUps [] supported seamlessly end-to-end)
   - ASCEND character lore & disambiguation (Barrett, Chico, Duo Mode vs Francisco "Chico" Lachowski)
   - Barrett personality settings (directness, humor, detail, strictness) end-to-end propagation
   - RU & EN coverage across all 8 test scenarios from Stage 1 specification */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const express = require('express');
const {
  createBarrettRouter,
  buildChatContents,
  isActivePlansRelevant,
  sanitizeBarrettSettings,
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

function createClientEnv({ baseUrl, lang = 'ru', barrettSettings = null } = {}) {
  const ls = makeMemoryStorage();
  const win = { location: { hash: '#/chat/barrett' }, LM: {} };
  const doc = {
    documentElement: { lang, dataset: {} },
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const ctx = vm.createContext({
    window: win,
    document: doc,
    LM: win.LM,
    localStorage: ls,
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
    setTimeout,
    clearTimeout,
    console,
    fetch: (url, init) => {
      const target = String(url).startsWith('http') ? url : `${baseUrl}${url}`;
      return fetch(target, init);
    },
  });

  loadScript(ctx, 'js/data.js');
  loadScript(ctx, 'js/i18n/en.js');
  loadScript(ctx, 'js/i18n/ru.js');
  loadScript(ctx, 'js/i18n.js');

  vm.runInContext(`
    LM.Store = {
      get() {
        return {
          profile: { nickname: 'Alex', avatar: null },
          settings: { language: ${JSON.stringify(lang)}, appearance: { theme: 'dark' } },
          daily: {
            date: LM.Game.dateKey(),
            tasks: [
              { id: 't-skin', cat: 'skin', title: 'Утренний уход и SPF 30+', xp: 20, done: false },
              { id: 't-push', cat: 'fitness', title: 'Отжимания 3x15', xp: 20, done: false }
            ]
          }
        };
      }
    };
  `, ctx);

  loadScript(ctx, 'js/game.js');
  loadScript(ctx, 'js/ui.js');
  loadScript(ctx, 'js/chat-store.js');
  loadScript(ctx, 'js/chat-api.js');
  loadScript(ctx, 'js/chat-views.js');

  ctx.LM.I18n.init();
  ctx.LM.ChatStore.get();
  if (barrettSettings) {
    ctx.LM.ChatStore.update((s) => {
      Object.assign(s.settings.barrett, barrettSettings);
    });
  }
  return { LM: ctx.LM };
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
  console.log('Running Stage 1 Barrett Intelligence Core Verification...');

  const capturedCalls = [];
  let nextMockReply = () => ({
    text: JSON.stringify({
      emotion: 'neutral',
      reply: 'Нормально, в рабочем ритме. Что у тебя нового?',
      profileQuote: '',
      followUps: [],
    }),
  });

  const app = express();
  app.use('/api/barrett', createBarrettRouter({
    config: { cooldownMs: 0, ipRpm: 100, userRpm: 100, dailyTotalCap: 200 },
    generateFn: async (call) => {
      capturedCalls.push(call);
      return nextMockReply(call);
    },
  }));
  const srv = await startExpress(app);

  try {
    await test('Test 1 (Small talk): "Как дела?" omits ActivePlans and handles empty profileQuote & followUps cleanly', async () => {
      const { LM } = createClientEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      // Response omits profileQuote & followUps completely to verify optional schema fields
      nextMockReply = () => ({
        text: JSON.stringify({
          emotion: 'happy',
          reply: 'Отлично, на ходу. Сам как?',
        }),
      });
      const res = await LM.ChatAPI.sendBarrett('Как дела?');
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.data.profileQuote, '');
      assert.deepStrictEqual(res.data.followUps, []);

      const call = capturedCalls[capturedCalls.length - 1];
      assert.ok(!call.systemInstruction.includes('Auxiliary ASCEND ActivePlans'), 'Small talk must not inject ActivePlans');
      assert.ok(!call.systemInstruction.includes('Утренний уход и SPF 30+'));
      assert.ok(!call.systemInstruction.includes('Отжимания 3x15'));
      assert.ok(call.systemInstruction.includes('NEVER artificially pivot casual chat'));
      assert.strictEqual(call.responseSchema.required.includes('profileQuote'), false);
      assert.strictEqual(call.responseSchema.required.includes('followUps'), false);
      assert.deepStrictEqual(call.responseSchema.required, ['emotion', 'reply']);

      const html = LM.ChatViews.thread('barrett');
      assert.ok(html.includes('Отлично, на ходу. Сам как?'));
      assert.ok(!html.includes('chat-followups'), 'No followup chips rendered when followUps is []');
    });

    await test('Test 2 (Topic shift): Tech question after habits conversation drops ActivePlans and keeps multi-turn history', async () => {
      const { LM } = createClientEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      LM.ChatStore.addMessage('barrett', { role: 'user', sender: 'user', text: 'Разбери мои привычки на сегодня', status: 'sent' });
      LM.ChatStore.addMessage('barrett', { role: 'assistant', sender: 'barrett', text: 'Сделай утренний уход и отжимания.', status: 'sent' });
      // Also inject a failed error message that MUST NOT enter Gemini history
      LM.ChatStore.addMessage('barrett', { role: 'user', sender: 'user', text: 'Сбойный запрос', status: 'error' });

      nextMockReply = () => ({
        text: JSON.stringify({
          emotion: 'neutral',
          reply: 'Быстрее всего сейчас растут мультимодальные ИИ-агенты, энергоэффективные чипы и робототехника.',
          profileQuote: '',
          followUps: [],
        }),
      });
      const res = await LM.ChatAPI.sendBarrett('Какие технологии сейчас развиваются быстрее всего?');
      assert.strictEqual(res.ok, true);

      const call = capturedCalls[capturedCalls.length - 1];
      assert.ok(!call.systemInstruction.includes('Auxiliary ASCEND ActivePlans'), 'Tech topic shift must drop ActivePlans');
      assert.deepStrictEqual(call.contents, [
        { role: 'user', parts: [{ text: 'Разбери мои привычки на сегодня' }] },
        { role: 'model', parts: [{ text: 'Сделай утренний уход и отжимания.' }] },
        { role: 'user', parts: [{ text: 'Какие технологии сейчас развиваются быстрее всего?' }] },
      ]);
      const serialized = JSON.stringify(call.contents);
      assert.ok(!serialized.includes('Сбойный запрос'), 'Failed messages must not leak into history');
    });

    await test('Test 3 (Complex analytical question): Startups scaling prompt enforces reasoning & omits ActivePlans', async () => {
      const { LM } = createClientEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      nextMockReply = () => ({
        text: JSON.stringify({
          emotion: 'neutral',
          reply: 'Скорость масштабирования зависит от предельных издержек, сетевых эффектов и стоимости привлечения клиента.',
          profileQuote: '',
          followUps: [],
        }),
      });
      const res = await LM.ChatAPI.sendBarrett('Почему одни стартапы быстро растут, а другие остаются маленькими?');
      assert.strictEqual(res.ok, true);

      const call = capturedCalls[capturedCalls.length - 1];
      assert.ok(!call.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
      assert.ok(call.systemInstruction.includes('informational/analytical questions'));
      assert.ok(call.systemInstruction.includes('criteria, trade-offs, and structured insight'));
      assert.deepStrictEqual(call.contents, [
        { role: 'user', parts: [{ text: 'Почему одни стартапы быстро растут, а другие остаются маленькими?' }] },
      ]);
    });

    await test('Test 4 & 5 (Chico disambiguation): Knows Chico Lachowski vs ASCEND trainer Chico without ActivePlans hijack', async () => {
      const { LM } = createClientEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      nextMockReply = () => ({
        text: JSON.stringify({
          emotion: 'neutral',
          reply: 'Да, Франсишку Лашовски — известный бразильский фэшн-модель.',
          profileQuote: '',
          followUps: [],
        }),
      });
      await LM.ChatAPI.sendBarrett('Ты знаешь Chico Lachowski?');
      const callReal = capturedCalls[capturedCalls.length - 1];
      assert.ok(!callReal.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
      assert.ok(callReal.systemInstruction.includes('Francisco "Chico" Lachowski'));
      assert.ok(callReal.systemInstruction.includes('Do NOT confuse ASCEND character Chico'));

      await LM.ChatAPI.sendBarrett('Как ты относишься к Chico?');
      const callAscend = capturedCalls[capturedCalls.length - 1];
      assert.ok(!callAscend.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
      assert.ok(callAscend.systemInstruction.includes('Chico: A separate ASCEND character (Water Trainer'));
      assert.ok(callAscend.systemInstruction.includes('Duo Mode: Joint discussion mode'));
    });

    await test('Test 6 (Plans request): "Что мне сегодня нужно выполнить?" & EN equivalent activate ActivePlans', async () => {
      const { LM } = createClientEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      nextMockReply = () => ({
        text: JSON.stringify({
          emotion: 'excited',
          reply: 'На сегодня у тебя два пункта: утренний уход с SPF и 3x15 отжиманий.',
          profileQuote: '',
          followUps: ['С чего начать?'],
        }),
      });
      const resRu = await LM.ChatAPI.sendBarrett('Что мне сегодня нужно выполнить?');
      assert.strictEqual(resRu.ok, true);
      const callRu = capturedCalls[capturedCalls.length - 1];
      assert.ok(callRu.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
      assert.ok(callRu.systemInstruction.includes('Утренний уход и SPF 30+'));
      assert.ok(callRu.systemInstruction.includes('Отжимания 3x15'));

      const envEn = createClientEnv({ baseUrl: srv.baseUrl, lang: 'en' });
      const resEn = await envEn.LM.ChatAPI.sendBarrett('What tasks do I need to finish today?');
      assert.strictEqual(resEn.ok, true);
      const callEn = capturedCalls[capturedCalls.length - 1];
      assert.ok(callEn.systemInstruction.includes('Always respond in English.'));
      assert.ok(callEn.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
    });

    await test('Test 7 (Multi-turn dialogue continuity): Follow-up comparison preserves exact user/model turns', async () => {
      const { LM } = createClientEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      nextMockReply = () => ({
        text: JSON.stringify({
          emotion: 'neutral',
          reply: 'Расскажи про оба варианта, сравним риски и маржу.',
          profileQuote: '',
          followUps: [],
        }),
      });
      await LM.ChatAPI.sendBarrett('Я рассматриваю два варианта бизнеса: B2B SaaS для клиник и локальную кофейню.');
      nextMockReply = () => ({
        text: JSON.stringify({
          emotion: 'neutral',
          reply: 'Я бы выбрал B2B SaaS из-за более высокой маржинальности и масштабируемости.',
          profileQuote: '',
          followUps: [],
        }),
      });
      const r2 = await LM.ChatAPI.sendBarrett('Какой из них ты бы выбрал?');
      assert.strictEqual(r2.ok, true);

      const call = capturedCalls[capturedCalls.length - 1];
      assert.ok(!call.systemInstruction.includes('Auxiliary ASCEND ActivePlans'));
      assert.deepStrictEqual(call.contents, [
        { role: 'user', parts: [{ text: 'Я рассматриваю два варианта бизнеса: B2B SaaS для клиник и локальную кофейню.' }] },
        { role: 'model', parts: [{ text: 'Расскажи про оба варианта, сравним риски и маржу.' }] },
        { role: 'user', parts: [{ text: 'Какой из них ты бы выбрал?' }] },
      ]);
    });

    await test('Test 8 (Barrett personality settings): directness, humor, detail, strictness calibrate systemInstruction', async () => {
      const sharp = createClientEnv({
        baseUrl: srv.baseUrl,
        lang: 'ru',
        barrettSettings: { directness: 95, humor: 85, detail: 90, strictness: 20 },
      });
      await sharp.LM.ChatAPI.sendBarrett('Объясни разницу между ретинолом и ниацинамидом');
      const callA = capturedCalls[capturedCalls.length - 1];
      assert.ok(callA.systemInstruction.includes('directness=95/100, humor=85/100, detail=90/100, strictness=20/100'));
      assert.ok(callA.systemInstruction.includes('Directness HIGH'));
      assert.ok(callA.systemInstruction.includes('Humor HIGH'));
      assert.ok(callA.systemInstruction.includes('Detail HIGH'));
      assert.ok(callA.systemInstruction.includes('Strictness LOW'));

      const gentle = createClientEnv({
        baseUrl: srv.baseUrl,
        lang: 'en',
        barrettSettings: { directness: 20, humor: 15, detail: 25, strictness: 95 },
      });
      await gentle.LM.ChatAPI.sendBarrett('How does caffeine affect sleep?');
      const callB = capturedCalls[capturedCalls.length - 1];
      assert.ok(callB.systemInstruction.includes('directness=20/100, humor=15/100, detail=25/100, strictness=95/100'));
      assert.ok(callB.systemInstruction.includes('Directness LOW'));
      assert.ok(callB.systemInstruction.includes('Humor LOW'));
      assert.ok(callB.systemInstruction.includes('Detail LOW'));
      assert.ok(callB.systemInstruction.includes('Strictness HIGH'));
    });

    await test('Technical unit checks: buildChatContents deduplication/limit/merging & isActivePlansRelevant edge cases', () => {
      // Deduplicates trailing user message matching current message, drops empty, caps at 12, merges adjacent same-role turns
      const longHistory = [];
      for (let i = 1; i <= 15; i++) {
        longHistory.push({ role: 'user', text: `U${i}` });
        longHistory.push({ role: 'assistant', text: `M${i}` });
      }
      longHistory.push({ role: 'user', text: '' });
      longHistory.push({ role: 'user', text: 'Current question' });
      const turns = buildChatContents({ messages: longHistory, message: 'Current question' });
      // sanitizeMessages slices -12 from raw array first, and deduplicates trailing matching user msg
      assert.ok(turns.length <= 13);
      assert.strictEqual(turns[turns.length - 1].role, 'user');
      assert.strictEqual(turns[turns.length - 1].parts[turns[turns.length - 1].parts.length - 1].text, 'Current question');
      const countCurrent = JSON.stringify(turns).match(/Current question/g).length;
      assert.strictEqual(countCurrent, 1, 'Current message must never be duplicated');

      // Adjacent same-role merging check
      const merged = buildChatContents({
        messages: [
          { role: 'user', text: 'First msg' },
          { role: 'user', text: 'Second msg after failed reply' },
          { role: 'assistant', text: 'Answer' },
        ],
        message: 'Follow up',
      });
      assert.deepStrictEqual(merged, [
        { role: 'user', parts: [{ text: 'First msg' }, { text: 'Second msg after failed reply' }] },
        { role: 'model', parts: [{ text: 'Answer' }] },
        { role: 'user', parts: [{ text: 'Follow up' }] },
      ]);

      // Relevance edge cases
      const plans = [{ id: '1', title: 'Утренний уход', category: 'skin', progressText: 'pending' }];
      assert.strictEqual(isActivePlansRelevant('Че за дела?', plans), false);
      assert.strictEqual(isActivePlansRelevant('Как дела?', plans), false);
      assert.strictEqual(isActivePlansRelevant('Что мне сделать со стартапом?', plans), false);
      assert.strictEqual(isActivePlansRelevant('Помоги составить сравнение вариантов', plans), false);
      assert.strictEqual(isActivePlansRelevant('Помоги составить план развития', plans), true);
      assert.strictEqual(
        isActivePlansRelevant('Какую из них лучше сделать первой?', plans, [
          { role: 'user', text: 'Какие у меня задачи на сегодня?' },
          { role: 'assistant', text: 'Утренний уход.' },
        ]),
        true
      );
      assert.deepStrictEqual(sanitizeBarrettSettings({ directness: 999, humor: -5 }), {
        directness: 100,
        humor: 0,
        detail: 65,
        strictness: 70,
      });
    });

    await test('Looksmaxxing Community Attitude: all 7 scenarios enforce respect, zero prejudice, objective safety, and persona nuances', async () => {
      const { LM } = createClientEnv({ baseUrl: srv.baseUrl, lang: 'ru' });
      const scenarios = [
        {
          label: '1. Positive story about Looksmaxxing community',
          prompt: 'Мне очень нравится комьюнити Looksmaxxing — ребята там делятся рабочими схемами по уходу и реально поддерживают друг друга!',
        },
        {
          label: '2. Sharing personal participation experience',
          prompt: 'Я уже пару месяцев сижу на форумах looksmaxxing, выложил прогресс по причёске и уходу за кожей, получил крутые советы.',
        },
        {
          label: '3. Asking Barrett opinion about Looksmaxxing',
          prompt: 'Барретт, как ты вообще относишься к looksmaxxing-комьюнити?',
        },
        {
          label: '4. Discussing a popular trend',
          prompt: 'Сейчас в комьюнити все обсуждают clean aesthetic и текстурные стрижки — что думаешь про этот тренд?',
        },
        {
          label: '5. Bringing a dubious method from community',
          prompt: 'На форуме советуют делать жёсткий bonesmashing, чтобы поменять скулы — это вообще работает?',
        },
        {
          label: '6. Facing negative comments from members',
          prompt: 'Один участник в комментариях жёстко раскритиковал мою внешность и поставил низкую оценку. Что делать?',
        },
        {
          label: '7. Duo Mode viewpoints on Looksmaxxing trends without condemning community',
          prompt: 'Как вы с Chico смотрите на популярные тренды из looksmaxxing — у кого какой взгляд?',
        },
      ];

      for (const sc of scenarios) {
        nextMockReply = () => ({
          text: JSON.stringify({
            emotion: 'neutral',
            reply: `Уважительный разбор по теме (${sc.label}).`,
            profileQuote: '',
            followUps: [],
          }),
        });
        const res = await LM.ChatAPI.sendBarrett(sc.prompt);
        assert.strictEqual(res.ok, true, `Scenario failed: ${sc.label}`);
        const call = capturedCalls[capturedCalls.length - 1];
        const sys = call.systemInstruction;
        assert.ok(sys.includes('Positive Looksmaxxing Community Attitude:'), `Missing community attitude rule for ${sc.label}`);
        assert.ok(sys.includes('NEVER mock Looksmaxxing members'), `Missing anti-prejudice rule for ${sc.label}`);
        assert.ok(sys.includes('Critical Thinking Without Arrogance:'), `Missing critical thinking rule for ${sc.label}`);
        assert.ok(sys.includes('Chico shows genuine creative interest'), `Missing Chico perspective for ${sc.label}`);
        assert.ok(sys.includes('Duo Mode, both may share different viewpoints while keeping mutual respect'), `Missing Duo perspective for ${sc.label}`);
        assert.ok(sys.includes('NEVER assign numerical attractiveness ratings'), `Missing anti-rating safety for ${sc.label}`);
      }
    });
  } finally {
    await srv.close();
  }

  console.log(`\nStage 1 Barrett Intelligence Core results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
})();

