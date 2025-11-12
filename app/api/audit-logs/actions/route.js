import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/audit-logs/actions - Get unique action types
 */
export async function GET(request) {
  try {
    const { data: logs, error } = await supabaseAdmin
      .from('audit_logs')
      .select('action')
      .limit(1000);

    if (error) {
      console.error('Error fetching action types:', error);
      return NextResponse.json({ error: 'Failed to fetch action types' }, { status: 500 });
    }

    const uniqueActions = [...new Set(logs.map(l => l.action))].filter(Boolean).sort();
    return NextResponse.json(uniqueActions);
  } catch (error) {
    console.error('Error fetching action types:', error);
    return NextResponse.json([], { status: 500 });
  }
}
