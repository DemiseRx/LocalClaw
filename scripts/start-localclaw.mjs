import { spawn } from 'node:child_process';
import path from 'node:path';

const localhost = ['127.0.0.1', 'localhost', '::1'];

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
let baseUrl = process.env.LOCALCLAW_BASE_URL;

if (!baseUrl) {
  if (backend === 'ollama') baseUrl = 'http://127.0.0.1:11434/v1';
  else if (backend === 'lmstudio') baseUrl = 'http://127.0.0.1:1234/v1';
  else if (backend === 'auto') {
    if (await canReach('http://127.0.0.1:11434/v1/models')) baseUrl = 'http://127.0.0.1:11434/v1';
    else if (await canReach('http://127.0.0.1:1234/v1/models')) baseUrl = 'http://127.0.0.1:1234/v1';
    else throw new Error('No local OpenAI-compatible server found on 11434 or 1234. Start Ollama or LM Studio first.');
  } else {
    throw new Error(`Unsupported LOCALCLAW_BACKEND: ${backend}`);
  }
}

const parsed = new URL(baseUrl);
if (!localhost.includes(parsed.hostname)) {
  throw new Error(`LOCALCLAW refuses non-local host: ${parsed.hostname}`);
}

const cwd = process.cwd();
const env = {
  ...process.env,
  LOCALCLAW_BASE_URL: baseUrl,
  LOCALCLAW_STATE_DIR: process.env.LOCALCLAW_STATE_DIR ?? path.join(cwd, '.localclaw', 'state'),
  OPENCLAW_CONFIG_PATH: process.env.OPENCLAW_CONFIG_PATH ?? path.join(cwd, '.localclaw', 'openclaw.local.json'),
};

await new Promise((resolve, reject) => {
  const render = spawn('node', ['scripts/render-local-config.mjs'], { stdio: 'inherit', shell: true, env });
  render.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`render-local-config failed (${code})`))));
});

const gw = spawn('openclaw', ['gateway', 'run'], { stdio: 'inherit', shell: true, env });
gw.on('exit', (code) => process.exit(code ?? 0));
