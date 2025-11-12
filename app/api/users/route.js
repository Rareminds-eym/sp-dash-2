import { authenticateRequest } from '@/lib/middleware/auth';
import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

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

/**
 * POST /api/users - Create a new admin user in Supabase and admin_users table
 */
export async function POST(request) {
  try {
    const { rlsClient, session, error } = await authenticateRequest(request, ['/users']);
    if (error) return error;
    
    // Parse request body
    const body = await request.json();
    const { email, firstName, lastName, role } = body;
    
    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return NextResponse.json({
        success: false,
        error: 'Email, first name, last name, and role are required'
      }, { status: 400 });
    }
    
    // Validate role
    if (!['super_admin', 'platform_admin'].includes(role)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid role. Must be super_admin or platform_admin'
      }, { status: 400 });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email format'
      }, { status: 400 });
    }
    
    // Create user in Supabase Auth with admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false, // User needs to verify email
      user_metadata: {
        name: fullName,
        role: 'admin'
      }
    });
    
    if (authError) {
      console.error('Error creating user in Supabase Auth:', authError);
      return NextResponse.json({
        success: false,
        error: authError.message || 'Failed to create user in authentication system'
      }, { status: 500 });
    }
    
    const newUserId = authData.user.id;
    
    try {
      // Insert user record in users table using supabaseAdmin
      // Set isActive to false until they verify their email and set password
      // Assign to Rareminds organization by default
      const { error: userInsertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: newUserId,
          email: email,
          role: 'platform_admin', // Set role as platform_admin for admin users
          isActive: false,
          organizationId: '3c5c2637-9f1e-4b68-83a3-bdc4d1a92f00', // Rareminds organization
          createdAt: new Date().toISOString(),
          metadata: {
            name: fullName,
            emailVerificationPending: true
          }
        });
      
      if (userInsertError) {
        console.error('Error inserting user in users table:', userInsertError);
        // Rollback: Delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return NextResponse.json({
          success: false,
          error: 'Failed to create user record'
        }, { status: 500 });
      }
      
      // Insert admin role in admin_users table
      const { error: adminInsertError } = await supabaseAdmin
        .from('admin_users')
        .insert({
          user_id: newUserId,
          admin_role: role,
          granted_by: session?.user?.id || null,
          granted_at: new Date().toISOString()
        });
      
      if (adminInsertError) {
        console.error('Error inserting admin role:', adminInsertError);
        // Rollback: Delete user from users table and auth
        await supabaseAdmin.from('users').delete().eq('id', newUserId);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return NextResponse.json({
          success: false,
          error: 'Failed to assign admin role'
        }, { status: 500 });
      }
      
      // Send password reset email to the new admin
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/reset-password`
      });
      
      if (resetError) {
        console.error('Error sending password reset email:', resetError);
        // Don't rollback - user is created, just notify about email issue
        return NextResponse.json({
          success: true,
          message: `Admin user created successfully, but failed to send password reset email: ${resetError.message || 'Unknown error'}. Please contact the user directly.`,
          data: {
            id: newUserId,
            email,
            role,
            fullName
          },
          emailError: resetError.message || 'Unknown error'
        });
      }
      
      return NextResponse.json({
        success: true,
        message: `Admin user created successfully. Password reset email sent to ${email}`,
        data: {
          id: newUserId,
          email,
          role,
          fullName
        }
      });
      
    } catch (innerError) {
      // Rollback: Delete the auth user if any error occurs
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw innerError;
    }
    
  } catch (error) {
    console.error('Error in POST /api/users:', error);
    return handleError(error, 'Create Admin User');
  }
}
