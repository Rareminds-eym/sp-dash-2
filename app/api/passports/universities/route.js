import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/passports/universities - Get unique universities for filter dropdown
 */
export async function GET(request) {
  try {
    const { data: universities } = await supabase
      .from('universities')
      .select('id, name')
      .order('name', { ascending: true });
    
    return NextResponse.json(universities || []);
  } catch (error) {
    return handleError(error, 'Passport Universities');
  }
}
