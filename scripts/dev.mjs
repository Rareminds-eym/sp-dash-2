import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { parse } from 'dotenv';
import { unstable_readConfig } from 'wrangler';
import { dashboardArguments, localDashboardConfig, serializeVariables, LOCAL_WORKER_PORT } from './lib/local-dashboard.mjs';
import { startLocalRecovery } from './lib/local-recovery.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = dashboardArguments(process.argv.slice(2));
const settings = {};
// Next's development precedence, with Wrangler's private bindings file last.
for (const filename of ['.env', '.env.development', '.env.local', '.env.development.local', '.dev.vars']) {
  const path = resolve(root, filename);
  if (existsSync(path)) Object.assign(settings, parse(readFileSync(path)));
}
for (const key of Object.keys(settings)) if (process.env[key] !== undefined) settings[key] = process.env[key];

async function available(port, hostname = '127.0.0.1') {
  const server = createServer();
  await new Promise((accept, reject) => {
    server.once('error', () => reject(new Error(`Port ${port} is already in use. Stop the existing dashboard/runtime before starting npm run dev.`)));
    server.listen(port, hostname, accept);
  });
  await new Promise(accept => server.close(accept));
}
await available(options.port, options.hostname);
await available(LOCAL_WORKER_PORT);
const dev = unstable_readConfig({ config: resolve(root, 'wrangler.toml'), env: 'dev' });
const canonical = unstable_readConfig({ config: resolve(root, 'wrangler.toml') });
const local = localDashboardConfig(dev, canonical.services, settings,
  { port: options.port, hostname: options.hostname, main: resolve(root, 'workers/local-dashboard.js') });
const output = resolve(root, '.wrangler/local-dashboard');
mkdirSync(output, { recursive: true, mode: 0o700 });
for (const [filename, contents] of Object.entries({
  'worker.json': JSON.stringify(local.worker, null, 2),
  'proxy.json': JSON.stringify(local.proxy, null, 2),
  '.dev.vars': serializeVariables(local.variables),
})) writeFileSync(resolve(output, filename), contents, { mode: 0o600 });

const children = [];
let stopping = false;
let stopRecovery = () => {};
function stop(code) {
  if (stopping) return;
  stopping = true;
  stopRecovery();
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode === null) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    }
  }
}
function launch(script, args, env) {
  const child = spawn(process.execPath, [resolve(root, script), ...args], {
    cwd: root, env: { ...process.env, ...env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'inherit', detached: true,
  });
  children.push(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => stop(code ?? 1));
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));
console.log(`Starting sp-dash BFF and UI on http://localhost:${options.port}. Uses normal local settings; no migrations or deployments.`);
console.log('Start the existing SSO/auth-sync services normally. Zoho remains approval-only and email-prohibited.');
launch('node_modules/wrangler/bin/wrangler.js', ['dev', '--local', '--config', resolve(output, 'worker.json'),
  '--ip', '127.0.0.1', '--port', String(LOCAL_WORKER_PORT), '--inspector-port', '9240', '--test-scheduled'], {});
launch('node_modules/next/dist/bin/next', ['dev', '--hostname', options.hostname, '--port', String(options.port), ...options.extra],
  { ...local.variables, CLOUDFLARE_LOCAL_CONFIG_PATH: resolve(output, 'proxy.json') });
stopRecovery = startLocalRecovery({ crons: local.worker.triggers.crons,
  origin: `http://127.0.0.1:${LOCAL_WORKER_PORT}`, onError: message => console.error(message),
  onSuccess: cron => console.log(`Local scheduled recovery completed (${cron}).`) });
