import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/users/organizations - Get unique organizations for filter dropdown
 */
export async function GET(request) {
  try {
    // Fetch from universities, recruiters, and organizations tables
    const [universitiesResult, recruitersResult, orgsResult] = await Promise.all([
      supabaseAdmin.from('universities').select('id, name').order('name', { ascending: true }),
      supabaseAdmin.from('recruiters').select('id, name').order('name', { ascending: true }),
      supabaseAdmin.from('organizations').select('id, name').order('name', { ascending: true })
    ]);
    
    const organizations = [
      ...(universitiesResult.data || []),
      ...(recruitersResult.data || []),
      ...(orgsResult.data || [])
    ].sort((a, b) => a.name.localeCompare(b.name));
    
    return NextResponse.json(organizations);
  } catch (error) {
    return handleError(error, 'Users Organizations');
  }
}
