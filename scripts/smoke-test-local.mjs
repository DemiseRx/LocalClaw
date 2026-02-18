import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';

const port = Number.parseInt(process.env.LOCALCLAW_TEST_PORT ?? '11434', 10);
const phrase = process.env.LOCALCLAW_TEST_PHRASE ?? 'LOCAL_TEST_PHRASE';

const runRender = (extraEnv = {}) => new Promise((resolve, reject) => {
  const render = spawn('node', ['scripts/render-local-config.mjs'], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, LOCALCLAW_BASE_URL: `http://127.0.0.1:${port}/v1`, LOCALCLAW_MODEL: 'llama3.2:latest', ...extraEnv },
  });
  render.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('render failed'))));
});

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

  await runRender();
  const cfg1 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  const token1 = cfg1?.gateway?.auth?.token;
  assert(cfg1.models.providers.openai.baseUrl.startsWith('http://127.0.0.1:'), 'config baseUrl is not localhost');
  assert(cfg1.agents.defaults.model.primary.startsWith('openai/'), 'default model not openai/*');
  assert(typeof token1 === 'string' && token1.length >= 24, 'gateway token missing after render');

  await runRender();
  const cfg2 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert.strictEqual(cfg2?.gateway?.auth?.token, token1, 'gateway token should persist across rerenders');

  await runRender({ LOCALCLAW_ROTATE_GATEWAY_TOKEN: '1' });
  const cfg3 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert.notStrictEqual(cfg3?.gateway?.auth?.token, token1, 'gateway token rotation flag should rotate token');

  console.log('Smoke test passed');
} finally {
  srv.kill('SIGTERM');
}
