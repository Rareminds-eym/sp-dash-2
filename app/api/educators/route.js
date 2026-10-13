import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireEducatorAdmin } from '@/lib/educator-admin';

/**
 * GET /api/educators
 * List all educators from organization_staff table with pagination, search, and filters
 */
export async function GET(request) {
  const auth = await requireEducatorAdmin(request);
  if (auth.error) return auth.error;
  console.log('📋 [LIST EDUCATORS API] GET /api/educators started')
  
  try {
    const url = new URL(request.url);

    // Pagination
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Filters
    const search = url.searchParams.get('search') || '';
    const department = url.searchParams.get('department') || '';
    const facultyRole = url.searchParams.get('facultyRole') || '';
    const status = url.searchParams.get('status') || '';
    const organizationId = url.searchParams.get('organizationId') || '';
    const sortByParam = url.searchParams.get('sortBy') || 'created_at';
    const sortOrderParam = (url.searchParams.get('sortOrder') || 'desc').toLowerCase();

    console.log('📋 [LIST EDUCATORS API] Query params:', {
      page, limit, offset, search, department, facultyRole, status, organizationId,
      sortByParam, sortOrderParam
    })

    // Map frontend sort keys to real DB columns (organization_staff has no
    // department/designation/specialization columns).
    const sortColumnMap = {
      dateOfJoining: 'date_of_joining',
      date_of_joining: 'date_of_joining',
      firstName: 'first_name',
      first_name: 'first_name',
      lastName: 'last_name',
      last_name: 'last_name',
      email: 'email',
      experienceYears: 'experience_years',
      experience_years: 'experience_years',
      createdAt: 'created_at',
      created_at: 'created_at',
    };
    const sortColumn = sortColumnMap[sortByParam] || 'created_at';
    const ascending = sortOrderParam === 'asc';

    const needsDeptFilter = department && department !== 'all';
    const needsRoleFilter = facultyRole && facultyRole !== 'all';

    // Build query from organization_staff table with assignments
    let query = supabaseAdmin
      .from('organization_staff')
      .select(`
        *,
        assignments:organization_staff_assignments(
          id,
          college_id,
          department_id,
          program_id,
          section_id,
          assigned_courses,
          start_date,
          end_date,
          departments:department_id(id, name, code),
          programs:program_id(id, name, code),
          sections:section_id(id, section, semester)
        )
      `, { count: 'exact' })
      .in('role', ['educator', 'college_educator', 'college_admin', 'rm_admin']); // Include all educator roles

    // Apply search filter (search in first_name, last_name, email, employee_id)
    if (search) {
      // Escape commas/% to avoid breaking PostgREST `or` syntax
      const safeSearch = search.replace(/[%(),]/g, '');
      query = query.or(`email.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,employee_id.ilike.%${safeSearch}%`);
    }

    // NOTE: organization_staff has NO `department` / `designation` /
    // `specialization` columns (verified against live schema). Filtering on
    // those directly causes PostgREST 400 "column does not exist" which
    // surfaced in the UI as "Failed to fetch educators". Department lives on
    // the assignment -> departments relation, and faculty role lives in
    // `role` / `metadata`. So we filter those in-memory below instead of
    // issuing an invalid `.eq()` here.

    // Apply status filter (account_status column)
    if (status && status !== 'all') {
      query = query.eq('account_status', status);
    }

    // Apply organization filter
    if (organizationId && organizationId !== 'all') {
      query = query.eq('organization_id', organizationId);
    }

    // Execute query — fetch one extra page worth when in-memory filters apply
    // so pagination stays correct for small/medium datasets.
    const fetchLimit = (needsDeptFilter || needsRoleFilter)
      ? 1000
      : limit;
    const fetchOffset = (needsDeptFilter || needsRoleFilter)
      ? 0
      : offset;

    query = query.range(fetchOffset, fetchOffset + fetchLimit - 1);

    const { data: educators, error, count } = await query.order(sortColumn, { ascending });

    if (error) {
      console.error('❌ [LIST EDUCATORS API] Error fetching educators:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch educators',
        details: error.message
      }, { status: 500 });
    }

    console.log(`✅ [LIST EDUCATORS API] Found ${count} total educators, returning ${educators?.length} for page ${page}`)

    // Map organization_staff fields to match frontend expectations.
    // department/designation/specialization don't exist as columns — derive
    // them from assignments + metadata so the UI never renders `undefined`.
    let mappedEducators = (educators || []).map(staff => {
      const assignments = (staff.assignments || []).map(assignment => ({
        id: assignment.id,
        collegeId: assignment.college_id,
        departmentId: assignment.department_id,
        programId: assignment.program_id,
        sectionId: assignment.section_id,
        assignedCourses: assignment.assigned_courses || [],
        startDate: assignment.start_date,
        endDate: assignment.end_date,
        departmentName: assignment.departments?.name || null,
        departmentCode: assignment.departments?.code || null,
        programName: assignment.programs?.name || null,
        programCode: assignment.programs?.code || null,
        sectionName: assignment.sections?.section || null,
        semester: assignment.sections?.semester || null
      }));
      const firstDept = assignments.find(a => a.departmentName)?.departmentName || null;
      const meta = staff.metadata || {};
      return {
        id: staff.id,
        firstName: staff.first_name,
        lastName: staff.last_name,
        email: staff.email,
        phone: staff.phone,
        employeeId: staff.employee_id,
        department: firstDept || meta.department || meta.customDepartment || '',
        facultyRole: meta.facultyRole || meta.designation || meta.platformRole || staff.role || '',
        qualification: staff.qualification,
        specialization: Array.isArray(staff.subject_expertise)
          ? staff.subject_expertise.map(s => typeof s === 'string' ? s : s?.subjectName).filter(Boolean).join(', ')
          : (staff.specialization || ''),
        experienceYears: staff.experience_years,
        dateOfJoining: staff.date_of_joining,
        status: staff.account_status,
        organizationId: staff.organization_id,
        userId: staff.user_id,
        createdAt: staff.created_at,
        user_metadata: staff.metadata,
        assignments,
      };
    });

    // In-memory filters for fields without dedicated columns.
    if (needsDeptFilter) {
      const needle = department.toLowerCase();
      mappedEducators = mappedEducators.filter(e =>
        (e.department || '').toLowerCase().includes(needle) ||
        (e.assignments || []).some(a =>
          (a.departmentName || '').toLowerCase().includes(needle)
        )
      );
    }
    if (needsRoleFilter) {
      const needle = facultyRole.toLowerCase();
      mappedEducators = mappedEducators.filter(e =>
        (e.facultyRole || '').toLowerCase().includes(needle)
      );
    }

    // Paginate in-memory when we over-fetched for the above filters.
    let total = count || 0;
    let pagedEducators = mappedEducators;
    if (needsDeptFilter || needsRoleFilter) {
      total = mappedEducators.length;
      pagedEducators = mappedEducators.slice(offset, offset + limit);
    }

    return NextResponse.json({
      success: true,
      data: pagedEducators,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ [LIST EDUCATORS API] Error in GET /api/educators:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
