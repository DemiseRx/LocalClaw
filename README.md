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
- Auto backend detection (`scripts/start_localclaw.sh`) for Ollama vs LM Studio.
- A reproducible smoke test (`scripts/smoke_test_local.sh`) using a mock OpenAI-compatible server (`scripts/mock_openai_server.py`) that auto-responds with `LOCAL_TEST_PHRASE`.
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

### 5) Gateway auth token changes every restart (disconnect loop)
Gateway clients rely on a stable token. If it changes every startup, dashboard/tool auth can flap.

**Mitigation:** `render-local-config.mjs` now reuses token sources in this order:
1. `LOCALCLAW_GATEWAY_TOKEN` (explicit override)
2. existing `.localclaw/openclaw.local.json` token
3. `.localclaw/gateway.token`
4. new random token

The effective token is always written back to `.localclaw/gateway.token` to keep restarts stable.

**Intentional rotation:** delete `.localclaw/gateway.token` and `.localclaw/openclaw.local.json`, or set a new `LOCALCLAW_GATEWAY_TOKEN`.

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
