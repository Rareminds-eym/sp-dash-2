import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/analytics/state-wise - State-wise distribution
 */
export async function GET(request) {
  try {
    // Fetch from both universities and recruiters tables
    const [universitiesResult, recruitersResult] = await Promise.all([
      supabaseAdmin.from('universities').select('state'),
      supabaseAdmin.from('recruiters').select('state')
    ]);

    if (universitiesResult.error) throw universitiesResult.error;
    if (recruitersResult.error) throw recruitersResult.error;

    const stateCounts = {};
    
    // Count universities by state
    universitiesResult.data?.forEach(univ => {
      if (univ.state) {
        stateCounts[univ.state] = (stateCounts[univ.state] || 0) + 1;
      }
    });
    
    // Count recruiters by state
    recruitersResult.data?.forEach(rec => {
      if (rec.state) {
        stateCounts[rec.state] = (stateCounts[rec.state] || 0) + 1;
      }
    });

    const chartData = Object.entries(stateCounts).map(([state, count]) => ({
      state,
      count
    }));

    const response = NextResponse.json(chartData);
    return addCacheHeaders(response, 'dynamic');
  } catch (error) {
    return handleError(error, 'State-wise Analytics');
  }
}
