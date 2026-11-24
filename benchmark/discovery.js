/* ASCEND — Benchmark Stage 1: Secret Availability & Live Model Discovery
   Strictly isolated in /benchmark/. Never logs or returns secret values. */
'use strict';

const { listProviders } = require('./registry');

async function checkLocalControlHealth(controlProxyUrl = 'http://127.0.0.1:3000', fetchFn = globalThis.fetch) {
  if (!controlProxyUrl || typeof fetchFn !== 'function') {
    return { reachable: false, available: false, model: null };
  }
  try {
    const res = await fetchFn(`${controlProxyUrl.replace(/\/+$/, '')}/api/barrett/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { reachable: true, available: false, model: null, status: res.status };
    const json = await res.json().catch(() => null);
    return {
      reachable: true,
      available: Boolean(json && json.ok && json.available),
      model: json && json.model ? String(json.model) : null,
      analyzeModel: json && json.analyzeModel ? String(json.analyzeModel) : null,
    };
  } catch (err) {
    return { reachable: false, available: false, model: null, error: err && err.message ? err.message : 'unreachable' };
  }
}

async function checkSecretsAvailability({
  env = process.env,
  controlProxyUrl = 'http://127.0.0.1:3000',
  fetchFn = globalThis.fetch,
} = {}) {
  const result = {};
  for (const provider of listProviders()) {
    const keyName = provider.envVarKey;
    if (provider.mockOnly) {
      result[provider.id] = {
        providerId: provider.id,
        displayName: provider.displayName,
        envVarKey: keyName,
        accountIdEnvKey: provider.accountIdEnvKey || null,
        presentInEnv: false,
        available: false,
        mockOnly: true,
        source: 'disabled_mock_only',
      };
      continue;
    }
    const raw = env && typeof env[keyName] === 'string' ? env[keyName].trim() : '';
    const inShellEnv = Boolean(raw);
    result[provider.id] = {
      providerId: provider.id,
      displayName: provider.displayName,
      envVarKey: keyName,
      presentInEnv: inShellEnv,
      available: inShellEnv,
      source: inShellEnv ? 'env' : 'missing',
    };
  }

  // Google Gemini control check: if shell env lacks GEMINI_API_KEY, inspect local dev server /health
  if (!result['google-gemini'].presentInEnv && controlProxyUrl) {
    const health = await checkLocalControlHealth(controlProxyUrl, fetchFn);
    if (health.reachable && health.available) {
      result['google-gemini'].available = true;
      result['google-gemini'].source = 'local-control-server';
      result['google-gemini'].controlModel = health.model;
    }
  }

  return result;
}

async function discoverProviderModels({
  env = process.env,
  controlProxyUrl = 'http://127.0.0.1:3000',
  fetchFn = globalThis.fetch,
  sdkLoader = () => import('@google/genai'),
} = {}) {
  const secrets = await checkSecretsAvailability({ env, controlProxyUrl, fetchFn });
  const catalog = {};

  // 1. Google Gemini
  {
    const sec = secrets['google-gemini'];
    if (sec.presentInEnv) {
      try {
        const { GoogleGenAI } = await sdkLoader();
        const ai = new GoogleGenAI({ apiKey: String(env.GEMINI_API_KEY).trim() });
        const pager = await ai.models.list();
        const models = [];
        for await (const m of pager) {
          if (m && m.name) models.push(String(m.name).replace(/^models\//, ''));
          if (models.length >= 25) break;
        }
        catalog['google-gemini'] = {
          status: 'discovered_via_sdk',
          availableForInference: true,
          modelsCount: models.length,
          models,
        };
      } catch (err) {
        catalog['google-gemini'] = {
          status: 'discovery_error',
          availableForInference: true,
          error: err && err.message ? err.message.slice(0, 180) : 'SDK list error',
          models: ['gemini-3.5-flash-lite'],
        };
      }
    } else if (sec.source === 'local-control-server') {
      catalog['google-gemini'] = {
        status: 'verified_via_control_health',
        availableForInference: true,
        transport: 'local-control-server',
        modelsCount: sec.controlModel ? 1 : 0,
        models: sec.controlModel ? [sec.controlModel] : [],
      };
    } else {
      catalog['google-gemini'] = {
        status: 'skipped_missing_key',
        availableForInference: false,
        missingSecret: 'GEMINI_API_KEY',
        models: [],
      };
    }
  }

  // 2. OpenRouter (public /api/v1/models catalog works even without key, inference requires OPENROUTER_API_KEY)
  {
    const sec = secrets.openrouter;
    try {
      const res = await fetchFn('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        const all = Array.isArray(json.data) ? json.data : [];
        const freeChatModels = all
          .filter((m) => String(m.id || '').endsWith(':free'))
          .map((m) => ({
            id: m.id,
            name: m.name,
            contextLength: m.context_length || null,
            pricingPrompt: m.pricing ? m.pricing.prompt : null,
            pricingCompletion: m.pricing ? m.pricing.completion : null,
          }));
        catalog.openrouter = {
          status: 'public_catalog_fetched',
          availableForInference: sec.available,
          missingSecret: sec.available ? null : sec.envVarKey,
          totalCatalogModels: all.length,
          freeModelsCount: freeChatModels.length,
          freeModels: freeChatModels.slice(0, 15),
        };
      } else {
        catalog.openrouter = {
          status: `catalog_http_${res.status}`,
          availableForInference: sec.available,
          missingSecret: sec.available ? null : sec.envVarKey,
          freeModels: [],
        };
      }
    } catch (err) {
      catalog.openrouter = {
        status: 'catalog_network_error',
        availableForInference: sec.available,
        missingSecret: sec.available ? null : sec.envVarKey,
        error: err && err.message ? err.message.slice(0, 180) : 'Network error',
        freeModels: [],
      };
    }
  }

  // 3. Groq (requires GROQ_API_KEY for /models and chat)
  {
    const sec = secrets.groq;
    if (!sec.presentInEnv) {
      catalog.groq = {
        status: 'skipped_missing_key',
        availableForInference: false,
        missingSecret: sec.envVarKey,
        models: [],
      };
    } else {
      try {
        const res = await fetchFn('https://api.groq.com/openai/v1/models', {
          method: 'GET',
          headers: { Authorization: `Bearer ${String(env.GROQ_API_KEY).trim()}` },
          signal: AbortSignal.timeout(8000),
        });
        const json = await res.json().catch(() => null);
        const ids = res.ok && json && Array.isArray(json.data) ? json.data.map((m) => m.id) : [];
        catalog.groq = {
          status: res.ok ? 'discovered_via_api' : `http_${res.status}`,
          availableForInference: res.ok,
          modelsCount: ids.length,
          hasGptOss120b: ids.includes('openai/gpt-oss-120b'),
          models: ids.slice(0, 30),
        };
      } catch (err) {
        catalog.groq = {
          status: 'discovery_network_error',
          availableForInference: false,
          error: err && err.message ? err.message.slice(0, 180) : 'Network error',
          models: [],
        };
      }
    }
  }

  // 4. Mistral AI (requires MISTRAL_API_KEY for /models and chat)
  {
    const sec = secrets.mistral;
    if (!sec.presentInEnv) {
      catalog.mistral = {
        status: 'skipped_missing_key',
        availableForInference: false,
        missingSecret: sec.envVarKey,
        models: [],
      };
    } else {
      try {
        const res = await fetchFn('https://api.mistral.ai/v1/models', {
          method: 'GET',
          headers: { Authorization: `Bearer ${String(env.MISTRAL_API_KEY).trim()}` },
          signal: AbortSignal.timeout(8000),
        });
        const json = await res.json().catch(() => null);
        const ids = res.ok && json && Array.isArray(json.data) ? json.data.map((m) => m.id) : [];
        catalog.mistral = {
          status: res.ok ? 'discovered_via_api' : `http_${res.status}`,
          availableForInference: res.ok,
          modelsCount: ids.length,
          models: ids.slice(0, 30),
        };
      } catch (err) {
        catalog.mistral = {
          status: 'discovery_network_error',
          availableForInference: false,
          error: err && err.message ? err.message.slice(0, 180) : 'Network error',
          models: [],
        };
      }
    }
  }

  // 5. Cloudflare Workers AI (strictly mock-only: no live key checks or HTTP calls)
  catalog['cloudflare-workers-ai'] = {
    status: 'mock_only_live_disabled',
    availableForInference: false,
    liveBlocked: true,
    errorCode: 'CLOUDFLARE_LIVE_DISABLED',
    models: [],
  };

  return { secrets, catalog };
}

module.exports = {
  checkLocalControlHealth,
  checkSecretsAvailability,
  discoverProviderModels,
};
