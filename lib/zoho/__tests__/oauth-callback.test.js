import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ refresh:vi.fn(), complete: vi.fn(), cancel: vi.fn(), auth: vi.fn() }));
vi.mock('../../../app/actions/auth',()=>({refreshAction:mocks.refresh}));
vi.mock('../admin', () => ({ requireZohoAdmin: mocks.auth }));
vi.mock('../oauth', () => ({ createZohoOAuth: () => ({ complete: mocks.complete, cancel: mocks.cancel }) }));
vi.mock('../../supabase-admin', () => ({ supabaseAdmin: {} }));
import { GET } from '../../../app/api/integrations/zoho-recruit/oauth/callback/route';
const source = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const request = () => new Request(`http://localhost:3010/api/integrations/zoho-recruit/oauth/callback?state=${'a'.repeat(72)}&code=private-code&source=${other}`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'admin' }, env: {} });
});
it('preserves only the state-verified source on provider organization mismatch', async () => {
  mocks.complete.mockImplementation(async (_state, _code, _actor, verified) => {
    verified(source); throw Object.assign(new Error('private-provider-message'), { code: 'ORGANIZATION_MISMATCH' });
  });
  const response = await GET(request());
  const target = new URL(response.headers.get('location'));
  expect(response.status).toBe(303);
  expect(target.searchParams.get('source')).toBe(source);
  expect(target.searchParams.get('reason')).toBe('organization_mismatch');
  expect(target.searchParams.get('connection')).toBe('failed');
  expect(target.href).not.toMatch(/private|code=|state=/);
});
it('does not trust a query or error source when OAuth state was not verified', async () => {
  mocks.complete.mockRejectedValue(Object.assign(new Error('Invalid OAuth state'), { connectionId: other }));
  const target = new URL((await GET(request())).headers.get('location'));
  expect(target.searchParams.has('source')).toBe(false);
  expect(target.searchParams.get('connection')).toBe('failed');
});
it('keeps a successfully verified source selected', async () => {
  mocks.complete.mockResolvedValue(source);
  const target = new URL((await GET(request())).headers.get('location'));
  expect(target.searchParams.get('source')).toBe(source);
  expect(target.searchParams.get('connection')).toBe('verified');
});
it('preserves the state-verified source after consent denial without exchanging a code', async () => {
  mocks.cancel.mockImplementation(async (_state, _actor, verified) => { verified(source); return source; });
  const response = await GET(new Request(`http://localhost:3010/api/integrations/zoho-recruit/oauth/callback?state=${'a'.repeat(72)}&error=access_denied&source=${other}`));
  const target = new URL(response.headers.get('location'));
  expect(target.searchParams.get('source')).toBe(source);
  expect(target.searchParams.get('reason')).toBe('consent_denied');
  expect(mocks.complete).not.toHaveBeenCalled();
});
it('recovers an expired session without passing OAuth codes through login URLs',async()=>{
 mocks.auth.mockResolvedValueOnce({error:Response.json({error:'expired'},{status:401})}).mockResolvedValue({user:{id:'admin'},env:{}});
 mocks.refresh.mockResolvedValue({success:true});mocks.complete.mockResolvedValue(source);
 const response=await GET(request());
 expect(mocks.refresh).toHaveBeenCalledOnce();expect(mocks.complete).toHaveBeenCalledOnce();
 expect(response.headers.get('location')).toContain('connection=verified');
 expect(response.headers.get('location')).not.toMatch(/state=|code=/);
 expect(response.headers.get('Cache-Control')).toContain('no-store');
});
it.each([401,403])('redirects failed session recovery/authority to a useful page (%s)',async status=>{
 mocks.auth.mockResolvedValue({error:Response.json({error:'private auth detail'},{status})});mocks.refresh.mockResolvedValue({success:false,status:401});
 const response=await GET(request());expect(response.status).toBe(303);
 expect(response.headers.get('location')).toContain(status===403?'administrator_required':'session_expired');
 expect(mocks.complete).not.toHaveBeenCalled();expect(response.headers.get('location')).not.toMatch(/state=|code=/);
});

it('reports a temporary authority outage without claiming the session expired',async()=>{
 mocks.auth.mockResolvedValue({error:Response.json({error:'Unavailable'},{status:503})});
 const response=await GET(request());
 expect(new URL(response.headers.get('location')).searchParams.get('reason')).toBe('authority_unavailable');
 expect(mocks.refresh).not.toHaveBeenCalled();expect(mocks.complete).not.toHaveBeenCalled();
 expect(response.headers.get('location')).not.toMatch(/code=|state=/);
});
it('reports temporary refresh failure without claiming expiry',async()=>{
 mocks.auth.mockResolvedValue({error:Response.json({error:'Expired access'},{status:401})});
 mocks.refresh.mockResolvedValue({success:false,status:503,retryable:true});
 const response=await GET(request());
 expect(new URL(response.headers.get('location')).searchParams.get('reason')).toBe('authority_unavailable');
 expect(mocks.complete).not.toHaveBeenCalled();
});
