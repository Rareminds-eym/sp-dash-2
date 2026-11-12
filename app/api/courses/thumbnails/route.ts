import { NextRequest, NextResponse } from 'next/server';
import { getCourseAssetsBucket, CourseAssetsBindingError } from '@/lib/services/course-assets-r2';
import { isCourseThumbnailKey } from '@/lib/services/course-resource-validation';

export const runtime = 'nodejs';

// Public catalog images must load in SkillPassport without dashboard admin cookies.
// The dedicated prefix and raster MIME allowlist never expose private course files.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') || '';
  if (!isCourseThumbnailKey(key)) return NextResponse.json({ error: 'Invalid thumbnail key' }, { status: 400 });
  try {
    const bucket = await getCourseAssetsBucket();
    const object = await bucket.get(key);
    if (!object?.body) return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    const contentType = object.httpMetadata?.contentType || '';
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) {
      return NextResponse.json({ error: 'Invalid thumbnail type' }, { status: 415 });
    }
    return new NextResponse(object.body, { headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    } });
  } catch (error) {
    console.error('[Course Thumbnail] R2 read failed', error);
    return NextResponse.json({ error: 'Thumbnail storage unavailable' }, {
      status: error instanceof CourseAssetsBindingError ? 503 : 500,
    });
  }
}
