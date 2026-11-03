import { requireEducatorAdmin } from '@/lib/educator-admin';
import { getSharedAssetsBucket } from '@/lib/services/course-assets-r2';

export async function GET(request) {
  const auth = await requireEducatorAdmin(request);
  if (auth.error) return auth.error;
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!/^educator-documents\/[A-Za-z0-9_-]{1,100}\/(degree-certificate|id-proof|experience-letters)-[a-f0-9]{16}\.(pdf|jpg|png)$/.test(key)) {
    return Response.json({ error: 'Invalid document key' }, { status: 400 });
  }
  try {
    const bucket = await getSharedAssetsBucket();
    const object = await bucket.get(key);
    if (!object?.body) return Response.json({ error: 'Document not found' }, { status: 404 });
    return new Response(object.body, { headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return Response.json({ error: 'Document storage unavailable' }, { status: 503 });
  }
}
