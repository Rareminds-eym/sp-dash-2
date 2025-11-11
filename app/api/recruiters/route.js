import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { filterAndRankResults } from '@/lib/search-utils';
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
    const statusFilter = url.searchParams.get('status');
    const activeFilter = url.searchParams.get('active');
    const stateFilter = url.searchParams.get('state');
    const searchTerm = url.searchParams.get('search');
    
    // Sorting parameters
    const sortBy = url.searchParams.get('sortBy') || 'createdat';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    
    // Build query
    let query = supabase.from('recruiters').select('*', { count: 'exact' });
    
    // Apply filters
    if (statusFilter) {
      query = query.eq('verificationstatus', statusFilter);
    }
    if (activeFilter !== null && activeFilter !== '') {
      query = query.eq('isactive', activeFilter === 'true');
    }
    if (stateFilter) {
      query = query.eq('state', stateFilter);
    }
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,website.ilike.%${searchTerm}%`);
    }
    
    // Apply sorting
    const sortField = sortBy === 'name' ? 'name' : sortBy === 'userCount' ? 'createdat' : sortBy;
    query = query.order(sortField, { ascending: sortOrder === 'asc' });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: recruiters, error, count } = await query;

    if (error) {
      console.error('Error fetching recruiters:', error);
      return NextResponse.json({ error: 'Failed to fetch recruiters' }, { status: 500 });
    }

    // Fetch all users in bulk and count by organization
    let userCountMap = {};
    if (recruiters && recruiters.length > 0) {
      const recruiterIds = recruiters.map(r => r.id);
      
      const { data: users } = await supabase
        .from('users')
        .select('id, organizationId')
        .in('organizationId', recruiterIds);
      
      // Count users by organization
      users?.forEach(user => {
        userCountMap[user.organizationId] = (userCountMap[user.organizationId] || 0) + 1;
      });
    }
    
    // Map recruiters to expected format and normalize field names
    let mappedRecruiters = (recruiters || []).map(recruiter => ({
      id: recruiter.id,
      name: recruiter.name,
      type: 'recruiter',
      state: recruiter.state,
      email: recruiter.email,
      phone: recruiter.phone,
      website: recruiter.website,
      address: recruiter.address,
      district: recruiter.district,
      verificationStatus: recruiter.verificationstatus || 'approved',
      isActive: recruiter.isactive !== undefined ? recruiter.isactive : true,
      createdAt: recruiter.createdat,
      created_at: recruiter.createdat,
      updatedAt: recruiter.updatedat,
      userCount: userCountMap[recruiter.id] || 0
    }));
    
    // Apply industrial-grade fuzzy search and relevance ranking (client-side for accuracy)
    if (searchTerm) {
      const searchFields = ['name', 'email', 'phone', 'district', 'website', 'state'];
      mappedRecruiters = filterAndRankResults(mappedRecruiters, searchFields, searchTerm, 0.7);
    }
    
    // Sort by user count if requested (can't do this in SQL easily with join)
    if (sortBy === 'userCount') {
      mappedRecruiters.sort((a, b) => {
        return sortOrder === 'asc' ? a.userCount - b.userCount : b.userCount - a.userCount;
      });
    }
    
    const response = NextResponse.json({
      data: mappedRecruiters,
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
