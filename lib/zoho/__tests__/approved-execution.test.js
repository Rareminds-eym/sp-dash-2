import { describe, it, expect, vi } from 'vitest';
import { approvedMessage, executeApprovedOperation, reconcileApprovedOperation } from '../approved-execution';
import { approvedConsumer as worker, capabilities, recoverDispatch } from '../approved-consumer';

const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const sourceHash = 'a'.repeat(64);
function fixture() {
  const capability = { version: 1, ready: true, emailPolicy: 'forbidden', checksLiveApproval: true,
    checksLiveApprover: true, idempotentByOperation: true, transactionalReceipt: true,
    fencesExpiredLeases: true, verifiesPostconditions: true, modules: ['Candidates'] };
  const receipt = { state: 'completed', operationId: id, sourceHash, targetId: other, receiptId: other, emailPolicy: 'forbidden' };
  const destination = { capabilities: vi.fn(async () => capability), executeApprovedOperation: vi.fn(async () => receipt),
    findOperationReceipt: vi.fn(async () => receipt) };
  const env = { recoveryEnabled: true, ZOHO_EXECUTION_ENABLED: 'true', SUPABASE_URL: 'https://database.example', SUPABASE_SERVICE_ROLE_KEY: 'test',
    ZOHO_APPROVED_QUEUE: { sendBatch: vi.fn() }, ZOHO_CANDIDATE_DESTINATION: destination,
    ZOHO_APPROVER_AUTHORITY: { checkApprover: vi.fn(async () => ({ allowed: true })), recordApproval: vi.fn(), validateApproval: vi.fn(async () => ({ allowed: true })) } };
  const db = { rpc: vi.fn(async (name, args) => {
    if (name === 'zoho_claim_operation') return { data: { claimed: true, operationId: id, lease: args.p_lease,
      leaseExpiresAt: new Date(Date.now() + 60000).toISOString(), approvalExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      actorId: id, connectionId: id, sourceOrgId: '123', publisherOrganizationId: id, recordId: id, revision: 1,
      configRevision: 1, sourceHash, candidateReviewHash: 'b'.repeat(64), action: 'provision_candidate', module: 'Candidates', externalId: '123',
      data: { email: 'fixture@example.com', name: 'Fixture' }, targetId: null, emailPolicy: 'forbidden' }, error: null };
    if (name === 'zoho_complete_operation') return { data: { completed: true }, error: null };
    return { data: { retryPermitted: args.p_outcome === 'NOT_APPLIED' }, error: null };
  }), from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: {
    id, state: 'processing', lease_token: other, source_hash: sourceHash, action: 'provision_candidate', expected_target_id: null,
  }, error: null }) }) }) })) };
  return { db, env, destination, capability, receipt };
}
function jobFixture() {
  const f=fixture();f.capability.modules=['Job_Openings'];
  delete f.env.ZOHO_CANDIDATE_DESTINATION;f.env.ZOHO_JOB_DESTINATION=f.destination;
  const original=f.db.rpc.getMockImplementation();
  f.db.rpc.mockImplementation(async(name,args)=>{
    if(name==='zoho_ack_job_no_effect') return {data:{reviewRequired:true},error:null};
    const result=await original(name,args);
    if(name==='zoho_claim_operation'){
      result.data.module='Job_Openings';result.data.action='apply_job';delete result.data.candidateReviewHash;
    }
    return result;
  });
  return f;
}
function jobProof(lease) {
  return {state:'not_applied',operationId:id,lease,sourceHash,emailPolicy:'forbidden',reviewRequired:true,reasonCode:'JOB_REVIEW_REQUIRED'};
}

const outcomes = db => db.rpc.mock.calls.filter(([name]) => name === 'zoho_record_execution_outcome').map(([, args]) => args.p_outcome);
describe('approved operation dispatcher', () => {
  it('uses only the claimed payload and records a matching destination receipt', async () => {
    const { db, env, destination } = fixture();
    expect(await executeApprovedOperation(db, { operationId: id }, env)).toEqual({ state: 'completed' });
    expect(destination.executeApprovedOperation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ operationId: id,
      emailPolicy: 'forbidden', data: { email: 'fixture@example.com', name: 'Fixture' } }));
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_complete_operation', expect.objectContaining({ p_operation: id, p_target: other, p_receipt: other }));
    expect(outcomes(db)).toEqual([]);
  });
  it('rejects a candidate claim with no canonical review hash before invoking a destination', async () => {
    const { db, env, destination } = fixture();
    const implementation = db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async (name,args)=>{
      const result=await implementation(name,args);
      if(name==='zoho_claim_operation') delete result.data.candidateReviewHash;
      return result;
    });
    expect(await executeApprovedOperation(db,{operationId:id},env)).toEqual({state:'retry_due'});
    expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
    expect(outcomes(db)).toEqual(['NOT_APPLIED']);
  });
  it('rejects caller payload/authority overrides and disabled execution before any claim', async () => {
    const { db, env, destination } = fixture();
    for (const body of [{ operationId: id, data: { email: 'override@example.com' } }, { operationId: id, actorId: other }, { operationId: id, sendEmail: true }])
      expect(approvedMessage.safeParse(body).success).toBe(false);
    await expect(executeApprovedOperation(db, { operationId: id }, { ...env, ZOHO_EXECUTION_ENABLED: 'false' })).rejects.toThrow('disabled');
    expect(db.rpc).not.toHaveBeenCalled(); expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
  });
  it('does not execute an unclaimed stale, duplicate or in-flight intent', async () => {
    const { db, env, destination } = fixture();
    db.rpc.mockResolvedValue({ data: { claimed: false, reason: 'IN_FLIGHT_OR_RECONCILIATION_REQUIRED' }, error: null });
    expect(await executeApprovedOperation(db, { operationId: id }, env)).toEqual({ state: 'not_claimed' });
    expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
  });
  it('requires current platform authority before calling any destination writer', async () => {
    const { db, env, destination } = fixture();
    env.ZOHO_APPROVER_AUTHORITY.checkApprover.mockResolvedValue({ allowed: false });
    expect(await executeApprovedOperation(db, { operationId: id }, env)).toEqual({ state: 'retry_due' });
    expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
    expect(outcomes(db)).toEqual(['NOT_APPLIED']);
  });
  it.each([false, null, 'true'])('rejects missing or denied canonical human evidence (%s)', async allowed => {
    const { db, env, destination } = fixture();
    env.ZOHO_APPROVER_AUTHORITY.validateApproval.mockResolvedValue({ allowed });
    expect(await executeApprovedOperation(db, { operationId: id }, env)).toEqual({ state: 'retry_due' });
    expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
    expect(outcomes(db)).toEqual(['NOT_APPLIED']);
  });
  it('requires a destination that verifies live approval and transactional receipts', async () => {
    const { db, env, destination, capability } = fixture();
    destination.capabilities.mockResolvedValue({ ...capability, checksLiveApproval: false });
    await executeApprovedOperation(db, { operationId: id }, env);
    expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
    expect(outcomes(db)).toEqual(['NOT_APPLIED']);
  });
  it('records a transport failure after invocation as unknown, never safe to repeat', async () => {
    const { db, env, destination } = fixture();
    destination.executeApprovedOperation.mockRejectedValue(new Error('private provider body'));
    expect(await executeApprovedOperation(db, { operationId: id }, env)).toEqual({ state: 'reconciliation_required' });
    expect(outcomes(db)).toEqual(['OUTCOME_UNKNOWN']);
    expect(db.rpc).not.toHaveBeenCalledWith('zoho_complete_operation', expect.anything());
  });
  it('treats a destination timeout as unknown even though its call may finish later', async () => {
    vi.useFakeTimers();
    try {
      const { db, env, destination } = fixture();
      destination.executeApprovedOperation.mockImplementation(() => new Promise(() => {}));
      const pending = executeApprovedOperation(db, { operationId: id }, env);
      await vi.advanceTimersByTimeAsync(0);
      expect(destination.executeApprovedOperation).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(15000);
      expect(await pending).toEqual({ state: 'reconciliation_required' });
      expect(outcomes(db)).toEqual(['OUTCOME_UNKNOWN']);
    } finally { vi.useRealTimers(); }
  });
  it('permits retry only for a matching explicit no-write response', async () => {
    const { db, env, destination } = fixture();
    destination.executeApprovedOperation.mockImplementation(async grant => ({ state: 'not_applied', operationId: id,
      lease: grant.lease, sourceHash, emailPolicy: 'forbidden' }));
    expect(await executeApprovedOperation(db, { operationId: id }, env)).toEqual({ state: 'retry_due' });
    expect(outcomes(db)).toEqual(['NOT_APPLIED']);
  });
  it('does not acknowledge wrong-operation/hash receipts or an ambiguous pending effect', async () => {
    for (const mismatch of [{ operationId: other }, { sourceHash: 'b'.repeat(64) }, { state: 'pending' }, { emailPolicy: 'allowed' }]) {
      const { db, env, destination, receipt } = fixture();
      destination.executeApprovedOperation.mockResolvedValue({ ...receipt, ...mismatch });
      expect((await executeApprovedOperation(db, { operationId: id }, env)).state).toBe('reconciliation_required');
      expect(outcomes(db)).toEqual(['OUTCOME_UNKNOWN']);
    }
  });
  it('rejects a receipt for a different existing target during execution and reconciliation', async () => {
    const { db, env, destination } = fixture();
    const original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async (name, args) => {
      const result = await original(name, args);
      if (name === 'zoho_claim_operation') result.data.targetId = id;
      return result;
    });
    expect(await executeApprovedOperation(db, { operationId: id }, env)).toEqual({ state: 'reconciliation_required' });
    expect(outcomes(db)).toEqual(['OUTCOME_UNKNOWN']);
    db.rpc.mockClear();
    db.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: {
      id, state: 'processing', lease_token: other, source_hash: sourceHash, action: 'provision_candidate', expected_target_id: id,
    } }) }) }) });
    expect(await reconcileApprovedOperation(db, id, env)).toEqual({ state: 'reconciliation_required' });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(destination.findOperationReceipt).toHaveBeenCalledOnce();
  });
  it('reconciles a committed receipt using a read-only destination method', async () => {
    const { db, env, destination } = fixture();
    expect(await executeApprovedOperation(db, { operationId: id, mode: 'reconcile' }, env)).toEqual({ state: 'completed' });
    expect(destination.findOperationReceipt).toHaveBeenCalledExactlyOnceWith({ operationId: id, sourceHash, readOnly: true });
    expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_complete_operation', { p_operation: id, p_lease: other, p_target: other, p_receipt: other });
  });
  it('reads a committed receipt while write flags, destination capabilities and current approver are unavailable', async () => {
    const {db,env,destination}=fixture();
    env.ZOHO_EXECUTION_ENABLED='false'; delete env.ZOHO_APPROVER_AUTHORITY;
    destination.capabilities.mockRejectedValue(new Error('Writes paused'));
    expect(await executeApprovedOperation(db,{operationId:id,mode:'reconcile'},env)).toEqual({state:'completed'});
    expect(destination.capabilities).not.toHaveBeenCalled();
    expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
    expect(db.rpc.mock.calls.map(([name])=>name)).toEqual(['zoho_complete_operation']);
    db.rpc.mockClear();
    await expect(executeApprovedOperation(db,{operationId:id,mode:'execute'},env)).rejects.toThrow('disabled');
    await expect(executeApprovedOperation(db,{operationId:id,mode:'reconcile'},{...env,recoveryEnabled:false})).rejects.toThrow('recovery disabled');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('returns a definitive job rejection to review through independently verified SQL proof',async()=>{
    const {db,env,destination}=jobFixture();
    destination.executeApprovedOperation.mockImplementation(async grant=>jobProof(grant.lease));
    expect(await executeApprovedOperation(db,{operationId:id},env)).toEqual({state:'review_required'});
    expect(db.rpc).toHaveBeenCalledWith('zoho_ack_job_no_effect',{p_operation:id,p_lease:expect.any(String),p_source_hash:sourceHash});
    expect(outcomes(db)).toEqual([]);
    expect(db.rpc).not.toHaveBeenCalledWith('zoho_complete_operation',expect.anything());
    expect(destination.executeApprovedOperation).toHaveBeenCalledOnce();
  });
  it('recovers a lost rejection confirmation from durable proof with writes and approvers paused',async()=>{
    const {db,env,destination}=jobFixture();let proof;
    destination.executeApprovedOperation.mockImplementation(async grant=>{proof=jobProof(grant.lease);throw new Error('Response lost');});
    expect(await executeApprovedOperation(db,{operationId:id},env)).toEqual({state:'reconciliation_required'});
    expect(outcomes(db)).toEqual(['OUTCOME_UNKNOWN']);
    db.from.mockReturnValue({select:()=>({eq:()=>({single:async()=>({data:{id,state:'processing',lease_token:proof.lease,source_hash:sourceHash,
      action:'apply_job',expected_target_id:null}})})})});
    destination.findOperationReceipt.mockResolvedValue(proof);
    env.ZOHO_EXECUTION_ENABLED='false';delete env.ZOHO_APPROVER_AUTHORITY;db.rpc.mockClear();
    expect(await executeApprovedOperation(db,{operationId:id,mode:'reconcile'},env)).toEqual({state:'review_required'});
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_ack_job_no_effect',{p_operation:id,p_lease:proof.lease,p_source_hash:sourceHash});
    expect(destination.executeApprovedOperation).toHaveBeenCalledOnce();
  });
  it.each(['wrong_lease','wrong_hash','wrong_operation','no_private_proof'])('never releases a rejected job with %s',async kind=>{
    const {db,env,destination}=jobFixture();
    destination.executeApprovedOperation.mockImplementation(async grant=>{
      const proof=jobProof(grant.lease);
      if(kind==='wrong_lease')proof.lease=other;
      if(kind==='wrong_hash')proof.sourceHash='b'.repeat(64);
      if(kind==='wrong_operation')proof.operationId=other;
      return proof;
    });
    if(kind==='no_private_proof'){
      const original=db.rpc.getMockImplementation();
      db.rpc.mockImplementation((name,args)=>name==='zoho_ack_job_no_effect'?Promise.resolve({data:null,error:{code:'22023'}}):original(name,args));
    }
    expect(await executeApprovedOperation(db,{operationId:id},env)).toEqual({state:'reconciliation_required'});
    expect(outcomes(db)).toEqual(['OUTCOME_UNKNOWN']);
    expect(db.rpc).not.toHaveBeenCalledWith('zoho_complete_operation',expect.anything());
    if(kind!=='no_private_proof')expect(db.rpc).not.toHaveBeenCalledWith('zoho_ack_job_no_effect',expect.anything());
  });
  it('does not infer a job no-effect proof from an empty receipt or a generic SQL rejection',async()=>{
    const {db,env,destination}=jobFixture();destination.executeApprovedOperation.mockRejectedValue(new Error('SQL precondition rejected'));
    expect(await executeApprovedOperation(db,{operationId:id},env)).toEqual({state:'reconciliation_required'});
    expect(outcomes(db)).toEqual(['OUTCOME_UNKNOWN']);
    db.from.mockReturnValue({select:()=>({eq:()=>({single:async()=>({data:{id,state:'processing',lease_token:other,source_hash:sourceHash,action:'apply_job',expected_target_id:null}})})})});
    destination.findOperationReceipt.mockResolvedValue(null);db.rpc.mockClear();
    expect(await reconcileApprovedOperation(db,id,env)).toEqual({state:'reconciliation_required'});
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('does not infer permission to retry from an absent receipt', async () => {
    const { db, env, destination } = fixture();
    destination.findOperationReceipt.mockResolvedValue(null);
    expect(await reconcileApprovedOperation(db, id, env)).toEqual({ state: 'reconciliation_required' });
    expect(destination.executeApprovedOperation).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('disables executor readiness until all required bindings and destination guarantees exist', async () => {
    const { env, destination, capability } = fixture();
    expect(await capabilities(env)).toMatchObject({ ready: true, modules: ['Candidates'], durableDispatch: true, receiptRecovery: true });
    expect((await capabilities({ ...env, ZOHO_EXECUTION_ENABLED: 'false' })).ready).toBe(false);
    expect((await capabilities({ ...env, ZOHO_APPROVED_QUEUE: undefined })).ready).toBe(false);
    destination.capabilities.mockResolvedValue({ ...capability, transactionalReceipt: false });
    expect((await capabilities(env)).ready).toBe(false);
  });
  it('exposes no public command endpoint', async () => {
    const { env } = fixture();
    expect((await worker.fetch(new Request('https://executor/execute', { method: 'POST' }), env)).status).toBe(404);
    const response = await worker.fetch(new Request('https://executor/readiness'), env);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ ready: true, emailPolicy: 'forbidden' });
  });
  it('recovers unpublished intents and unresolved receipts as different queue modes', async () => {
    const query = data => {
      const builder = { in: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
        limit: async () => ({ data }) };
      return { select: () => builder };
    };
    const db = { from: vi.fn().mockReturnValue(query([{ id }])), rpc: vi.fn(async () => ({ data: [{ id: other }] })) };
    const queue = { sendBatch: vi.fn() };
    await recoverDispatch(db, queue, ['Candidates'], '2026-10-30T08:00:00Z');
    expect(db.rpc).toHaveBeenCalledWith('zoho_schedule_reconciliation', { p_actions: ['provision_candidate'] });
    expect(queue.sendBatch).toHaveBeenCalledExactlyOnceWith([
      { body: { operationId: id, mode: 'execute' } }, { body: { operationId: other, mode: 'reconcile' } },
    ]);
  });  it('schedules only receipt reads when writes are paused, without selecting queued effects', async () => {
    const db={from:vi.fn(),rpc:vi.fn(async()=>({data:[{id}]}))};const queue={sendBatch:vi.fn()};
    await recoverDispatch(db,queue,[],'2026-10-30T08:00:00Z',['Job_Openings']);
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_schedule_reconciliation',{p_actions:['apply_job']});
    expect(queue.sendBatch).toHaveBeenCalledExactlyOnceWith([{body:{operationId:id,mode:'reconcile'}}]);
  });
  it('consumes paused receipt recovery without querying write readiness or invoking a writer', async () => {
    const {db,env,destination}=fixture();env.ZOHO_EXECUTION_ENABLED='false';delete env.ZOHO_APPROVER_AUTHORITY;
    const message={body:{operationId:id,mode:'reconcile'},ack:vi.fn(),retry:vi.fn()};
    await worker.queue({messages:[message]},env,{database:()=>db});
    expect(message.ack).toHaveBeenCalledOnce();expect(message.retry).not.toHaveBeenCalled();
    expect(destination.findOperationReceipt).toHaveBeenCalledOnce();
    expect(destination.capabilities).not.toHaveBeenCalled();expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
    expect(db.rpc.mock.calls.map(([name])=>name)).toEqual(['zoho_complete_operation']);
  });
  it('does not consume a paused execute message or an internally disabled recovery message', async()=>{
    const {db,env,destination}=fixture();env.ZOHO_EXECUTION_ENABLED='false';
    const execute={body:{operationId:id},ack:vi.fn(),retry:vi.fn()};
    const reconcile={body:{operationId:id,mode:'reconcile'},ack:vi.fn(),retry:vi.fn()};
    await worker.queue({messages:[execute]},env,{database:()=>db});
    await worker.queue({messages:[reconcile]},{...env,recoveryEnabled:false},{database:()=>db});
    expect(execute.retry).toHaveBeenCalledOnce();expect(reconcile.retry).toHaveBeenCalledOnce();
    expect(execute.ack).not.toHaveBeenCalled();expect(reconcile.ack).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();expect(db.from).not.toHaveBeenCalled();
    expect(destination.findOperationReceipt).not.toHaveBeenCalled();expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
  });
  it('does not claim a paused module just because a different module can write', async()=>{
    const {db,env,destination}=fixture();
    db.from.mockReturnValue({select:()=>({eq:()=>({single:async()=>({data:{action:'apply_job'}})})})});
    const message={body:{operationId:id},ack:vi.fn(),retry:vi.fn()};
    await worker.queue({messages:[message]},env,{database:()=>db});
    expect(message.retry).toHaveBeenCalledOnce();expect(message.ack).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();expect(destination.executeApprovedOperation).not.toHaveBeenCalled();
  });

});
