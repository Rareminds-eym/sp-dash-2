import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireEducatorAdmin } from '@/lib/educator-admin';

/**
 * GET /api/educators/[id]/assignments
 * Full assignment detail for one educator, each with attendance history.
 * Lazy-loaded by the "View all" assignments modal so the list stays light.
 */
export async function GET(request, { params }) {
  const auth = await requireEducatorAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;

    const { data: staff, error: staffError } = await supabaseAdmin
      .from('organization_staff')
      .select('id, first_name, last_name, email, employee_id')
      .eq('id', id)
      .single();

    if (staffError || !staff) {
      return NextResponse.json({ error: 'Educator not found' }, { status: 404 });
    }

    const { data: assignments, error: assignError } = await supabaseAdmin
      .from('organization_staff_assignments')
      .select(`
        id,
        college_id,
        department_id,
        program_id,
        section_id,
        assigned_courses,
        start_date,
        end_date,
        is_active,
        metadata,
        departments:department_id(id, name, code),
        programs:program_id(id, name, code),
        sections:section_id(id, section, semester)
      `)
      .eq('staff_id', id)
      .order('start_date', { ascending: false });

    if (assignError) {
      return NextResponse.json({ error: 'Failed to fetch assignments', details: assignError.message }, { status: 500 });
    }

    const collegeIds = [...new Set((assignments || []).map(a => a.college_id).filter(Boolean))];
    let collegesById = {};
    if (collegeIds.length > 0) {
      const { data: colleges } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .in('id', collegeIds);
      collegesById = Object.fromEntries((colleges || []).map(c => [c.id, c.name]));
    }

    const assignmentIds = (assignments || []).map(a => a.id);
    let sessionsByAssignment = {};
    let slotsByAssignment = {};
    if (assignmentIds.length > 0) {
      const { data: slots } = await supabaseAdmin
        .from('assignment_time_slots')
        .select('assignment_id, start_time, end_time')
        .in('assignment_id', assignmentIds)
        .order('start_time', { ascending: true });
      slotsByAssignment = Object.fromEntries(assignmentIds.map(aid => [aid, []]));
      for (const s of slots || []) {
        if (slotsByAssignment[s.assignment_id]) slotsByAssignment[s.assignment_id].push(s);
      }

      const { data: sessions, error: sessionsError } = await supabaseAdmin
        .from('college_attendance_sessions')
        .select('id, staff_assignment_id, lms_course_id, date, subject_name, status, present_count, total_learners, attendance_percentage')
        .eq('organization_staff_id', id)
        .in('staff_assignment_id', assignmentIds)
        .order('date', { ascending: false })
        .limit(200);
      if (!sessionsError) {
        sessionsByAssignment = Object.fromEntries(assignmentIds.map(aid => [aid, []]));
        for (const s of sessions || []) {
          if (s.staff_assignment_id && sessionsByAssignment[s.staff_assignment_id]) {
            sessionsByAssignment[s.staff_assignment_id].push({
              id: s.id,
              courseId: s.lms_course_id || null,
              date: s.date,
              subject: s.subject_name,
              status: s.status,
              present: s.present_count || 0,
              total: s.total_learners || 0,
              percentage: s.attendance_percentage || 0,
            });
          }
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    // Resolve allocated course ids to titles (SP-admin allocation pool).
    const allCourseIds = [...new Set(
      (assignments || []).flatMap(a => a.assigned_courses || []).filter(Boolean)
    )];
    let coursesById = {};
    if (allCourseIds.length > 0) {
      const { data: courses } = await supabaseAdmin
        .from('courses')
        .select('course_id, title, code')
        .in('course_id', allCourseIds);
      coursesById = Object.fromEntries((courses || []).map(c => [c.course_id, c]));
    }

    const data = (assignments || []).map(assignment => {
      const specs = Array.isArray(assignment.metadata?.specializations)
        ? assignment.metadata.specializations.map(s => String(s).trim()).filter(Boolean)
        : [];
      const programName = assignment.programs?.name || null;
      const programCode = (typeof assignment.programs?.code === 'string' && assignment.programs.code.trim())
        ? assignment.programs.code.trim()
        : programName;
      const start = assignment.start_date || null;
      const end = assignment.end_date || null;
      const history = (sessionsByAssignment[assignment.id] || []).slice(0, 50);
      const allocatedIds = assignment.assigned_courses || [];
      const taughtIds = new Set(history.map(s => s.courseId).filter(Boolean));
      return {
        id: assignment.id,
        collegeId: assignment.college_id,
        collegeName: collegesById[assignment.college_id] || null,
        departmentId: assignment.department_id,
        departmentName: assignment.departments?.name || null,
        programId: assignment.program_id,
        programName,
        specializations: specs,
        specialization: specs[0] || null,
        programLabel: specs.length > 0 && programCode ? `${programCode} - ${specs.join(', ')}` : programName,
        sectionId: assignment.section_id,
        sectionName: assignment.sections?.section || null,
        semester: assignment.sections?.semester || null,
        assignedCourses: assignment.assigned_courses || [],
        allocatedCourses: allocatedIds.map(cid => ({
          id: cid,
          title: coursesById[cid]?.title || null,
          code: coursesById[cid]?.code || null,
          sessionsHeld: history.filter(s => s.courseId === cid).length,
        })),
        startDate: start,
        endDate: end,
        isActive: assignment.is_active,
        status: start && start > today ? 'upcoming' : (end && end < today ? 'ended' : 'active'),
        timeSlots: slotsByAssignment[assignment.id] || [],
        history,
        historyTotal: (sessionsByAssignment[assignment.id] || []).length,
      };
    });

    return NextResponse.json({ success: true, data: { educator: staff, assignments: data } });
  } catch (error) {
    console.error('❌ [ASSIGNMENT DETAIL API] Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
