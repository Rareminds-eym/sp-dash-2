import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/universities - List all universities with pagination, search, and filters
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const approvalStatus = url.searchParams.get('approval_status');
    const accountStatus = url.searchParams.get('account_status');
    const searchTerm = url.searchParams.get('search');
    
    // Build query
    let query = supabase.from('universities').select('*', { count: 'exact' });
    
    // Apply filters
    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }
    if (accountStatus) {
      query = query.eq('account_status', accountStatus);
    }
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`);
    }
    
    // Apply sorting (newest first by default)
    query = query.order('createdat', { ascending: false });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: universities, error, count } = await query;

    if (error) {
      console.error('Error fetching universities:', error);
      return NextResponse.json({ error: 'Failed to fetch universities' }, { status: 500 });
    }

    // Normalize field names to match frontend expectations
    const normalizedUniversities = (universities || []).map(university => ({
      ...university,
      created_at: university.createdat,
    }));

    const response = NextResponse.json({
      data: normalizedUniversities || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
    
    return addCacheHeaders(response, 'static');
  } catch (error) {
    return handleError(error, 'Universities');
  }
}
