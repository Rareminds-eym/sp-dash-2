import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { getR2Bucket } from '@/lib/services/lte-ingestion/r2-runtime';

const logger = new Logger('LTEAssetsAPI');

export const runtime = 'nodejs';

function isAllowedAssetKey(key: string): boolean {
  return key.startsWith('lte/resources/') && !key.includes('..') && !key.startsWith('/');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const key = request.nextUrl.searchParams.get('key') || '';
    if (!key || !isAllowedAssetKey(key)) {
      return NextResponse.json({ success: false, error: 'Invalid asset key' }, { status: 400 });
    }

    const bucket = await getR2Bucket();
    const object = await bucket.get(key);
    if (!object) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    return new NextResponse(object.body, {
      status: 200,
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to serve LTE asset', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
