import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/users/organizations - Get unique organizations for filter dropdown
 */
export async function GET(request) {
  try {
    // Fetch from both universities and recruiters tables
    const [universitiesResult, recruitersResult] = await Promise.all([
      supabase.from('universities').select('id, name').order('name', { ascending: true }),
      supabase.from('recruiters').select('id, name').order('name', { ascending: true })
    ]);
    
    const organizations = [
      ...(universitiesResult.data || []),
      ...(recruitersResult.data || [])
    ].sort((a, b) => a.name.localeCompare(b.name));
    
    return NextResponse.json(organizations);
  } catch (error) {
    return handleError(error, 'Users Organizations');
  }
}
