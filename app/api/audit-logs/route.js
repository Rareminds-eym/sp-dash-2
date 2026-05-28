import { NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { filterAndRankResults } from '@/lib/search-utils';
import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET /api/audit-logs - List audit logs with pagination, filtering, and search
 */
export async function GET(request) {
  try {
    const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin']);
    if (error) return error;
    
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    
    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Build query using RLS client
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }
    
    if (userId) {
      query = query.eq('actorId', userId);
    }
    
    if (dateFrom) {
      query = query.gte('createdAt', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('createdAt', dateTo);
    }
    
    if (search) {
      query = query.or(`target.ilike.%${search}%,action.ilike.%${search}%,ip.ilike.%${search}%`);
    }
    
    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: logs, error: queryError, count } = await query;

    if (queryError) {
      console.error('Error fetching audit logs:', queryError);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }
    
    // Fetch all user emails in bulk using RLS client
    let enrichedLogs = logs || [];
    if (enrichedLogs.length > 0) {
      const userIds = enrichedLogs.map(l => l.actorId).filter(Boolean);
      
      if (userIds.length > 0) {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('id, email, metadata')
          .in('id', userIds);
        
        const userMap = {};
        users?.forEach(user => { 
          userMap[user.id] = {
            id: user.id,
            email: user.email,
            name: user.metadata?.name || user.email
          };
        });
        
        enrichedLogs.forEach(log => {
          if (log.actorId && userMap[log.actorId]) {
            log.users = userMap[log.actorId];
          }
        });
      }
    }
    
    // Apply industrial-grade fuzzy search and relevance ranking (client-side for accuracy)
    if (search) {
      const searchFields = ['target', 'action', 'ip', 'users.email', 'users.name'];
      enrichedLogs = filterAndRankResults(enrichedLogs, searchFields, search, 0.7);
    }
    
    return NextResponse.json({
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    return handleError(error, 'Audit Logs');
  }
}
