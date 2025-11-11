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
    
    // Build query with count using admin client to bypass RLS restrictions
    let query = supabaseAdmin.from('students').select('*', { count: 'exact' });
    
    // Apply filters
    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }
    
    // Apply sorting and pagination
    const { data: students, error, count } = await query
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching students:', error);
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }
    
    // Fetch all related data in parallel
    if (students && students.length > 0) {
      const userIds = students.map(s => s.userId).filter(Boolean);
      const universityIds = students.map(s => s.universityId).filter(Boolean);
      
      const mappedUniversityIds = universityIds.filter(Boolean);
      
      const [usersResult, universitiesResult] = await Promise.all([
        userIds.length > 0 ? supabaseAdmin.from('users').select('id, email').in('id', userIds) : { data: [] },
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
          student.organizations = univMap[student.universityId];
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
