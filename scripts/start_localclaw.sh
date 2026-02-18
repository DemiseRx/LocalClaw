#!/usr/bin/env bash
set -euo pipefail

export PATH="/root/.nvm/versions/node/v22.21.1/bin:$PATH"

BACKEND="${LOCALCLAW_BACKEND:-auto}"
if [[ -z "${LOCALCLAW_BASE_URL:-}" ]]; then
  case "$BACKEND" in
    ollama) LOCALCLAW_BASE_URL="http://127.0.0.1:11434/v1" ;;
    lmstudio) LOCALCLAW_BASE_URL="http://127.0.0.1:1234/v1" ;;
    auto)
      if curl -sfS http://127.0.0.1:11434/v1/models >/dev/null 2>&1; then
        LOCALCLAW_BASE_URL="http://127.0.0.1:11434/v1"
      elif curl -sfS http://127.0.0.1:1234/v1/models >/dev/null 2>&1; then
        LOCALCLAW_BASE_URL="http://127.0.0.1:1234/v1"
      else
        echo "No local OpenAI-compatible server found on 11434 or 1234. Start Ollama or LM Studio first." >&2
        exit 1
      fi
      ;;
    *) echo "Unsupported LOCALCLAW_BACKEND: $BACKEND" >&2; exit 1 ;;
  esac
fi

export LOCALCLAW_BASE_URL
export LOCALCLAW_STATE_DIR="${LOCALCLAW_STATE_DIR:-$PWD/.localclaw/state}"
export OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-$PWD/.localclaw/openclaw.local.json}"

python3 "$PWD/scripts/render_local_config.py"

exec openclaw gateway run
