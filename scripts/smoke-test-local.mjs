import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';

const port = Number.parseInt(process.env.LOCALCLAW_TEST_PORT ?? '11434', 10);
const phrase = process.env.LOCALCLAW_TEST_PHRASE ?? 'LOCAL_TEST_PHRASE';

const srv = spawn('node', ['scripts/mock-openai-server.mjs'], {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, LOCALCLAW_TEST_PORT: String(port), LOCALCLAW_TEST_PHRASE: phrase },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await wait(800);
  const chatRes = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2:latest', messages: [{ role: 'user', content: 'test' }] }),
  });
  const chat = await chatRes.text();
  assert(chat.includes(phrase), 'chat/completions missing phrase');

  const respRes = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2:latest', input: 'test' }),
  });
  const resp = await respRes.text();
  assert(resp.includes(phrase), 'responses missing phrase');

  const render = spawn('node', ['scripts/render-local-config.mjs'], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, LOCALCLAW_BASE_URL: `http://127.0.0.1:${port}/v1`, LOCALCLAW_MODEL: 'llama3.2:latest' },
  });
  await new Promise((resolve, reject) => render.on('exit', (code) => code === 0 ? resolve() : reject(new Error('render failed'))));

  const cfg = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert(cfg.models.providers.openai.baseUrl.startsWith('http://127.0.0.1:'), 'config baseUrl is not localhost');
  assert(cfg.agents.defaults.model.primary.startsWith('openai/'), 'default model not openai/*');

  const firstToken = cfg.gateway.auth.token;
  assert(typeof firstToken === 'string' && firstToken.length > 0, 'gateway token missing');

  const rerender = spawn('node', ['scripts/render-local-config.mjs'], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, LOCALCLAW_BASE_URL: `http://127.0.0.1:${port}/v1`, LOCALCLAW_MODEL: 'llama3.2:latest' },
  });
  await new Promise((resolve, reject) => rerender.on('exit', (code) => code === 0 ? resolve() : reject(new Error('rerender failed'))));

  const cfg2 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert(cfg2.gateway.auth.token === firstToken, 'gateway token changed between renders');
  console.log('Smoke test passed');
} finally {
  srv.kill('SIGTERM');
}
