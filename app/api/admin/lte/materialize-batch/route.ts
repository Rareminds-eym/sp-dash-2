import { NextRequest, NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
  if (authError || !user) return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(
    {
      success: false,
      error: 'Batch materialization is no longer required. Existing levels are the course catalog records.',
    },
    { status: 410 }
  );
}
