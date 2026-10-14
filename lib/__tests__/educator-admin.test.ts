import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), cookies: vi.fn(), identity: vi.fn(), memberships: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('../jwt-utils', () => ({ verifyJWT: mocks.verify }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: {
  SSO: { getUserById: mocks.identity, getUserMemberships: mocks.memberships },
} }) }));
import { PLATFORM_ORG_ID, requireEducatorAdmin } from '../educator-admin';
describe('platform educator administration', () => {
  afterEach(() => vi.unstubAllEnvs());
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
  it('accepts localhost uploads when Next dev constructs a wildcard listening URL', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const request = new Request('http://0.0.0.0:3000/api/educators/upload-document', {
      method: 'POST', headers: { Origin: 'http://localhost:3000', Host: 'localhost:3000' },
    });
    expect((await requireEducatorAdmin(request)).user?.id).toBe('admin-id');
  });
  it('rejects remote origins, mismatched hosts and ports in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    for (const [origin, host] of [
      ['http://attacker.example:3000', 'attacker.example:3000'],
      ['http://localhost:3000', '127.0.0.1:3000'],
      ['http://localhost:3001', 'localhost:3001'],
    ]) {
      const request = new Request('http://0.0.0.0:3000/api/educators/upload-document', {
        method: 'POST', headers: { Origin: origin, Host: host },
      });
      expect((await requireEducatorAdmin(request)).error?.status).toBe(403);
    }
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it('keeps the production origin comparison strict', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const mismatch = new Request('http://0.0.0.0:3000/api/educators/upload-document', {
      method: 'POST', headers: { Origin: 'http://localhost:3000', Host: 'localhost:3000' },
    });
    expect((await requireEducatorAdmin(mismatch)).error?.status).toBe(403);
    const matching = new Request('https://admin.example/api/educators/upload-document', {
      method: 'POST', headers: { Origin: 'https://admin.example' },
    });
    expect((await requireEducatorAdmin(matching)).user?.id).toBe('admin-id');
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
