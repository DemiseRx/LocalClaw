import { spawn } from 'node:child_process';
import path from 'node:path';

const localhost = ['127.0.0.1', 'localhost', '::1'];
const preferredModels = [
  'liquid/lfm2.5-1.2b',
  'liquid/lfm2.5-1.2b@q8_0',
  'lfm2.5-1.2b',
  'liquid/lfm2-1.2b',
  'lfm2-1.2b',
  'openai/gpt-oss-20b',
  'gpt-oss:20b',
  'llama3.2:latest',
  'qwen2.5:latest',
  'mistral:latest',
  'phi4:latest',
];

const canReach = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const fetchModelIds = async (baseUrl) => {
  try {
    const res = await fetch(`${baseUrl}/models`);
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.data) ? body.data.map((x) => String(x?.id ?? '')).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const selectModel = (ids) => {
  const lowerMap = new Map(ids.map((id) => [id.toLowerCase(), id]));
  for (const preferred of preferredModels) {
    const match = lowerMap.get(preferred.toLowerCase());
    if (match) return match;
  }

  for (const id of ids) {
    if (/lfm2(\.5)?[-:/ ]?1\.2b/i.test(id) || /liquid/i.test(id)) return id;
  }

  return ids[0] ?? null;
};

const hasModelId = (ids, candidate) => {
  if (!candidate) return false;
  const needle = candidate.toLowerCase();
  return ids.some((id) => id.toLowerCase() === needle);
};

const backend = process.env.LOCALCLAW_BACKEND ?? 'auto';
let baseUrl = process.env.LOCALCLAW_BASE_URL;
let resolvedBackend = backend;

if (!baseUrl) {
  if (backend === 'ollama') {
    resolvedBackend = 'ollama';
    baseUrl = 'http://127.0.0.1:11434/v1';
  } else if (backend === 'lmstudio') {
    resolvedBackend = 'lmstudio';
    baseUrl = 'http://127.0.0.1:1234/v1';
  } else if (backend === 'auto') {
    if (await canReach('http://127.0.0.1:11434/v1/models')) {
      resolvedBackend = 'ollama';
      baseUrl = 'http://127.0.0.1:11434/v1';
    } else if (await canReach('http://127.0.0.1:1234/v1/models')) {
      resolvedBackend = 'lmstudio';
      baseUrl = 'http://127.0.0.1:1234/v1';
    } else throw new Error('No local OpenAI-compatible server found on 11434 or 1234. Start Ollama or LM Studio first.');
  } else {
    throw new Error(`Unsupported LOCALCLAW_BACKEND: ${backend}`);
  }
}

const parsed = new URL(baseUrl);
if (!localhost.includes(parsed.hostname)) {
  throw new Error(`LOCALCLAW refuses non-local host: ${parsed.hostname}`);
}

const availableModels = await fetchModelIds(baseUrl);
const autoModel = selectModel(availableModels);
const requestedModel = (process.env.LOCALCLAW_MODEL ?? '').trim();
let selectedModel = requestedModel || autoModel || '';

if (requestedModel && availableModels.length > 0 && !hasModelId(availableModels, requestedModel)) {
  if (autoModel) {
    console.warn(`[LocalClaw] LOCALCLAW_MODEL=${requestedModel} is not served by ${baseUrl}. Falling back to available model: ${autoModel}`);
    selectedModel = autoModel;
  } else {
    throw new Error(`LOCALCLAW_MODEL=${requestedModel} was not found in ${baseUrl}/models`);
  }
}

if (!selectedModel) {
  throw new Error(`No model IDs were returned by ${baseUrl}/models. Load a local model in Ollama/LM Studio and retry.`);
}

const defaultApiMode = resolvedBackend === 'lmstudio' ? 'openai-chat' : 'openai-completions';
const apiMode = (process.env.LOCALCLAW_API_MODE ?? defaultApiMode).trim();

const cwd = process.cwd();
const env = {
  ...process.env,
  LOCALCLAW_BASE_URL: baseUrl,
  LOCALCLAW_MODEL: selectedModel,
  LOCALCLAW_API_MODE: apiMode,
  LOCALCLAW_STATE_DIR: process.env.LOCALCLAW_STATE_DIR ?? path.join(cwd, '.localclaw', 'state'),
  OPENCLAW_CONFIG_PATH: process.env.OPENCLAW_CONFIG_PATH ?? path.join(cwd, '.localclaw', 'openclaw.local.json'),
};

console.log(`[LocalClaw] backend=${resolvedBackend} baseUrl=${baseUrl}`);
console.log(`[LocalClaw] model=${selectedModel} api=${apiMode}`);

await new Promise((resolve, reject) => {
  const render = spawn('node', ['scripts/render-local-config.mjs'], { stdio: 'inherit', shell: true, env });
  render.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`render-local-config failed (${code})`))));
});

if (process.env.LOCALCLAW_SKIP_GATEWAY === '1') {
  console.log('[LocalClaw] LOCALCLAW_SKIP_GATEWAY=1 set; skipping gateway launch (test mode).');
  process.exit(0);
}

const gw = spawn('openclaw', ['gateway', 'run'], { stdio: 'inherit', shell: true, env });
gw.on('exit', (code) => process.exit(code ?? 0));
