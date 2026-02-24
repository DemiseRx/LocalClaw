import { execSync } from 'node:child_process';

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const run = (cmd) => {
  console.log(`[LocalClaw] ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
};

try {
  run(`${npmBin} i -g clawhub`);
} catch (err) {
  console.warn('[LocalClaw] Warning: failed to preinstall clawhub globally. Skills UI may show install errors until npm environment is fixed.');
}

run(`${npxBin} playwright install chromium`);
