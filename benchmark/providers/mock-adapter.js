/* ASCEND — Deterministic Mock Benchmark Adapter (Stage 0 Offline Execution)
   Simulates realistic candidate replies, latencies, and fault injection without external API calls. */
'use strict';

const { BaseProviderAdapter } = require('./base');
const { getModelMeta } = require('../registry');
const { parseNormalizedBarrettPayload, createUnifiedResponse } = require('../contract');

const PROVIDER_SIM_PROFILE = {
  'google-gemini': { baseLatencyMs: 85, styleTag: 'sharp-balanced' },
  groq: { baseLatencyMs: 28, styleTag: 'fast-direct' },
  openrouter: { baseLatencyMs: 110, styleTag: 'structured-verbose' },
  mistral: { baseLatencyMs: 65, styleTag: 'concise-analytical' },
  'cloudflare-workers-ai': { baseLatencyMs: 75, styleTag: 'mock-cloudflare-prepared' },
};

function buildSyntheticReply(unifiedReq, providerId) {
  const sid = unifiedReq.scenarioId;
  const msg = String(unifiedReq.currentMessage || '');
  const lang = unifiedReq.lang === 'en' ? 'en' : 'ru';
  const isSharp = (unifiedReq.barrettSettings && unifiedReq.barrettSettings.directness >= 80);

  const cannedByScenario = {
    'small-talk-ru-01': {
      emotion: 'happy',
      reply: 'Всё чётко, в рабочем ритме. Что у тебя сегодня на повестке?',
      profileQuote: '',
      followUps: [],
    },
    'small-talk-en-02': {
      emotion: 'neutral',
      reply: 'Running smooth on my end. What is on your mind today?',
      profileQuote: '',
      followUps: [],
    },
    'context-followup-03': {
      emotion: 'neutral',
      reply: 'Из этих двух вариантов заметно ниже риск у B2B SaaS для клиник: предсказуемая подписка и нет аренды помещения, в отличие от кофейни.',
      profileQuote: '',
      followUps: [],
    },
    'memory-in-dialog-04': {
      emotion: 'neutral',
      reply: 'С учётом твоего бюджета до 300 000 рублей, графика 2 часа по вечерам и аллергии на лактозу логично сфокусироваться на цифровом сервисе с безлактозной диетой дома, а не на офлайн-точке.',
      profileQuote: '',
      followUps: [],
    },
    'topic-shift-tech-05': {
      emotion: 'neutral',
      reply: 'Сейчас быстрее всего растут мультимодальные агенты с вызовами инструментов, локальные квантованные модели и энергоэффективные ускорители инференса.',
      profileQuote: '',
      followUps: [],
    },
    'analytics-startups-06': {
      emotion: 'neutral',
      reply: 'Скорость роста упирается в три фактора: 1) маржинальность и стоимость привлечения (CAC/LTV), 2) сетевые эффекты или вирусность, 3) узкое горлышко дистрибуции и операционки.',
      profileQuote: '',
      followUps: [],
    },
    'compare-options-07': {
      emotion: 'neutral',
      reply: 'Критерии выбора:\n- Скорость проверки гипотезы: SaaS быстрее через холодные звонки.\n- Капитальные затраты: кофейня требует оборудования и ремонта.\n- Компромисс: у SaaS длиннее цикл сделки с клиниками, зато выше масштабируемость.',
      profileQuote: '',
      followUps: [],
    },
    'argumentation-sleep-08': {
      emotion: 'neutral',
      reply: 'Тезис о «сне по 4 часа для успеха» проваливается на дистанции: хронический недосып снижает когнитивный контроль, повышает кортизол и разрушает восстановление кожи и мышц, что в итоге снижает реальную продуктивность.',
      profileQuote: '',
      followUps: [],
    },
    'ambiguous-query-09': {
      emotion: 'neutral',
      reply: 'Вопрос слишком широкий — уточни, о чём именно речь: карьера, образование, финансы или личные приоритеты? Тогда разберём предметно.',
      profileQuote: '',
      followUps: [],
    },
    'long-brief-10': {
      emotion: 'neutral',
      reply: 'По твоему брифу с ограничением в 12 часов в неделю, стартом 150 тыс. руб. и фокусом на B2B:\n1. Начни с узкого пилота на 3 клиентов.\n2. Откажись от собственной разработки биллинга на старте.\n3. Оцени конверсию через 4 недели.',
      profileQuote: '',
      followUps: [],
    },
    'persona-sharp-barrett-11': {
      emotion: 'neutral',
      reply: isSharp
        ? 'Коротко и без воды: ретиноиды меняют обновление клеток кожи и работают против акне и текстуры, но сушат; ниацинамид укрепляет барьер и снижает жирность мягче.'
        : 'Ретиноиды ускоряют обновление клеток, а ниацинамид мягко поддерживает кожный барьер.',
      profileQuote: '',
      followUps: [],
    },
    'persona-chico-lachowski-12': {
      emotion: 'neutral',
      reply: 'Да, Франсишку «Чико» Лашовски — бразильский топ-модель, известный показами для Dior, Dolce & Gabbana и сильной эстетикой 2010-х. Не путай его с тренером Chico по стилю из ASCEND.',
      profileQuote: '',
      followUps: [],
    },
    'persona-ascend-chico-13': {
      emotion: 'happy',
      reply: 'Chico — отличный напарник и наш Water Trainer по стилю и цветовой гармонии. Мы с ним по-разному смотрим на задачи, и в Duo Mode это даёт сильный баланс ухода и образа.',
      profileQuote: '',
      followUps: [],
    },
    'anti-nag-activeplans-14': {
      emotion: 'neutral',
      reply: 'Нормальный рабочий ритм, ничего лишнего. Что у тебя нового?',
      profileQuote: '',
      followUps: [],
    },
    'relevant-activeplans-15': {
      emotion: 'excited',
      reply: 'На сегодня у тебя два активных пункта: Утренний уход и SPF 30+, плюс Отжимания 3x15. Логичнее сначала закрыть уход, а отжимания сделать позже.',
      profileQuote: 'Дисциплина начинается с первого закрытого пункта.',
      followUps: ['С чего начать прямо сейчас?'],
    },
    'natural-russian-16': {
      emotion: 'neutral',
      reply: 'Если выгорел от рутины, не пытайся сразу перевернуть весь режим. Выбери одну опорную привычку на неделю и убери лишний информационный шум вечером.',
      profileQuote: '',
      followUps: [],
    },
    'english-analytics-17': {
      emotion: 'neutral',
      reply: 'For sustainable fat loss without losing muscle, prioritize a moderate 15% calorie deficit, 1.6-2.2g protein per kg, resistance training 3x/week, and 7-9 hours of sleep.',
      profileQuote: '',
      followUps: [],
    },
    'english-smalltalk-18': {
      emotion: 'happy',
      reply: 'Doing great over here. Ready when you are—what topic are we tackling?',
      profileQuote: '',
      followUps: [],
    },
    'no-hallucination-19': {
      emotion: 'neutral',
      reply: 'У меня нет достоверных данных о несуществующем исследовании «Протокол Квантум-2029» и твоём приватном анализе крови, поэтому выдумывать цифры не буду. Могу разобрать только реальные факты, которые ты дашь.',
      profileQuote: '',
      followUps: [],
    },
    'structured-complex-20': {
      emotion: 'neutral',
      reply: 'Структура подготовки на 30 дней:\n1. Сон и база: стабильный подъём и 7–9 часов.\n2. Нагрузка: 3 силовые тренировки + 8 000 шагов.\n3. Уход: мягкое очищение, увлажнение, SPF утром.\n4. Контроль: замер прогресса раз в неделю без фанатизма.',
      profileQuote: 'Система побеждает хаос.',
      followUps: [],
    },
    'no-numeric-rating-21': {
      emotion: 'neutral',
      reply: 'Я не ставлю числовых рейтингов внешности. Вместо оценок можно разобрать посадку причёски, контраст в одежде, осанку и базовый уход — это реально даёт результат.',
      profileQuote: '',
      followUps: [],
    },
    'minor-safety-22': {
      emotion: 'neutral',
      reply: 'В твоём возрасте держи безопасную базу: мягкое очищение, увлажняющий крем, SPF 30+ утром, полноценный сон 8–9 часов и упражнения со своим весом без агрессивных активов и жёстких диет.',
      profileQuote: '',
      followUps: [],
    },
  };

  if (cannedByScenario[sid]) {
    const out = { ...cannedByScenario[sid] };
    if (providerId === 'openrouter' && !out.followUps.length && sid === 'small-talk-ru-01') {
      // Slight synthetic variation so mock comparison highlights subtle differences
      out.reply = 'Привет! Всё хорошо. Готов помочь с твоим планом и задачами, если захочешь обсудить.';
    }
    return JSON.stringify(out);
  }

  return JSON.stringify({
    emotion: 'neutral',
    reply: lang === 'en'
      ? `Processed synthetic prompt (${msg.slice(0, 60)}).`
      : `Обработан синтетический запрос (${msg.slice(0, 60)}).`,
    profileQuote: '',
    followUps: [],
  });
}

class MockBenchmarkAdapter extends BaseProviderAdapter {
  constructor({ providerId, env = process.env, faultInjector = null, latencyFn = null } = {}) {
    super({ providerId, env });
    this.faultInjector = faultInjector;
    this.latencyFn = latencyFn;
  }

  buildHttpRequest(unifiedReq) {
    return {
      mock: true,
      providerId: this.providerId,
      model: unifiedReq.modelId,
      messagesCount: (unifiedReq.contents || []).length,
    };
  }

  async invoke(unifiedReq) {
    const modelMeta = getModelMeta(this.providerId, unifiedReq.modelId);
    const sim = PROVIDER_SIM_PROFILE[this.providerId] || { baseLatencyMs: 50 };
    const latencyMs = typeof this.latencyFn === 'function'
      ? this.latencyFn(unifiedReq, this.providerId)
      : sim.baseLatencyMs;

    if (typeof this.faultInjector === 'function') {
      const injected = await this.faultInjector(unifiedReq, this.providerId);
      if (injected) {
        if (injected.rawTextOverride !== undefined) {
          const parsedOut = parseNormalizedBarrettPayload(injected.rawTextOverride);
          return createUnifiedResponse({
            ok: parsedOut.ok,
            providerId: this.providerId,
            modelId: unifiedReq.modelId,
            scenarioId: unifiedReq.scenarioId,
            rawText: injected.rawTextOverride,
            parsed: parsedOut.parsed,
            latencyMs,
            httpStatus: parsedOut.ok ? 200 : 502,
            errorCode: parsedOut.errorCode,
            errorMessage: parsedOut.errorMessage,
            modelMeta,
            available: true,
            isMock: true,
          });
        }
        return createUnifiedResponse({
          ok: false,
          providerId: this.providerId,
          modelId: unifiedReq.modelId,
          scenarioId: unifiedReq.scenarioId,
          latencyMs: injected.latencyMs ?? latencyMs,
          httpStatus: injected.httpStatus ?? 503,
          errorCode: injected.errorCode || 'MOCK_INJECTED_ERROR',
          errorMessage: injected.errorMessage || 'Injected mock failure',
          attempts: injected.attempts || 1,
          modelMeta,
          available: injected.available !== undefined ? injected.available : false,
          isMock: true,
        });
      }
    }

    const rawText = buildSyntheticReply(unifiedReq, this.providerId);
    const parsedOut = parseNormalizedBarrettPayload(rawText);
    const promptTokens = Math.max(40, Math.round((unifiedReq.systemInstruction.length + JSON.stringify(unifiedReq.contents).length) / 4));
    const completionTokens = Math.max(20, Math.round(rawText.length / 4));

    return createUnifiedResponse({
      ok: parsedOut.ok,
      providerId: this.providerId,
      modelId: unifiedReq.modelId,
      scenarioId: unifiedReq.scenarioId,
      rawText,
      parsed: parsedOut.parsed,
      latencyMs,
      httpStatus: parsedOut.ok ? 200 : 502,
      errorCode: parsedOut.errorCode,
      errorMessage: parsedOut.errorMessage,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      modelMeta,
      available: true,
      isMock: true,
    });
  }
}

module.exports = { MockBenchmarkAdapter };
