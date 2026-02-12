# LocalClaw

LocalClaw is a Pinokio package that adapts OpenClaw for **strictly local model usage** with:

- **Ollama** (`http://127.0.0.1:11434/v1`)
- **LM Studio** (`http://127.0.0.1:1234/v1`)

No cloud endpoints are configured by default.

## What this package adds

- A local-only config renderer (`scripts/render_local_config.py`) that:
  - rejects non-local hosts,
  - seeds OpenClaw with OpenAI-compatible local model definitions,
  - writes config to `.localclaw/openclaw.local.json`.
- Auto backend detection (`scripts/start-localclaw.mjs`) for Ollama vs LM Studio (cross-platform, including Windows Pinokio).
- A reproducible smoke test (`scripts/smoke-test-local.mjs`) using a mock OpenAI-compatible server (`scripts/mock-openai-server.mjs`) that auto-responds with `LOCAL_TEST_PHRASE`.
- Pinokio menu entries for Install / Start / Test / Update / Uninstall.

## Pinokio usage

1. Click **Install**.
2. Start either:
   - Ollama with an OpenAI-compatible endpoint (`/v1`), or
   - LM Studio local server.
3. Click **Start (Auto detect Ollama/LM Studio)**.
4. Optionally run **Local API smoke test**.

## Runtime overrides

You can change behavior with environment variables:

- `LOCALCLAW_BACKEND=auto|ollama|lmstudio`
- `LOCALCLAW_BASE_URL=http://127.0.0.1:11434/v1`
- `LOCALCLAW_MODEL=llama3.2:latest`
- `LOCALCLAW_GATEWAY_PORT=18789`

## Failure modes & mitigations

### 1) OpenClaw reports unknown model
OpenClaw validates model IDs against configured provider models.

**Mitigation:** set `LOCALCLAW_MODEL=<your-local-model-id>` and rerun Start. The config renderer injects that model ID into provider definitions.

### 2) Local server not detected in auto mode
Auto mode checks `11434` then `1234`.

**Mitigation:** set `LOCALCLAW_BACKEND` explicitly or set `LOCALCLAW_BASE_URL` directly.

### 3) Accidental remote endpoint usage
Strict local mode blocks non-local hosts.

**Mitigation:** only `127.0.0.1`, `localhost`, and `::1` are allowed by config generation.

### 4) Endpoint compatibility differences
Some OpenAI-compatible servers support `/v1/chat/completions` only.

**Mitigation:** LocalClaw config uses `openai-completions` API mode for compatibility.

## Community dashboard visibility (Pinokio/GitHub)

To maximize visibility when published:

- Keep `pinokio.js`, `pinokio.json`, and `icon.svg` in the repository root.
- Use a clear `title` + `description` in `pinokio.json`.
- Include a concise README and screenshots if/when UI behavior changes.
- Tag the GitHub repo clearly (`pinokio`, `openclaw`, `ollama`, `lmstudio`, `local-llm`) and provide release notes so community users understand what is local-only.

## Notes on OpenClaw usage patterns and added gaps

OpenClaw users commonly run multi-channel automations and cloud providers by default. This package fills local-first gaps by adding:

- hardened localhost-only guardrails,
- backend auto-detection for common local inference runtimes,
- deterministic API emulation tests for safer packaging/sharing.


## Windows/Pinokio compatibility note

This repo now includes an `app/` mirror of the package files. Some Pinokio Windows flows run apps from `<repo>/app` and fall back to launching `app.py` if script manifests are missing there. Including `app/pinokio.js` and companion files helps avoid that fallback, and `app/app.py` is also included as a safe compatibility launcher when Pinokio still invokes `python app.py` on Windows.
