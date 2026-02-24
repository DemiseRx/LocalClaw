import { spawn } from 'node:child_process';
import path from 'node:path';

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

const backend = process.env.LOCALCLAW_BACKEND ?? 'auto';
let baseUrl = (process.env.LMSTUDIO_BASE_URL ?? process.env.LOCALCLAW_BASE_URL ?? '').trim();
let resolvedBackend = backend;
let useLocalModelFlow = true;

if (!baseUrl) {
  if (backend === 'lmstudio') {
    resolvedBackend = 'lmstudio';
    baseUrl = 'http://127.0.0.1:1234/v1';
  } else if (backend === 'ollama') {
    resolvedBackend = 'ollama';
    baseUrl = 'http://127.0.0.1:11434/v1';
  } else if (backend === 'auto') {
    if (await canReach('http://127.0.0.1:1234/v1/models')) {
      resolvedBackend = 'lmstudio';
      baseUrl = 'http://127.0.0.1:1234/v1';
    } else if (await canReach('http://127.0.0.1:11434/v1/models')) {
      resolvedBackend = 'ollama';
      baseUrl = 'http://127.0.0.1:11434/v1';
    } else {
      useLocalModelFlow = false;
      resolvedBackend = 'quickstart';
      console.log('[LocalClaw] No local OpenAI-compatible server found on 1234 or 11434; using baseline quick-start gateway start.');
    }
  } else {
    throw new Error(`Unsupported LOCALCLAW_BACKEND: ${backend}`);
  }
}

const cwd = process.cwd();
const env = {
  ...process.env,
  LMSTUDIO_BASE_URL: baseUrl,
  LMSTUDIO_MODEL_ID: process.env.LMSTUDIO_MODEL_ID ?? process.env.LOCALCLAW_MODEL,
  LOCALCLAW_STATE_DIR: process.env.LOCALCLAW_STATE_DIR ?? path.join(cwd, '.localclaw', 'state'),
  OPENCLAW_CONFIG_PATH: process.env.OPENCLAW_CONFIG_PATH ?? path.join(cwd, '.localclaw', 'openclaw.local.json'),
};

if (useLocalModelFlow) {
  console.log(`[LocalClaw] backend=${resolvedBackend} baseUrl=${baseUrl}`);
  await new Promise((resolve, reject) => {
    const patch = spawn('node', ['scripts/patch-openclaw-config.mjs'], { stdio: 'inherit', shell: true, env });
    patch.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`patch-openclaw-config failed (${code})`))));
  });
} else {
  console.log('[LocalClaw] backend=quickstart baseUrl=(none)');
}

if (process.env.LOCALCLAW_SKIP_GATEWAY === '1') {
  console.log('[LocalClaw] LOCALCLAW_SKIP_GATEWAY=1 set; skipping gateway launch (test mode).');
  process.exit(0);
}

const gw = spawn('openclaw', ['gateway', 'run'], { stdio: 'inherit', shell: true, env });
gw.on('exit', (code) => process.exit(code ?? 0));
