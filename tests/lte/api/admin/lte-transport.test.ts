import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest';
import {NextRequest} from 'next/server';
import {callLTE, lteConnection, proxyLTEAsset} from '@/lib/lte-api';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {signedLTERequest} from '@/lib/lte-http';
import consumer from '@/workers/lte-asset-validation-consumer';
vi.mock('@opennextjs/cloudflare', () => ({getCloudflareContext:vi.fn()}));
const secret = 'test-secret-longer-than-thirty-two-characters';
beforeEach(() => {vi.mocked(getCloudflareContext).mockResolvedValue({env:{LTE_API_BASE_URL:'https://lte.example.com'}} as never);});
afterEach(() => {vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('LTE API boundary', () => {
 it('uses Cloudflare bindings and prevents Node dev from inheriting a production LTE target',async()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('LTE_API_BASE_URL','https://unexpected-process-env.example.com');
  vi.mocked(getCloudflareContext).mockResolvedValue({env:{LTE_API_BASE_URL:'https://lte.rareminds.in',LTE_CATALOG_SYNC_SECRET:secret}} as never);
  expect(await lteConnection()).toEqual({LTE_API_BASE_URL:'http://localhost:8789',LTE_CATALOG_SYNC_SECRET:secret});
  vi.mocked(getCloudflareContext).mockResolvedValue({env:{LTE_API_BASE_URL:'http://127.0.0.1:8789',LTE_CATALOG_SYNC_SECRET:secret}} as never);
  expect((await lteConnection()).LTE_API_BASE_URL).toBe('http://127.0.0.1:8789');
  vi.stubEnv('NODE_ENV','production');vi.mocked(getCloudflareContext).mockResolvedValue({env:{LTE_API_BASE_URL:'https://lte.rareminds.in'}} as never);
  expect((await lteConnection()).LTE_API_BASE_URL).toBe('https://lte.rareminds.in');
 });
 it('rejects oversized mutation bodies and streams bodies that omit Content-Length',async()=>{
  const upstream=vi.fn(async (_input:RequestInfo|URL,init?:RequestInit)=>{await new Response(init?.body).text();return Response.json({success:true});});vi.stubGlobal('fetch',upstream);
  const headers={authorization:'Bearer jwt','Content-Length':String(26*1024*1024)};
  expect((await callLTE(new NextRequest('https://dash.example.com/api/admin/lte/review',{method:'PATCH',headers,body:'{}'}),'review')).status).toBe(413);
  expect(upstream).not.toHaveBeenCalled();
  expect((await callLTE(new NextRequest('https://dash.example.com/api/admin/lte/review',{method:'PATCH',headers:{authorization:'Bearer jwt'},body:'{}'}),'review')).status).toBe(200);
  expect(upstream.mock.calls[0][1]?.body).toBeInstanceOf(ReadableStream);
 });
 it('forwards the original access token, method, query and JSON without role cookies', async () => {
  const upstream = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({success:true})); vi.stubGlobal('fetch',upstream);
  const request = new NextRequest('https://dash.example.com/api/admin/lte/review?uploadId=123', {method:'PATCH',headers:{cookie:'sso_access_token=original.jwt; sso_user=forged-admin',origin:'https://dash.example.com','Content-Type':'application/json'},body:'{"title":"edited"}'});
  expect((await callLTE(request,'review')).status).toBe(200);
  const [url,options] = upstream.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.toString()).toBe('https://lte.example.com/api/v1/admin/catalog/review?uploadId=123');
  const headers = new Headers(options.headers);
  expect(headers.get('Authorization')).toBe('Bearer original.jwt');
  expect(headers.has('Cookie')).toBe(false);
  expect(options.method).toBe('PATCH');
  expect(await new Response(options.body).text()).toBe('{"title":"edited"}');
 });
 it('rejects cross-origin and missing-origin cookie mutations before calling LTE', async () => {
  const upstream = vi.fn();vi.stubGlobal('fetch',upstream);
  for (const origin of ['https://evil.example.com', '']) {
   const headers:Record<string,string> = {cookie:'sso_access_token=jwt'};if(origin) headers['origin']=origin;
   expect((await callLTE(new NextRequest('https://dash.example.com/api/admin/lte/publish',{method:'POST',headers,body:'{}'}),'publish')).status).toBe(403);
  }
  expect(upstream).not.toHaveBeenCalled();
 });
 it('fails only the LTE request when endpoint config is missing and preserves auth failures', async () => {
  const request = new NextRequest('https://dash.example.com/api/admin/lte/workspace',{headers:{authorization:'Bearer jwt'}});
  vi.mocked(getCloudflareContext).mockResolvedValue({env:{}} as never);
  expect((await callLTE(request,'workspace')).status).toBe(503);
  vi.mocked(getCloudflareContext).mockResolvedValue({env:{LTE_API_BASE_URL:'https://lte.example.com'}} as never);
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Forbidden'},{status:403})));
  expect((await callLTE(request,'workspace')).status).toBe(403);
 });
 it('streams legacy asset requests through LTE without dashboard R2 access', async () => {
  const upstream = vi.fn(async(_input: RequestInfo | URL, _init?: RequestInit)=>new Response('asset',{headers:{'Content-Type':'application/pdf','Cache-Control':'public, max-age=3600'}}));vi.stubGlobal('fetch',upstream);
  const result = await proxyLTEAsset(new NextRequest('https://dash.example.com/api/admin/lte/assets?key=resources%2Ffile.pdf'));
  expect(await result.text()).toBe('asset');
  expect(result.headers.get('Content-Type')).toBe('application/pdf');
  expect(String(upstream.mock.calls[0]?.[0])).toBe('https://lte.example.com/api/v1/catalog/assets?key=resources%2Ffile.pdf');
 });
 it('signs the exact path and body for machine requests', async () => {
  const upstream = vi.fn(async(_input: RequestInfo | URL, _init?: RequestInit)=>Response.json({success:true}));vi.stubGlobal('fetch',upstream);
  await signedLTERequest({LTE_API_BASE_URL:'https://lte.example.com',LTE_CATALOG_SYNC_SECRET:secret},'/api/v1/internal/catalog/export',{roleIds:['role']});
  const [url,options] = upstream.mock.calls[0] as unknown as [URL,RequestInit];
  const headers = new Headers(options.headers);const timestamp=headers.get('x-lte-timestamp');
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const signature = Uint8Array.from(headers.get('x-lte-signature')!.match(/../g)!,value=>parseInt(value,16));
  expect(await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(`POST\n${url.pathname}\n${timestamp}\n${options.body}`))).toBe(true);
 });
 it('keeps the original queue body and acknowledges only a confirmed result', async () => {
  const upstream = vi.fn().mockResolvedValueOnce(Response.json({success:true})).mockResolvedValueOnce(Response.json({error:'Unavailable'},{status:503}));vi.stubGlobal('fetch',upstream);
  const messages = [1,3].map(attempts=>({body:{uploadId:'upload',assetUrl:'https://drive.google.com/file/d/id/view'},attempts,ack:vi.fn(),retry:vi.fn()}));
  await consumer.queue({messages},{LTE_API_BASE_URL:'https://lte.example.com',LTE_CATALOG_SYNC_SECRET:secret});
  expect(messages[0].ack).toHaveBeenCalledOnce();expect(messages[1].ack).not.toHaveBeenCalled();
  expect(messages[1].retry).toHaveBeenCalledWith({delaySeconds:30});
  expect(JSON.parse(upstream.mock.calls[1][1].body)).toEqual({...messages[1].body,attempts:3});
 });
});
