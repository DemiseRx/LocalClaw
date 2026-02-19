import { spawn } from 'node:child_process';
import path from 'node:path';

const cwd = process.cwd();
const env = {
  ...process.env,
  LOCALCLAW_STATE_DIR: process.env.LOCALCLAW_STATE_DIR ?? path.join(cwd, '.localclaw', 'state'),
  OPENCLAW_CONFIG_PATH: process.env.OPENCLAW_CONFIG_PATH ?? path.join(cwd, '.localclaw', 'openclaw.local.json'),
};

const dashboard = spawn('openclaw', ['dashboard'], { stdio: 'inherit', shell: true, env });
dashboard.on('exit', (code) => process.exit(code ?? 0));
