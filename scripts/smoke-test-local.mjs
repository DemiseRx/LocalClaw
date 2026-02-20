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
  const model = 'lfm2.5-1.2b';

  const chatRes = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'test' }] }),
  });
  const chat = await chatRes.text();
  assert(chat.includes(phrase), 'chat/completions missing phrase');

  const toolRes = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'check health with a tool' }],
      tools: [{ type: 'function', function: { name: 'local_lookup', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } }],
    }),
  });
  const toolPayload = await toolRes.json();
  const toolCall = toolPayload?.choices?.[0]?.message?.tool_calls?.[0];
  assert(toolCall?.type === 'function', 'tool call missing in chat response');
  assert(toolCall?.function?.name === 'local_lookup', 'tool function name mismatch');

  const respRes = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: 'test' }),
  });
  const resp = await respRes.text();
  assert(resp.includes(phrase), 'responses missing phrase');

  const render = spawn('node', ['scripts/render-local-config.mjs'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      LOCALCLAW_BASE_URL: `http://127.0.0.1:${port}/v1`,
      LOCALCLAW_MODEL: model,
      LOCALCLAW_API_MODE: 'openai-chat',
    },
  });
  await new Promise((resolve, reject) => render.on('exit', (code) => code === 0 ? resolve() : reject(new Error('render failed'))));

  const cfg = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert(cfg.models.providers.openai.baseUrl.startsWith('http://127.0.0.1:'), 'config baseUrl is not localhost');
  assert(cfg.agents.defaults.model.primary === `openai/${model}`, 'default model not set to LFM model');
  assert(cfg.models.providers.openai.api === 'openai-chat', 'provider api mode not set to openai-chat');
  assert(cfg.commands?.native === 'auto', 'commands.native not set to auto');
  assert(cfg.commands?.nativeSkills === 'auto', 'commands.nativeSkills not set to auto');

  const firstToken = cfg.gateway.auth.token;
  assert(typeof firstToken === 'string' && firstToken.length > 0, 'gateway token missing');

  const rerender = spawn('node', ['scripts/render-local-config.mjs'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      LOCALCLAW_BASE_URL: `http://127.0.0.1:${port}/v1`,
      LOCALCLAW_MODEL: model,
      LOCALCLAW_API_MODE: 'openai-chat',
    },
  });
  await new Promise((resolve, reject) => rerender.on('exit', (code) => code === 0 ? resolve() : reject(new Error('rerender failed'))));

  const cfg2 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert(cfg2.gateway.auth.token === firstToken, 'gateway token changed between renders');

  const start = spawn('node', ['scripts/start-localclaw.mjs'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      LOCALCLAW_BACKEND: 'lmstudio',
      LOCALCLAW_BASE_URL: `http://127.0.0.1:${port}/v1`,
      LOCALCLAW_MODEL: 'llama3.2:not-installed',
      LOCALCLAW_API_MODE: 'openai-chat',
      LOCALCLAW_SKIP_GATEWAY: '1',
    },
  });
  await new Promise((resolve, reject) => start.on('exit', (code) => code === 0 ? resolve() : reject(new Error('start-localclaw failed'))));

  const cfg3 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  const correctedPrimary = cfg3.agents.defaults.model.primary;
  assert(correctedPrimary !== 'openai/llama3.2:not-installed', 'stale LOCALCLAW_MODEL was not corrected');
  assert(/^openai\/.+/.test(correctedPrimary), 'corrected model was not written to openai/* alias');

  console.log('Smoke test passed');
} finally {
  srv.kill('SIGTERM');
}
