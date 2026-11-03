import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/organizations
 * List all organizations for dropdown selection
 */
export async function GET(request) {
  try {
    const { data: organizations, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: organizations || []
    });

  } catch (error) {
    console.error('Error in GET /api/organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
