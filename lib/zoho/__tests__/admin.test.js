import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ cookies: vi.fn(), verify: vi.fn(), identity: vi.fn(), memberships: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('../../jwt-utils', () => ({ verifyJWT: mocks.verify }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { SSO: { getUserById: mocks.identity, getUserMemberships: mocks.memberships } } }) }));
import { requireZohoAdmin } from '../admin';
const org = '00000000-0000-0000-0000-000000000001';
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('NODE_ENV', 'test');
  mocks.cookies.mockResolvedValue({ get: () => ({ value: 'signed' }) });
  mocks.verify.mockResolvedValue({ valid: true, payload: { sub: 'admin', org_id: org, membership_status: 'active', roles: ['super_admin'] } });
  mocks.identity.mockResolvedValue({ id: 'admin', is_blocked: false });
  mocks.memberships.mockResolvedValue({ memberships: [{ org_id: org, status: 'active', roles: ['super_admin'] }] });
});
afterEach(() => vi.unstubAllEnvs());
describe('Zoho administration boundary', () => {
  it('accepts signed and live platform super-admin authority', async () => {
    expect((await requireZohoAdmin(new Request('https://admin.example/api/integrations/zoho-recruit'))).user.id).toBe('admin');
  });
  it('rejects a super-admin demoted in live SSO even with a still-valid JWT', async () => {
    mocks.memberships.mockResolvedValue({ memberships: [{ org_id: org, status: 'active', roles: ['admin'] }] });
    expect((await requireZohoAdmin(new Request('https://admin.example/api'))).error.status).toBe(403);
  });
  it.each([true, null, undefined, 0, 'false'])('denies unknown/malformed or blocked identity state (%s)', async value => {
    mocks.identity.mockResolvedValue({ id: 'admin', is_blocked: value });
    for (const method of ['GET', 'POST']) {
      const request = new Request('https://admin.example/api', { method, ...(method === 'POST' ? { headers: { origin: 'https://admin.example' } } : {}) });
      expect((await requireZohoAdmin(request)).error.status).toBe(403);
    }
  });
  it('does not authorize a mismatched live identity response', async () => {
    mocks.identity.mockResolvedValue({ id: 'another-admin', is_blocked: false });
    expect((await requireZohoAdmin(new Request('https://admin.example/api'))).error.status).toBe(403);
  });
  it('rejects cross-origin or missing-origin mutations before any authority lookup', async () => {
    for (const origin of [undefined, 'https://attacker.example']) {
      const request = new Request('https://admin.example/api', { method: 'POST', headers: origin ? { origin } : {} });
      expect((await requireZohoAdmin(request)).error.status).toBe(403);
    }
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it('fails closed when live administrator verification is unavailable', async () => {
    mocks.identity.mockRejectedValue(new Error('offline'));
    expect((await requireZohoAdmin(new Request('https://admin.example/api'))).error.status).toBe(503);
  });
});
