import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/passports/universities - Get unique universities for filter dropdown
 */
export async function GET(request) {
  try {
    const { data: universities } = await supabaseAdmin
      .from('universities')
      .select('id, name')
      .order('name', { ascending: true });
    
    return NextResponse.json(universities || []);
  } catch (error) {
    console.error('Error fetching universities:', error);
    return NextResponse.json([], { status: 500 });
  }
}
