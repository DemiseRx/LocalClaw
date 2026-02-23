# LocalClaw

LocalClaw is a Pinokio wrapper based on `cocktailpeanut/clawdbot.pinokio` that keeps OpenClaw gateway/tooling behavior intact while routing inference to a local LM Studio/Ollama OpenAI-compatible endpoint.

## What this wrapper changes

- Installs OpenClaw from a pinned target (`OPENCLAW_INSTALL_TARGET`, default `openclaw@2026.2.17`).
- Runs onboarding, installs Playwright Chromium dependency, then patches OpenClaw config.
- Patches config to use `models.providers.lmstudio` with:
  - `baseUrl` (default `http://127.0.0.1:1234/v1`)
  - `api` (default `openai-responses`)
  - discovered/default model id from `/v1/models`
- Sets `agents.defaults.model.primary` to `lmstudio/<modelId>`.
- Preserves hub/tool/skill-related settings (`commands.native`, `commands.nativeSkills`) as `auto`.
- Preserves gateway token across reruns.

## Model discovery behavior

`patch-openclaw-config.mjs` selects model id in this order:

1. `LMSTUDIO_MODEL_ID` (or `LOCALCLAW_MODEL`) if provided and available.
2. First `/v1/models` id matching `lfm2` + `1.2b` (case-insensitive), shortest id wins.
3. First model returned by `/v1/models`.

If no models are available, patching fails with an actionable error.

## Environment overrides

- `OPENCLAW_INSTALL_TARGET` (e.g. `openclaw@2026.2.17` or `github:user/repo#ref`)
- `LMSTUDIO_BASE_URL` (or `LOCALCLAW_BASE_URL` fallback)
- `LMSTUDIO_MODEL_ID` (or `LOCALCLAW_MODEL` fallback)
- `LOCALCLAW_API_MODE` (`openai-responses` default)
- `LOCALCLAW_GATEWAY_PORT`
- `LOCALCLAW_SKIP_GATEWAY=1` (test mode)

## Verification

Run the smoke test:

```bash
node scripts/smoke-test-local.mjs
```

It verifies:

- model endpoint reachable (`/v1/models`)
- deterministic tool-call shape from chat endpoint
- `/v1/responses` works
- patched config defaults to `lmstudio/<modelId>`
- tool/skill command settings remain enabled (`auto`)
- gateway token is stable across reruns
