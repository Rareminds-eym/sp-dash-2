import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@/lib/middleware/sso-auth', () => ({ authenticateSSORequest: vi.fn(async () => ({ user: { id: 'admin' }, error: null })) }));
vi.mock('@/app/api/courses/resource-upload/route', () => ({ POST: mocks.upload }));
import { POST } from '@/app/api/courses/import-google/route';

function request(url: string) {
  return new NextRequest('http://localhost/api/courses/import-google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, name: 'Slides.ppt' }) });
}

describe('Google course resource import', () => {
  afterEach(() => { vi.restoreAllMocks(); mocks.upload.mockReset(); });
  it('exports Google Slides and hands the PPTX to the existing uploader', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([0x50, 0x4b, 3, 4])));
    mocks.upload.mockResolvedValue(NextResponse.json({ success: true }));
    const response = await POST(request('https://docs.google.com/presentation/d/abc/edit'));
    expect(response.status).toBe(200);
    const form = await mocks.upload.mock.calls[0][0].formData();
    expect((form.get('file') as File).name).toBe('Slides.pptx');
    expect(form.get('resourceType')).toBe('document');
  });
  it('rejects non-Google URLs and redirects to untrusted hosts', async () => {
    expect((await POST(request('https://example.com/presentation/d/abc/edit'))).status).toBe(400);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }));
    expect((await POST(request('https://docs.google.com/presentation/d/abc/edit'))).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
