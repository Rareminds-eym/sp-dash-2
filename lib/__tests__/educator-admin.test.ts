import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), cookies: vi.fn(), identity: vi.fn(), memberships: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('../jwt-utils', () => ({ verifyJWT: mocks.verify }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: {
  SSO: { getUserById: mocks.identity, getUserMemberships: mocks.memberships },
} }) }));
import { PLATFORM_ORG_ID, requireEducatorAdmin } from '../educator-admin';
describe('platform educator administration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.identity.mockResolvedValue({ id: 'admin-id', is_blocked: false });
    mocks.memberships.mockResolvedValue({ memberships: [{ org_id: PLATFORM_ORG_ID, status: 'active', roles: ['rm_admin'] }] });
    mocks.cookies.mockResolvedValue({ get: () => ({ value: 'token' }) });
    mocks.verify.mockResolvedValue({ valid: true, payload: {
      sub: 'admin-id', org_id: PLATFORM_ORG_ID, roles: ['rm_admin'], membership_status: 'active',
    } });
  });
  it('requires same-origin for mutations', async () => {
    const result = await requireEducatorAdmin(new Request('https://admin.example/api/educators', { method: 'POST' }));
    expect(result.error?.status).toBe(403);
  });
  it('rejects destination faculty and disabled memberships', async () => {
    mocks.verify.mockResolvedValue({ valid: true, payload: { sub: 'faculty', org_id: PLATFORM_ORG_ID, roles: ['educator'], membership_status: 'active' } });
    expect((await requireEducatorAdmin(new Request('https://admin.example/api/educators'))).error?.status).toBe(403);
  });
  it('accepts signed platform admin claims without trusting user-cookie roles', async () => {
    const result = await requireEducatorAdmin(new Request('https://admin.example/api/educators'));
    expect(result.user?.id).toBe('admin-id');
    expect(mocks.verify).toHaveBeenCalledWith('token', expect.objectContaining({ allowDevelopmentFallback: false }));
  });
  it('rejects revoked live membership even with a signed active JWT', async () => {
    mocks.memberships.mockResolvedValue({ memberships: [{ org_id: PLATFORM_ORG_ID, status: 'inactive', roles: ['rm_admin'] }] });
    expect((await requireEducatorAdmin(new Request('https://admin.example/api/educators'))).error?.status).toBe(403);
  });
  it('denies when current authority is unavailable', async () => {
    mocks.identity.mockRejectedValue(new Error('offline'));
    expect((await requireEducatorAdmin(new Request('https://admin.example/api/educators'))).error?.status).toBe(503);
  });
});
