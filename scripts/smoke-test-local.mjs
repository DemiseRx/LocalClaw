import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

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

  const tokenFile = path.join('.localclaw', 'gateway.token');
  const renderEnv = { ...process.env, LOCALCLAW_BASE_URL: `http://127.0.0.1:${port}/v1`, LOCALCLAW_MODEL: 'llama3.2:latest' };

  const render = spawn('node', ['scripts/render-local-config.mjs'], {
    shell: true,
    stdio: 'inherit',
    env: renderEnv,
  });
  await new Promise((resolve, reject) => render.on('exit', (code) => code === 0 ? resolve() : reject(new Error('render failed'))));

  const cfg = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert(cfg.models.providers.openai.baseUrl.startsWith('http://127.0.0.1:'), 'config baseUrl is not localhost');
  assert(cfg.agents.defaults.model.primary.startsWith('openai/'), 'default model not openai/*');
  assert(fs.existsSync(tokenFile), 'gateway token file was not written');

  const tokenFromConfig = cfg.gateway?.auth?.token;
  const tokenFromFile = fs.readFileSync(tokenFile, 'utf8').trim();
  assert(tokenFromConfig, 'gateway token missing in config');
  assert(tokenFromConfig === tokenFromFile, 'gateway token file/config mismatch after first render');

  const renderSecond = spawn('node', ['scripts/render-local-config.mjs'], {
    shell: true,
    stdio: 'inherit',
    env: renderEnv,
  });
  await new Promise((resolve, reject) => renderSecond.on('exit', (code) => code === 0 ? resolve() : reject(new Error('second render failed'))));

  const cfg2 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  const tokenFromConfigSecond = cfg2.gateway?.auth?.token;
  const tokenFromFileSecond = fs.readFileSync(tokenFile, 'utf8').trim();
  assert(tokenFromConfigSecond === tokenFromConfig, 'gateway token changed across renders');
  assert(tokenFromFileSecond === tokenFromConfigSecond, 'gateway token file/config mismatch after second render');
  console.log('Smoke test passed');
} finally {
  srv.kill('SIGTERM');
}
