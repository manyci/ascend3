/* ASCEND — Isolated Benchmark Report Storage
   Saves JSON + Markdown benchmark reports strictly inside benchmark/reports/
   completely separate from ASCEND production data and user chats. */
'use strict';

const fs = require('fs');
const path = require('path');
const { redactSecrets } = require('./contract');

function formatMarkdownReport(report) {
  const lines = [
    `# ASCEND AI Benchmark Report (${report.runId})`,
    '',
    `- **Generated At**: ${report.createdAt}`,
    `- **Mode**: \`${report.config.mode}\` (Live API calls allowed: \`${report.config.allowLiveRequests}\`)`,
    `- **Scenarios Count**: ${report.scenariosCount}`,
    `- **Targets Evaluated**: ${report.summary.length}`,
    '',
  ];

  if (report.discovery && report.discovery.secrets) {
    lines.push('## 0. Secrets & Provider Availability', '');
    lines.push('| Provider | Env Var | Available | Source | Catalog Status |');
    lines.push('|---|---|---|---|---|');
    for (const s of Object.values(report.discovery.secrets)) {
      const cat = report.discovery.catalog && report.discovery.catalog[s.providerId];
      lines.push(`| ${s.providerId} | \`${s.envVarKey}\` | ${s.available ? 'YES' : 'NO'} | ${s.source} | ${cat ? cat.status : 'n/a'} |`);
    }
    lines.push('');
  }

  lines.push(
    '## 1. Subjective Quality Comparison (Scale 1–10)',
    '',
    '| Provider | Model | Role | Overall | Intelligence | Context | Argumentation | Naturalness | Barrett Persona | Accuracy | Structure |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  );

  for (const t of report.summary) {
    const q = t.qualityEvaluation;
    const d = q.dimensions;
    lines.push(
      `| ${t.providerId} | \`${t.modelId}\` | ${t.role} | **${q.overallQuality1to10}** | ${d.intelligenceReasoning} | ${d.contextUnderstanding} | ${d.argumentationQuality} | ${d.naturalCommunication} | ${d.barrettPersonaAdherence} | ${d.accuracy} | ${d.responseStructure} |`
    );
  }

  lines.push(
    '',
    '## 2. Objective Technical Metrics (Separated from Quality Scores)',
    '',
    '| Provider | Model | Success Rate | Avg Latency | P95 Latency | HTTP Errors | Availability | Cost |',
    '|---|---|---|---|---|---|---|---|'
  );

  for (const t of report.summary) {
    const m = t.technicalMetrics;
    const errText = Object.keys(m.httpErrorCounts).length ? JSON.stringify(m.httpErrorCounts) : 'none';
    const costText = m.cost.status === 'estimated' && m.cost.estimatedTotalUsd !== null
      ? `$${m.cost.estimatedTotalUsd}`
      : `unavailable (${m.cost.pricingNote})`;
    lines.push(
      `| ${t.providerId} | \`${t.modelId}\` | ${m.successRatePercent}% (${m.successfulRequests}/${m.totalRequests}) | ${m.avgLatencyMs}ms | ${m.p95LatencyMs}ms | \`${errText}\` | ${m.modelAvailability} | ${costText} |`
    );
  }

  lines.push('', '## 3. Scenario Coverage', '');
  for (const sc of report.scenariosMeta) {
    lines.push(`- \`${sc.id}\` (${sc.category}, ${sc.lang}): ${sc.title}`);
  }

  return lines.join('\n') + '\n';
}

function saveBenchmarkReport(report, reportsDir) {
  const dir = path.resolve(reportsDir);
  fs.mkdirSync(dir, { recursive: true });
  const safeId = String(report.runId || `bench_${Date.now()}`).replace(/[^A-Za-z0-9_.-]/g, '_');
  const jsonPath = path.join(dir, `${safeId}.json`);
  const mdPath = path.join(dir, `${safeId}.md`);

  const safeJson = redactSecrets(JSON.stringify(report, null, 2));
  const safeMd = redactSecrets(formatMarkdownReport(report));

  fs.writeFileSync(jsonPath, safeJson, 'utf8');
  fs.writeFileSync(mdPath, safeMd, 'utf8');

  return { jsonPath, mdPath };
}

module.exports = {
  formatMarkdownReport,
  saveBenchmarkReport,
};
