vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { discoveryCredential, integrationRuntime, queueNames, RECOVERY_CRON } from '../runtime';
import { discoveryStatus } from '../discovery-readiness';
import { executorStatus } from '../executor';
import { sealTokens,tokenKeyring } from '../token-vault';

const id = '10000000-0000-4000-8000-000000000001';
const lease = '10000000-0000-4000-8000-000000000002';
const readerToken = `header.${btoa(JSON.stringify({ role: 'zoho_discovery', exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
const key = btoa('k'.repeat(32));
function env() {
  return { ZOHO_ENVIRONMENT: 'dev', ZOHO_BACKGROUND_ENABLED: 'true', ZOHO_DISCOVERY_ENABLED: 'true',
    ZOHO_EXECUTION_ENABLED: 'false', ZOHO_JOB_DESTINATION: {}, SKILLPASSPORT_SUPABASE_URL: 'https://database.example', SKILLPASSPORT_SERVICE_ROLE_KEY: 'fixture',
    ZOHO_DISCOVERY_DB_TOKEN: readerToken, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key', ZOHO_CLIENT_ID: 'client', ZOHO_CLIENT_SECRET: 'secret', ZOHO_TOKEN_ENCRYPTION_KEY: key,
    ZOHO_DISCOVERY_QUEUE: { send: vi.fn() }, ZOHO_APPROVED_QUEUE: { sendBatch: vi.fn() },
    EMAIL_QUEUE: { send: vi.fn(() => { throw new Error('Email forbidden'); }) },
    SSO: { createLearnerUser: vi.fn(() => { throw new Error('Unapproved creation'); }) } };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());
describe('existing sp-dash runtime', () => {
  it('can clean expired payloads independently of new discovery and execution', async () => {
    const config = { ...env(), ZOHO_DISCOVERY_ENABLED: 'false', ZOHO_EXECUTION_ENABLED: 'false', ZOHO_PRIVACY_CLEANUP_ENABLED: 'true' };
    const db = { rpc: vi.fn(async () => ({ data: { redacted: 2 } })) };
    await integrationRuntime(config, { database: () => db }).scheduled({ cron: RECOVERY_CRON });
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_cleanup_source_payloads', {});
    expect(config.ZOHO_DISCOVERY_QUEUE.send).not.toHaveBeenCalled();
    expect(config.ZOHO_APPROVED_QUEUE.sendBatch).not.toHaveBeenCalled();
    expect(config.EMAIL_QUEUE.send).not.toHaveBeenCalled();
  });
  it('derives exact environment-scoped queue names', () => {
    expect(queueNames({ ZOHO_ENVIRONMENT: 'production' })).toEqual({ discovery: 'zoho-recruit-discovery', approved: 'zoho-recruit-approved' });
    expect(queueNames({ ZOHO_ENVIRONMENT: 'qa' }).discovery).toBe('zoho-recruit-discovery-qa');
    expect(queueNames({ ZOHO_ENVIRONMENT: 'preview' })).toBeNull();
    expect(queueNames({})).toBeNull();
  });
  it('reports actual local consumer readiness without a new service binding', async () => {
    const config = env();
    const runtime = integrationRuntime(config);
    expect(await discoveryStatus(runtime.discovery, config.ZOHO_DISCOVERY_QUEUE)).toBe(true);
    expect(await executorStatus(runtime.executor, config.ZOHO_APPROVED_QUEUE)).toEqual({ ready: false, modules: [] });
    for (const override of [{ ZOHO_BACKGROUND_ENABLED: 'false' }, { ZOHO_PREVIEW: 'true' },
      { ZOHO_ENVIRONMENT: 'preview' },
      { ZOHO_DISCOVERY_DB_TOKEN: undefined }, { ZOHO_CLIENT_SECRET: '' }]) {
      const checked = integrationRuntime({ ...config, ...override });
      expect(await discoveryStatus(checked.discovery, config.ZOHO_DISCOVERY_QUEUE)).toBe(false);
    }
  });
  it('rejects broad, malformed and expired discovery credentials', () => {
    const config = env();
    expect(discoveryCredential(config)).toBe(true);
    for (const claims of [{ role: 'service_role', exp: Math.floor(Date.now() / 1000) + 3600 },
      { role: 'zoho_discovery', exp: 1 }, { role: 'anon', exp: Math.floor(Date.now() / 1000) + 3600 }])
      expect(discoveryCredential({ ...config, ZOHO_DISCOVERY_DB_TOKEN: `header.${btoa(JSON.stringify(claims))}.signature` })).toBe(false);
    expect(discoveryCredential({ ...config, ZOHO_DISCOVERY_DB_TOKEN: 'not-a-jwt' })).toBe(false);
    expect(discoveryCredential({ ...config, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined })).toBe(false);
    // Discovery does not require the host's privileged application key.
    expect(discoveryCredential({ ...config, SKILLPASSPORT_SERVICE_ROLE_KEY: undefined })).toBe(true);
  });
  it.each([false,true])('runs real discovery without mail/account capability, keyring=%s', async keyringOnly => {
    const config = env();
    if(keyringOnly){delete config.ZOHO_TOKEN_ENCRYPTION_KEY;config.ZOHO_TOKEN_ENCRYPTION_KEYS=JSON.stringify({current:key});config.ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID='current';}
    const envelope = await sealTokens({ accessToken: 'source-token', refreshToken: 'refresh', expiresAt: Date.now() + 3600000 }, tokenKeyring(config), id);
    const db = { rpc: vi.fn(async name => ({ data: name === 'zoho_claim_discovery_batch' ? {
      claimed: true, lease, run: { id, module: 'Candidates', next_page: 1, config_revision: 1 },
      source: { id, region: 'in', credential_generation: 1 }, envelope,
    } : name === 'zoho_reserve_discovery_quota' ? {granted:true,reservationId:lease} : { done: true, runId: id } })) };
    const fetcher = vi.fn(async () => Response.json({ data: [{ id: '123', First_Name: 'Synthetic', Email: 'fixture@example.com',
      Modified_Time: '2026-10-29T08:00:00Z' }], info: { more_records: false } }));
    vi.stubGlobal('fetch', fetcher);
    const message = { body: { runId: id }, ack: vi.fn(), retry: vi.fn() };
    const runtime = integrationRuntime(config, { database: () => db });
    expect(await runtime.queue({ queue: 'zoho-recruit-discovery-dev', messages: [message] })).toBe(true);
    expect(message.ack).toHaveBeenCalledOnce(); expect(message.retry).not.toHaveBeenCalled();
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['zoho_claim_discovery_batch','zoho_reserve_discovery_quota','zoho_settle_discovery_quota','zoho_reserve_discovery_quota','zoho_settle_discovery_quota','zoho_commit_claimed_discovery']);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({ p_run: id, p_lease: lease,
      p_records: [expect.objectContaining({ data: { name: 'Synthetic', email: 'fixture@example.com' } })] }));
    expect(config.EMAIL_QUEUE.send).not.toHaveBeenCalled(); expect(config.SSO.createLearnerUser).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('cannot route discovery authority overrides into approved execution', async () => {
    const config = env(); const database = vi.fn();
    const runtime = integrationRuntime(config, { database });
    const message = { body: { runId: id, operationId: id, mode: 'execute' }, ack: vi.fn(), retry: vi.fn() };
    expect(await runtime.queue({ queue: 'zoho-recruit-discovery-dev', messages: [message] })).toBe(true);
    expect(message.ack).toHaveBeenCalledOnce(); expect(database).not.toHaveBeenCalled();
    expect(await runtime.queue({ queue: 'zoho-recruit-approved-qa', messages: [message] })).toBe(false);
    expect(await runtime.queue({ queue: 'course-management-uploads-dev', messages: [message] })).toBe(false);
  });
  it('keeps preview and disabled queue work dormant rather than acknowledging it', async () => {
    const database = vi.fn(); const runtime = integrationRuntime({ ...env(), ZOHO_PREVIEW: 'true' }, { database });
    const message = { body: { runId: id }, ack: vi.fn(), retry: vi.fn() };
    await runtime.queue({ queue: 'zoho-recruit-discovery-dev', messages: [message] });
    await runtime.scheduled({ cron: RECOVERY_CRON });
    expect(message.retry).toHaveBeenCalledOnce(); expect(message.ack).not.toHaveBeenCalled();
    expect(database).not.toHaveBeenCalled();
  });
  it('recovers persisted due discovery only on its configured schedule', async () => {
    const config = env(); const db = { rpc: vi.fn(async () => ({ data: [{ id }] })) };
    const runtime = integrationRuntime(config, { database: () => db });
    await runtime.scheduled({ cron: '0 3 * * *' }); expect(db.rpc).not.toHaveBeenCalled();
    await runtime.scheduled({ cron: RECOVERY_CRON });
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['zoho_recover_deferred', 'zoho_due_sync']);
    expect(config.ZOHO_DISCOVERY_QUEUE.send).toHaveBeenCalledExactlyOnceWith({ runId: id });
    expect(config.EMAIL_QUEUE.send).not.toHaveBeenCalled();
  });
});

describe('projection publication on the existing recovery schedule', () => {
  it('recovers committed projection work independently of permission to execute new approvals', async () => {
    const config = { ...env(), ZOHO_DISCOVERY_ENABLED: 'false', ZOHO_PROJECTION_DELIVERY_ENABLED: 'true',
      ZOHO_CANDIDATE_DESTINATION: { recoverProjections: vi.fn(async () => ({ published: 1 })) } };
    await integrationRuntime(config).scheduled({ cron: RECOVERY_CRON });
    expect(config.ZOHO_CANDIDATE_DESTINATION.recoverProjections).toHaveBeenCalledOnce();
    expect(config.ZOHO_APPROVED_QUEUE.sendBatch).not.toHaveBeenCalled();
  });
  it('does not recover projections when preview/background/explicit delivery flags are disabled', async () => {
    for (const change of [{ ZOHO_PREVIEW: 'true' }, { ZOHO_BACKGROUND_ENABLED: 'false' }, { ZOHO_PROJECTION_DELIVERY_ENABLED: 'false' }]) {
      const recoverProjections = vi.fn();
      await integrationRuntime({ ...env(), ZOHO_DISCOVERY_ENABLED: 'false', ZOHO_PROJECTION_DELIVERY_ENABLED: 'true',
        ...change, ZOHO_CANDIDATE_DESTINATION: { recoverProjections } }).scheduled({ cron: RECOVERY_CRON });
      expect(recoverProjections).not.toHaveBeenCalled();
    }
  });
});


describe('receipt recovery background boundary',()=>{
  it('acknowledges paused job receipts directly without exposing write capabilities',async()=>{
    const config=env();config.ZOHO_DISCOVERY_ENABLED='false';
    const findOperationReceipt=vi.fn(async()=>({state:'completed',operationId:id,sourceHash:'a'.repeat(64),targetId:lease,receiptId:lease,emailPolicy:'forbidden'}));
    config.ZOHO_JOB_DESTINATION={findOperationReceipt};
    const db={from:vi.fn(()=>({select:()=>({eq:()=>({single:async()=>({data:{id,state:'processing',lease_token:lease,source_hash:'a'.repeat(64),action:'apply_job',expected_target_id:null}})})})})),
      rpc:vi.fn(async name=>({data:name==='zoho_complete_operation'?{completed:true}:[{id}]}))};
    const runtime=integrationRuntime(config,{executionDatabase:()=>db});
    await runtime.scheduled({cron:RECOVERY_CRON});
    expect(db.from).toHaveBeenCalledExactlyOnceWith('zoho_approved_operations');
    expect(db.rpc).toHaveBeenCalledWith('zoho_schedule_reconciliation',{p_actions:['apply_job']});
    expect(db.rpc).toHaveBeenCalledWith('zoho_complete_operation',{p_operation:id,p_lease:lease,p_target:lease,p_receipt:lease});
    expect(config.ZOHO_APPROVED_QUEUE.sendBatch).not.toHaveBeenCalled();
    const message={body:{operationId:id,mode:'reconcile'},ack:vi.fn(),retry:vi.fn()};
    await runtime.queue({queue:'zoho-recruit-approved-dev',messages:[message]});
    expect(findOperationReceipt).toHaveBeenCalledTimes(2);expect(message.ack).toHaveBeenCalledOnce();
    expect(config.EMAIL_QUEUE.send).not.toHaveBeenCalled();expect(config.SSO.createLearnerUser).not.toHaveBeenCalled();
  });
  it.each([{ZOHO_PREVIEW:'true'},{ZOHO_BACKGROUND_ENABLED:'false'}])('keeps recovery dormant under runtime gates %j',async change=>{
    const findOperationReceipt=vi.fn();const database=vi.fn();
    const runtime=integrationRuntime({...env(),...change,recoveryEnabled:true,ZOHO_JOB_DESTINATION:{findOperationReceipt}},{executionDatabase:database});
    const message={body:{operationId:id,mode:'reconcile'},ack:vi.fn(),retry:vi.fn()};
    await runtime.queue({queue:'zoho-recruit-approved-dev',messages:[message]});
    await runtime.scheduled({cron:RECOVERY_CRON});
    expect(message.retry).toHaveBeenCalledOnce();expect(message.ack).not.toHaveBeenCalled();
    expect(database).not.toHaveBeenCalled();expect(findOperationReceipt).not.toHaveBeenCalled();
  });
});

it('routes linked bulk work through the existing source queue and keeps REST references narrow', async () => {
  const config = env();
  const second = '10000000-0000-4000-8000-000000000003';
  const db = { rpc: vi.fn(async name => ({ data: name === 'zoho_due_sync'
    ? [{ id, transport: 'bulk', bulkRunId: lease }, { id: second, transport: 'rest', bulkRunId: null }] : [] })) };
  await integrationRuntime(config, { database: () => db }).scheduled({ cron: RECOVERY_CRON });
  expect(config.ZOHO_DISCOVERY_QUEUE.send.mock.calls.map(([value]) => value)).toEqual([{ bulkRunId: lease }, { runId: second }]);
  expect(config.EMAIL_QUEUE.send).not.toHaveBeenCalled();
});
