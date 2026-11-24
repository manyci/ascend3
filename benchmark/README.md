# ASCEND — AI Model Benchmark System (Stage 0)

Isolated model evaluation framework for comparing Google Gemini (control) with Groq, OpenRouter, and Mistral AI candidates for Barrett without modifying production Barrett logic, routes, or user data.

## Structure
- `config.js`: Dedicated benchmark configuration (`mode`, `timeoutMs`, `delayBetweenCallsMs`, `reportsDir`).
- `registry.js`: Provider & model registry (`google-gemini`, `groq`, `openrouter`, `mistral`). Unverified availability, limits, and tariffs are explicitly marked `UNVERIFIED` until verified against live docs.
- `contract.js`: Unified request/response contract, JSON output normalizer, and secret redaction.
- `context-builder.js`: Read-only wrapper around `server/barrett.js` pure context builders so all candidates receive identical `systemInstruction`, multi-turn `contents`, and conditional `ActivePlans`.
- `providers/`: Independent adapters (`base.js`, `mock-adapter.js`, `gemini-adapter.js`, `groq-adapter.js`, `openrouter-adapter.js`, `mistral-adapter.js`, `index.js`).
- `scenarios.js`: 22 synthetic test scenarios across 15+ evaluation categories.
- `evaluator.js`: 1–10 quality scoring across 7 criteria, strictly separated from objective technical metrics (latency, success rate, HTTP errors, availability, cost).
- `storage.js`: Saves redacted JSON & Markdown reports to `benchmark/reports/`.
- `runner.js` & `cli.js`: Orchestrator and CLI entrypoint (`node benchmark/cli.js --mode mock`).

## Required Environment Variables (for future live stage)
- `GEMINI_API_KEY` — Google Gemini (control only)
- `GROQ_API_KEY` — Groq
- `OPENROUTER_API_KEY` — OpenRouter
- `MISTRAL_API_KEY` — Mistral AI
