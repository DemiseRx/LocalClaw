import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const cwd = process.cwd();
const defaultConfigPath = path.join(cwd, '.localclaw', 'openclaw.local.json');

const tryResolveByCli = () => {
  const commands = ['openclaw config path', 'openclaw config --path', 'openclaw config get-path'];
  for (const command of commands) {
    try {
      const out = execSync(command, { stdio: ['ignore', 'pipe', 'ignore'], shell: true }).toString('utf8').trim();
      if (out && out.endsWith('.json')) return out;
    } catch {}
  }
  return null;
};

const readJson = (p) => {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

const configPath = process.env.OPENCLAW_CONFIG_PATH ?? tryResolveByCli() ?? defaultConfigPath;
const stateDir = process.env.LOCALCLAW_STATE_DIR ?? path.join(path.dirname(configPath), 'state');
const existing = readJson(configPath) ?? {};

const discoverModel = async (baseUrl, override) => {
  let ids = [];
  try {
    const res = await fetch(`${baseUrl}/models`);
    if (res.ok) {
      const body = await res.json();
      ids = Array.isArray(body?.data) ? body.data.map((m) => String(m?.id ?? '')).filter(Boolean) : [];
    }
  } catch {}

  const hasId = (candidate) => ids.some((id) => id.toLowerCase() === candidate.toLowerCase());

  if (override) {
    if (!ids.length || hasId(override)) return { modelId: override, discovered: ids };
    console.warn(`[LocalClaw] Requested model ${override} not returned by /v1/models; selecting best available model.`);
  }

  const lfm = ids.filter((id) => /lfm2(\.5)?/i.test(id) && /(1\.2b|1_2b)/i.test(id)).sort((a, b) => a.length - b.length);
  if (lfm.length) return { modelId: lfm[0], discovered: ids };
  if (ids.length) return { modelId: ids[0], discovered: ids };
  throw new Error(`No model available at ${baseUrl}/models. Load a model in LM Studio or set LMSTUDIO_MODEL_ID.`);
};

const baseUrlRaw = (process.env.LMSTUDIO_BASE_URL ?? process.env.LOCALCLAW_BASE_URL ?? 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
const apiMode = (process.env.LOCALCLAW_API_MODE ?? 'openai-responses').trim() || 'openai-responses';
const overrideModel = (process.env.LMSTUDIO_MODEL_ID ?? process.env.LOCALCLAW_MODEL ?? '').trim();
const searchProvider = (process.env.LOCALCLAW_WEB_SEARCH_PROVIDER ?? 'perplexity').trim() || 'perplexity';
const perplexityApiKey = (process.env.PERPLEXITY_API_KEY ?? process.env.OPENROUTER_API_KEY ?? '').trim();
const perplexityBaseUrl = (process.env.LOCALCLAW_PERPLEXITY_BASE_URL ?? 'http://127.0.0.1:8787').trim();
const perplexityModel = (process.env.LOCALCLAW_PERPLEXITY_MODEL ?? existing?.tools?.web?.search?.perplexity?.model ?? 'perplexity/sonar-pro').trim();

const parsed = new URL(baseUrlRaw);
if (!['http:', 'https:'].includes(parsed.protocol)) {
  throw new Error(`LMSTUDIO_BASE_URL must be http(s), got: ${baseUrlRaw}`);
}

const { modelId, discovered } = await discoverModel(baseUrlRaw, overrideModel || null);

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(path.join(stateDir, 'workspace'), { recursive: true });

const existingToken = existing?.gateway?.auth?.token;
const token = (typeof existingToken === 'string' && existingToken.trim()) ? existingToken.trim() : (process.env.LOCALCLAW_GATEWAY_TOKEN ?? crypto.randomBytes(24).toString('hex'));

const providers = { ...(existing.models?.providers ?? {}) };
const existingLm = providers.lmstudio ?? {};
const existingLmModels = Array.isArray(existingLm.models) ? existingLm.models : [];

const unique = [...new Set([modelId, ...discovered].filter(Boolean).map((x) => String(x)))];
const modelDefs = unique.map((id) => {
  const prior = existingLmModels.find((m) => m?.id === id) ?? {};
  return {
    id,
    name: prior.name ?? id,
    api: apiMode,
    input: prior.input ?? ['text'],
    reasoning: prior.reasoning ?? false,
    cost: prior.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: prior.contextWindow ?? 131072,
    maxTokens: prior.maxTokens ?? 8192,
  };
});

providers.lmstudio = {
  ...existingLm,
  baseUrl: baseUrlRaw,
  apiKey: existingLm.apiKey ?? 'lmstudio',
  api: apiMode,
  authHeader: existingLm.authHeader ?? false,
  models: modelDefs,
};

const agentsDefaults = { ...(existing.agents?.defaults ?? {}) };
const agentModels = { ...(agentsDefaults.models ?? {}) };
agentModels[`lmstudio/${modelId}`] = { alias: modelId };

const next = {
  ...existing,
  messages: { ackReactionScope: 'group-mentions', ...(existing.messages ?? {}) },
  commands: {
    native: existing.commands?.native ?? 'auto',
    nativeSkills: existing.commands?.nativeSkills ?? 'auto',
    ...(existing.commands ?? {}),
  },
  tools: {
    ...(existing.tools ?? {}),
    web: {
      ...(existing.tools?.web ?? {}),
      search: {
        ...(existing.tools?.web?.search ?? {}),
        provider: searchProvider,
        ...(searchProvider === 'perplexity' ? {
          perplexity: {
            ...(existing.tools?.web?.search?.perplexity ?? {}),
            ...(perplexityBaseUrl ? { baseUrl: perplexityBaseUrl } : {}),
            model: perplexityModel,
            apiKey: perplexityApiKey || existing?.tools?.web?.search?.perplexity?.apiKey || 'local-search',
          },
        } : {}),
      },
    },
  },
  agents: {
    ...(existing.agents ?? {}),
    defaults: {
      workspace: agentsDefaults.workspace ?? path.join(stateDir, 'workspace'),
      maxConcurrent: agentsDefaults.maxConcurrent ?? 4,
      subagents: agentsDefaults.subagents ?? { maxConcurrent: 8 },
      compaction: agentsDefaults.compaction ?? { mode: 'safeguard' },
      ...agentsDefaults,
      models: agentModels,
      model: { ...(agentsDefaults.model ?? {}), primary: `lmstudio/${modelId}` },
    },
  },
  gateway: {
    mode: existing.gateway?.mode ?? 'local',
    bind: existing.gateway?.bind ?? 'loopback',
    port: Number.parseInt(process.env.LOCALCLAW_GATEWAY_PORT ?? `${existing.gateway?.port ?? 18789}`, 10),
    auth: { mode: 'token', token, ...(existing.gateway?.auth ?? {}) },
    tailscale: existing.gateway?.tailscale ?? { mode: 'off', resetOnExit: false },
    ...(existing.gateway ?? {}),
  },
  models: {
    ...(existing.models ?? {}),
    mode: existing.models?.mode ?? 'merge',
    providers,
  },
};

const tmp = path.join(path.dirname(configPath), `.tmp-${path.basename(configPath)}-${process.pid}-${Date.now()}`);
fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
fs.renameSync(tmp, configPath);

console.log(`[LocalClaw] Patched config: ${configPath}`);
console.log(`[LocalClaw] Provider lmstudio -> ${baseUrlRaw}`);
console.log(`[LocalClaw] Default model -> lmstudio/${modelId}`);
console.log(`[LocalClaw] Web search provider -> ${searchProvider}`);
