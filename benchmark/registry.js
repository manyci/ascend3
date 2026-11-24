/* ASCEND — Benchmark Provider & Model Registry (Stage 0)
   Registry entries explicitly mark unverified availability, limits, and pricing
   as UNVERIFIED / TBD until checked against live provider docs & APIs. */
'use strict';

const PROVIDER_REGISTRY = Object.freeze({
  'google-gemini': {
    id: 'google-gemini',
    displayName: 'Google Gemini',
    role: 'control',
    apiStyle: 'google-genai',
    envVarKey: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: [
      {
        id: 'gemini-3.5-flash-lite',
        label: 'Gemini 3.5 Flash Lite (Control Baseline)',
        role: 'control',
        availabilityStatus: 'verified-in-project-config',
        freeTierStatus: 'UNVERIFIED — depends on project/API key tier',
        rateLimits: 'UNVERIFIED — verify in Google AI Studio quota console',
        pricingUsdPer1MTokens: null,
        pricingStatus: 'UNVERIFIED',
        notes: 'Current production Barrett control model in ASCEND.',
      },
      {
        id: 'gemini-candidate-placeholder',
        label: 'Gemini Candidate Slot (Verify Before Live Run)',
        role: 'candidate',
        availabilityStatus: 'unverified_requires_docs_check',
        freeTierStatus: 'UNVERIFIED',
        rateLimits: 'UNVERIFIED',
        pricingUsdPer1MTokens: null,
        pricingStatus: 'UNVERIFIED',
        notes: 'Placeholder for newer/higher-tier Gemini control comparison after docs verification.',
      },
    ],
  },

  groq: {
    id: 'groq',
    displayName: 'Groq',
    role: 'candidate',
    apiStyle: 'openai-compatible',
    envVarKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    models: [
      {
        id: 'openai/gpt-oss-120b',
        label: 'GPT-OSS 120B (Groq — Verify Availability)',
        role: 'candidate',
        availabilityStatus: 'unverified_requires_api_check',
        freeTierStatus: 'UNVERIFIED — verify Groq Developer plan limits',
        rateLimits: 'UNVERIFIED — verify RPM/TPM/TPD in Groq docs',
        pricingUsdPer1MTokens: null,
        pricingStatus: 'UNVERIFIED',
        notes: 'Include only if confirmed active in Groq /openai/v1/models at live stage.',
      },
      {
        id: 'groq-candidate-slot-2',
        label: 'Groq Secondary Candidate Slot (TBD)',
        role: 'candidate',
        availabilityStatus: 'unverified_requires_docs_check',
        freeTierStatus: 'UNVERIFIED',
        rateLimits: 'UNVERIFIED',
        pricingUsdPer1MTokens: null,
        pricingStatus: 'UNVERIFIED',
        notes: 'Populate exact Groq model ID after inspecting live Groq model catalog.',
      },
    ],
  },

  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    role: 'candidate',
    apiStyle: 'openai-compatible',
    envVarKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      {
        id: 'google/gemma-4-31b-it:free',
        label: 'Google: Gemma 4 31B (:free)',
        role: 'candidate',
        availabilityStatus: 'verified-in-openrouter-catalog',
        freeTierStatus: 'Catalog prompt=0, completion=0; inference requires OPENROUTER_API_KEY',
        rateLimits: 'UNVERIFIED — depends on OpenRouter free tier RPM/RPD',
        pricingUsdPer1MTokens: { input: 0, output: 0 },
        pricingStatus: 'verified-free-catalog',
        notes: 'Discovered from public OpenRouter /api/v1/models (ctx: 262144).',
      },
      {
        id: 'google/gemma-4-26b-a4b-it:free',
        label: 'Google: Gemma 4 26B A4B (:free)',
        role: 'candidate',
        availabilityStatus: 'verified-in-openrouter-catalog',
        freeTierStatus: 'Catalog prompt=0, completion=0; inference requires OPENROUTER_API_KEY',
        rateLimits: 'UNVERIFIED — depends on OpenRouter free tier RPM/RPD',
        pricingUsdPer1MTokens: { input: 0, output: 0 },
        pricingStatus: 'verified-free-catalog',
        notes: 'Discovered from public OpenRouter /api/v1/models (ctx: 262144).',
      },
      {
        id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        label: 'NVIDIA: Nemotron 3 Ultra 550B (:free)',
        role: 'candidate',
        availabilityStatus: 'verified-in-openrouter-catalog',
        freeTierStatus: 'Catalog prompt=0, completion=0; inference requires OPENROUTER_API_KEY',
        rateLimits: 'UNVERIFIED — depends on OpenRouter free tier RPM/RPD',
        pricingUsdPer1MTokens: { input: 0, output: 0 },
        pricingStatus: 'verified-free-catalog',
        notes: 'Discovered from public OpenRouter /api/v1/models (ctx: 1000000).',
      },
    ],
  },

  mistral: {
    id: 'mistral',
    displayName: 'Mistral AI',
    role: 'candidate',
    apiStyle: 'mistral-chat',
    envVarKey: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    models: [
      {
        id: 'mistral-candidate-slot-1',
        label: 'Mistral Candidate #1 (TBD)',
        role: 'candidate',
        availabilityStatus: 'unverified_requires_docs_check',
        freeTierStatus: 'UNVERIFIED — verify Mistral Experiment/Free tier terms',
        rateLimits: 'UNVERIFIED — verify RPM/TPM in Mistral console',
        pricingUsdPer1MTokens: null,
        pricingStatus: 'UNVERIFIED',
        notes: 'Populate exact Mistral model ID (e.g., small/medium/large) after verifying Mistral docs.',
      },
      {
        id: 'mistral-candidate-slot-2',
        label: 'Mistral Candidate #2 (TBD)',
        role: 'candidate',
        availabilityStatus: 'unverified_requires_docs_check',
        freeTierStatus: 'UNVERIFIED',
        rateLimits: 'UNVERIFIED',
        pricingUsdPer1MTokens: null,
        pricingStatus: 'UNVERIFIED',
        notes: 'Secondary Mistral candidate slot.',
      },
    ],
  },

  'cloudflare-workers-ai': {
    id: 'cloudflare-workers-ai',
    displayName: 'Cloudflare Workers AI',
    role: 'candidate',
    apiStyle: 'cloudflare-workers-ai',
    envVarKey: 'CLOUDFLARE_API_TOKEN',
    accountIdEnvKey: 'CLOUDFLARE_ACCOUNT_ID',
    mockOnly: true,
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/{modelId}',
    models: [
      {
        id: 'cloudflare-model-unverified',
        label: 'Cloudflare Workers AI Candidate (UNVERIFIED — Mock Only)',
        role: 'candidate',
        availabilityStatus: 'unverified_mock_only',
        freeTierStatus: 'UNVERIFIED — mock-only preparation, live quota/Neurons not checked',
        rateLimits: 'UNVERIFIED — mock-only stage',
        pricingUsdPer1MTokens: null,
        pricingStatus: 'UNVERIFIED',
        notes: 'Prepared config/adapter slot; live HTTP calls & key checks are explicitly disabled.',
      },
    ],
  },
});

function listProviders() {
  return Object.values(PROVIDER_REGISTRY);
}

function getProviderMeta(providerId) {
  return PROVIDER_REGISTRY[providerId] || null;
}

function getModelMeta(providerId, modelId) {
  const provider = getProviderMeta(providerId);
  if (!provider) return null;
  return provider.models.find((m) => m.id === modelId) || null;
}

function listAllTargets({ includePlaceholders = true } = {}) {
  const targets = [];
  for (const provider of listProviders()) {
    for (const model of provider.models) {
      if (!includePlaceholders && model.availabilityStatus !== 'verified-in-project-config') {
        continue;
      }
      targets.push({
        providerId: provider.id,
        providerName: provider.displayName,
        envVarKey: provider.envVarKey,
        modelId: model.id,
        modelLabel: model.label,
        role: model.role,
        availabilityStatus: model.availabilityStatus,
        pricingStatus: model.pricingStatus,
      });
    }
  }
  return targets;
}

module.exports = {
  PROVIDER_REGISTRY,
  listProviders,
  getProviderMeta,
  getModelMeta,
  listAllTargets,
};
