import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/students - List all students with pagination and filters
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
    const searchTerm = url.searchParams.get('search');
    const state = url.searchParams.get('state');
    const collegeSchoolName = url.searchParams.get('college_school_name');
    const branchField = url.searchParams.get('branch_field');
    const sortBy = url.searchParams.get('sort') || 'date-newest';

    // Build query with count using admin client to bypass RLS restrictions
    let query = supabaseAdmin.from('students').select('*', { count: 'exact' });

    // Apply filters
    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }
    if (state && state !== 'all') {
      query = query.eq('state', state);
    }
    if (collegeSchoolName && collegeSchoolName !== 'all') {
      query = query.eq('college_school_name', collegeSchoolName);
    }
    if (branchField && branchField !== 'all') {
      query = query.eq('branch_field', branchField);
    }
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,college_school_name.ilike.%${searchTerm}%,branch_field.ilike.%${searchTerm}%`);
    }

    // Apply sorting
    switch (sortBy) {
      case 'name-asc':
        query = query.order('name', { ascending: true, nullsFirst: false });
        break;
      case 'name-desc':
        query = query.order('name', { ascending: false, nullsFirst: false });
        break;
      case 'date-oldest':
        query = query.order('createdAt', { ascending: true });
        break;
      case 'state-asc':
        query = query.order('state', { ascending: true, nullsFirst: false });
        break;
      case 'date-newest':
      default:
        query = query.order('createdAt', { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: students, error, count } = await query;

    if (error) {
      // Handle range error gracefully
      if (error.code === 'PGRST103' || error.message?.includes('range')) {
        return NextResponse.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        });
      }
      console.error('Error fetching students:', error);
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }

    // If offset is beyond total count, return empty result
    if (count !== null && offset >= count) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
      });
    }

    // Fetch all related data in parallel
    if (students && students.length > 0) {
      const userIds = students.map(s => s.userId).filter(Boolean);
      const universityIds = students.map(s => s.universityId).filter(Boolean);

      const mappedUniversityIds = universityIds.filter(Boolean);

      const [usersResult, universitiesResult] = await Promise.all([
        userIds.length > 0 ? supabaseAdmin.from('users').select('id, email, metadata').in('id', userIds) : { data: [] },
        mappedUniversityIds.length > 0 ? supabaseAdmin.from('universities').select('id, name').in('id', mappedUniversityIds) : { data: [] }
      ]);

      // Create lookup maps
      const userMap = {};
      usersResult.data?.forEach(user => { userMap[user.id] = user; });

      const univMap = {};
      universitiesResult.data?.forEach(univ => {
        univMap[univ.id] = { id: univ.id, name: univ.name };
      });

      // Map data to students
      students.forEach(student => {
        if (student.userId && userMap[student.userId]) {
          student.users = userMap[student.userId];
        }
        if (student.universityId && univMap[student.universityId]) {
          student.university = univMap[student.universityId];
        }
      });
    }

    // Normalize field names to match frontend expectations
    const normalizedStudents = (students || []).map(student => ({
      ...student,
      created_at: student.createdAt || student.created_at,
    }));

    // Return consistent format with other endpoints
    const response = NextResponse.json({
      data: normalizedStudents || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

    return addCacheHeaders(response, 'static');
  } catch (error) {
    return handleError(error, 'Students');
  }
}
