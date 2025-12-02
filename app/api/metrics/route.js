import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth';
import { getDashboardMetrics } from '@/lib/services/metricsService';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/metrics - Dashboard metrics
 */
export async function GET(request) {
  try {
    const { rlsClient, error } = await authenticateRequest(request, ['/api/metrics']);
    if (error) return error;

    const metrics = await getDashboardMetrics(rlsClient);
    const response = NextResponse.json(metrics);
    return addCacheHeaders(response, 'dynamic');
  } catch (error) {
    return handleError(error, 'Metrics');
  }
}
