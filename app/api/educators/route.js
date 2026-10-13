import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/educators
 * List all educators from organization_staff table with pagination, search, and filters
 */
export async function GET(request) {
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

    console.log('📋 [LIST EDUCATORS API] Query params:', {
      page, limit, offset, search, department, facultyRole, status, organizationId
    })

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
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%`);
    }

    // Apply department filter
    if (department && department !== 'all') {
      query = query.eq('department', department);
    }

    // Apply faculty role filter (designation column)
    if (facultyRole && facultyRole !== 'all') {
      query = query.eq('designation', facultyRole);
    }

    // Apply status filter (account_status column)
    if (status && status !== 'all') {
      query = query.eq('account_status', status);
    }

    // Apply organization filter
    if (organizationId && organizationId !== 'all') {
      query = query.eq('organization_id', organizationId);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: educators, error, count } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [LIST EDUCATORS API] Error fetching educators:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch educators',
        details: error.message
      }, { status: 500 });
    }

    console.log(`✅ [LIST EDUCATORS API] Found ${count} total educators, returning ${educators?.length} for page ${page}`)

    // Map organization_staff fields to match frontend expectations
    const mappedEducators = (educators || []).map(staff => ({
      id: staff.id,
      firstName: staff.first_name,
      lastName: staff.last_name,
      email: staff.email,
      phone: staff.phone,
      employeeId: staff.employee_id,
      department: staff.department,
      facultyRole: staff.designation,
      qualification: staff.qualification,
      specialization: staff.specialization,
      experienceYears: staff.experience_years,
      dateOfJoining: staff.date_of_joining,
      status: staff.account_status,
      organizationId: staff.organization_id,
      userId: staff.user_id,
      createdAt: staff.created_at,
      user_metadata: staff.metadata,
      // Assignment details
      assignments: (staff.assignments || []).map(assignment => ({
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
      }))
    }));

    return NextResponse.json({
      success: true,
      data: mappedEducators,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
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
