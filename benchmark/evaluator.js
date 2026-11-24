/* ASCEND — Benchmark Evaluation & Metrics Aggregator
   Strictly separates:
     1) Subjective / rubric Quality Scores (1-10 scale across 7 criteria)
     2) Objective Technical Metrics (latency, success rate, HTTP errors, availability, cost) */
'use strict';

const QUALITY_DIMENSIONS = Object.freeze([
  'intelligenceReasoning',
  'contextUnderstanding',
  'argumentationQuality',
  'naturalCommunication',
  'barrettPersonaAdherence',
  'accuracy',
  'responseStructure',
]);

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(10, Math.round(v * 10) / 10));
}

function scoreScenarioResponse(scenario, response, manualOverride = null) {
  if (!response || !response.ok || !response.parsed || !response.parsed.reply) {
    const failedScores = {
      intelligenceReasoning: 1,
      contextUnderstanding: 1,
      argumentationQuality: 1,
      naturalCommunication: 1,
      barrettPersonaAdherence: 1,
      accuracy: 1,
      responseStructure: 1,
    };
    return {
      evaluated: false,
      judgeMode: 'failed-request',
      scores: failedScores,
      overallQuality1to10: 1,
      checks: {
        validJson: false,
        languageOk: false,
        noForbiddenTerms: true,
        contextAnchorHit: false,
        noNumericRating: true,
      },
      notes: [response && response.metrics && response.metrics.errorCode ? `Request failed: ${response.metrics.errorCode}` : 'Empty or invalid response'],
    };
  }

  const reply = response.parsed.reply;
  const lower = reply.toLowerCase();
  const exp = scenario.expectations || {};
  const notes = [];

  const hasCyrillic = /[а-яё]/i.test(reply);
  const hasLatin = /[a-z]/i.test(reply);
  const languageOk = scenario.lang === 'en' ? (!hasCyrillic && hasLatin) : hasCyrillic;
  if (!languageOk) notes.push(`Language mismatch for lang=${scenario.lang}`);

  const forbidden = Array.isArray(exp.forbiddenTerms) ? exp.forbiddenTerms : [];
  const hitForbidden = forbidden.filter((term) => lower.includes(String(term).toLowerCase()));
  const noForbiddenTerms = hitForbidden.length === 0;
  if (!noForbiddenTerms) notes.push(`Forbidden terms matched: ${hitForbidden.join(', ')}`);

  const noNumericRating = !/\b([0-9]|10)(?:[.,]\d)?\s*\/\s*10\b/.test(reply);
  if (!noNumericRating) notes.push('Emitted numeric x/10 rating');

  const requiredAny = Array.isArray(exp.requiredAnyTerms) ? exp.requiredAnyTerms : [];
  const matchedReq = requiredAny.filter((term) => lower.includes(String(term).toLowerCase()));
  const contextAnchorHit = requiredAny.length === 0 ? true : matchedReq.length > 0;
  if (!contextAnchorHit) notes.push('Missed expected domain/context anchor terms');

  const minLenOk = !exp.minLength || reply.length >= exp.minLength;
  const hasStructuredList = /\n|1\.|2\.|- /.test(reply);
  const structureOk = !exp.requireStructure || hasStructuredList;
  const cleanSmallTalk = !(exp.preferEmptyFollowUps && response.parsed.followUps && response.parsed.followUps.length > 0);
  if (!cleanSmallTalk) notes.push('Included unprompted followUps in small talk');

  // Deterministic 1-10 heuristic baseline
  const base = {
    intelligenceReasoning: (contextAnchorHit && minLenOk) ? 8.5 : 5.5,
    contextUnderstanding: (contextAnchorHit && noForbiddenTerms) ? 8.5 : (noForbiddenTerms ? 6 : 3.5),
    argumentationQuality: (minLenOk && contextAnchorHit) ? 8 : 6,
    naturalCommunication: (languageOk && cleanSmallTalk) ? 8.5 : 5.5,
    barrettPersonaAdherence: (noForbiddenTerms && noNumericRating && cleanSmallTalk) ? 8.5 : 4,
    accuracy: (noForbiddenTerms && noNumericRating && contextAnchorHit) ? 8.5 : 4.5,
    responseStructure: structureOk ? (hasStructuredList ? 9 : 8) : 5.5,
  };

  let judgeMode = 'heuristic-baseline';
  const finalScores = { ...base };
  if (manualOverride && typeof manualOverride === 'object') {
    judgeMode = 'hybrid-manual-override';
    for (const dim of QUALITY_DIMENSIONS) {
      if (manualOverride[dim] !== undefined) {
        finalScores[dim] = clampScore(manualOverride[dim]);
      }
    }
  }

  for (const dim of QUALITY_DIMENSIONS) {
    finalScores[dim] = clampScore(finalScores[dim]);
  }
  const avg = QUALITY_DIMENSIONS.reduce((acc, k) => acc + finalScores[k], 0) / QUALITY_DIMENSIONS.length;

  return {
    evaluated: true,
    judgeMode,
    scores: finalScores,
    overallQuality1to10: clampScore(avg),
    checks: {
      validJson: true,
      languageOk,
      noForbiddenTerms,
      contextAnchorHit,
      noNumericRating,
      structureOk,
      cleanSmallTalk,
    },
    notes,
  };
}

function percentile(sortedNums, p) {
  if (!sortedNums.length) return 0;
  const idx = Math.min(sortedNums.length - 1, Math.max(0, Math.ceil((p / 100) * sortedNums.length) - 1));
  return sortedNums[idx];
}

function aggregateTargetReport({ providerId, modelId, runs, modelMeta = null }) {
  const latencies = runs
    .map((r) => r.response && r.response.metrics ? r.response.metrics.latencyMs : 0)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);

  const successRuns = runs.filter((r) => r.response && r.response.ok);
  const httpErrorCounts = {};
  let totalEstimatedCostUsd = 0;
  let anyCostCalculated = false;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const r of runs) {
    const m = r.response && r.response.metrics ? r.response.metrics : {};
    if (!r.response || !r.response.ok) {
      const codeKey = String(m.httpStatus || m.errorCode || 'ERROR');
      httpErrorCounts[codeKey] = (httpErrorCounts[codeKey] || 0) + 1;
    }
    if (m.usage) {
      totalPromptTokens += Number(m.usage.promptTokens) || 0;
      totalCompletionTokens += Number(m.usage.completionTokens) || 0;
    }
    if (m.costStatus === 'estimated' && typeof m.estimatedCostUsd === 'number') {
      totalEstimatedCostUsd += m.estimatedCostUsd;
      anyCostCalculated = true;
    }
  }

  // Average subjective quality scores strictly separately from technical metrics
  const qualityAverages = {};
  for (const dim of QUALITY_DIMENSIONS) {
    const vals = runs.map((r) => r.evaluation.scores[dim]);
    qualityAverages[dim] = clampScore(vals.reduce((a, b) => a + b, 0) / (vals.length || 1));
  }
  const overallQuality1to10 = clampScore(
    QUALITY_DIMENSIONS.reduce((acc, dim) => acc + qualityAverages[dim], 0) / QUALITY_DIMENSIONS.length
  );

  // Separate objective technical metrics object
  const technicalMetrics = {
    totalRequests: runs.length,
    successfulRequests: successRuns.length,
    failedRequests: runs.length - successRuns.length,
    successRatePercent: runs.length ? Math.round((successRuns.length / runs.length) * 1000) / 10 : 0,
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    p95LatencyMs: percentile(latencies, 95),
    minLatencyMs: latencies.length ? latencies[0] : 0,
    maxLatencyMs: latencies.length ? latencies[latencies.length - 1] : 0,
    httpErrorCounts,
    modelAvailability: modelMeta ? modelMeta.availabilityStatus : 'unknown',
    tokenUsage: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    },
    cost: {
      status: anyCostCalculated ? 'estimated' : 'unavailable',
      estimatedTotalUsd: anyCostCalculated ? Number(totalEstimatedCostUsd.toFixed(8)) : null,
      pricingNote: modelMeta ? modelMeta.pricingStatus : 'UNVERIFIED',
    },
  };

  return {
    providerId,
    modelId,
    modelLabel: modelMeta ? modelMeta.label : modelId,
    role: modelMeta ? modelMeta.role : 'candidate',
    qualityEvaluation: {
      scale: '1-10',
      overallQuality1to10,
      dimensions: qualityAverages,
    },
    technicalMetrics,
  };
}

module.exports = {
  QUALITY_DIMENSIONS,
  scoreScenarioResponse,
  aggregateTargetReport,
};
