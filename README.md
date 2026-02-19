# LocalClaw

LocalClaw is a Pinokio package based on `cocktailpeanut/clawdbot.pinokio`, modified only to run OpenClaw against **localhost** model endpoints.

## Installer check (baseline + modification)

Yes — the project has an installer (`install.json`).

- We **copied the upstream installer flow** from `clawdbot.pinokio`:
  1. `npm i -g openclaw@latest`
  2. `openclaw onboard --skip-ui`
  3. completion modal
- Then we made the **minimum local-only modification**:
  - inserted `node scripts/render-local-config.mjs` immediately after onboarding so the generated OpenClaw config is overwritten with localhost-only provider settings.

This preserves upstream onboarding behavior while enforcing local models.

## Local-only behavior

- Auto-detects a local OpenAI-compatible server:
  - Ollama: `http://127.0.0.1:11434/v1`
  - LM Studio: `http://127.0.0.1:1234/v1`
- Rejects non-local hosts (`127.0.0.1`, `localhost`, `::1` only).
- Generates a dedicated local config at `.localclaw/openclaw.local.json`.

## Pinokio flow

1. **Install** (installs `openclaw`, runs onboarding, then writes local-only config).
2. Start Ollama or LM Studio local server.
3. **Start** (detects local backend, starts gateway + dashboard).
4. Optional: **Local API smoke test**.

## Environment overrides

- `LOCALCLAW_BACKEND=auto|ollama|lmstudio`
- `LOCALCLAW_BASE_URL=http://127.0.0.1:11434/v1`
- `LOCALCLAW_MODEL=lfm2.5-1.2b`
- `LOCALCLAW_API_MODE=openai-chat|openai-completions`
- `LOCALCLAW_GATEWAY_PORT=18789`


## LM Studio LFM2.5 compatibility

- Startup now queries `/v1/models` and auto-selects an available local model, preferring `liquid/lfm2.5-1.2b` (and `@q8_0`) then other Liquid LFM2 1.2B IDs.
- For LM Studio backends, LocalClaw defaults API mode to `openai-chat` for better chat/tool-call response compatibility.
- If `LOCALCLAW_MODEL` is set to a model that LM Studio is not serving (for example stale `llama3.2:latest`), LocalClaw now falls back automatically to a currently served model instead of failing chat calls.
- You can still force an exact model with `LOCALCLAW_MODEL` if that model exists in `/v1/models`.

## Verification of app structure (`app.py` concern)

This repo intentionally does **not** use `app.py` and does not include an `app/` mirror.

- Entry points are Pinokio JS/JSON manifests in the repository root:
  - `pinokio.js`, `install.json`, `start.js`, `update.js`, `uninstall.js`, `test.js`.
- Runtime behavior is implemented by Node scripts in `scripts/`.
- There are no `python app.py` commands in this repo.

If you still see Pinokio attempting `python app.py`, it usually means your local Pinokio cache has an older checkout.

Recommended cleanup:

1. Stop the app in Pinokio.
2. Remove the existing local app folder/cache for this repo.
3. Reinstall from the updated Git branch/commit.

## Gateway token stability

`render-local-config.mjs` now preserves the existing `gateway.auth.token` from `.localclaw/openclaw.local.json` across reruns, unless you explicitly set `LOCALCLAW_GATEWAY_TOKEN`. This prevents dashboard/device-token mismatch errors after Pinokio restarts.
