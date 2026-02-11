#!/usr/bin/env python3
import json, os, secrets
from urllib.parse import urlparse

base_url = os.environ.get('LOCALCLAW_BASE_URL', 'http://127.0.0.1:11434/v1').rstrip('/')
model_id = os.environ.get('LOCALCLAW_MODEL', 'llama3.2:latest').strip() or 'llama3.2:latest'
state_dir = os.environ.get('LOCALCLAW_STATE_DIR', os.path.join(os.getcwd(), '.localclaw', 'state'))
config_path = os.environ.get('OPENCLAW_CONFIG_PATH', os.path.join(os.getcwd(), '.localclaw', 'openclaw.local.json'))

u = urlparse(base_url)
if u.scheme not in {'http', 'https'}:
    raise SystemExit(f'LOCALCLAW_BASE_URL must be http(s), got: {base_url}')
if u.hostname not in {'127.0.0.1', 'localhost', '::1'}:
    raise SystemExit(f'LOCALCLAW refuses non-local host: {u.hostname}')

os.makedirs(os.path.dirname(config_path), exist_ok=True)
os.makedirs(state_dir, exist_ok=True)
workspace = os.path.join(state_dir, 'workspace')
os.makedirs(workspace, exist_ok=True)

def model_def(mid):
    return {
      'id': mid,
      'name': mid,
      'api': 'openai-completions',
      'input': ['text'],
      'reasoning': False,
      'cost': {'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0},
      'contextWindow': 131072,
      'maxTokens': 8192,
    }

seed_models = [
  'llama3.2:latest',
  'qwen2.5:latest',
  'mistral:latest',
  'phi4:latest',
  'gpt-oss:20b'
]
if model_id not in seed_models:
    seed_models.insert(0, model_id)

models_map = {f'openai/{m}': {'alias': m} for m in seed_models}
models_map[f'openai/{model_id}'] = {'alias': model_id}

cfg = {
  'messages': {'ackReactionScope': 'group-mentions'},
  'agents': {
    'defaults': {
      'workspace': workspace,
      'maxConcurrent': 4,
      'subagents': {'maxConcurrent': 8},
      'compaction': {'mode': 'safeguard'},
      'models': models_map,
      'model': {'primary': f'openai/{model_id}'},
    }
  },
  'gateway': {
    'mode': 'local',
    'bind': 'loopback',
    'port': int(os.environ.get('LOCALCLAW_GATEWAY_PORT', '18789')),
    'auth': {'mode': 'token', 'token': os.environ.get('LOCALCLAW_GATEWAY_TOKEN', secrets.token_hex(24))},
    'tailscale': {'mode': 'off', 'resetOnExit': False}
  },
  'models': {
    'mode': 'merge',
    'providers': {
      'openai': {
        'baseUrl': base_url,
        'api': 'openai-completions',
        'authHeader': False,
        'apiKey': 'local-only',
        'models': [model_def(m) for m in seed_models],
      }
    }
  }
}

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(cfg, f, indent=2)
print(config_path)
