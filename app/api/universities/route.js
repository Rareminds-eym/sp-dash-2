import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
    const state = url.searchParams.get('state');
    const sortBy = url.searchParams.get('sort') || 'date-newest';
    
    // Build query - using supabaseAdmin to bypass RLS for admin operations
    let query = supabaseAdmin.from('universities').select('*', { count: 'exact' });
    
    // Apply filters
    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }
    if (accountStatus) {
      query = query.eq('account_status', accountStatus);
    }
    if (state && state !== 'all') {
      query = query.eq('state', state);
    }
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
    }
    
    // Apply sorting
    switch(sortBy) {
      case 'name-asc':
        query = query.order('name', { ascending: true });
        break;
      case 'name-desc':
        query = query.order('name', { ascending: false });
        break;
      case 'date-oldest':
        query = query.order('createdat', { ascending: true });
        break;
      case 'state-asc':
        query = query.order('state', { ascending: true });
        break;
      case 'date-newest':
      default:
        query = query.order('createdat', { ascending: false });
        break;
    }
    
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
