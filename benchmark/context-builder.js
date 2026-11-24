/* ASCEND — Benchmark Context Builder
   Reuses Barrett's exact pure prompt/history builders read-only from server/barrett.js
   so all models receive identical systemInstruction, multi-turn contents, and conditional ActivePlans. */
'use strict';

const {
  buildBarrettSystemInstruction,
  buildChatContents,
  isActivePlansRelevant,
  sanitizeBarrettSettings,
} = require('../server/barrett');

const { createUnifiedRequest } = require('./contract');

function buildScenarioContext(scenario) {
  const lang = scenario.lang === 'en' ? 'en' : 'ru';
  const profile = scenario.profile || { nickname: 'Alex', age: null, ageGroup: '18-24', goals: [] };
  const barrettSettings = sanitizeBarrettSettings(scenario.barrettSettings);
  const activePlans = Array.isArray(scenario.activePlans) ? scenario.activePlans : [];
  const history = Array.isArray(scenario.history) ? scenario.history : [];
  const currentMessage = String(scenario.currentMessage || '');

  const plansRelevant = isActivePlansRelevant(currentMessage, activePlans, history);
  const contents = buildChatContents({ messages: history, message: currentMessage });
  const systemInstruction = buildBarrettSystemInstruction(lang, profile, 'chat', {
    barrettSettings,
    memorySummary: scenario.memorySummary || '',
    activePlans: plansRelevant ? activePlans : [],
    updateSummary: false,
  });

  // Append explicit JSON output shape guidance for non-schema-enforced OpenAI-compatible adapters
  const benchmarkSystemInstruction = [
    systemInstruction,
    '',
    'JSON Output Format Requirement:',
    'Respond ONLY with a single valid JSON object matching this exact schema:',
    '{"emotion":"neutral"|"happy"|"sad"|"excited","reply":"<string>","profileQuote":"<string or empty>","followUps":["<optional 0-2 strings>"]}',
  ].join('\n');

  return {
    plansRelevant,
    contents,
    systemInstruction: benchmarkSystemInstruction,
  };
}

function buildUnifiedRequestForTarget(scenario, providerId, modelId, options = {}) {
  const built = buildScenarioContext(scenario);
  return createUnifiedRequest({
    scenario,
    providerId,
    modelId,
    systemInstruction: built.systemInstruction,
    contents: built.contents,
    options,
  });
}

module.exports = {
  buildScenarioContext,
  buildUnifiedRequestForTarget,
};
