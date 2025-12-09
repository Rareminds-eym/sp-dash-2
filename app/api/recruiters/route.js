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
    const accountStatus = url.searchParams.get('account_status'); // active/inactive
    const verificationStatus = url.searchParams.get('verification_status');
    const searchTerm = url.searchParams.get('search');
    const state = url.searchParams.get('state');
    const sortBy = url.searchParams.get('sort') || 'date-newest';

    // Build query - using supabaseAdmin to bypass RLS for admin operations
    let query = supabaseAdmin.from('recruiters').select('*', { count: 'exact' });

    // Apply filters
    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }
    if (accountStatus) {
      // Map 'active'/'inactive' to boolean isactive if needed, or check schema.
      // Based on schema inspection: 'isactive' is boolean, 'account_status' is text (e.g. 'active').
      // Let's support both or prioritize one. The schema showed 'account_status': 'active' and 'isactive': true.
      // Let's use account_status column if provided, or isactive.
      // The schema has both. Let's assume account_status is the main one for now or check usage.
      // Inspect output showed: account_status: 'active', isactive: true.
      // Let's filter by account_status if provided.
      if (accountStatus === 'active' || accountStatus === 'inactive') {
        query = query.eq('account_status', accountStatus);
      }
    }
    if (verificationStatus) {
      query = query.eq('verificationstatus', verificationStatus);
    }

    if (state && state !== 'all') {
      query = query.eq('state', state);
    }
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,website.ilike.%${searchTerm}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'name-asc':
        query = query.order('name', { ascending: true });
        break;
      case 'name-desc':
        query = query.order('name', { ascending: false });
        break;
      case 'date-oldest':
        query = query.order('createdat', { ascending: true });
        break;
      case 'date-newest':
      default:
        query = query.order('createdat', { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: recruiters, error, count } = await query;

    if (error) {
      // Handle range error gracefully
      if (error.code === 'PGRST103' || error.message?.includes('range')) {
        return NextResponse.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        });
      }
      console.error('Error fetching recruiters:', error);
      return NextResponse.json({ error: 'Failed to fetch recruiters' }, { status: 500 });
    }

    // If offset is beyond total count, return empty result
    if (count !== null && offset >= count) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
      });
    }

    // Deduplicate recruiters by ID to handle potential database duplicates
    const uniqueRecruitersMap = new Map();
    (recruiters || []).forEach(recruiter => {
      if (!uniqueRecruitersMap.has(recruiter.id)) {
        uniqueRecruitersMap.set(recruiter.id, recruiter);
      }
    });
    const uniqueRecruiters = Array.from(uniqueRecruitersMap.values());

    // Normalize field names if needed (e.g. createdat -> created_at)
    const normalizedRecruiters = uniqueRecruiters.map(recruiter => ({
      ...recruiter,
      created_at: recruiter.createdat,
      updated_at: recruiter.updatedat,
    }));

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

/**
 * POST /api/recruiters - Create a new recruiter
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.name || !body.email) {
      return NextResponse.json({ error: 'Name and Email are required' }, { status: 400 });
    }

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      email_confirm: true, // Auto-confirm for now to simplify, or false if we want verification flow
      user_metadata: {
        name: body.name,
        role: 'recruiter'
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: 'Failed to create user account', details: authError.message }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. Insert into users table (public profile)
    // Split name into first and last name for users table
    const nameParts = body.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const { error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: body.email,
        firstName: firstName,
        lastName: lastName,
        role: 'recruiter', // Assuming 'recruiter' is a valid role enum
        isActive: true, // Auto-active for now
        // organizationId: '...', // specific org or null
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'recruiter_management'
        }
      });

    if (userInsertError) {
      console.error('Error inserting user profile:', userInsertError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to create user profile', details: userInsertError.message }, { status: 500 });
    }

    // 3. Prepare data for insertion
    const newRecruiter = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      website: body.website,
      state: body.state,
      user_id: userId, // Link to auth user
      // Defaults
      isactive: true,
      account_status: 'active',
      verificationstatus: 'pending',
      approval_status: 'approved',
      createdat: new Date().toISOString(),
      updatedat: new Date().toISOString()
    };

    // 4. Insert into recruiters table
    const { data, error } = await supabaseAdmin
      .from('recruiters')
      .insert([newRecruiter])
      .select()
      .single();

    if (error) {
      console.error('Error creating recruiter:', error);
      // Rollback auth user and user profile
      await supabaseAdmin.from('users').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to create recruiter profile', details: error.message, code: error.code }, { status: 500 });
    }

    // 4. Send password reset email (optional, but good practice)
    // await supabaseAdmin.auth.resetPasswordForEmail(body.email, { ... });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleError(error, 'Create Recruiter');
  }
}

