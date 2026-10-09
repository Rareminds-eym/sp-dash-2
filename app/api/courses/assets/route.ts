import { NextRequest, NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { getCourseAssetsBucket, CourseAssetsBindingError, isAllowedCourseAssetKey } from '@/lib/services/course-assets-r2';
import { sanitizeContentDispositionFilename } from '@/lib/services/course-resource-validation';

export const runtime = 'nodejs';

/** Parse a single `bytes=start-end` Range header. Returns null when malformed. */
function parseRangeHeader(header: string | null, size: number): { start: number; end: number } | null {
  if (!header || !header.startsWith('bytes=')) return null;
  const spec = header.slice('bytes='.length).trim().split(',')[0].trim();
  const match = spec.match(/^(\d*)-(\d*)$/);
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (startStr === '' && endStr === '') return null;
  if (startStr === '') {
    // Suffix range: last N bytes.
    const suffix = Number(endStr);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    if (size === 0) return null;
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }
  const start = Number(startStr);
  if (!Number.isSafeInteger(start) || start < 0) return null;
  const end = endStr === '' ? size - 1 : Number(endStr);
  if (!Number.isSafeInteger(end) || end < 0) return null;
  return { start, end };
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * GET /api/courses/assets?key={r2Key} - Serve files from the COURSE_ASSETS R2 bucket.
 *
 * Authenticated: course resources are private. Unpredictable R2 keys are NOT
 * treated as a security control — a valid SSO session with a course role is
 * required. Browser <img>/<video>/<a> navigations send cookies, so direct
 * embedding keeps working for signed-in users.
 *
 * Supports HTTP byte-range requests (206 Partial Content) for HTML5 video
 * seeking. Range is served via R2 ranged reads when the binding supports
 * them, with a bounded single-buffer fallback otherwise.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await authenticateSSORequest(request, [
      'super_admin',
      'admin',
      'rm_admin',
      'educator',
      'college_admin',
      'university_admin',
    ]);
    if (authError) return authError;

    const key = request.nextUrl.searchParams.get('key') || '';
    if (!key || !isAllowedCourseAssetKey(key)) {
      return NextResponse.json({ success: false, error: 'Invalid asset key' }, { status: 400 });
    }

    const bucket = await getCourseAssetsBucket().catch((err) => {
      if (err instanceof CourseAssetsBindingError) return null;
      throw err;
    });
    if (!bucket) {
      return NextResponse.json(
        { success: false, error: 'Resource storage is not configured. Contact support.' },
        { status: 503 }
      );
    }
    const object = await bucket.get(key);
    if (!object || !object.body) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    // SVG can carry executable script: never render inline, always download.
    const isSvg = key.toLowerCase().endsWith('.svg') || contentType === 'image/svg+xml';
    const fileName = sanitizeContentDispositionFilename(key.split('/').pop() || 'download');
    const baseHeaders: Record<string, string> = {
      'Content-Type': isSvg ? 'image/svg+xml' : contentType,
      'Content-Disposition': `${isSvg ? 'attachment' : 'inline'}; filename="${fileName}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };

    const rangeHeader = request.headers.get('range');
    if (!rangeHeader) {
      return new NextResponse(object.body, { status: 200, headers: baseHeaders });
    }

    // Range request: resolve total size (metadata or single buffered read).
    let bytes = object.size !== undefined ? null : await streamToBytes(object.body);
    const totalSize = object.size ?? bytes?.byteLength ?? 0;
    const range = parseRangeHeader(rangeHeader, totalSize);
    if (!range || range.start >= totalSize || range.end >= totalSize || range.end < range.start) {
      return new NextResponse('Range Not Satisfiable', {
        status: 416,
        headers: { ...baseHeaders, 'Content-Range': `bytes */${totalSize}` },
      });
    }
    const length = range.end - range.start + 1;

    // Prefer a ranged R2 read; fall back to slicing the buffered copy.
    let body: ReadableStream<Uint8Array> | Uint8Array;
    try {
      const ranged = await bucket.get(key, { range: { offset: range.start, length } });
      if (ranged?.body) {
        body = ranged.body;
      } else {
        bytes = bytes ?? (await streamToBytes(object.body));
        body = bytes.slice(range.start, range.end + 1);
      }
    } catch {
      bytes = bytes ?? (await streamToBytes(object.body));
      body = bytes.slice(range.start, range.end + 1);
    }

    return new NextResponse(body as BodyInit, {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
        'Content-Length': String(length),
      },
    });
  } catch (error) {
    console.error('[Course Assets] Failed to serve asset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to serve asset', details: (error as Error).message },
      { status: 500 }
    );
  }
}
