import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth';
import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

/**
 * GET /api/users - List admin users from admin_users table with pagination, search, and filters
 */
export async function GET(request) {
  try {
    const { rlsClient, error } = await authenticateRequest(request, ['/users']);
    if (error) return error;
    
    // Get parameters from query string
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    const roleFilter = url.searchParams.get('role') || '';
    const activeFilter = url.searchParams.get('active') || '';
    const sortBy = url.searchParams.get('sortBy') || 'granted_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    
    // Build the query for admin users using RLS client
    let adminUsersQuery = rlsClient
      .from('admin_users')
      .select('*', { count: 'exact' });
    
    // Apply role filter
    if (roleFilter && roleFilter !== 'all') {
      adminUsersQuery = adminUsersQuery.eq('admin_role', roleFilter);
    }
    
    // Apply sorting
    const ascending = sortOrder === 'asc';
    if (sortBy === 'granted_at') {
      adminUsersQuery = adminUsersQuery.order('granted_at', { ascending });
    } else if (sortBy === 'admin_role') {
      adminUsersQuery = adminUsersQuery.order('admin_role', { ascending });
    }
    
    // Execute query with pagination
    const { data: adminUsers, error: queryError, count } = await adminUsersQuery.range(offset, offset + limit - 1);

    if (queryError) {
      console.error('Error fetching admin users:', queryError);
      return NextResponse.json({ error: 'Failed to fetch admin users', details: queryError }, { status: 500 });
    }
    
    // Fetch user details for all admin users using RLS client
    const userIds = (adminUsers || []).map(a => a.user_id);
    const grantedByIds = (adminUsers || []).map(a => a.granted_by).filter(Boolean);
    
    let usersMap = {};
    let grantedByMap = {};
    
    if (userIds.length > 0) {
      const { data: usersData } = await rlsClient
        .from('users')
        .select('id, email, isActive, createdAt, metadata')
        .in('id', userIds);
      
      usersData?.forEach(u => {
        usersMap[u.id] = u;
      });
    }
    
    if (grantedByIds.length > 0) {
      const { data: grantedByData } = await rlsClient
        .from('users')
        .select('id, email, metadata')
        .in('id', grantedByIds);
      
      grantedByData?.forEach(u => {
        grantedByMap[u.id] = u;
      });
    }
    
    // Transform the data to match the frontend expectations
    let transformedUsers = (adminUsers || []).map(admin => {
      const user = usersMap[admin.user_id] || {};
      const grantedByUser = admin.granted_by ? grantedByMap[admin.granted_by] : null;
      
      return {
        id: admin.user_id,
        email: user.email,
        isActive: user.isActive,
        role: admin.admin_role,
        createdAt: user.createdAt,
        metadata: user.metadata || {},
        grantedBy: admin.granted_by,
        grantedByEmail: grantedByUser?.email || null,
        grantedByName: grantedByUser?.metadata?.name || null,
        grantedAt: admin.granted_at
      };
    });
    
    // Apply active filter
    if (activeFilter && activeFilter !== 'all') {
      transformedUsers = transformedUsers.filter(u => 
        u.isActive === (activeFilter === 'true')
      );
    }
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      transformedUsers = transformedUsers.filter(user => {
        const email = user.email?.toLowerCase() || '';
        const role = user.role?.toLowerCase() || '';
        const name = user.metadata?.name?.toLowerCase() || '';
        const grantedByEmail = user.grantedByEmail?.toLowerCase() || '';
        
        return email.includes(searchLower) || 
               role.includes(searchLower) || 
               name.includes(searchLower) ||
               grantedByEmail.includes(searchLower);
      });
    }
    
    // Apply email sorting if needed (after filtering)
    if (sortBy === 'email') {
      transformedUsers.sort((a, b) => {
        const emailA = a.email?.toLowerCase() || '';
        const emailB = b.email?.toLowerCase() || '';
        return ascending ? emailA.localeCompare(emailB) : emailB.localeCompare(emailA);
      });
    }
    
    // Return paginated response
    return NextResponse.json({
      data: transformedUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    return handleError(error, 'Users');
  }
}
