import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/recruiters/states - Get unique states for filter dropdown
 */
export async function GET(request) {
  try {
    const { data: recruiters } = await supabase
      .from('recruiters')
      .select('state')
      .not('state', 'is', null);
    
    const uniqueStates = [...new Set(recruiters?.map(r => r.state).filter(Boolean))].sort();
    
    return NextResponse.json(uniqueStates);
  } catch (error) {
    return handleError(error, 'Recruiter States');
  }
}
