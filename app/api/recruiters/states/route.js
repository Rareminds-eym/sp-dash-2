import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/recruiters/states - Get unique states for filter dropdown
 */
export async function GET(request) {
  try {
    const { data: recruiters, error } = await supabaseAdmin
      .from('recruiters')
      .select('state')
      .not('state', 'is', null);
    
    if (error) throw error;
    
    const uniqueStates = [...new Set(recruiters?.map(r => r.state).filter(Boolean))].sort();
    
    return NextResponse.json(uniqueStates);
  } catch (error) {
    return handleError(error, 'Recruiter States');
  }
}
