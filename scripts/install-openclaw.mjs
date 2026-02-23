import { execSync } from 'node:child_process';

const target = (process.env.OPENCLAW_INSTALL_TARGET ?? 'openclaw@2026.2.17').trim() || 'openclaw@2026.2.17';
console.log(`[LocalClaw] Installing OpenClaw target: ${target}`);
execSync(`npm i -g ${target}`, { stdio: 'inherit', shell: true });
