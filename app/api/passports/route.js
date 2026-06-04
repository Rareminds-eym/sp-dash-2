import { NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { filterAndRankResults, fuzzyMatch } from '@/lib/search-utils';
import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET /api/passports - List all skill passports with pagination, search, and filters
 */
export async function GET(request) {
  try {
    const { error } = await authenticateSSORequest(request, ['super_admin', 'admin']);
    if (error) return error;
    
    // Get parameters from query string
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const nsqfLevelFilter = url.searchParams.get('nsqfLevel') || '';
    const universityFilter = url.searchParams.get('university') || '';
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    
    // Build the query for passports using RLS client
    let passportsQuery = supabaseAdmin.from('skill_passports').select('*', { count: 'exact' });
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      passportsQuery = passportsQuery.eq('status', statusFilter);
    }
    
    // Apply NSQF level filter
    if (nsqfLevelFilter && nsqfLevelFilter !== 'all') {
      passportsQuery = passportsQuery.eq('nsqfLevel', parseInt(nsqfLevelFilter));
    }
    
    // Apply sorting
    const ascending = sortOrder === 'asc';
    if (sortBy === 'nsqfLevel') {
      passportsQuery = passportsQuery.order('nsqfLevel', { ascending, nullsFirst: false });
    } else if (sortBy === 'createdAt') {
      passportsQuery = passportsQuery.order('createdAt', { ascending });
    }
    
    // Execute query with pagination
    const { data: passports, error: passportsError, count } = await passportsQuery.range(offset, offset + limit - 1);
    
    if (passportsError) {
      console.error('Error fetching passports:', passportsError);
      return NextResponse.json({ error: 'Failed to fetch passports' }, { status: 500 });
    }
    
    let filteredPassports = passports || [];
    
    // If we have passports, fetch all related data in bulk
    if (filteredPassports.length > 0) {
      const studentIds = filteredPassports.map(p => p.studentId).filter(Boolean);
      
      if (studentIds.length > 0) {
        // Fetch all students and their users in parallel using RLS client
        const [studentsResult, usersResult] = await Promise.all([
          supabaseAdmin.from('students').select('*').in('id', studentIds),
          supabaseAdmin.from('students').select('userId, organizationId').in('id', studentIds).then(async (result) => {
            if (result.data && result.data.length > 0) {
              const userIds = result.data.map(s => s.userId).filter(Boolean);
              if (userIds.length > 0) {
                return await supabaseAdmin.from('users').select('id, email, metadata').in('id', userIds);
              }
            }
            return { data: [] };
          })
        ]);
        
        const students = studentsResult.data || [];
        const users = usersResult.data || [];
        
        // Fetch universities if needed for filtering using RLS client
        const orgIds = students.map(s => s.universityId || s.organizationId).filter(Boolean);
        let universities = [];
        if (orgIds.length > 0) {
          const { data: univData } = await supabaseAdmin.from('universities').select('id, name').in('id', orgIds);
          universities = univData || [];
        }
        
        // Create lookup maps for O(1) access
        const studentMap = {};
        students.forEach(student => {
          // Parse profile if it's a string
          if (student.profile && typeof student.profile === 'string') {
            try {
              const cleanedProfile = student.profile.replace(/:\s*NaN/g, ': null');
              student.profile = JSON.parse(cleanedProfile);
            } catch (parseError) {
              student.profile = {};
            }
          }
          studentMap[student.id] = student;
        });
        
        const userMap = {};
        users.forEach(user => {
          userMap[user.id] = user;
        });
        
        const universityMap = {};
        universities.forEach(univ => {
          universityMap[univ.id] = univ;
        });
        
        // Map data to passports
        filteredPassports.forEach(passport => {
          if (passport.studentId && studentMap[passport.studentId]) {
            const student = studentMap[passport.studentId];
            if (student.userId && userMap[student.userId]) {
              student.users = userMap[student.userId];
            }
            const univId = student.universityId || student.organizationId;
            if (univId && universityMap[univId]) {
              student.university = universityMap[univId];
            }
            passport.students = student;
          }
        });
      }
    }
    
    // Apply industrial-grade fuzzy search and relevance ranking with university filter
    if (search || universityFilter) {
      filteredPassports = filteredPassports.filter(passport => {
        let matchesSearch = true;
        let matchesUniversity = true;
        
        if (search) {
          const studentName = passport.students?.profile?.name || '';
          const studentEmail = passport.students?.email || passport.students?.users?.email || '';
          const passportId = passport.id || '';
          const universityName = passport.students?.university?.name || '';
          const skills = Array.isArray(passport.skills) ? passport.skills.join(' ') : (passport.skills || '');
          
          matchesSearch = fuzzyMatch(studentName, search, 0.7) ||
                         fuzzyMatch(studentEmail, search, 0.7) ||
                         fuzzyMatch(passportId, search, 0.7) ||
                         fuzzyMatch(universityName, search, 0.7) ||
                         fuzzyMatch(skills, search, 0.7);
        }
        
        if (universityFilter && universityFilter !== 'all') {
          const univId = passport.students?.universityId || passport.students?.organizationId;
          matchesUniversity = univId === universityFilter;
        }
        
        return matchesSearch && matchesUniversity;
      });
      
      // Apply relevance ranking if search term exists
      if (search) {
        const searchFields = ['students.profile.name', 'students.email', 'students.users.email', 'id', 'students.university.name', 'skills'];
        filteredPassports = filterAndRankResults(filteredPassports, searchFields, search, 0.7);
      }
    }
    
    // Apply client-side sorting for student name
    if (sortBy === 'studentName') {
      filteredPassports.sort((a, b) => {
        const nameA = a.students?.profile?.name || a.students?.users?.email || '';
        const nameB = b.students?.profile?.name || b.students?.users?.email || '';
        if (ascending) {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(nameA);
        }
      });
    }
    
    // Return paginated response
    return NextResponse.json({
      data: filteredPassports,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    return handleError(error, 'Passports');
  }
}
