import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'dotenv';
import { dashboardArguments, localDashboardConfig, serializeVariables } from '../lib/local-dashboard.mjs';

const infrastructure = {
  name: 'sp-dash-2', compatibility_date: '2026-09-25',
  compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
  vars: { ENVIRONMENT: 'development', NEXT_PUBLIC_SUPABASE_URL: 'https://remote.example.test', OTHER: 'preserved' },
  queues: { producers: [{ binding: 'ZOHO_DISCOVERY_QUEUE', queue: 'zoho-recruit-discovery-dev' }],
    consumers: [{ queue: 'zoho-recruit-discovery-dev', max_retries: 8 }] },
  kv_namespaces: [{ binding: 'RATE_LIMIT_KV', id: 'fixture' }],
  r2_buckets: [{ binding: 'SKILLPASSPORT_ASSETS', bucket_name: 'fixture' }],
  triggers: { crons: ['*/2 * * * *'] },
};
const services = [{ binding: 'SSO', service: 'sso-api', entrypoint: 'SsoWorker' },
  { binding: 'WORKER_SELF_REFERENCE', service: 'sp-dash-2' }];
const settings = { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', ZOHO_CLIENT_SECRET: 'synthetic-test-value' };
const create = (values = settings) => localDashboardConfig(infrastructure, services, values,
  { port: 3010, main: '/fixture/workers/local-dashboard.js' });

test('normal startup preserves BFF/SSO identities, consumers and schedule; UI is producer-only', () => {
  const { worker, proxy, variables } = create();
  assert.equal(worker.name, 'sp-dash-2');
  assert.equal(worker.services[0].service, 'sso-api');
  assert.equal(worker.services[1].service, worker.name);
  assert.ok(worker.services.every(item => item.remote === false));
  assert.deepEqual(worker.queues, infrastructure.queues);
  assert.deepEqual(worker.triggers, infrastructure.triggers);
  assert.ok(worker.kv_namespaces.every(item => item.remote === false));
  assert.ok(worker.r2_buckets.every(item => item.remote === false));
  assert.notEqual(worker.name, proxy.name);
  assert.equal(proxy.queues.consumers, undefined);
  assert.equal(proxy.triggers, undefined);
  assert.equal(proxy.main, undefined);
  assert.equal(worker.vars.NEXT_PUBLIC_SUPABASE_URL, settings.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(worker.vars.SKILLPASSPORT_SUPABASE_URL, settings.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(worker.vars.LOCAL_DASHBOARD_ORIGIN, 'http://127.0.0.1:3010');
  assert.equal(worker.vars.OTHER, 'preserved');
  assert.equal(worker.vars.ZOHO_CLIENT_SECRET, undefined);
  assert.equal(variables.ZOHO_CLIENT_SECRET, settings.ZOHO_CLIENT_SECRET);
  assert.deepEqual(worker.compatibility_flags, ['nodejs_compat']);
});

test('local BFF refuses remote, missing, malformed and mixed database settings', () => {
  for (const values of [{}, { NEXT_PUBLIC_SUPABASE_URL: 'https://remote.example.test' },
    { NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321/path' },
    { NEXT_PUBLIC_SUPABASE_URL: 'http://user:password@localhost:54321' },
    { ...settings, SKILLPASSPORT_SUPABASE_URL: 'https://remote.example.test' },
    { ...settings, SUPABASE_URL: 'https://remote.example.test' }])
    assert.throws(() => create(values), /loopback database/);
});

test('private multiline settings round-trip without shell execution or public config exposure', () => {
  const values = { PRIVATE_KEY: 'line1\nline2', VALUE: 'quotes " and $() and `literal`', ENVIRONMENT: 'development' };
  assert.deepEqual(parse(serializeVariables(values)), values);
  assert.throws(() => serializeVariables({ 'BAD\nKEY': 'value' }), /Invalid local setting/);
});

test('standard npm dev arguments preserve explicit UI port and hostname', () => {
  assert.deepEqual(dashboardArguments([]), { port: 3010, hostname: '127.0.0.1', extra: [] });
  assert.deepEqual(dashboardArguments(['--port', '3020', '--hostname', '0.0.0.0', '--turbo']),
    { port: 3020, hostname: '0.0.0.0', extra: ['--turbo'] });
  for (const args of [['--port'], ['--port=8896'], ['-p', '0'], ['--hostname', 'https://example.test']])
    assert.throws(() => dashboardArguments(args));
});

test('IPv6 binding uses an IPv6 loopback proxy; localhost is deterministic', () => {
  assert.equal(dashboardArguments(['--hostname', 'localhost']).hostname, '127.0.0.1');
  for (const hostname of ['::1', '::']) {
    const options = dashboardArguments(['--hostname', hostname]);
    const local = localDashboardConfig(infrastructure, services, settings,
      { ...options, main: '/fixture/local.js' });
    assert.equal(local.worker.vars.LOCAL_DASHBOARD_ORIGIN, 'http://[::1]:3010');
  }
  assert.throws(() => dashboardArguments(['--hostname', '192.0.2.1']), /loopback or wildcard/);
});

test('conflicting local endpoints fail before rewriting database settings', () => {
  for (const value of ['http://127.0.0.1:54322', 'https://127.0.0.1:54321'])
    assert.throws(() => create({ ...settings, SKILLPASSPORT_SUPABASE_URL: value }), /Conflicting local database/);
  const local = create({ ...settings, SKILLPASSPORT_SUPABASE_URL: 'http://localhost:54321' });
  assert.equal(local.variables.NEXT_PUBLIC_SUPABASE_URL, 'http://localhost:54321');
});

test('app owns indexing objects; the UI proxy references the existing app worker namespace', () => {
  const withIndex = { ...infrastructure, durable_objects: { bindings: [{ name: 'JOB_INDEX_COORDINATOR', class_name: 'JobIndexCoordinator' }] },
    migrations: [{ tag: 'index-app-v1', new_sqlite_classes: ['JobIndexCoordinator'] }] };
  const local = localDashboardConfig(withIndex, services, settings, { port: 3010, main: '/fixture/local.js' });
  assert.deepEqual(local.worker.durable_objects, withIndex.durable_objects);
  assert.deepEqual(local.worker.migrations, withIndex.migrations);
  assert.equal(local.proxy.durable_objects.bindings[0].script_name, local.worker.name);
  assert.equal(local.proxy.migrations, undefined);
});
