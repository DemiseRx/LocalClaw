import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const cwd = process.cwd();
const baseUrlRaw = (process.env.LOCALCLAW_BASE_URL ?? 'http://127.0.0.1:11434/v1').replace(/\/$/, '');
const modelId = (process.env.LOCALCLAW_MODEL ?? 'llama3.2:latest').trim() || 'llama3.2:latest';
const stateDir = process.env.LOCALCLAW_STATE_DIR ?? path.join(cwd, '.localclaw', 'state');
const configPath = process.env.OPENCLAW_CONFIG_PATH ?? path.join(cwd, '.localclaw', 'openclaw.local.json');
const tokenPath = process.env.LOCALCLAW_GATEWAY_TOKEN_PATH ?? path.join(path.dirname(configPath), 'gateway.token');

let parsed;
try {
  parsed = new URL(baseUrlRaw);
} catch {
  throw new Error(`LOCALCLAW_BASE_URL must be a valid URL, got: ${baseUrlRaw}`);
}
if (!['http:', 'https:'].includes(parsed.protocol)) {
  throw new Error(`LOCALCLAW_BASE_URL must be http(s), got: ${baseUrlRaw}`);
}
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
  throw new Error(`LOCALCLAW refuses non-local host: ${parsed.hostname}`);
}

const readTextFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return '';
  }
};

const readTokenFromConfig = () => {
  try {
    const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const token = existing?.gateway?.auth?.token;
    return typeof token === 'string' ? token.trim() : '';
  } catch {
    return '';
  }
};

const isLikelyToken = (value) => typeof value === 'string' && /^[a-f0-9]{24,}$/i.test(value);
const shouldRotate = ['1', 'true', 'yes'].includes(String(process.env.LOCALCLAW_ROTATE_GATEWAY_TOKEN ?? '').toLowerCase());

const envToken = (process.env.LOCALCLAW_GATEWAY_TOKEN ?? '').trim();
const configToken = shouldRotate ? '' : readTokenFromConfig();
const fileToken = shouldRotate ? '' : readTextFile(tokenPath);
const token =
  (isLikelyToken(envToken) && envToken) ||
  (isLikelyToken(configToken) && configToken) ||
  (isLikelyToken(fileToken) && fileToken) ||
  crypto.randomBytes(24).toString('hex');

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.mkdirSync(stateDir, { recursive: true });
const workspace = path.join(stateDir, 'workspace');
fs.mkdirSync(workspace, { recursive: true });
fs.writeFileSync(tokenPath, `${token}\n`, 'utf8');

const modelDef = (id) => ({
  id,
  name: id,
  api: 'openai-completions',
  input: ['text'],
  reasoning: false,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 131072,
  maxTokens: 8192,
});

const seedModels = ['llama3.2:latest', 'qwen2.5:latest', 'mistral:latest', 'phi4:latest', 'gpt-oss:20b'];
if (!seedModels.includes(modelId)) seedModels.unshift(modelId);

const modelsMap = Object.fromEntries(seedModels.map((m) => [`openai/${m}`, { alias: m }]));
const gatewayPort = Number.parseInt(process.env.LOCALCLAW_GATEWAY_PORT ?? '18789', 10);

const cfg = {
  messages: { ackReactionScope: 'group-mentions' },
  agents: {
    defaults: {
      workspace,
      maxConcurrent: 4,
      subagents: { maxConcurrent: 8 },
      compaction: { mode: 'safeguard' },
      models: modelsMap,
      model: { primary: `openai/${modelId}` },
    },
  },
  gateway: {
    mode: 'local',
    bind: 'loopback',
    port: Number.isFinite(gatewayPort) ? gatewayPort : 18789,
    auth: { mode: 'token', token },
    tailscale: { mode: 'off', resetOnExit: false },
  },
  models: {
    mode: 'merge',
    providers: {
      openai: {
        baseUrl: baseUrlRaw,
        api: 'openai-completions',
        authHeader: false,
        apiKey: 'local-only',
        models: seedModels.map(modelDef),
      },
    },
  },
};

fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
console.log(configPath);
