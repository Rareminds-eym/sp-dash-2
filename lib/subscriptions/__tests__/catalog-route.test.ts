import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ cookies: vi.fn(), verify: vi.fn(), context: vi.fn(), identity: vi.fn(), memberships: vi.fn(), inventory: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: io.cookies }));
vi.mock('@/lib/jwt-utils', () => ({ verifyJWT: io.verify }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: io.context }));
import { GET } from '@/app/api/admin/subscriptions/catalog/route';

const org = '00000000-0000-0000-0000-000000000001';
const userId = 'a0000000-0000-4000-8000-000000000001';
const featureId = 'b0000000-0000-4000-8000-000000000001';
const request = () => new Request('https://admin.example.invalid/api/admin/subscriptions/catalog');
let transport = vi.fn<typeof fetch>();
let environment: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('NODE_ENV', 'test');
  io.cookies.mockResolvedValue({ get: (name: string) => name === 'sso_access_token' ? { value: 'synthetic-signed-token' } : undefined });
  io.verify.mockResolvedValue({ valid: true, payload: { sub: userId, org_id: org, membership_status: 'active', roles: ['super_admin'] } });
  io.identity.mockResolvedValue({ id: userId, is_blocked: false });
  io.memberships.mockResolvedValue({ memberships: [{ org_id: org, status: 'active', roles: ['super_admin'] }] });
  io.inventory.mockResolvedValue({ schemaVersion: 1, plans: [] });
  environment = { SSO: { getUserById: io.identity, getUserMemberships: io.memberships, getSubscriptionCatalogInventory: io.inventory },
    SKILLPASSPORT_API_URL: 'https://owner.example.invalid' };
  io.context.mockResolvedValue({ env: environment });
  transport = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ schemaVersion: 1, plans: [], features: [{ id: featureId, key: 'ai_credits', name: 'AI credits', type: 'metered', category: 'ai' }] }));
  vi.stubGlobal('fetch', transport);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('actual admin catalog GET with existing live authorization', () => {
  it('calls the owner endpoint and existing auth helper after a valid live platform super-admin check', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ schemaVersion: 1, plans: [], features: [{ id: featureId, key: 'ai_credits', name: 'AI credits', type: 'metered', category: 'ai' }] });
    expect(io.verify).toHaveBeenCalledWith('synthetic-signed-token', expect.objectContaining({ enforceClaims: true, allowDevelopmentFallback: false }));
    expect(io.identity).toHaveBeenCalledExactlyOnceWith(userId);
    expect(io.memberships).toHaveBeenCalledExactlyOnceWith(userId);
    expect(io.inventory).not.toHaveBeenCalled();
    expect(io.memberships.mock.invocationCallOrder[0]).toBeLessThan(transport.mock.invocationCallOrder[0]);
    expect(io.identity.mock.invocationCallOrder[0]).toBeLessThan(transport.mock.invocationCallOrder[0]);
  });

  it('rejects an unauthenticated request before all owner lookups', async () => {
    io.cookies.mockResolvedValue({ get: () => undefined });
    expect((await GET(request())).status).toBe(401);
    expect(io.verify).not.toHaveBeenCalled(); expect(io.context).not.toHaveBeenCalled();
    expect(io.inventory).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    { valid: false, payload: null },
    { valid: true, payload: { sub: userId, org_id: org, membership_status: 'active', roles: ['admin'] } },
    { valid: true, payload: { sub: userId, org_id: featureId, membership_status: 'active', roles: ['super_admin'] } },
  ])('denies invalid, tenant-scoped or insufficient signed authority %j', async verification => {
    io.verify.mockResolvedValue(verification);
    expect((await GET(request())).status).toBe(verification.valid ? 403 : 401);
    expect(io.inventory).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
  });

  it.each([true, undefined, 'false'])('denies blocked or unknown live identity state %j', async blocked => {
    io.identity.mockResolvedValue({ id: userId, is_blocked: blocked });
    expect((await GET(request())).status).toBe(403);
    expect(io.inventory).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
  });

  it('denies live revocation even when the signed token still carries super_admin', async () => {
    io.memberships.mockResolvedValue({ memberships: [{ org_id: org, status: 'active', roles: ['admin'] }] });
    expect((await GET(request())).status).toBe(403);
    expect(io.inventory).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
  });

  it('ignores a forged display cookie when the token has no authority', async () => {
    io.cookies.mockResolvedValue({ get: (name: string) => name === 'sso_user'
      ? { value: JSON.stringify({ roles: ['super_admin'] }) }
      : name === 'sso_access_token' ? { value: 'synthetic-signed-token' } : undefined });
    io.verify.mockResolvedValue({ valid: true, payload: { sub: userId, org_id: org, membership_status: 'active', roles: ['admin'] } });
    expect((await GET(request())).status).toBe(403);
    expect(io.inventory).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    { memberships: [] }, { memberships: [{ org_id: org, status: 'suspended', roles: ['super_admin'] }] },
    { memberships: [{ org_id: featureId, status: 'active', roles: ['super_admin'] }] },
  ])('denies absent, suspended or other-organization live authority %j', async ({ memberships }) => {
    io.memberships.mockResolvedValue({ memberships });
    expect((await GET(request())).status).toBe(403);
    expect(io.inventory).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
  });

  it('denies mismatched live identity', async () => {
    io.identity.mockResolvedValue({ id: featureId, is_blocked: false });
    expect((await GET(request())).status).toBe(403);
    expect(io.inventory).not.toHaveBeenCalled(); expect(transport).not.toHaveBeenCalled();
  });

  it('fails explicitly when the application target is missing without using generic environment settings', async () => {
    delete environment.SKILLPASSPORT_API_URL;
    environment.SUPABASE_URL = 'https://another-owner.example.invalid';
    const response = await GET(request());
    expect(response.status).toBe(503); expect(transport).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: 'Subscription catalog inventory is unavailable' });
  });

  it('returns a redacted no-store error when either owner is unavailable', async () => {
    transport.mockRejectedValue(new Error('Sensitive upstream detail'));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'Subscription catalog inventory is unavailable' });
  });
});
