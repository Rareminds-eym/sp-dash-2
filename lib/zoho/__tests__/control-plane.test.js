import { describe, it, expect, vi } from 'vitest';
import { createZohoControlPlane } from '../control-plane';
const id = '10000000-0000-4000-8000-000000000001';
describe('Zoho control plane', () => {
  it('binds privacy changes to the authenticated actor and fixed RPCs', async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: { suppressed: true } }) };
    const service = createZohoControlPlane(db);
    await service.suppress({ connectionId: id, module: 'Candidates', externalId: '123', suppressed: true, reason: 'Privacy request' }, id);
    expect(db.rpc).toHaveBeenCalledWith('zoho_set_source_suppression', { p_connection: id, p_module: 'Candidates',
      p_external: '123', p_suppressed: true, p_reason: 'Privacy request', p_actor: id });
    await service.retention({ connectionId: id, days: 14, reason: 'Retention review' }, id);
    expect(db.rpc).toHaveBeenCalledWith('zoho_configure_retention', { p_connection: id, p_days: 14, p_reason: 'Retention review', p_actor: id });
    await service.privacy(id);
    expect(db.rpc).toHaveBeenCalledWith('zoho_source_privacy_snapshot', { p_connection: id });
  });
  it('rejects privacy actor injection, unsafe IDs and invalid retention before mutation', async () => {
    const db = { rpc: vi.fn() }; const service = createZohoControlPlane(db);
    for (const patch of [{ actor: id }, { externalId: '1 OR true' }, { suppressed: 'true' }, { reason: 'x' }])
      await expect(service.suppress({ connectionId: id, module: 'Candidates', externalId: '123', suppressed: true, reason: 'Review', ...patch }, id)).rejects.toThrow();
    for (const days of [0, 366, 2.5, '30']) await expect(service.retention({ connectionId: id, days, reason: 'Review' }, id)).rejects.toThrow();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('scopes deferred outcomes without exposing duplicate source payloads', async () => {
    const query = { eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn(async () => ({ data: [{ id }], error: null })) };
    const select = vi.fn(() => query);
    expect(await createZohoControlPlane({ from: () => ({ select }) }).deferred(id)).toEqual([{ id }]);
    expect(query.eq).toHaveBeenCalledWith('connection_id', id);
    expect(query.in).toHaveBeenCalledWith('state', ['waiting_execution', 'blocked_invalid']);
    expect(select.mock.calls[0][0]).not.toMatch(/proposed_data|validation_errors|envelope|lease/);
    expect(query.limit).toHaveBeenCalledWith(50);
  });
  it('scopes bounded execution history through its source record without selecting approved payloads or lease tokens', async () => {
    const query = { eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ id }], error: null }) };
    const select = vi.fn(() => query);
    const db = { from: vi.fn(() => ({ select })) };
    expect(await createZohoControlPlane(db).executions(id)).toEqual([{ id }]);
    expect(query.eq).toHaveBeenCalledWith('zoho_staged_records.connection_id', id);
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(select.mock.calls[0][0]).toContain('zoho_staged_records!inner');
    expect(select.mock.calls[0][0]).not.toMatch(/approved_data|lease_token|envelope/);
  });
  it('returns the discovery configuration revision needed to distinguish historical scans without exposing credentials', async () => {
    const run = { id, config_revision: 4, state: 'failed' };
    const query = { eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [run], error: null }) };
    const select = vi.fn(() => query);
    expect(await createZohoControlPlane({ from: () => ({ select }) }).runs(id)).toEqual([run]);
    expect(select.mock.calls[0][0].split(',')).toContain('config_revision');
    expect(select.mock.calls[0][0]).not.toMatch(/token|credential|envelope/);
    expect(query.eq).toHaveBeenCalledWith('connection_id', id);
  });
  it('loads a second page using the exact PostgreSQL offset timestamp and UUID cursor', async () => {
    const rpc=vi.fn(async()=>({data:{records:[{id}]},error:null}));
    const before='2026-10-29T08:00:00.123456+00:00';
    expect(await createZohoControlPlane({rpc}).reviewPage({connectionId:id,module:'Candidates',before,beforeId:id})).toEqual({records:[{id}]});
    expect(rpc).toHaveBeenCalledWith('zoho_review_page',expect.objectContaining({p_before:before,p_before_id:id}));
  });
  it('records only an approval intent through the database; never calls a mailer or domain writer', async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: { decision: 'approve' }, error: null }), from: vi.fn() };
    const body = { connectionId: id, requestId: id, decision: 'approve', reason: 'Reviewed source', items: [{ id, revision: 3, sourceHash: 'a'.repeat(64), configRevision: 1, targetId: null }] };
    await createZohoControlPlane(db).decide(body, id);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_decide_records', { p_connection: id, p_request: id, p_decision: 'approve', p_reason: 'Reviewed source', p_items: body.items, p_actor: id });
    expect(db.from).not.toHaveBeenCalled();
  });
  it('does not write on invalid or authority-injected decisions', async () => {
    const db = { rpc: vi.fn() };
    await expect(createZohoControlPlane(db).decide({ autoApprove: true }, id)).rejects.toThrow();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('preserves conflict codes without leaking source/database details', async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ error: { code: '40001', message: 'email private@example.com' } }) };
    const input = { connectionId: id, requestId: id, decision: 'hold', reason: 'Review required', items: [{ id, revision: 3, sourceHash: 'a'.repeat(64), configRevision: 1, targetId: null }] };
    await expect(createZohoControlPlane(db).decide(input, id)).rejects.toMatchObject({ code: '40001', message: 'Integration state could not be updated' });
  });
});

describe('per-module live discovery status', () => {
  it('reads bounded independent module heads and checkpoints without a history cursor', async () => {
    const reads = [];
    const db = { from: table => {
      const read = {table, filters:{}}; reads.push(read);
      const query = { select: () => query, eq: (key,value) => { read.filters[key] = value; return query; },
        order: () => query, limit: async limit => { read.limit = limit; return {data:[{module:read.filters.module,capture_complete:!!read.filters.capture_complete}],error:null}; } };
      return query;
    } };
    const status = await createZohoControlPlane(db).discoveryStatus({connectionId:id});
    expect(status.latestRuns.map(row => row.module)).toEqual(['Candidates','Job_Openings']);
    expect(status.captures.every(row => row.capture_complete)).toBe(true);
    expect(reads).toHaveLength(4);
    expect(reads.every(read => read.limit === 1 && read.filters.connection_id === id)).toBe(true);
    await expect(createZohoControlPlane(db).discoveryStatus({connectionId:id,before:'unexpected'})).rejects.toThrow();
  });
  it('does not convert a module read outage into empty successful status', async () => {
    const query = {select:()=>query,eq:()=>query,order:()=>query,limit:async()=>({data:null,error:{message:'outage'}})};
    await expect(createZohoControlPlane({from:()=>query}).discoveryStatus({connectionId:id})).rejects.toThrow('Discovery status unavailable');
  });
});
