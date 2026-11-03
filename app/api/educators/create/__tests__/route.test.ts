import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ guard: vi.fn(), provision: vi.fn(), env: {} as any }));
vi.mock('@/lib/educator-admin', () => ({ PLATFORM_ORG_ID: '00000000-0000-0000-0000-000000000001', requireEducatorAdmin: fixture.guard }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: fixture.env }) }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));
vi.mock('@/lib/services/educator-provisioning', () => ({ provisionEducator: fixture.provision,
  EducatorProvisioningError: class extends Error {
    status: number; recoveryUserId: string | null;
    constructor(message: string, status: number, recoveryUserId: string | null) { super(message); this.status = status; this.recoveryUserId = recoveryUserId; }
  },
}));
import { EducatorProvisioningError } from '@/lib/services/educator-provisioning';
import { POST } from '../route';
const body = { requestId: '00000000-0000-4000-8000-000000000002', org_id: '00000000-0000-0000-0000-000000000001',
  email: 'hari@example.com', user_metadata: { firstName: 'Hari', lastName: 'PN', dateOfJoining: '', subjects: [] } };
const request = (payload: unknown = body) => new Request('https://admin.example/api/educators/create', {
  method: 'POST', headers: { Origin: 'https://admin.example', 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
});
beforeEach(() => { vi.resetAllMocks(); fixture.guard.mockResolvedValue({ user: { id: 'admin-1' } });
  fixture.env = { SSO: {}, SKILLPASSPORT_LOGIN_URL: 'https://skillpassport.example/login' };
  fixture.provision.mockResolvedValue({ staffId: 'staff-1', authUserId: 'user-1', emailStatus: 'queued' }); });
afterEach(() => vi.unstubAllEnvs());
describe('external educator create API', () => {
  it('authorizes before touching credentials or provisioning', async () => {
    fixture.guard.mockResolvedValue({ error: Response.json({ error: 'Denied' }, { status: 403 }) });
    expect((await POST(request())).status).toBe(403);
    expect(fixture.provision).not.toHaveBeenCalled();
  });
  it('rejects local college onboarding and strips client-controlled lifecycle flags', async () => {
    expect((await POST(request({ ...body, org_id: 'college-1' }))).status).toBe(400);
    await POST(request({ ...body, user_metadata: { ...body.user_metadata, must_change_password: false, source: 'spoofed', password: 'secret' } }));
    expect(fixture.provision.mock.calls[0][0].input.user_metadata).not.toHaveProperty('password');
    expect(fixture.provision.mock.calls[0][0].input.user_metadata).not.toHaveProperty('source');
  });
  it('returns no-store response and correct SkillPassport login target', async () => {
    const response = await POST(request());
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fixture.provision).toHaveBeenCalledWith(expect.objectContaining({ loginUrl: 'https://skillpassport.example/login', actor: { id: 'admin-1' } }));
    expect((await response.json()).data.emailStatus).toBe('queued');
  });
  it('does not create any account without a production login target', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('SKILLPASSPORT_LOGIN_URL', '');
    fixture.env.SKILLPASSPORT_LOGIN_URL = undefined;
    expect((await POST(request())).status).toBe(503);
    expect(fixture.provision).not.toHaveBeenCalled();
  });
  it('reports partial creation honestly with a nonsecret recovery reference', async () => {
    fixture.provision.mockRejectedValue(new EducatorProvisioningError('Identity exists; retry profile creation', 503, 'user-1'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ recoveryRequired: true, recoveryUserId: 'user-1' });
  });
});
