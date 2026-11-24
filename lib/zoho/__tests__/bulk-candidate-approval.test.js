import { describe, expect, it, vi } from 'vitest';
import { createBulkCandidateApproval } from '../bulk-candidate-approval';
import { decisionSchema } from '../contracts';

const connectionId = '10000000-0000-4000-8000-000000000001';
function fixture(count = 123) {
  const connection = { id: connectionId, name: 'Synthetic source', status: 'connected', configRevision: 1 };
  const rows = Array.from({ length: count }, (_, i) => ({ id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    connection_id: connectionId, module: 'Candidates', external_id: String(1000 + i), revision: 1,
    created_at: new Date(Date.UTC(2026, 0, 1) - i * 1000).toISOString(),
    source_hash: 'a'.repeat(64), config_revision: 1, target_id: null, decision: 'pending_approval', validation_errors: [],
    proposed_data: { name: `Candidate ${i}`, email: `candidate${i}@example.invalid` } }));
  let current = connection, sequence = 0;
  const state = { blocked: new Set(), changed: new Set(), decisions: [], snapshots: [], reviews: [],
    transportFailure: false, serviceFailure: false, wrongCount: false, reviewCalls: 0, maxInFlight: 0, inFlight: 0 };
  const api = vi.fn(async (path, options) => {
    if (path) {
      const url = new URL(path, 'http://localhost'); state.snapshots.push(url);
      const offset = url.searchParams.has('beforeId') ? rows.findIndex(row => row.id === url.searchParams.get('beforeId')) + 1 : 0;
      return { total: rows.length, records: rows.slice(offset, offset + 50) };
    }
    const { action, input } = JSON.parse(options.body);
    if (action === 'decide') {
      decisionSchema.parse(input); state.decisions.push(input);
      if (state.transportFailure) { state.transportFailure = false; throw new Error('Lost response'); }
      return { result: { decision: 'approve', count: state.wrongCount ? 0 : input.items.length, delivery: 'queued' } };
    }
    expect(action).toBe('review_candidates');
    expect(input.items.length).toBeLessThanOrEqual(10);
    state.inFlight++; state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await Promise.resolve(); state.inFlight--;
    if (state.serviceFailure) throw Object.assign(new Error('Authority unavailable'), { status: 503 });
    return { reviews: input.items.map(item => {
      state.reviews.push(item); state.reviewCalls++;
      const row = rows.find(row => row.id === item.recordId), blocked = state.blocked.has(row.id);
      return { recordId: row.id, review: { recordId: row.id, revision: row.revision, sourceHash: row.source_hash,
        configRevision: row.config_revision, targetId: null, reviewHash: (state.changed.has(row.id) ? 'c' : 'b').repeat(64),
        decision: blocked ? 'blocked' : 'create', blockers: blocked ? ['Ambiguous account'] : [], expiresAt: new Date(Date.now() + 600000).toISOString(),
        identity: { email: row.proposed_data.email }, entitlements: { action: 'grant_discover' } } };
    }) };

  });
  const changes = [];
  const flow = createBulkCandidateApproval({ api, connection: { ...connection }, currentConnection: () => current,
    onChange: value => changes.push(value), requestId: () => `30000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` });
  return { api, flow, state, rows, changes, connection, setSource: value => { current = value; } };
}
describe('bulk candidate approval through existing BFF decisions', () => {
  it('checks the complete source snapshot and approves more than one page with a single confirmation', async () => {
    const f = fixture(); await f.flow.prepare();
    expect(f.flow.state).toMatchObject({ phase: 'ready', total: 123, checked: 123, approved: 0 });
    expect(f.state.decisions).toHaveLength(0);
    expect(Object.fromEntries(f.state.snapshots[0].searchParams)).toEqual({ view: 'records', connectionId,
      module: 'Candidates', state: 'pending_approval' });
    expect(f.state.snapshots).toHaveLength(3);
    expect(f.state.snapshots[1].searchParams.get('beforeId')).toBe(f.rows[49].id);
    expect(f.state.snapshots[1].searchParams.get('before')).toBe(f.rows[49].created_at);
    expect(f.changes.some(state => state.phase === 'loading' && state.loadedCount === 50)).toBe(true);
    await f.flow.approve('Reviewed all staged candidates');
    expect(f.flow.state).toMatchObject({ phase: 'done', approved: 123, processed: 123 });
    expect(f.state.decisions.map(input => input.items.length)).toEqual([50, 50, 23]);
    expect(new Set(f.state.decisions.flatMap(input => input.items.map(item => item.id))).size).toBe(123);
    expect(new Set(f.state.decisions.map(input => input.requestId)).size).toBe(3);
    expect(f.api.mock.calls.filter(([, options]) => options?.body && JSON.parse(options.body).action === 'review_candidates')).toHaveLength(26);
    expect(f.state.reviewCalls).toBe(246); expect(f.state.maxInFlight).toBeLessThanOrEqual(3);
  });
  it('lists validation and canonical blockers without authorizing them', async () => {
    const f = fixture(4); f.rows[0].validation_errors = ['Missing email']; f.state.blocked.add(f.rows[1].id);
    await f.flow.prepare(); expect(f.flow.state.skipped).toHaveLength(2); expect(f.flow.state.eligible).toHaveLength(2);
    await f.flow.approve('Approve eligible candidates');
    expect(f.state.decisions[0].items.map(item => item.id)).toEqual(f.rows.slice(2).map(row => row.id));
  });
  it.each([1, 2])('resumes timed-out loading page %i without discarding earlier pages or checking a partial list', async failedPage => {
    const f = fixture(123), original = f.api.getMockImplementation(), requests = [];
    let fail = true;
    f.api.mockImplementation(async (path, options) => {
      if (path) {
        requests.push(path);
        const page = new URL(path, 'http://localhost').searchParams.has('beforeId') ? 2 : 1;
        if (fail && page === failedPage) { fail = false; throw Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }); }
      }
      return original(path, options);
    });
    await f.flow.prepare();
    expect(f.flow.state).toMatchObject({ phase: 'error', mode: 'load', loadedCount: (failedPage - 1) * 50, checked: 0, approved: 0 });
    expect(f.flow.state.error).toMatch(new RegExp(`page ${failedPage} timed out`));
    expect(f.state.reviews).toHaveLength(0); expect(f.state.decisions).toHaveLength(0);
    await f.flow.approve('Must not approve partial data'); expect(f.state.decisions).toHaveLength(0);
    await f.flow.resume(); expect(f.flow.state).toMatchObject({ phase: 'ready', total: 123, loadedCount: 123, checked: 123 });
    expect(requests[failedPage]).toBe(requests[failedPage - 1]);
  });
  it('stops between loading pages and resumes the same cursor before any account checks', async () => {
    const f = fixture(53), original = f.api.getMockImplementation();
    f.api.mockImplementation(async (path, options) => { const result = await original(path, options); if (path) f.flow.stop(); return result; });
    await f.flow.prepare(); expect(f.flow.state).toMatchObject({ phase: 'paused', mode: 'load', loadedCount: 50, checked: 0 });
    f.api.mockImplementation(original); await f.flow.resume();
    expect(f.flow.state).toMatchObject({ phase: 'ready', total: 53, loadedCount: 53, checked: 53 });
    expect(f.state.snapshots).toHaveLength(2); expect(f.state.decisions).toHaveLength(0);
  });
  it('ignores new candidates above the loading cursor and refuses a list that shrinks midway', async () => {
    const f = fixture(53), original = f.api.getMockImplementation();
    let first = true;
    f.api.mockImplementation(async (path, options) => {
      const result = await original(path, options);
      if (path && first) { first = false; f.rows.unshift({ ...f.rows[0], id: '20000000-0000-4000-8000-000000000099', created_at: new Date().toISOString() }); }
      return result;
    });
    await f.flow.prepare(); expect(f.flow.state).toMatchObject({ phase: 'ready', total: 53, loadedCount: 53 });
    expect(f.state.reviews.some(input => input.recordId.endsWith('0099'))).toBe(false);
    const shrinking = fixture(53), api = shrinking.api.getMockImplementation(); first = true;
    shrinking.api.mockImplementation(async (path, options) => {
      const result = await api(path, options);
      if (path && first) { first = false; shrinking.rows.pop(); }
      return result;
    });
    await shrinking.flow.prepare(); expect(shrinking.flow.state).toMatchObject({ phase: 'error', reviewRequired: true, checked: 0 });
    expect(shrinking.state.reviews).toHaveLength(0); expect(shrinking.state.decisions).toHaveLength(0);
  });
  it('rechecks long-lived reviews but never authorizes a changed account snapshot', async () => {
    const f = fixture(3); await f.flow.prepare(); f.state.changed.add(f.rows[0].id);
    await f.flow.approve('Approve unchanged candidates');
    expect(f.flow.state.approved).toBe(2); expect(f.flow.state.skipped[0].issue).toMatch(/changed after/);
    expect(f.state.decisions[0].items.map(item => item.id)).not.toContain(f.rows[0].id);
  });
  it('retains exact idempotency input after a lost decision response and resumes subsequent batches', async () => {
    const f = fixture(51); await f.flow.prepare(); f.state.transportFailure = true;
    await f.flow.approve('Recoverable bulk approval');
    expect(f.flow.state).toMatchObject({ phase: 'error', approved: 0, pendingBatch: true });
    const reviews = f.state.reviewCalls;
    await f.flow.resume();
    expect(f.state.decisions[1]).toEqual(f.state.decisions[0]);
    expect(f.flow.state).toMatchObject({ phase: 'done', approved: 51, pendingBatch: false });
    expect(f.state.reviewCalls - reviews).toBe(1); // Pending batch is replayed without changing its evidence.
  });
  it('requires a new review after a definitive refusal instead of retrying stale evidence indefinitely', async () => {
    const f = fixture(2); await f.flow.prepare();
    const original = f.api.getMockImplementation();
    f.api.mockImplementation(async (path, options) => {
      if (!path && JSON.parse(options.body).action === 'decide') throw Object.assign(new Error('Selection changed'), { status: 409 });
      return original(path, options);
    });
    await f.flow.approve('Reviewed eligible candidates');
    expect(f.flow.state).toMatchObject({ phase: 'error', approved: 0, pendingBatch: false, reviewRequired: true });
    expect(f.flow.state.error).toMatch(/Review the remaining/);
    await f.flow.resume(); expect(f.flow.state.approved).toBe(0);
  });
  it('does not claim confirmed queue delivery for a recovered decision without delivery metadata', async () => {
    const f = fixture(2); await f.flow.prepare();
    const original = f.api.getMockImplementation();
    f.api.mockImplementation(async (path, options) => {
      const result = await original(path, options);
      if (!path && JSON.parse(options.body).action === 'decide') {
        delete result.result.delivery; result.result.replayed = true;
      }
      return result;
    });
    await f.flow.approve('Recovered approval evidence');
    expect(f.flow.state).toMatchObject({ phase: 'done', approved: 2, pendingDelivery: 2 });
  });
  it('does not treat service failures or a mismatched approval receipt as successful exclusions', async () => {
    const f = fixture(3); f.state.serviceFailure = true; await f.flow.prepare();
    expect(f.flow.state.phase).toBe('error'); expect(f.flow.state.skipped).toHaveLength(0); expect(f.state.decisions).toHaveLength(0);
    f.state.serviceFailure = false; await f.flow.resume(); f.state.wrongCount = true;
    await f.flow.approve('Reviewed eligible candidates');
    expect(f.flow.state).toMatchObject({ phase: 'error', approved: 0, pendingBatch: true });
  });
  it('stops a source-wide review conflict instead of marking every candidate as individually blocked', async () => {
    const f = fixture(20), original = f.api.getMockImplementation();
    f.api.mockImplementation(async (path, options) => {
      if (!path) throw Object.assign(new Error('Source was paused'), { status: 409, code: 'SOURCE_PAUSED' });
      return original(path, options);
    });
    await f.flow.prepare();
    expect(f.flow.state).toMatchObject({ phase: 'error', approved: 0, checked: 0, skipped: [] });
    expect(f.flow.state.error).toMatch(/Source was paused/);
    expect(f.api).toHaveBeenCalledTimes(2); // One snapshot and one bounded batch.
    expect(f.state.decisions).toHaveLength(0);
  });
  it.each(['truncated', 'missing rows', 'foreign source', 'job', 'held', 'duplicate', 'invalid cursor'])('refuses an incomplete or invalid %s snapshot', async kind => {
    const f = fixture(2);
    if (kind === 'truncated') f.api.mockImplementationOnce(async () => ({ total: 100001, records: f.rows }));
    if (kind === 'missing rows') f.api.mockImplementationOnce(async () => ({ total: 3, records: f.rows }));
    if (kind === 'foreign source') f.rows[0].connection_id = '10000000-0000-4000-8000-000000000009';
    if (kind === 'job') f.rows[0].module = 'Job_Openings';
    if (kind === 'held') f.rows[0].decision = 'held';
    if (kind === 'duplicate') f.rows[1].id = f.rows[0].id;
    if (kind === 'invalid cursor') f.rows[0].created_at = 'not-a-date';
    await f.flow.prepare(); expect(f.flow.state.phase).toBe('error'); expect(f.state.reviews).toHaveLength(0); expect(f.state.decisions).toHaveLength(0);
  });
  it('stops after an in-flight batch, preserves queued approvals and resumes only remaining batches', async () => {
    const f = fixture(51); await f.flow.prepare();
    const api = f.api.getMockImplementation();
    f.api.mockImplementation(async (path, options) => {
      const result = await api(path, options);
      if (!path && JSON.parse(options.body).action === 'decide') f.flow.stop();
      return result;
    });
    await f.flow.approve('Explicit bulk approval');
    expect(f.flow.state).toMatchObject({ phase: 'paused', approved: 50 }); expect(f.state.decisions).toHaveLength(1);
    f.api.mockImplementation(api); await f.flow.resume(); expect(f.flow.state.approved).toBe(51); expect(f.state.decisions).toHaveLength(2);
  });
  it('can stop account checks without recording approvals, then finish checking before confirmation', async () => {
    const f = fixture(18), original = f.api.getMockImplementation();
    f.api.mockImplementation(async (path, options) => { const result = await original(path, options); if (!path) f.flow.stop(); return result; });
    await f.flow.prepare(); expect(f.flow.state.phase).toBe('paused'); expect(f.flow.state.checked).toBe(10);
    await f.flow.approve('Cannot bypass checks'); expect(f.state.decisions).toHaveLength(0);
    f.api.mockImplementation(original); await f.flow.resume(); expect(f.flow.state.phase).toBe('ready'); expect(f.flow.state.checked).toBe(18);
  });
  it('blocks source/config changes and concurrent submission, and never silently adds newly discovered rows', async () => {
    const f = fixture(2); await f.flow.prepare();
    f.rows.push({ ...f.rows[0], id: '20000000-0000-4000-8000-000000000099', external_id: '1099' });
    f.setSource({ ...f.connection, configRevision: 2 }); await f.flow.approve('Reviewed source'); expect(f.state.decisions).toHaveLength(0);
    f.setSource(f.connection);
    await Promise.all([f.flow.resume(), f.flow.resume()]);
    expect(f.state.decisions).toHaveLength(1); expect(f.flow.state.approved).toBe(2);
  });
});
