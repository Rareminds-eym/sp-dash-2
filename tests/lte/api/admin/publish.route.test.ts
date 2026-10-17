import {describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/lte-api', () => ({proxyLTE:vi.fn()}));
import {proxyLTE} from '@/lib/lte-api';
import {POST} from '@/app/api/admin/lte/publish/route';
describe('publish proxy', () => {
 it('forwards the request and preserves LTE failures', async () => {
 const request = new NextRequest('https://dash.example.com/api/admin/lte/publish', {method:'POST'});
 const upstream = Response.json({success:false,error:'Forbidden'}, {status:403});
 vi.mocked(proxyLTE).mockResolvedValue(upstream);
 expect(await POST(request)).toBe(upstream);
 expect(proxyLTE).toHaveBeenCalledWith(request, 'publish');
 });
});
