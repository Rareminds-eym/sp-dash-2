import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ cookies: vi.fn(), verify: vi.fn(), context: vi.fn(), identity: vi.fn(), memberships: vi.fn(), database: vi.fn(), plans: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: io.cookies }));
vi.mock('@/lib/jwt-utils', () => ({ verifyJWT: io.verify }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: io.context }));
vi.mock('../server', async original => ({ ...await original<typeof import('../server')>(), promoDatabase: io.database, publishedPromoPlans: io.plans }));
import { GET, POST, PATCH, DELETE } from '@/app/api/admin/promo-codes/route';
import { GET as redemptions } from '@/app/api/admin/promo-codes/redemptions/route';
import { GET as exportHistory } from '@/app/api/admin/promo-codes/redemptions/export/route';
const id = 'a0000000-0000-4000-8000-000000000001', org = '00000000-0000-0000-0000-000000000001', code = `pln_${'a'.repeat(32)}`;
const payload = { code: 'TEST1000', campaign_name: 'Test', role: 'learner', target_plan_code: code, mode: 'fixed', amount: '1000', overall_max_uses: 100, starts_at: '2026-11-25T00:00:00Z', expires_at: '2026-12-25T00:00:00Z' };
function request(method = 'GET', body?: unknown, origin = 'https://admin.example.invalid', query = '') {
  return new Request(`https://admin.example.invalid/api/admin/promo-codes${query}`, { method, headers: { origin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
let builder: any;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('NODE_ENV', 'test');
  io.cookies.mockResolvedValue({ get: () => ({ value: 'signed-test-token' }) });
  io.verify.mockResolvedValue({ valid: true, payload: { sub: id, org_id: org, membership_status: 'active', roles: ['super_admin'] } });
  io.identity.mockResolvedValue({ id, is_blocked: false });
  io.memberships.mockResolvedValue({ memberships: [{ org_id: org, status: 'active', roles: ['super_admin'] }] });
  io.context.mockResolvedValue({ env: { SSO: { getUserById: io.identity, getUserMemberships: io.memberships } } });
  io.plans.mockResolvedValue([{ code, name: 'Starter', role: 'learner', baseMinor: 250000, intervalUnit: 'year', intervalCount: 1 }]);
  builder = Object.fromEntries(['select', 'insert', 'update', 'delete', 'is', 'eq', 'order', 'range', 'ilike', 'lte', 'limit', 'gt'].map(key => [key, vi.fn().mockImplementation(() => builder)]));
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: { id } }); builder.single = vi.fn().mockResolvedValue({ data: { id, ...payload } });
  builder.then = (resolve: any) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
  io.database.mockReturnValue({ from: vi.fn().mockReturnValue(builder) });
});
afterEach(() => vi.unstubAllEnvs());
describe('promo admin API with actual live authorization guard', () => {
  it.each([GET, POST, PATCH, DELETE, redemptions, exportHistory])('denies missing session before database access', async handler => {
    io.cookies.mockResolvedValue({ get: () => undefined }); expect((await handler(request())).status).toBe(401); expect(io.database).not.toHaveBeenCalled();
  });
  it.each(['learner', 'school_admin', 'college_admin', 'admin'])('denies %s role', async role => {
    io.verify.mockResolvedValue({ valid: true, payload: { sub: id, org_id: org, membership_status: 'active', roles: [role] } });
    expect((await GET(request())).status).toBe(403); expect(io.database).not.toHaveBeenCalled();
  });
  it('denies revoked live membership and cross-origin writes', async () => {
    io.memberships.mockResolvedValue({ memberships: [] }); expect((await GET(request())).status).toBe(403);
    expect((await exportHistory(request('GET', undefined, undefined, `?id=${id}`))).status).toBe(403);
    expect((await POST(request('POST', payload, 'https://evil.invalid'))).status).toBe(403); expect(io.database).not.toHaveBeenCalled();
    expect((await DELETE(request('DELETE', { id, updated_at: '2026-11-25T00:00:00Z' }, 'https://evil.invalid'))).status).toBe(403);
  });
  it('creates exact fixed price and audit actor after plan validation', async () => {
    expect((await POST(request('POST', payload))).status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ fixed_price_minor: 100000, price_adjustment: 0, target_plan_code: code, created_by: id, updated_by: id, role_quotas: { learner: 100, school_admin: 0, college_admin: 0 } }));
  });
  it('rejects supplied raw prices, stale plan, duplicate code and missing synced actor', async () => {
    expect((await POST(request('POST', { ...payload, fixed_price_minor: 1 }))).status).toBe(400);
    io.plans.mockResolvedValueOnce([]); expect((await POST(request('POST', payload))).status).toBe(400);
    builder.single.mockResolvedValueOnce({ error: { code: '23505' } }); expect((await POST(request('POST', payload))).status).toBe(409);
    builder.maybeSingle.mockResolvedValueOnce({ data: null }); expect((await POST(request('POST', payload))).status).toBe(409);
  });
  it('bounds input and prevents searches injecting PostgREST filters', async () => {
    expect((await POST(request('POST', { ...payload, campaign_name: 'x'.repeat(9000) }))).status).toBe(400);
    expect((await GET(request('GET', undefined, undefined, '?q=abc%2Ccode.eq.SECRET'))).status).toBe(400);
    expect((await GET(request('GET', undefined, undefined, '?page=0'))).status).toBe(400);
    expect(io.database).not.toHaveBeenCalled();
  });
  it('only permits status changes using optimistic concurrency; never updates redemption terms', async () => {
    const body = { id, active: false, updated_at: '2026-11-25T00:00:00Z' };
    expect((await PATCH(request('PATCH', body))).status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('updated_at', body.updated_at);
    expect(Object.keys(builder.update.mock.calls[0][0]).sort()).toEqual(['active', 'updated_at', 'updated_by']);
    builder.maybeSingle.mockResolvedValueOnce({ data: null }); expect((await PATCH(request('PATCH', body))).status).toBe(409);
    expect((await PATCH(request('PATCH', { ...body, fixed_price_minor: 1 }))).status).toBe(400);
  });
  it('returns no-store paginated campaigns and read-only redemption snapshots', async () => {
    const list = await GET(request()); expect(list.status).toBe(200); expect(list.headers.get('cache-control')).toBe('private, no-store');
    expect(builder.range).toHaveBeenCalledWith(0, 19);
    expect((await redemptions(request('GET', undefined, undefined, `?id=${id}&page=2`))).status).toBe(200);
    expect(builder.range).toHaveBeenCalledWith(20, 39); expect(builder.insert).not.toHaveBeenCalled(); expect(builder.update).not.toHaveBeenCalled();
  });
  it('returns an Excel attachment through the authenticated export route, including empty campaigns', async () => {
    builder.maybeSingle.mockResolvedValueOnce({ data: { code: 'TEST', campaign_name: 'Example' } });
    const response = await exportHistory(request('GET', undefined, undefined, `?id=${id}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('.xlsx');
    const bytes = new Uint8Array(await response.arrayBuffer()); expect([...bytes.slice(0, 2)]).toEqual([80, 75]);
    expect(builder.insert).not.toHaveBeenCalled(); expect(builder.update).not.toHaveBeenCalled();
  });
  it('rejects malformed export queries, missing campaigns and oversized exports', async () => {
    expect((await exportHistory(request('GET', undefined, undefined, '?id=bad'))).status).toBe(400);
    expect(io.database).not.toHaveBeenCalled();
    builder.maybeSingle.mockResolvedValueOnce({ data: null });
    expect((await exportHistory(request('GET', undefined, undefined, `?id=${id}`))).status).toBe(404);
    builder.maybeSingle.mockResolvedValueOnce({ data: { code: 'TEST', campaign_name: 'Example' } });
    builder.then = (resolve: any) => Promise.resolve({ count: 10001, error: null }).then(resolve);
    const response = await exportHistory(request('GET', undefined, undefined, `?id=${id}`));
    expect(response.status).toBe(422); expect((await response.json()).error).toContain('10,000');
  });
  const edit = { id, updated_at: '2026-11-25T00:00:00Z', campaign_name: 'Updated campaign', mode: 'fixed', amount: '2000', starts_at: payload.starts_at, expires_at: payload.expires_at, overall_max_uses: 20, role_quotas: { learner: 20, school_admin: 0, college_admin: 0 } };
  const current = { id, updated_at: edit.updated_at, code: payload.code, target_plan_code: code, fixed_price_minor: 100000, price_adjustment: 0 };
  it('updates future campaign terms without changing active status, code, target plan or redemption snapshots', async () => {
    builder.maybeSingle.mockResolvedValueOnce({ data: current });
    expect((await PATCH(request('PATCH', edit))).status).toBe(200);
    const update = builder.update.mock.calls[0][0]; expect(update).toMatchObject({ campaign_name: 'Updated campaign', fixed_price_minor: 200000, price_adjustment: 0, updated_by: id });
    for (const field of ['code', 'target_plan_code', 'active', 'created_by', 'accepted_amount_minor']) expect(update).not.toHaveProperty(field);
    expect(builder.eq).toHaveBeenCalledWith('updated_at', edit.updated_at);
  });
  it('rejects forged identifiers, stale edits, incompatible quotas and unsafe changes to legacy prices', async () => {
    expect((await PATCH(request('PATCH', { ...edit, code: 'RENAMED' }))).status).toBe(400);
    builder.maybeSingle.mockResolvedValueOnce({ data: { ...current, updated_at: '2026-11-26T00:00:00Z' } }); expect((await PATCH(request('PATCH', edit))).status).toBe(409);
    builder.maybeSingle.mockResolvedValueOnce({ data: current });
    expect((await PATCH(request('PATCH', { ...edit, role_quotas: { ...edit.role_quotas, school_admin: 1 } }))).status).toBe(400);
    builder.maybeSingle.mockResolvedValueOnce({ data: current }); builder.then = (resolve: any) => Promise.resolve({ count: 1, error: null }).then(resolve);
    expect((await PATCH(request('PATCH', edit))).status).toBe(409); expect(builder.update).not.toHaveBeenCalled();
  });
  it('allows name/limit changes for legacy records when pricing is unchanged', async () => {
    builder.maybeSingle.mockResolvedValueOnce({ data: { ...current, fixed_price_minor: null, price_adjustment: 0 } });
    expect((await PATCH(request('PATCH', { ...edit, mode: 'addition', amount: '0' }))).status).toBe(200);
    expect(builder.update).toHaveBeenCalled();
  });
  it('deletes only the exact unused campaign version and handles concurrent redemption/FK conflicts', async () => {
    const command = { id, updated_at: edit.updated_at };
    expect((await DELETE(request('DELETE', command))).status).toBe(200); expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('id', id); expect(builder.eq).toHaveBeenCalledWith('updated_at', edit.updated_at);
    builder.maybeSingle.mockResolvedValueOnce({ error: { code: '23503' } });
    const conflict = await DELETE(request('DELETE', command)); expect(conflict.status).toBe(409); expect((await conflict.json()).error).toContain('Pause it instead');
    builder.maybeSingle.mockResolvedValueOnce({ data: null }); expect((await DELETE(request('DELETE', command))).status).toBe(409);
    expect((await DELETE(request('DELETE', { ...command, force: true }))).status).toBe(400);
  });
});
