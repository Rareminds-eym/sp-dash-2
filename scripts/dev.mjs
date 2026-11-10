import { readFileSync, mkdirSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { parse } from 'dotenv';
import { unstable_readConfig } from 'wrangler';
import { dashboardArguments, localDashboardConfig, serializeVariables, LOCAL_WORKER_PORT } from './lib/local-dashboard.mjs';
import { localDiscoveryCredential, startLocalDiscoveryRenewal, needsLocalDiscoveryCredential } from './lib/local-discovery-credential.mjs';
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
let reader = needsLocalDiscoveryCredential(settings) ? await localDiscoveryCredential(settings) : null;
if (reader) settings.ZOHO_DISCOVERY_DB_TOKEN = reader.token;
if (reader?.renewed) console.log('Renewed the restricted local discovery credential.');
if (reader) console.log(`Local discovery credential expires ${new Date(reader.expiresAt).toLocaleString()}. The local supervisor renews it before expiry.`);
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
let restarting = false;
let stopCredentialRenewal = () => {};
let stopRecovery = () => {};
function stop(code) {
  if (stopping) return;
  stopping = true;
  stopRecovery();
  stopCredentialRenewal();
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
  child.once('exit', code => { if (!restarting) stop(code ?? 1); });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));
console.log(`Starting sp-dash BFF and UI on http://localhost:${options.port}. Uses normal local settings; no migrations or deployments.`);
console.log('Start the existing SSO/auth-sync services normally. Zoho remains approval-only and email-prohibited.');
function startRuntimes() {
  launch('node_modules/wrangler/bin/wrangler.js', ['dev', '--local', '--config', resolve(output, 'worker.json'),
    '--ip', '127.0.0.1', '--port', String(LOCAL_WORKER_PORT), '--inspector-port', '9240', '--test-scheduled'], {});
  launch('node_modules/next/dist/bin/next', ['dev', '--hostname', options.hostname, '--port', String(options.port), ...options.extra],
    { ...local.variables, CLOUDFLARE_LOCAL_CONFIG_PATH: resolve(output, 'proxy.json') });
  stopRecovery = startLocalRecovery({ crons: local.worker.triggers.crons,
    origin: `http://127.0.0.1:${LOCAL_WORKER_PORT}`, onError: message => console.error(message),
    onSuccess: cron => console.log(`Local scheduled recovery completed (${cron}).`) });

}
startRuntimes();

if (reader) stopCredentialRenewal = startLocalDiscoveryRenewal({
  expiresAt: reader.expiresAt,
  renew: () => localDiscoveryCredential(settings),
  onError: message => console.error(message),
  async onRenewed(next) {
    if (stopping) return;
    settings.ZOHO_DISCOVERY_DB_TOKEN = next.token;
    local.variables.ZOHO_DISCOVERY_DB_TOKEN = next.token;
    const temporary = resolve(output, `.reader-${process.pid}`);
    writeFileSync(temporary, serializeVariables(local.variables), { mode: 0o600 });
    renameSync(temporary, resolve(output, '.dev.vars'));
    restarting = true;
    stopRecovery();
    const previous = children.splice(0);
    try {
      await Promise.all(previous.map(child => new Promise((accept, reject) => {
        if (child.exitCode !== null || child.signalCode !== null) { accept(); return; }
        const timer = setTimeout(() => {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
          reject(new Error('Local runtime shutdown timed out'));
        }, 10000);
        child.once('exit', () => { clearTimeout(timer); accept(); });
        try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
      })));
      reader = next;
      restarting = false;
      if (!stopping) {
        startRuntimes();
        console.log('Renewed the restricted local discovery credential and reloaded dashboard runtimes.');
      }
    } catch {
      restarting = false;
      console.error('Local runtime reload failed. Restart npm run dev.');
      stop(1);
    }
  },
});
