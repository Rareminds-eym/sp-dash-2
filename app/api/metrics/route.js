import { NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { getDashboardMetrics } from '@/lib/services/metricsService';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET /api/metrics - Dashboard metrics
 */
export async function GET(request) {
  try {
    const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin']);
    if (error) return error;

    const metrics = await getDashboardMetrics(supabaseAdmin);
    const response = NextResponse.json(metrics);
    return addCacheHeaders(response, 'dynamic');
  } catch (error) {
    return handleError(error, 'Metrics');
  }
}
