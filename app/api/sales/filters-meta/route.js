import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { error } = await authenticateSSORequest(request, ['super_admin', 'admin', 'rm_admin']);
    if (error) return error;

    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();
    const meta = await ssoClient.getSalesFilterMeta();

    return NextResponse.json(meta, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' },
    });
  } catch (error) {
    console.error('[FiltersMeta] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter metadata' },
      { status: 500 },
    );
  }
}
