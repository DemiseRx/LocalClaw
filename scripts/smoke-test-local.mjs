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
const run = (command, args, env) => new Promise((resolve, reject) => {
  const p = spawn(command, args, { shell: true, stdio: 'inherit', env });
  p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed (${code})`))));
});

try {
  await wait(800);
  const model = 'liquid/lfm2.5-1.2b';
  const env = {
    ...process.env,
    LMSTUDIO_BASE_URL: `http://127.0.0.1:${port}/v1`,
    LMSTUDIO_MODEL_ID: model,
    LOCALCLAW_API_MODE: 'openai-responses',
    LOCALCLAW_BACKEND: 'lmstudio',
    LOCALCLAW_SKIP_GATEWAY: '1',
  };

  const modelsRes = await fetch(`http://127.0.0.1:${port}/v1/models`);
  const modelsJson = await modelsRes.json();
  assert(Array.isArray(modelsJson.data) && modelsJson.data.length > 0, 'models endpoint empty');

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

  const respRes = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: 'test' }),
  });
  const resp = await respRes.text();
  assert(resp.includes(phrase), 'responses missing phrase');

  await run('node', ['scripts/patch-openclaw-config.mjs'], env);

  const cfg = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert(cfg.models?.providers?.lmstudio?.baseUrl === `http://127.0.0.1:${port}/v1`, 'lmstudio baseUrl not written');
  const primary = cfg.agents?.defaults?.model?.primary ?? '';
  assert(primary.startsWith('lmstudio/'), 'default primary model not in lmstudio/*');
  assert(/lfm2/i.test(primary), 'default primary model is not an LFM2 variant');
  assert(cfg.commands?.native === 'auto', 'commands.native should remain auto');
  assert(cfg.commands?.nativeSkills === 'auto', 'commands.nativeSkills should remain auto');

  const firstToken = cfg.gateway.auth.token;
  await run('node', ['scripts/patch-openclaw-config.mjs'], env);
  const cfg2 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert(cfg2.gateway.auth.token === firstToken, 'gateway token changed between patch runs');

  await run('node', ['scripts/start-localclaw.mjs'], {
    ...env,
    LOCALCLAW_MODEL: 'llama3.2:not-installed',
  });
  const cfg3 = JSON.parse(fs.readFileSync('.localclaw/openclaw.local.json', 'utf8'));
  assert(cfg3.agents.defaults.model.primary.startsWith('lmstudio/'), 'start-localclaw did not retain lmstudio default');

  console.log('Smoke test passed');
} finally {
  srv.kill('SIGTERM');
}
