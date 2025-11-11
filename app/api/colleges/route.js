import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/colleges - List all colleges with pagination, search, and filters
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
    const collegeType = url.searchParams.get('college_type');
    const searchTerm = url.searchParams.get('search');
    
    // Build query
    let query = supabase.from('colleges').select('*', { count: 'exact' });
    
    // Apply filters
    if (approvalStatus) {
      query = query.eq('approvalStatus', approvalStatus);
    }
    if (accountStatus) {
      query = query.eq('accountStatus', accountStatus);
    }
    if (collegeType) {
      query = query.eq('collegeType', collegeType);
    }
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`);
    }
    
    // Apply sorting (newest first by default)
    query = query.order('createdAt', { ascending: false });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: colleges, error, count } = await query;

    if (error) {
      console.error('Error fetching colleges:', error);
      return NextResponse.json({ error: 'Failed to fetch colleges' }, { status: 500 });
    }

    // Normalize field names to match frontend expectations
    const normalizedColleges = (colleges || []).map(college => ({
      ...college,
      created_at: college.createdAt,
    }));

    const response = NextResponse.json({
      data: normalizedColleges,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
    
    return addCacheHeaders(response, 'static');
  } catch (error) {
    return handleError(error, 'Colleges');
  }
}
