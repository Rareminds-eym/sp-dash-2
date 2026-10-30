import { NextRequest, NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { POST as uploadResource } from '../resource-upload/route';

export const runtime = 'nodejs';
const MAX_BYTES = 500 * 1024 * 1024;

/** Import publicly accessible Google Docs/Slides through the normal R2 upload flow. */
export async function POST(request: NextRequest) {
  const { user, error } = await authenticateSSORequest(request, ['admin', 'super_admin', 'rm_admin', 'platform_admin']);
  if (error || !user) return error || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { url?: string; name?: string };
    const source = new URL(body.url || '');
    const match = source.hostname === 'docs.google.com' && source.protocol === 'https:'
      ? source.pathname.match(/^\/(presentation|document)\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/) : null;
    if (!match) return NextResponse.json({ success: false, error: 'Only Google Slides and Docs links are supported' }, { status: 400 });
    const [, kind, id] = match;
    const ext = kind === 'presentation' ? 'pptx' : 'docx';
    let url = new URL(`https://docs.google.com/${kind}/d/${id}/export?format=${ext}`);
    let response: Response | undefined;
    const signal = AbortSignal.timeout(120000);
    for (let i = 0; i < 6; i++) {
      response = await fetch(url, { redirect: 'manual', signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) throw new Error('Google returned an invalid redirect');
      const next = new URL(location, url);
      if (next.protocol !== 'https:' || !(next.hostname === 'docs.google.com' || next.hostname === 'googleusercontent.com' || next.hostname.endsWith('.googleusercontent.com'))) {
        throw new Error('Google file is not publicly accessible or requires a login');
      }
      url = next;
    }
    if (!response?.ok || !response.body) throw new Error('Could not download the Google file. Check its sharing settings.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Google file exceeds the 500 MB limit'); }
      chunks.push(value);
    }
    const blob = new Blob(chunks);
    const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    // A login or error page is not an Office document.
    if (size < 4 || signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error('Google did not return an Office file. Check its sharing settings.');
    const name = `${String(body.name || 'presentation').replace(/\.(pptx?|docx?)$/i, '').slice(0, 200)}.${ext}`;
    const form = new FormData();
    form.append('file', new File([blob], name));
    form.append('resourceType', 'document');
    form.append('resourceName', name);
    const headers = new Headers();
    for (const key of ['authorization', 'cookie']) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    return uploadResource(new NextRequest(new URL('/api/courses/resource-upload', request.url), { method: 'POST', headers, body: form }));
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Google import failed' }, { status: 400 });
  }
}
