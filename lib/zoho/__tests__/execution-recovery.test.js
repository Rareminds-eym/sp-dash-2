import { describe, expect, it, vi } from 'vitest';
import { recoverSourceExecutions } from '../execution-recovery';
import { executionRecoveryStatus } from '../execution-recovery-status';

const connectionId = '10000000-0000-4000-8000-000000000001';
const operationId = '20000000-0000-4000-8000-000000000001';
function fixture(ready = true) {
  const queries = [];
  const db = { from: vi.fn(() => {
    const calls = [], query = {};
    for (const name of ['select', 'eq', 'in', 'lt', 'gt', 'lte', 'or', 'order']) query[name] = vi.fn((...args) => { calls.push([name, ...args]); return query; });
    query.limit = vi.fn(async count => ({ data: [{ id: operationId, zoho_staged_records: { connection_id: connectionId } }], error: null }));
    queries.push({ calls, query }); return query;
  }) };
  const env = { ENVIRONMENT: 'local', ZOHO_APPROVED_QUEUE: { sendBatch: vi.fn() } };
  const dependencies = { runtime: vi.fn(() => ({ executor: {} })), status: vi.fn(async () => ({ ready, modules: ready ? ['Candidates'] : [] })) };
  return { db, env, dependencies, queries, run: input => recoverSourceExecutions(db, env, input || { connectionId, module: 'Candidates' }, dependencies) };
}
describe('recovery of saved approvals', () => {
  it('dispatches bounded source-scoped retries and receipt reads without creating approvals or changing storage', async () => {
    const f = fixture();
    expect(await f.run()).toMatchObject({ retriesScheduled: 1, receiptChecksScheduled: 1, executionAvailable: true, emailPolicy: 'forbidden' });
    for (const { calls, query } of f.queries) {
      expect(calls).toContainEqual(['eq', 'zoho_staged_records.connection_id', connectionId]);
      expect(calls).toContainEqual(['eq', 'action', 'provision_candidate']);
      expect(query.limit).toHaveBeenCalledWith(25);
    }
    expect(f.queries[0].calls).toContainEqual(['lt', 'execution_attempts', 8]);
    expect(f.queries[0].calls).toContainEqual(['gt', 'expires_at', expect.any(String)]);
    expect(f.queries[0].calls).toContainEqual(['lte', 'next_attempt_at', expect.any(String)]);
    expect(f.queries[1].calls).toContainEqual(['eq', 'state', 'processing']);
    expect(f.queries[1].calls).toContainEqual(['or', expect.stringContaining('last_error.eq.OUTCOME_UNKNOWN,lease_expires_at.lte.')]);
    expect(f.env.ZOHO_APPROVED_QUEUE.sendBatch).toHaveBeenCalledWith([
      { body: { operationId, mode: 'execute' } }, { body: { operationId, mode: 'reconcile' } },
    ]);
  });
  it('continues receipt recovery when the writer is unavailable, without selecting write intents', async () => {
    const f = fixture(false); expect(await f.run()).toMatchObject({ retriesScheduled: 0, receiptChecksScheduled: 1, executionAvailable: false });
    expect(f.queries).toHaveLength(1);
    expect(f.env.ZOHO_APPROVED_QUEUE.sendBatch).toHaveBeenCalledWith([{ body: { operationId, mode: 'reconcile' } }]);
  });
  it('checks receipts immediately and reports only acknowledged completions while retaining execution in the queue',async()=>{
    const f=fixture(),reconcileReceipt=vi.fn(async()=>({state:'completed'}));
    f.dependencies.runtime.mockReturnValue({executor:{},reconcileReceipt});
    expect(await f.run()).toMatchObject({receiptChecksCheckedNow:1,confirmedCompletions:1});
    expect(reconcileReceipt).toHaveBeenCalledWith(operationId,f.db);
    expect(f.env.ZOHO_APPROVED_QUEUE.sendBatch).toHaveBeenCalledExactlyOnceWith([{body:{operationId,mode:'execute'}}]);
  });
  it('keeps failed immediate receipt checks on the durable queue',async()=>{
    const f=fixture(false),reconcileReceipt=vi.fn(async()=>{throw new Error('receipt read unavailable');});
    f.dependencies.runtime.mockReturnValue({executor:{},reconcileReceipt});
    expect(await f.run()).toMatchObject({receiptChecksCheckedNow:0,confirmedCompletions:0});
    expect(f.env.ZOHO_APPROVED_QUEUE.sendBatch).toHaveBeenCalledExactlyOnceWith([{body:{operationId,mode:'reconcile'}}]);
  });
  it('rejects disabled policy, unknown inputs, and cross-source references before dispatch', async () => {
    const f = fixture();
    await expect(f.run({ connectionId, module: 'Candidates', resetAttempts: true })).rejects.toThrow();
    f.env.ENVIRONMENT = 'production'; await expect(f.run()).rejects.toThrow('unavailable');
    expect(f.db.from).not.toHaveBeenCalled(); f.env.ENVIRONMENT = 'local';
    f.db.from.mockImplementation(() => ({ select() { return this; }, eq() { return this; }, in() { return this; }, lt() { return this; }, gt() { return this; }, lte() { return this; }, order() { return this; }, or() { return this; }, limit: async () => ({ data: [{ id: operationId, zoho_staged_records: { connection_id: operationId } }] }) }));
    await expect(f.run()).rejects.toThrow('unavailable'); expect(f.env.ZOHO_APPROVED_QUEUE.sendBatch).not.toHaveBeenCalled();
  });
  it('does not dispatch when either storage read fails, and makes ambiguous delivery safe to repeat', async () => {
    const f = fixture(); f.env.ZOHO_APPROVED_QUEUE.sendBatch.mockRejectedValue(new Error('lost response'));
    await expect(f.run()).rejects.toThrow('Retrying recovery is safe');
    await expect(f.run()).rejects.toThrow('Retrying recovery is safe');
    expect(f.env.ZOHO_APPROVED_QUEUE.sendBatch.mock.calls[0]).toEqual(f.env.ZOHO_APPROVED_QUEUE.sendBatch.mock.calls[1]);
    f.db.from.mockImplementation(() => { throw new Error('storage offline'); });
    await expect(f.run()).rejects.toThrow(); expect(f.env.ZOHO_APPROVED_QUEUE.sendBatch).toHaveBeenCalledTimes(2);
  });
  it('distinguishes interruption, expiry, exhaustion, queued work and confirmed completion', () => {
    const now = Date.parse('2026-11-06T00:00:00Z');
    const row = { state: 'failed', execution_attempts: 1, expires_at: '2026-11-07T00:00:00Z' };
    expect(executionRecoveryStatus(row, now).label).toBe('Waiting for safe retry');
    expect(executionRecoveryStatus({ ...row, expires_at: '2026-11-05T00:00:00Z' }, now).label).toBe('Approval expired');
    expect(executionRecoveryStatus({ ...row, execution_attempts: 8 }, now).label).toBe('Retry limit reached');
    expect(executionRecoveryStatus({ ...row, state: 'queued' }, now).label).toBe('Approved · queued');
    expect(executionRecoveryStatus({ ...row, state: 'processing', last_error: 'OUTCOME_UNKNOWN' }, now).label).toBe('Checking interrupted operation');
    expect(executionRecoveryStatus({ ...row, state: 'processing', last_error: 'OUTCOME_UNKNOWN', destination_phase: 'projection_pending' }, now).label).toBe('Syncing to application');
    expect(executionRecoveryStatus({ ...row, state: 'processing', lease_expires_at: '2026-11-05T00:00:00Z' }, now).label).toBe('Checking interrupted operation');
    expect(executionRecoveryStatus({ ...row, state: 'processing', lease_expires_at: '2026-11-07T00:00:00Z' }, now).label).toBe('Processing');
    expect(executionRecoveryStatus({ ...row, state: 'completed' }, now).label).toBe('Completed');
  });
});
