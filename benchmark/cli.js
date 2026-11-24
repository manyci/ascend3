/* ASCEND — Benchmark CLI Entrypoint
   Supports offline --mode mock (default) and explicit opt-in --mode live --allow-live. */
'use strict';

const { runBenchmark } = require('./runner');
const { listAllTargets } = require('./registry');
const { discoverProviderModels } = require('./discovery');

function parseArgs(argv) {
  const args = {
    mode: 'mock',
    allowLive: false,
    discoverOnly: false,
    save: true,
    providers: null,
    scenarios: null,
    models: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === '--mode' && argv[i + 1]) {
      args.mode = argv[++i];
    } else if (tok === '--allow-live') {
      args.allowLive = true;
    } else if (tok === '--discover-only') {
      args.discoverOnly = true;
    } else if (tok === '--no-save') {
      args.save = false;
    } else if (tok === '--providers' && argv[i + 1]) {
      args.providers = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (tok === '--scenarios' && argv[i + 1]) {
      args.scenarios = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (tok === '--models' && argv[i + 1]) {
      args.models = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return args;
}

(async () => {
  const opts = parseArgs(process.argv);

  if (opts.discoverOnly) {
    const d = await discoverProviderModels();
    console.log('ASCEND Benchmark Discovery (Secrets & Catalog):');
    console.log(JSON.stringify(d, null, 2));
    return;
  }

  if (opts.mode === 'live' && !opts.allowLive) {
    console.error('Live mode requires explicit --allow-live flag.');
    process.exit(1);
  }

  let targets = listAllTargets({ includePlaceholders: true });
  if (opts.providers && opts.providers.length) {
    const pSet = new Set(opts.providers);
    targets = targets.filter((t) => pSet.has(t.providerId));
  }
  if (opts.models && opts.models.length) {
    const mSet = new Set(opts.models);
    targets = targets.filter((t) => mSet.has(t.modelId));
  }

  const { report, savedFiles } = await runBenchmark({
    config: {
      mode: opts.mode === 'live' ? 'live' : 'mock',
      allowLiveRequests: opts.mode === 'live' && opts.allowLive,
      delayBetweenCallsMs: opts.mode === 'live' ? 250 : 0,
      saveReports: opts.save,
    },
    targets,
    scenarioIds: opts.scenarios,
  });

  console.log(`ASCEND Benchmark (${report.runId}) — mode=${report.config.mode}, scenarios=${report.scenariosCount}`);
  if (report.discovery && report.discovery.secrets) {
    console.log('Secrets availability:');
    for (const s of Object.values(report.discovery.secrets)) {
      console.log(` * ${s.providerId} (${s.envVarKey}): ${s.available ? `AVAILABLE via ${s.source}` : 'MISSING'}`);
    }
  }
  for (const row of report.summary) {
    const firstRun = report.resultsByTarget.find((x) => x.providerId === row.providerId && x.modelId === row.modelId)?.runs[0];
    const err = firstRun && !firstRun.response.ok ? ` [${firstRun.response.metrics.errorCode}]` : '';
    console.log(
      ` - ${row.providerId} / ${row.modelId}: quality=${row.qualityEvaluation.overallQuality1to10}/10, ` +
      `success=${row.technicalMetrics.successRatePercent}%, avgLatency=${row.technicalMetrics.avgLatencyMs}ms${err}`
    );
  }
  if (savedFiles) {
    console.log(`Saved JSON: ${savedFiles.jsonPath}`);
    console.log(`Saved MD:   ${savedFiles.mdPath}`);
  }
})();
