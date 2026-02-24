# LocalClaw

LocalClaw is a Pinokio wrapper based on `cocktailpeanut/clawdbot.pinokio` that keeps OpenClaw gateway/tooling behavior intact while routing inference to a local LM Studio/Ollama OpenAI-compatible endpoint.

## Quick start modes

Pinokio menu now provides two install paths:

1. **Install (Quick Start baseline)**
   - Uses original OpenClaw quick start onboarding behavior.
   - Installs common skill prerequisites.
   - Does **not** force local-model routing.
2. **Install (Quick Start + Local Model)**
   - Runs the same onboarding flow.
   - Then patches default model/provider to local LM Studio/Ollama endpoint.

You can also run **Enable/refresh local model config** later to switch an already-onboarded baseline install to local model routing.

## What this wrapper changes

- Installs OpenClaw from a pinned target (`OPENCLAW_INSTALL_TARGET`, default `openclaw@2026.2.17`).
- Runs onboarding, installs skill prerequisites, then optionally patches OpenClaw config.
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

## Skill/package install failure note (Windows `spawn EINVAL`)

If skill package installs fail in the dashboard with errors like `Install failed (unknown exit): spawn EINVAL`, this is commonly related to Windows command spawning of npm/npx from child processes.

Mitigation in this wrapper:

- Pre-installs `clawhub` globally during install/update.
- Uses platform-specific binaries (`npm.cmd` / `npx.cmd` on Windows) in prereq installer script.
- Installs Playwright Chromium dependency during install/update.

Script: `scripts/install-skill-prereqs.mjs`.


## Web search workaround (Brave API optional)

This wrapper includes a **local web-search proxy** (`scripts/local-web-search-proxy.mjs`) and configures OpenClaw `web_search` to use it by default via the Perplexity-compatible provider interface.

How it works:

- OpenClaw calls `tools.web.search.provider = "perplexity"`.
- `tools.web.search.perplexity.baseUrl` defaults to `http://127.0.0.1:8787` (local process).
- The local proxy performs HTML search scraping (DuckDuckGo Lite endpoint) and returns Perplexity/OpenAI-compatible chat-completions payload with citations.
- No paid API key is required; default key is local placeholder (`local-search`).

You can still override provider or base URL with env vars if desired.

## Environment overrides

- `OPENCLAW_INSTALL_TARGET` (e.g. `openclaw@2026.2.17` or `github:user/repo#ref`)
- `LMSTUDIO_BASE_URL` (or `LOCALCLAW_BASE_URL` fallback)
- `LMSTUDIO_MODEL_ID` (or `LOCALCLAW_MODEL` fallback)
- `LOCALCLAW_API_MODE` (`openai-responses` default)
- `LOCALCLAW_WEB_SEARCH_PROVIDER` (`perplexity` default)
- `LOCALCLAW_PERPLEXITY_BASE_URL` (defaults to local proxy `http://127.0.0.1:8787`)
- `LOCALCLAW_PERPLEXITY_MODEL`
- `LOCAL_WEB_SEARCH_PORT` (proxy listener, default `8787`)
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
