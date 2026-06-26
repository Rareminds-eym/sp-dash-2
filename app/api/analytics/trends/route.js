export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleError } from '@/lib/middleware/errorHandler';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';



/**
 * GET /api/analytics/trends - Employability trends
 */
export async function GET(request) {
  try {
    const { error } = await authenticateSSORequest(request, ['super_admin', 'admin']);
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
