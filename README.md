# LocalClaw

LocalClaw is a Pinokio package based on `cocktailpeanut/clawdbot.pinokio`, modified only to run OpenClaw against **localhost** model endpoints.

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
- `LOCALCLAW_MODEL=llama3.2:latest`
- `LOCALCLAW_GATEWAY_PORT=18789`

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
