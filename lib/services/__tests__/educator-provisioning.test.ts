import { describe, expect, it, vi } from 'vitest';
vi.mock('../../educator-admin', () => ({ PLATFORM_ORG_ID: '00000000-0000-0000-0000-000000000001' }));
import { provisionEducator } from '../educator-provisioning';

const input = { email: 'HARI@example.com', requestId: 'request-1', user_metadata: { firstName: 'Hari', lastName: 'PN', platformRole: 'Trainer' } };
function setup(failStaff = false) {
  const writes: Array<{ table: string; action: string; payload: any }> = [];
  const rows: Record<string, any> = { users: null, organization_staff: null };
  const database = { from(table: string) {
    let action = 'select'; let payload: any;
    const finish = () => {
      if (action === 'select') return { data: rows[table], error: null };
      writes.push({ table, action, payload });
      if (table === 'organization_staff' && action === 'insert' && failStaff) return { data: null, error: { message: 'database rejected staff' } };
      rows[table] = { ...rows[table], ...payload, id: payload.id || 'staff-1' };
      return { data: rows[table], error: null };
    };
    const query: any = {
      select: () => query, eq: () => query, maybeSingle: async () => finish(), single: async () => finish(),
      upsert: (data: any) => { action = 'upsert'; payload = data; return query; },
      insert: (data: any) => { action = 'insert'; payload = data; return query; },
      update: (data: any) => { action = 'update'; payload = data; return query; },
      then: (resolve: any, reject: any) => Promise.resolve(finish()).then(resolve, reject),
    };
    return query;
  } };
  const sso = { getUserByEmail: vi.fn(async () => null as any), getUserById: vi.fn(), getUserMemberships: vi.fn(),
    createMember: vi.fn(async () => ({ user_id: 'sso-1' })), forgotPassword: vi.fn(async () => ({ kind: 'succeeded', data: { accepted: true } })) };
  const queue = { send: vi.fn(async () => {
    if (!rows.organization_staff) throw new Error('Invitation preceded staff profile');
  }) };
  const args = { input, actor: { id: 'admin-1' }, database, sso, queue, loginUrl: 'https://skillpassport.example/login' };
  return { args, writes, rows, sso, queue };
}
describe('external educator provisioning', () => {
  it('persists local profile before sending credentials and attributes the admin', async () => {
    const fixture = setup(); const result = await provisionEducator(fixture.args);
    expect(result.emailStatus).toBe('queued');
    expect(result.authUserId).toBe('sso-1');
    expect(result.staffId).toBe('staff-1');
    expect(result.teachingAccessStatus).toBe('granted');
    expect(fixture.rows.organization_staff.created_by).toBe('admin-1');
    expect(fixture.rows.organization_staff.metadata.portal_mode).toBe('assigned_trainer');
    expect(JSON.stringify(fixture.writes)).not.toContain(result.temporaryPassword);
    expect(fixture.queue.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'hari@example.com', type: 'send-email' }));
  });
  it('never claims success or sends credentials after a failed staff insert', async () => {
    const fixture = setup(true);
    await expect(provisionEducator(fixture.args)).rejects.toMatchObject({ status: 503, recoveryUserId: 'sso-1' });
    expect(fixture.queue.send).not.toHaveBeenCalled();
  });
  it('reports unavailable/failed queue truthfully and still exposes one-time credentials', async () => {
    const fixture = setup(); fixture.queue.send.mockRejectedValue(new Error('offline'));
    const result = await provisionEducator(fixture.args);
    expect(result.emailStatus).toBe('failed');
    expect(result.temporaryPassword).toBeTruthy();
    const other = setup();
    expect((await provisionEducator({ ...other.args, queue: undefined })).emailStatus).toBe('unavailable');
  });
  it('rejects a different existing identity without changing credentials', async () => {
    const fixture = setup(); fixture.sso.getUserByEmail.mockResolvedValue({ id: 'existing-1' });
    fixture.sso.getUserById.mockResolvedValue({ user_metadata: { source: 'other' } });
    fixture.sso.getUserMemberships.mockResolvedValue({ memberships: [] });
    await expect(provisionEducator(fixture.args)).rejects.toMatchObject({ status: 409 });
    expect(fixture.sso.createMember).not.toHaveBeenCalled();
    expect(fixture.sso.forgotPassword).not.toHaveBeenCalled();
  });
  it('reconciles the same creation without a duplicate SSO user or fabricated password', async () => {
    const fixture = setup(); fixture.sso.getUserByEmail.mockResolvedValue({ id: 'sso-1' });
    fixture.sso.getUserById.mockResolvedValue({ user_metadata: { source: 'sp_dashboard_onboarding', portal_mode: 'assigned_trainer',
      onboarding_actor: 'admin-1', onboarding_request_id: input.requestId } });
    fixture.sso.getUserMemberships.mockResolvedValue({ memberships: [{ org_id: '00000000-0000-0000-0000-000000000001', status: 'active', roles: ['educator'] }] });
    const result = await provisionEducator(fixture.args);
    expect(result.recovered).toBe(true); expect(result.temporaryPassword).toBeNull();
    expect(result.emailStatus).toBe('reset_requested');
    expect(fixture.sso.createMember).not.toHaveBeenCalled(); expect(fixture.queue.send).not.toHaveBeenCalled();
  });
  it('does not reactivate suspended local staff during creation retry', async () => {
    const fixture = setup();
    await provisionEducator(fixture.args);
    fixture.sso.getUserByEmail.mockResolvedValue({ id: 'sso-1' });
    fixture.sso.getUserById.mockResolvedValue({ user_metadata: { source: 'sp_dashboard_onboarding', portal_mode: 'assigned_trainer',
      onboarding_actor: 'admin-1', onboarding_request_id: input.requestId } });
    fixture.sso.getUserMemberships.mockResolvedValue({ memberships: [{ org_id: '00000000-0000-0000-0000-000000000001', status: 'active', roles: ['educator'] }] });
    fixture.rows.organization_staff.account_status = 'suspended';
    const priorWrites = fixture.writes.length;
    await expect(provisionEducator(fixture.args)).rejects.toMatchObject({ status: 409 });
    expect(fixture.writes).toHaveLength(priorWrites);
  });
});
