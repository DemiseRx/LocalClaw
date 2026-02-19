#!/usr/bin/env bash
set -euo pipefail
PORT="${LOCALCLAW_TEST_PORT:-11434}"
PHRASE="${LOCALCLAW_TEST_PHRASE:-LOCAL_TEST_PHRASE}"
python3 "$PWD/scripts/mock_openai_server.py" >/tmp/localclaw-mock.log 2>&1 &
MPID=$!
cleanup(){ kill "$MPID" >/dev/null 2>&1 || true; }
trap cleanup EXIT
sleep 1

# emulate OpenClaw-compatible completion calls against the local endpoint
CHAT_RESP=$(curl -sS -X POST "http://127.0.0.1:${PORT}/v1/chat/completions" \
  -H 'content-type: application/json' \
  -d '{"model":"llama3.2:latest","messages":[{"role":"user","content":"test"}]}' )

echo "$CHAT_RESP" | rg -q "$PHRASE"

RESP_RESP=$(curl -sS -X POST "http://127.0.0.1:${PORT}/v1/responses" \
  -H 'content-type: application/json' \
  -d '{"model":"llama3.2:latest","input":"test"}' )

echo "$RESP_RESP" | rg -q "$PHRASE"

# verify config renderer enforces local provider settings
LOCALCLAW_BASE_URL="http://127.0.0.1:${PORT}/v1" LOCALCLAW_MODEL="llama3.2:latest" python3 "$PWD/scripts/render_local_config.py" >/tmp/localclaw-config-path.txt
python3 - <<'PY'
import json
cfg=json.load(open('.localclaw/openclaw.local.json'))
assert cfg['models']['providers']['openai']['baseUrl'].startswith('http://127.0.0.1:')
assert cfg['agents']['defaults']['model']['primary'].startswith('openai/')
print('config check ok')
PY

echo "Smoke test passed"
