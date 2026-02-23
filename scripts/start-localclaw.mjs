import { execSync, spawn } from 'node:child_process';

const check = (url) => {
  try {
    execSync(`curl -fsS ${url} >nul 2>nul`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
};

const backend = process.env.LOCALCLAW_BACKEND ?? 'auto';
let baseUrl = process.env.LOCALCLAW_BASE_URL;

if (!baseUrl) {
  if (backend === 'ollama') baseUrl = 'http://127.0.0.1:11434/v1';
  else if (backend === 'lmstudio') baseUrl = 'http://127.0.0.1:1234/v1';
  else if (backend === 'auto') {
    if (check('http://127.0.0.1:11434/v1/models')) baseUrl = 'http://127.0.0.1:11434/v1';
    else if (check('http://127.0.0.1:1234/v1/models')) baseUrl = 'http://127.0.0.1:1234/v1';
    else throw new Error('No local OpenAI-compatible server found on 11434 or 1234. Start Ollama or LM Studio first.');
  } else {
    throw new Error(`Unsupported LOCALCLAW_BACKEND: ${backend}`);
  }
}

process.env.LOCALCLAW_BASE_URL = baseUrl;
process.env.LOCALCLAW_STATE_DIR = process.env.LOCALCLAW_STATE_DIR ?? `${process.cwd()}\\.localclaw\\state`;
process.env.OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH ?? `${process.cwd()}\\.localclaw\\openclaw.local.json`;

const render = spawn('node', ['scripts/render-local-config.mjs'], { stdio: 'inherit', shell: true, env: process.env });
render.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const gw = spawn('openclaw', ['gateway', 'run'], { stdio: 'inherit', shell: true, env: process.env });
  gw.on('exit', (c) => process.exit(c ?? 0));
});
