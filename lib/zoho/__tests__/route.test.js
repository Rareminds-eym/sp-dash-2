vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('../admin', () => ({ requireZohoAdmin: f.auth }));
vi.mock('../../supabase-admin', () => ({ supabaseAdmin: { rpc: f.rpc, from: f.from } }));
import { GET, POST } from '../../../app/api/integrations/zoho-recruit/route';
const id = '10000000-0000-4000-8000-000000000001';
const payload = { action: 'decide', input: { connectionId: id, requestId: id, decision: 'approve', reason: 'Reviewed candidate', items: [{ id, revision: 1, sourceHash: 'a'.repeat(64), configRevision: 1, targetId: null, candidateReviewHash: 'b'.repeat(64) }] } };
const readerToken = `header.${btoa(JSON.stringify({ role: 'zoho_discovery', exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
const runtimeConfig = { ZOHO_DISCOVERY_DB_TOKEN: readerToken, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key', ZOHO_ENVIRONMENT: 'dev', ZOHO_BACKGROUND_ENABLED: 'true', SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'fixture' };
const post = value => new Request('https://admin.example/api/integrations/zoho-recruit', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://admin.example' }, body: JSON.stringify(value) });
function rpcResult(data) { f.rpc.mockImplementation(async name => ({ data: name === 'zoho_lookup_decision' ? { found: false } : name === 'zoho_review_payload_current' ? true : data, error: null })); }
beforeEach(() => {
  vi.clearAllMocks();
  f.from.mockReset();
  f.auth.mockResolvedValue({ user: { id }, env: {} });
  rpcResult({ connections: [], counts: {}, emailPolicy: 'forbidden' });
});
describe('Zoho admin API', () => {
  it('reads private complete execution progress with an exact source/type scope', async () => {
    rpcResult({connectionId:id,module:'Candidates',checkedAt:'2026-11-06T00:00:00Z',total:2,completed:1,
      queued:0,processing:0,checking:1,retrying:0,attention:0,expired:0,exhausted:0,nextRetryAt:null,emailPolicy:'forbidden'});
    const response=await GET(new Request(`https://admin.example/api?view=execution_progress&connectionId=${id}&module=Candidates`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({progress:{total:2,completed:1,checking:1}});
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('zoho_execution_progress',{p_connection:id,p_module:'Candidates'});
    f.rpc.mockClear();
    expect((await GET(new Request(`https://admin.example/api?view=execution_progress&connectionId=${id}&module=Candidates&total=999`))).status).toBe(400);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('does not return progress data when live administrator authority is unavailable', async () => {
    f.auth.mockResolvedValue({error:Response.json({error:'Administrator authority is unavailable'},{status:503})});
    const response=await GET(new Request(`https://admin.example/api?view=execution_progress&connectionId=${id}&module=Candidates`));
    expect(response.status).toBe(503);expect(f.rpc).not.toHaveBeenCalled();
  });
  it('requires live administrator authorization before scheduling execution recovery', async () => {
    f.auth.mockResolvedValue({ error: Response.json({ error: 'Administrator access is inactive' }, { status: 403 }) });
    const response = await POST(post({ action: 'recover_executions', input: { connectionId: id, module: 'Candidates' } }));
    expect(response.status).toBe(403);
    expect(f.from).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('explains unavailable recovery without claiming execution is undeployed', async () => {
    const response = await POST(post({ action: 'recover_executions', input: { connectionId: id, module: 'Candidates' } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('Restore the background worker') });
    expect(f.from).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('schedules receipt recovery through the private BFF without minting new approval evidence', async () => {
    const queue = { sendBatch: vi.fn() };
    f.auth.mockResolvedValue({ user: { id }, env: { ENVIRONMENT: 'local', ZOHO_APPROVED_QUEUE: queue } });
    f.from.mockImplementation(() => {
      const q = { select: () => q, eq: () => q, or: () => q, order: () => q,
        limit: async () => ({ data: [{ id, zoho_staged_records: { connection_id: id } }] }) };
      return q;
    });
    const response = await POST(post({ action: 'recover_executions', input: { connectionId: id, module: 'Candidates' } }));
    expect(response.status).toBe(202);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ result: { retriesScheduled: 0, receiptChecksScheduled: 1 }, emailPolicy: 'forbidden' });
    expect(queue.sendBatch).toHaveBeenCalledWith([{ body: { operationId: id, mode: 'reconcile' } }]);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each(['paused','stale'])('returns actionable %s candidate review conflicts without canonical lookup',async kind=>{
    const record={id,connection_id:id,module:'Candidates',external_id:'123',revision:1,source_hash:'a'.repeat(64),config_revision:1,target_id:null,
      proposed_data:{email:'candidate@example.com',name:'Candidate Name'},validation_errors:[],decision:'pending_approval'};
    const connection={id,status:kind==='paused'?'paused':'connected',source_org_id:'123',config_revision:2};
    const preview=vi.fn();
    f.auth.mockResolvedValue({user:{id},accessToken:'signed',env:{ZOHO_APPROVER_AUTHORITY:{previewCandidateReview:preview}}});
    f.from.mockImplementation(table=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:table==='zoho_connections'?connection:record})};return q;});
    const response=await POST(post({action:'review_candidate',input:{connectionId:id,recordId:id,revision:1,sourceHash:record.source_hash,configRevision:1,targetId:null}}));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:kind==='paused'?'SOURCE_PAUSED':'SOURCE_CONFIG_CHANGED',error:expect.stringMatching(/fresh discovery/)});
    expect(preview).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('provides private keyset history with the authenticated actor and rejects browser actor overrides',async()=>{
    rpcResult({version:1,kind:'administration',view:'pending',items:[],nextCursor:null});
    const response=await GET(new Request(`https://admin.example/api?view=operator_history&connectionId=${id}&kind=administration&historyView=pending`));
    expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(f.rpc).toHaveBeenCalledWith('zoho_operator_history_page',expect.objectContaining({p_actor:id,p_connection:id,p_after:null,p_after_id:null}));
    f.rpc.mockClear();
    expect((await GET(new Request(`https://admin.example/api?view=operator_history&connectionId=${id}&kind=administration&historyView=pending&actorId=${id}`))).status).toBe(400);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('allows only authenticated privacy commands and returns no-store results', async () => {
    rpcResult({ suppressed: true, canonicalDeletion: false });
    const response = await POST(post({ action: 'suppress_source', input: { connectionId: id, module: 'Candidates',
      externalId: '123', suppressed: true, reason: 'Source privacy request' } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(f.rpc).toHaveBeenCalledWith('zoho_set_source_suppression', expect.objectContaining({ p_actor: id, p_external: '123' }));
    expect(await response.json()).toMatchObject({ result: { canonicalDeletion: false }, emailPolicy: 'forbidden' });
  });
  it('does not access storage or any executor when authentication fails', async () => {
    f.auth.mockResolvedValue({ error: Response.json({ error: 'Unauthorized' }, { status: 401 }) });
    expect((await GET(new Request('https://admin.example/api'))).status).toBe(401);
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled();
  });
  it('reports missing executor honestly and keeps mail forbidden', async () => {
    const response = await GET(new Request('https://admin.example/api'));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ emailPolicy: 'forbidden', capabilities: { execution: { ready: false }, discovery: false } });
  });
  it('cannot queue creation while the silent executor is not deployed', async () => {
    const response = await POST(post(payload));
    expect(response.status).toBe(503);
    expect(f.rpc.mock.calls.every(([name]) => name === 'zoho_lookup_decision')).toBe(true); expect(f.from).not.toHaveBeenCalled();
  });
  it('does not create a discovery run when only a producer queue is bound', async () => {
    const send = vi.fn();
    f.auth.mockResolvedValue({ user: { id }, env: { ZOHO_DISCOVERY_QUEUE: { send } } });
    expect((await POST(post({ action: 'discover', input: { connectionId: id, module: 'Candidates' } }))).status).toBe(503);
    expect(f.rpc).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
  it('checks consumer readiness before persisting and dispatching a staging run', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    f.auth.mockResolvedValue({ user: { id }, env: { ...runtimeConfig, ZOHO_DISCOVERY_ENABLED: 'true', ZOHO_CLIENT_ID: 'client', ZOHO_CLIENT_SECRET: 'secret',
      ZOHO_TOKEN_ENCRYPTION_KEY: btoa('k'.repeat(32)), ZOHO_DISCOVERY_QUEUE: { send } } });
    rpcResult({ runId: id });
    expect((await POST(post({ action: 'discover', input: { connectionId: id, module: 'Candidates' } }))).status).toBe(202);
    expect(f.rpc).toHaveBeenCalledWith('zoho_plan_discovery', expect.objectContaining({ p_connection: id, p_actor: id, p_bulk_available: false }));
    expect(send).toHaveBeenCalledWith({ runId: id });
  });
  it('rejects email and administrator overrides before any mutation', async () => {
    const response = await POST(post({ ...payload, sendEmail: true, actor: 'attacker' }));
    expect(response.status).toBe(400); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('reports pending delivery when discovery persisted but queue publication failed', async () => {
    const send = vi.fn(async () => { throw new Error('offline'); });
    f.auth.mockResolvedValue({ user: { id }, env: { ...runtimeConfig, ZOHO_DISCOVERY_ENABLED: 'true',
      ZOHO_CLIENT_ID: 'client', ZOHO_CLIENT_SECRET: 'secret', ZOHO_TOKEN_ENCRYPTION_KEY: btoa('k'.repeat(32)),
      ZOHO_DISCOVERY_QUEUE: { send } } });
    rpcResult({ runId: id });
    const response = await POST(post({ action: 'discover', input: { connectionId: id, module: 'Candidates' } }));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ result: { runId: id, delivery: 'pending' }, emailPolicy: 'forbidden' });
    expect(f.rpc.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
  });
  it('allows a hold decision without claiming account creation', async () => {
    rpcResult({ decision: 'hold', count: 1 });
    const response = await POST(post({ ...payload, input: { ...payload.input, decision: 'hold' } }));
    expect(response.status).toBe(200);
    expect(f.rpc).toHaveBeenCalledWith('zoho_decide_records', expect.objectContaining({ p_decision: 'hold', p_actor: id }));
    expect(await response.json()).toMatchObject({ emailPolicy: 'forbidden', result: { decision: 'hold' } });
  });
  it.each([false, true])('persists approval before publishing; a publication failure is recoverable (%s)', async fails => {
    const ready = { version: 1, ready: true, emailPolicy: 'forbidden', approvalRequired: true,
      durableDispatch: true, receiptRecovery: true, modules: ['Candidates'] };
    const recordApproval = vi.fn(async () => ({ recorded: true }));
    const sendBatch = vi.fn(async () => { if (fails) throw new Error('Queue offline'); });
    f.auth.mockResolvedValue({ user: { id }, accessToken: 'signed-human-token', env: { ...runtimeConfig, ZOHO_EXECUTION_ENABLED: 'true', ZOHO_APPROVED_QUEUE: { sendBatch },
      ZOHO_APPROVER_AUTHORITY: { checkApprover: vi.fn(), validateApproval: vi.fn(), recordApproval, verifyCandidateReview: vi.fn(async()=>({allowed:true})) },
      ZOHO_CANDIDATE_DESTINATION: { capabilities: async () => ({ ...ready, checksLiveApproval: true, checksLiveApprover: true,
        idempotentByOperation: true, transactionalReceipt: true, fencesExpiredLeases: true, verifiesPostconditions: true }),
        executeApprovedOperation: vi.fn(), findOperationReceipt: vi.fn() } } });
    rpcResult({ decision: 'approve', approvalId: id, count: 1 });
    f.from.mockImplementation(table => {
      const record = { id, connection_id:id, module:'Candidates',external_id:'123',revision:1,config_revision:1,
        source_hash:'a'.repeat(64),target_id:null,proposed_data:{email:'candidate@example.com',name:'Candidate Name'}, validation_errors:[],decision:'pending_approval' };
      const connection={id,status:'connected',source_org_id:'123',config_revision:1,publisher_organization_id:id};
      const query={select:()=>query,eq:()=>query,in:async()=>({data:[record]}),
        single:async()=>({data:table==='zoho_connections'?connection:record}),
        then:resolve=>Promise.resolve({data:[{id}]}).then(resolve)};
      return query;
    });
    const response = await POST(post(payload));
    expect(response.status).toBe(202);
    expect(f.rpc.mock.calls.filter(([name]) => name === 'zoho_decide_records')).toEqual([['zoho_decide_records', expect.objectContaining({ p_decision: 'approve' })]]);
    expect(sendBatch).toHaveBeenCalledExactlyOnceWith([{ body: { operationId: id, mode: 'execute' } }]);
    expect(recordApproval).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'signed-human-token' }));
    const decisionCall = f.rpc.mock.calls.findIndex(([name]) => name === 'zoho_decide_records');
    expect(recordApproval.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[decisionCall]);
    expect(f.rpc.mock.invocationCallOrder[decisionCall]).toBeLessThan(sendBatch.mock.invocationCallOrder[0]);
    expect(await response.json()).toMatchObject({ result: { delivery: fails ? 'pending' : 'queued' }, emailPolicy: 'forbidden' });
  });
  it.each(['denied', 'transport'])('explains %s human approval verification failures without deciding or dispatching', async failure => {
    const ready = { version: 1, ready: true, emailPolicy: 'forbidden', approvalRequired: true,
      durableDispatch: true, receiptRecovery: true, modules: ['Candidates'] };
    const recordApproval = vi.fn(async () => {
      if (failure === 'transport') throw new Error('private authority infrastructure details');
      return { recorded: false };
    });
    const sendBatch = vi.fn();
    f.auth.mockResolvedValue({ user: { id }, accessToken: 'signed-human-token', env: {
      ...runtimeConfig, ZOHO_EXECUTION_ENABLED: 'true', ZOHO_APPROVED_QUEUE: { sendBatch },
      ZOHO_APPROVER_AUTHORITY: { checkApprover: vi.fn(), validateApproval: vi.fn(), recordApproval, verifyCandidateReview: vi.fn(async()=>({allowed:true})) },
      ZOHO_CANDIDATE_DESTINATION: { capabilities: async () => ({ ...ready, checksLiveApproval: true, checksLiveApprover: true,
        idempotentByOperation: true, transactionalReceipt: true, fencesExpiredLeases: true, verifiesPostconditions: true }),
        executeApprovedOperation: vi.fn(), findOperationReceipt: vi.fn() },
    } });
    f.from.mockImplementation(table => {
      const record = { id, connection_id:id, module:'Candidates',external_id:'123',revision:1,config_revision:1,
        source_hash:'a'.repeat(64),target_id:null,proposed_data:{email:'candidate@example.com',name:'Candidate Name'}, validation_errors:[],decision:'pending_approval' };
      const connection={id,status:'connected',source_org_id:'123',config_revision:1,publisher_organization_id:id};
      const query={select:()=>query,eq:()=>query,in:async()=>({data:[record]}),
        single:async()=>({data:table==='zoho_connections'?connection:record}),then:resolve=>Promise.resolve({data:[record]}).then(resolve)};
      return query;
    });
    const response=await POST(post(payload));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({code:'APPROVAL_EVIDENCE_UNAVAILABLE',
      error:'Human approval verification is unavailable. Retry the pending batch to recover the same request.'});
    expect(recordApproval).toHaveBeenCalledOnce();
    expect(f.rpc.mock.calls.some(([name])=>name==='zoho_decide_records')).toBe(false);
    expect(sendBatch).not.toHaveBeenCalled();
  });
  it('allows authenticated canonical preview while creation remains disabled and returns no-store', async () => {
    const record={id,connection_id:id,module:'Candidates',external_id:'123',revision:1,source_hash:'a'.repeat(64),config_revision:1,target_id:null,
      proposed_data:{email:'candidate@example.com',name:'Candidate Name'},validation_errors:[],decision:'pending_approval'};
    const review={version:1,reviewHash:'b'.repeat(64),recordId:id,revision:1,sourceHash:record.source_hash,configRevision:1,targetId:null,decision:'create',
      identity:{targetId:null,outcome:'new_identity',email:'candidate@example.com',name:'Candidate Name',activationState:'activation_pending',profileAction:'create'},
      entitlements:{action:'grant_discover',planCodes:['discover'],learnerAccess:true,paidAccessPreserved:false,organizationAccessPreserved:false},blockers:[],
      expiresAt:new Date(Date.now()+600000).toISOString()};
    const previewCandidateReview=vi.fn(async()=>review);
    f.auth.mockResolvedValue({user:{id},accessToken:'signed-human',env:{ZOHO_APPROVER_AUTHORITY:{previewCandidateReview}}});
    f.from.mockImplementation(table=>{const query={select:()=>query,eq:()=>query,single:async()=>({data:table==='zoho_connections'
      ?{id,status:'connected',source_org_id:'123',config_revision:1}:record})};return query;});
    const response=await POST(post({action:'review_candidate',input:{connectionId:id,recordId:id,revision:1,sourceHash:record.source_hash,configRevision:1,targetId:null}}));
    expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({review,emailPolicy:'forbidden'});
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('zoho_review_payload_current',{p_connection:id,p_record:id});expect(previewCandidateReview).toHaveBeenCalledOnce();
  });
  it('exposes policy controls behind live admin authentication and uses the verified actor', async () => {
    const input={connectionId:id,expectedConfigRevision:1,statusMap:{Open:'open'},employmentMap:{Permanent:'job'},
      enabled:false,noEmailReviewed:false,triggerFingerprint:'a'.repeat(64),reason:'Reviewed publication status and all database side effects.'};
    rpcResult({connectionId:id,configRevision:2,requiresRediscovery:true});
    const response=await POST(post({action:'configure_job_policy',input}));
    expect(response.status).toBe(200);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('zoho_configure_job_policy',expect.objectContaining({p_actor:id,p_connection:id,p_enabled:false,p_expected_config:1}));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    f.rpc.mockClear();
    expect((await POST(post({action:'configure_job_policy',input:{...input,actorId:id}}))).status).toBe(400);
    expect(f.rpc).not.toHaveBeenCalled();
    const read=await GET(new Request(`https://admin.example/api?view=job_policy&connectionId=${id}`));
    expect(read.status).toBe(200);
    expect(f.rpc).toHaveBeenCalledWith('zoho_read_job_policy',{p_connection:id});
  });
  it('bounds the request body before parsing or mutating', async () => {
    expect((await POST(post({ large: 'x'.repeat(131073) }))).status).toBe(413);
    expect(f.rpc).not.toHaveBeenCalled();
  });
});

describe('exact decision recovery', () => {
  it('recovers immutable accepted intent despite unavailable writers, without inspecting current records or dispatching', async () => {
    const recordApproval = vi.fn(); const sendBatch = vi.fn();
    f.auth.mockResolvedValue({ user: { id }, env: { ZOHO_APPROVER_AUTHORITY: { recordApproval }, ZOHO_APPROVED_QUEUE: { sendBatch } } });
    const result = { approvalId: id, decision: 'approve', count: 1, replayed: true, emailPolicy: 'forbidden' };
    f.rpc.mockResolvedValue({ data: { found: true, result }, error: null });
    const response = await POST(post(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result, emailPolicy: 'forbidden' });
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('zoho_lookup_decision', expect.objectContaining({ p_actor: id, p_request: id, p_items: payload.input.items }));
    expect(f.from).not.toHaveBeenCalled(); expect(recordApproval).not.toHaveBeenCalled(); expect(sendBatch).not.toHaveBeenCalled();
  });
  it('recovers another delivery that commits while the executor readiness check fails', async () => {
    const result = { approvalId: id, decision: 'approve', count: 1, replayed: true };
    f.rpc.mockResolvedValueOnce({ data: { found: false }, error: null }).mockResolvedValueOnce({ data: { found: true, result }, error: null });
    const response = await POST(post(payload));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ result });
    expect(f.rpc.mock.calls.every(([name]) => name === 'zoho_lookup_decision')).toBe(true);
    expect(f.from).not.toHaveBeenCalled();
  });
  it('keeps changed manifests in conflict, never reapproves them', async () => {
    f.rpc.mockResolvedValue({ error: { code: '40001' } });
    expect((await POST(post(payload))).status).toBe(409);
    expect(f.rpc.mock.calls.every(([name]) => name === 'zoho_lookup_decision')).toBe(true);
    expect(f.from).not.toHaveBeenCalled();
  });
  it('fails closed if durable recovery cannot be read', async () => {
    f.rpc.mockResolvedValue({ error: { code: '08006' } });
    expect((await POST(post(payload))).status).toBe(503);
    expect(f.from).not.toHaveBeenCalled();
  });
});
it('rejects unknown read views before any data fetch',async()=>{
 const response=await GET(new Request('https://admin.example/api?view=not_a_view'));
 expect(response.status).toBe(400);expect(f.rpc).not.toHaveBeenCalled();expect(f.from).not.toHaveBeenCalled();
});
it('logs only closed diagnostics and distinguishes programming failures from storage outages',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  f.rpc.mockRejectedValue(new TypeError('private@example.com secret token'));
  const response=await GET(new Request('https://admin.example/api'));
  expect(response.status).toBe(500);const body=await response.json();expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(log).toHaveBeenCalledOnce();expect(log.mock.calls[0][0]).not.toMatch(/private|secret|token/);
 }finally{log.mockRestore();}
});

it('exposes sync settings only through the authenticated BFF and never accepts an injected actor', async () => {
  rpcResult({ policies: [], configRevision: 1, webhookConfigured: false });
  const response = await GET(new Request(`https://admin.example/api?view=sync&connectionId=${id}`));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(f.rpc).toHaveBeenCalledWith('zoho_sync_snapshot', { p_connection: id });
  f.rpc.mockClear();
  const rejected = await POST(post({ action: 'configure_sync', input: { connectionId: id, expectedConfigRevision: 1, module: 'Candidates', enabled: true,
    intervalMinutes: 15, reconciliationDays: 7, preferBulk: true, actor: id } }));
  expect(rejected.status).toBe(400); expect(f.rpc).not.toHaveBeenCalled();
});

it('returns live module status separately from paginated discovery history', async () => {
  const reads = [];
  f.from.mockImplementation(() => {
    const filters = {}; reads.push(filters);
    const query = {select:()=>query,eq:(key,value)=>{filters[key]=value;return query;},order:()=>query,
      limit:async limit=>({data:[{id,module:filters.module || 'Candidates',capture_complete:!!filters.capture_complete,limit}],error:null})};
    return query;
  });
  const response = await GET(new Request(`https://admin.example/api?view=runs&connectionId=${id}&live=1`));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.runs).toHaveLength(1);
  expect(body.latestRuns.map(row=>row.module)).toEqual(['Candidates','Job_Openings']);
  expect(body.captures).toHaveLength(2);
  expect(reads.every(filters=>filters.connection_id===id)).toBe(true);
  f.from.mockClear();
  expect((await GET(new Request(`https://admin.example/api?view=runs&connectionId=${id}&live=unexpected`))).status).toBe(400);
  expect(f.from).not.toHaveBeenCalled();
});
