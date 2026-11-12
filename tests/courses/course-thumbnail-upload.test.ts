import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const f = vi.hoisted(() => ({ auth: vi.fn(), bucket: { put: vi.fn(), get: vi.fn(), delete: vi.fn() }, runtime: {} as any }));
vi.mock('@/lib/middleware/sso-auth', () => ({ authenticateSSORequest: f.auth }));
vi.mock('@/lib/services/course-assets-r2', () => ({
  getCourseAssetsBucket: async () => f.bucket,
  CourseAssetsBindingError: class extends Error {},
}));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: f.runtime }) }));
import { POST } from '@/app/api/courses/resource-upload/route';
import { GET } from '@/app/api/courses/thumbnails/route';
import consumer from '@/workers/course-upload-consumer';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=', 'base64');
function request(target = 'course-image', internalOrigin = 'http://localhost:3000') {
  const form = new FormData();
  form.append('file', new File([png], 'thumbnail.png', { type: 'image/png' }));
  form.append('resourceType', 'image'); form.append('resourceName', 'Thumbnail'); form.append('uploadTarget', target);
  return new NextRequest(`${internalOrigin}/api/courses/resource-upload`, { method: 'POST', body: form, headers: { host: 'localhost:3000' } });
}
beforeEach(() => {
  vi.clearAllMocks(); f.runtime = {};
  f.auth.mockResolvedValue({ user: { id: 'admin' }, error: null });
  f.bucket.put.mockResolvedValue(undefined); f.bucket.delete.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('R2 thumbnail upload', () => {
  it('uses the browser host when Next.js internally addresses the dev server as 0.0.0.0', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = await POST(request('course-image', 'http://0.0.0.0:3000'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.url).toMatch(/^http:\/\/localhost:3000\/api\/courses\/thumbnails\?/);
  });
  it('writes local thumbnails to the bound R2 bucket and returns an absolute image URL', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = await POST(request()); const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.r2Key).toMatch(/^courses\/thumbnails\//);
    expect(data.url).toBe(`http://localhost:3000/api/courses/thumbnails?key=${encodeURIComponent(data.r2Key)}`);
    expect(f.bucket.put).toHaveBeenCalledWith(data.r2Key, expect.any(Uint8Array), expect.objectContaining({ httpMetadata: { contentType: 'image/png' } }));
  });
  it('keeps lesson resources on the authenticated resource endpoint', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const data = await (await POST(request('resource'))).json();
    expect(data.r2Key).toMatch(/^courses\/resources\//);
    expect(data.url).toMatch(/^\/api\/courses\/assets\?/);
  });
  it('enqueues deployed thumbnails and the worker stores the final image in R2 without Supabase', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const jobs = new Map<string, string>(); const send = vi.fn();
    const kv = { get: async (key: string) => jobs.get(key), put: async (key: string, value: string) => { jobs.set(key, value); }, delete: vi.fn() };
    f.runtime = { COURSE_MANAGEMENT_UPLOAD_QUEUE: { send }, RATE_LIMIT_KV: kv };
    expect((await POST(request())).status).toBe(202);
    const message = send.mock.calls[0][0];
    f.bucket.get.mockResolvedValue({ body: new Blob([png]).stream() });
    const ack = vi.fn(); const retry = vi.fn();
    await consumer.queue({ messages: [{ body: message, ack, retry }] }, { SKILLPASSPORT_ASSETS: f.bucket, RATE_LIMIT_KV: kv } as any);
    expect(f.bucket.put).toHaveBeenLastCalledWith(message.r2Key, expect.any(ReadableStream), expect.objectContaining({ httpMetadata: { contentType: 'image/png' } }));
    const result = JSON.parse([...jobs.values()][0]);
    expect(result.status).toBe('completed'); expect(result.url).toContain('/api/courses/thumbnails?key=');
    expect(f.bucket.delete).toHaveBeenCalledWith(message.stagingKey);
    expect(ack).toHaveBeenCalled(); expect(retry).not.toHaveBeenCalled();
  });
  it('fails deployed uploads when queue bindings are missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await POST(request())).status).toBe(503); expect(f.bucket.put).not.toHaveBeenCalled();
  });
  it('requires an authenticated admin for uploads', async () => {
    f.auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    expect((await POST(request())).status).toBe(401); expect(f.bucket.put).not.toHaveBeenCalled();
  });
});

describe('public thumbnails across applications', () => {
  it('serves raster images without dashboard cookies', async () => {
    f.bucket.get.mockResolvedValue({ body: new Blob([png]).stream(), httpMetadata: { contentType: 'image/png' } });
    const response = await GET(new NextRequest('http://localhost:3000/api/courses/thumbnails?key=courses/thumbnails/2026/11/image.png'));
    expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    expect(f.auth).not.toHaveBeenCalled(); expect(response.headers.get('content-type')).toBe('image/png');
  });
  it.each(['courses/resources/2026/11/private.png', 'courses/thumbnails/2026/11/../private.png', 'courses/thumbnails/2026/11/script.svg'])('does not expose non-thumbnail keys: %s', async key => {
    expect((await GET(new NextRequest(`http://localhost:3000/api/courses/thumbnails?key=${encodeURIComponent(key)}`))).status).toBe(400);
    expect(f.bucket.get).not.toHaveBeenCalled();
  });
  it('rejects executable content even under a thumbnail key', async () => {
    f.bucket.get.mockResolvedValue({ body: new Blob(['<script>']).stream(), httpMetadata: { contentType: 'text/html' } });
    expect((await GET(new NextRequest('http://localhost:3000/api/courses/thumbnails?key=courses/thumbnails/2026/11/image.png'))).status).toBe(415);
  });
});
