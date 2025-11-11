import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/analytics/trends - Employability trends
 */
export async function GET(request) {
  try {
    const { data: metrics, error } = await supabase
      .from('metrics_snapshots')
      .select('*')
      .order('snapshotDate', { ascending: true })
      .limit(30);

    if (error) throw error;

    const chartData = metrics.map(m => ({
      date: m.snapshotDate,
      employability: parseFloat(m.employabilityIndex) || 0
    }));

    return NextResponse.json(chartData);
  } catch (error) {
    return handleError(error, 'Trends Analytics');
  }
}
