# 16. MLOps and LLMOps

## What this is
MLOps is how you version, ship, and watch models. For LLMs that includes the prompt, the index, the traces, and a gate that does not need a secret key.

## Why Shelf uses it
A new embedding model silently breaks search if old rows keep old vectors. A prompt edit changes captions with no code diff you can see in the row. You want the version on the data, a way to rebuild, and a trace when a request was odd.

## How it works
Every row stores `text_model`, `clip_model`, `prompt_version`, and `index_version`. `POST /v1/reembed` runs embed again. `GET /v1/metrics` returns average milliseconds per stage and the queue depth. Tracing always appends JSONL under `eval/reports/traces.jsonl`. If Langfuse host and keys are set, Shelf also sends an event to the self-hosted Langfuse container. GitHub Actions runs pytest and the retrieval eval on Python 3.12 with no model API key.

## What you build
`metrics.py`, `tracing.py`, the reembed route, and `.github/workflows/ci.yml`.

## Must-knows
- A trace that contains the screenshot is a second copy of private data. Keep ids and timings.
- The CI gate uses the synthetic set so it stays free and legal to run.
- Re-embed is a migration. Write down the old and new index version.

## Interview questions
- What breaks if you change the embedding model and do not re-embed?
- Why is a keyless CI gate valuable?

## Self-check
Open one row and point at the four version fields. Say which one changes when you edit the prompt text.
