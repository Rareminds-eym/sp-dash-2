import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/recruiters - List all recruiters with pagination, search, and filters
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
    
    // Build query - fetch recruiters with their associated user data and company info
    let query = supabaseAdmin
      .from('recruiters')
      .select(`
        *,
        users:user_id (
          id,
          email,
          metadata
        ),
        companies:company_id (
          id,
          name,
          state,
          city
        )
      `, { count: 'exact' });
    
    // Apply filters
    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }
    if (accountStatus) {
      query = query.eq('account_status', accountStatus);
    }
    if (searchTerm) {
      // Search in recruiter name and email from users table
      query = query.or(`users.email.ilike.%${searchTerm}%,users.metadata->>name.ilike.%${searchTerm}%`);
    }
    
    // Apply sorting (newest first by default)
    query = query.order('createdat', { ascending: false });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: recruiters, error, count } = await query;

    if (error) {
      console.error('Error fetching recruiters:', error);
      return NextResponse.json({ error: 'Failed to fetch recruiters' }, { status: 500 });
    }

    // Normalize data to match frontend expectations
    const normalizedRecruiters = (recruiters || []).map(recruiter => {
      const userName = recruiter.users?.metadata?.name || recruiter.users?.metadata?.first_name || 'Unknown';
      const companyState = recruiter.companies?.state || null;
      
      return {
        ...recruiter,
        name: userName,
        email: recruiter.users?.email,
        state: companyState,
        phone: recruiter.users?.metadata?.phone || recruiter.phone || null,
        created_at: recruiter.createdat,
      };
    });

    const response = NextResponse.json({
      data: normalizedRecruiters || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
    
    return addCacheHeaders(response, 'static');
  } catch (error) {
    return handleError(error, 'Recruiters');
  }
}
