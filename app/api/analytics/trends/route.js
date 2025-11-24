import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleError } from '@/lib/middleware/errorHandler';
import { authenticateRequest } from '@/lib/middleware/auth';

export const runtime = 'edge';

/**
 * GET /api/analytics/trends - Employability trends
 */
export async function GET(request) {
  try {
    const { rlsClient, error } = await authenticateRequest(request, ['/api/metrics']);
    if (error) return error;

    const { data: metrics, error: dbError } = await supabaseAdmin
      .from('metrics_snapshots')
      .select('*')
      .order('snapshotDate', { ascending: true })
      .limit(30);

    if (dbError) throw dbError;

    const chartData = metrics.map(m => ({
      date: m.snapshotDate,
      employability: parseFloat(m.employabilityIndex) || 0
    }));

    return NextResponse.json(chartData);
  } catch (error) {
    return handleError(error, 'Trends Analytics');
  }
}
