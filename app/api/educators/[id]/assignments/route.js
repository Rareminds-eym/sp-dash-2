import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireEducatorAdmin } from '@/lib/educator-admin';

/**
 * GET /api/educators/[id]/assignments
 * Full assignment detail for one educator, each with attendance history.
 * Lazy-loaded by the "View all" assignments modal so the list stays light.
 * 
 * Query Parameters (Teaching & Attendance):
 * - status: active|upcoming|ended|all (default: all)
 * - collegeId: filter by college
 * - departmentId: filter by department
 * - startDateFrom: start date >= this value (YYYY-MM-DD)
 * - startDateTo: start date <= this value (YYYY-MM-DD)
 * - courseId: filter assignments that include this course
 * - sessionStatus: scheduled|ongoing|completed|cancelled (filter by attendance session status)
 * 
 * Query Parameters (Tasks & Evaluations):
 * - taskId: filter by specific task ID
 * - taskType: filter by assignment type (quiz, assignment, project, exam)
 * - taskCollegeId: filter tasks by college
 * - taskDepartmentId: filter tasks by department
 * - taskCourseId: filter by course name
 * - taskStatus: all|has_submissions|pending_review|fully_graded|no_submissions
 * - taskDueDate: all|overdue|due_this_week|due_this_month
 */
export async function GET(request, { params }) {
  const auth = await requireEducatorAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    
    // Parse query parameters for Teaching & Attendance
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all';
    const collegeId = searchParams.get('collegeId');
    const departmentId = searchParams.get('departmentId');
    const startDateFrom = searchParams.get('startDateFrom');
    const startDateTo = searchParams.get('startDateTo');
    const courseId = searchParams.get('courseId');
    const sessionStatus = searchParams.get('sessionStatus');
    
    // Parse query parameters for Tasks & Evaluations
    const taskId = searchParams.get('taskId');
    const taskType = searchParams.get('taskType');
    const taskCollegeId = searchParams.get('taskCollegeId');
    const taskDepartmentId = searchParams.get('taskDepartmentId');
    const taskCourseId = searchParams.get('taskCourseId');
    const taskStatus = searchParams.get('taskStatus') || 'all';

    const { data: staff, error: staffError } = await supabaseAdmin
      .from('organization_staff')
      .select('id, user_id, first_name, last_name, email, employee_id')
      .eq('id', id)
      .single();

    if (staffError || !staff) {
      return NextResponse.json({ error: 'Educator not found' }, { status: 404 });
    }

    // Build query with filters
    let query = supabaseAdmin
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
      .eq('staff_id', id);

    // Apply filters
    if (collegeId) {
      query = query.eq('college_id', collegeId);
    }
    
    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }
    
    if (startDateFrom) {
      query = query.gte('start_date', startDateFrom);
    }
    
    if (startDateTo) {
      query = query.lte('start_date', startDateTo);
    }
    
    // Note: Course filter is applied after fetching since Supabase JSONB array filtering can be tricky
    // We'll filter it in post-processing

    query = query.order('start_date', { ascending: false });

    let { data: assignments, error: assignError } = await query;

    if (assignError) {
      return NextResponse.json({ error: 'Failed to fetch assignments', details: assignError.message }, { status: 500 });
    }

    // Fetch tasks created by this external educator
    let rawTasks = [];
    if (staff.user_id) {
      let taskQuery = supabaseAdmin
        .from('college_assignments')
        .select(`
          assignment_id,
          title,
          description,
          instructions,
          course_name,
          course_code,
          due_date,
          total_points,
          assignment_type,
          skill_outcomes,
          created_date,
          college_id,
          department_id,
          program_id,
          program_section_id,
          programs:program_id(id, name, code),
          departments:department_id(id, name, code),
          sections:program_section_id(id, section, semester)
        `)
        .eq('external_educator_id', staff.user_id)
        .eq('is_deleted', false);
      
      // Apply task filters at database level where possible
      if (taskType) {
        taskQuery = taskQuery.eq('assignment_type', taskType);
      }
      
      if (taskCollegeId) {
        taskQuery = taskQuery.eq('college_id', taskCollegeId);
      }
      
      if (taskDepartmentId) {
        taskQuery = taskQuery.eq('department_id', taskDepartmentId);
      }
      
      taskQuery = taskQuery.order('created_date', { ascending: false });
      
      const { data: taskRows } = await taskQuery;

      if (taskRows) rawTasks = taskRows;
    }

    const collegeIds = [...new Set([
      ...(assignments || []).map(a => a.college_id),
      ...rawTasks.map(t => t.college_id),
    ].filter(Boolean))];

    let collegesById = {};
    if (collegeIds.length > 0) {
      const { data: colleges } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .in('id', collegeIds);
      collegesById = Object.fromEntries((colleges || []).map(c => [c.id, c.name]));
    }

    // Process learner submissions, grades, and feedback for each task
    let tasks = [];
    if (rawTasks.length > 0) {
      const taskIds = rawTasks.map(t => t.assignment_id);

      const { data: subRows } = await supabaseAdmin
        .from('college_learner_assignments')
        .select(`
          learner_assignment_id,
          assignment_id,
          learner_id,
          status,
          priority,
          grade_received,
          grade_percentage,
          instructor_feedback,
          feedback_date,
          graded_date,
          submission_date,
          is_late
        `)
        .in('assignment_id', taskIds)
        .eq('is_deleted', false);

      const learnerUserIds = [...new Set((subRows || []).map(s => s.learner_id).filter(Boolean))];
      let learnersById = {};
      if (learnerUserIds.length > 0) {
        const { data: learnerRows } = await supabaseAdmin
          .from('learners')
          .select('id, user_id, name, email, roll_number')
          .in('user_id', learnerUserIds);
        learnersById = Object.fromEntries((learnerRows || []).map(l => [l.user_id, l]));
      }

      const submissionsByTask = {};
      for (const sub of subRows || []) {
        if (!submissionsByTask[sub.assignment_id]) {
          submissionsByTask[sub.assignment_id] = [];
        }
        const learnerInfo = learnersById[sub.learner_id] || null;
        submissionsByTask[sub.assignment_id].push({
          id: sub.learner_assignment_id,
          learnerId: sub.learner_id,
          learnerName: learnerInfo?.name || 'Unknown Learner',
          learnerEmail: learnerInfo?.email || '',
          rollNumber: learnerInfo?.roll_number || '',
          status: sub.status,
          priority: sub.priority,
          gradeReceived: sub.grade_received,
          gradePercentage: sub.grade_percentage,
          instructorFeedback: sub.instructor_feedback,
          feedbackDate: sub.feedback_date,
          gradedDate: sub.graded_date,
          submissionDate: sub.submission_date,
          isLate: sub.is_late,
        });
      }

      tasks = rawTasks.map(t => {
        const subs = submissionsByTask[t.assignment_id] || [];
        const totalAssigned = subs.length;
        const submittedCount = subs.filter(s => s.status === 'submitted' || s.status === 'graded').length;
        const gradedCount = subs.filter(s => s.status === 'graded' || (s.gradePercentage !== null && s.gradePercentage !== undefined)).length;
        const pendingCount = subs.filter(s => s.status === 'submitted').length;

        return {
          id: t.assignment_id,
          title: t.title,
          description: t.description,
          instructions: t.instructions,
          courseName: t.course_name,
          courseCode: t.course_code,
          dueDate: t.due_date,
          totalPoints: t.total_points,
          assignmentType: t.assignment_type,
          skillOutcomes: t.skill_outcomes || [],
          createdDate: t.created_date,
          collegeId: t.college_id,
          collegeName: collegesById[t.college_id] || null,
          departmentName: t.departments?.name || null,
          programName: t.programs?.name || null,
          sectionName: t.sections?.section || null,
          semester: t.sections?.semester || null,
          programSectionId: t.program_section_id,
          stats: {
            totalAssigned,
            submittedCount,
            gradedCount,
            pendingCount,
          },
          learners: subs,
        };
      });
      
      // Apply post-processing filters for tasks
      const today = new Date().toISOString().slice(0, 10);
      
      // Task ID filter (by specific task)
      if (taskId) {
        tasks = tasks.filter(t => t.id === taskId);
      }
      
      // Course filter (by course name/code)
      if (taskCourseId) {
        tasks = tasks.filter(t => 
          t.courseName === taskCourseId || 
          t.courseCode === taskCourseId
        );
      }
      
      // Task status filter - filter learners within each task by status
      if (taskStatus && taskStatus !== 'all') {
        tasks = tasks.map(t => {
          const filteredLearners = (t.learners || []).filter(l => l.status === taskStatus);
          
          // Recalculate stats based on filtered learners
          const totalAssigned = filteredLearners.length;
          const submittedCount = filteredLearners.filter(s => s.status === 'submitted' || s.status === 'graded').length;
          const gradedCount = filteredLearners.filter(s => s.status === 'graded' || (s.gradePercentage !== null && s.gradePercentage !== undefined)).length;
          const pendingCount = filteredLearners.filter(s => s.status === 'submitted').length;
          
          return {
            ...t,
            learners: filteredLearners,
            stats: {
              totalAssigned,
              submittedCount,
              gradedCount,
              pendingCount,
            }
          };
        }).filter(t => t.learners.length > 0); // Remove tasks with no matching learners
      }
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

    let data = (assignments || []).map(assignment => {
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
      const status = start && start > today ? 'upcoming' : (end && end < today ? 'ended' : 'active');
      const historyTotal = (sessionsByAssignment[assignment.id] || []).length;
      
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
        status,
        timeSlots: slotsByAssignment[assignment.id] || [],
        history,
        historyTotal,
        tasks: tasks.filter(t => t.programSectionId && t.programSectionId === assignment.section_id),
      };
    });

    // Apply course filter (post-processing)
    if (courseId) {
      data = data.filter(a => {
        const assignedCourses = a.assignedCourses || [];
        return assignedCourses.includes(courseId);
      });
    }

    // Apply post-processing filters
    if (statusFilter && statusFilter !== 'all') {
      data = data.filter(a => a.status === statusFilter);
    }
    
    // Filter by session status (attendance history)
    if (sessionStatus && sessionStatus !== '' && sessionStatus !== 'all') {
      data = data.filter(a => {
        const sessions = a.history || [];
        // Filter assignments that have at least one session with the specified status
        return sessions.some(s => s.status === sessionStatus);
      });
    }

    // Fetch filter options for dropdowns
    const allColleges = [...new Set((assignments || []).map(a => a.college_id).filter(Boolean))];
    const allDepartments = [...new Set((assignments || []).map(a => a.department_id).filter(Boolean))];
    const allCourses = [...new Set((assignments || []).flatMap(a => a.assigned_courses || []).filter(Boolean))];
    
    // Extract unique session statuses from actual attendance sessions data
    const allSessionStatuses = [...new Set(
      Object.values(sessionsByAssignment)
        .flat()
        .map(s => s.status)
        .filter(Boolean)
    )];
    
    // Generate attendance history filter options based on actual session statuses in database
    const attendanceHistoryOptions = [];
    if (allSessionStatuses.length > 0) {
      // Add each unique status found in the data
      allSessionStatuses.forEach(status => {
        attendanceHistoryOptions.push({
          value: status,
          label: status.charAt(0).toUpperCase() + status.slice(1) // Capitalize first letter
        });
      });
    }
    
    // Task filter options
    const taskColleges = [...new Set(rawTasks.map(t => t.college_id).filter(Boolean))];
    const taskDepartments = [...new Set(rawTasks.map(t => t.department_id).filter(Boolean))];
    const taskTypes = [...new Set(rawTasks.map(t => t.assignment_type).filter(Boolean))];
    const taskCourseNames = [...new Set(rawTasks.map(t => t.course_name).filter(Boolean))];
    const taskNames = rawTasks.map(t => ({ id: t.assignment_id, title: t.title }));
    
    // Get actual status values from the database for this educator's tasks
    // Extract unique statuses from the learner submissions already fetched above
    const taskStatusSet = new Set();
    for (const task of tasks) {
      for (const learner of task.learners || []) {
        if (learner.status) taskStatusSet.add(learner.status);
      }
    }
    // Status display order: todo → in-progress → submitted → graded
    const STATUS_ORDER = ['todo', 'in-progress', 'submitted', 'graded'];
    const taskStatuses = STATUS_ORDER.filter(s => taskStatusSet.has(s));
    
    let filterOptions = {
      colleges: [],
      departments: [],
      courses: [],
      attendanceHistoryOptions: attendanceHistoryOptions,
      taskNames: taskNames,
      taskColleges: [],
      taskDepartments: [],
      taskTypes: taskTypes,
      taskCourses: taskCourseNames.map(name => ({ id: name, title: name, name: name })),
      taskStatuses: taskStatuses,
    };
    
    if (allColleges.length > 0) {
      const { data: collegeOptions } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .in('id', allColleges)
        .order('name');
      filterOptions.colleges = collegeOptions || [];
    }
    
    if (allDepartments.length > 0) {
      const { data: deptOptions } = await supabaseAdmin
        .from('departments')
        .select('id, name, code')
        .in('id', allDepartments)
        .order('name');
      filterOptions.departments = deptOptions || [];
    }
    
    if (allCourses.length > 0) {
      const { data: courseOptions } = await supabaseAdmin
        .from('courses')
        .select('course_id, title, code')
        .in('course_id', allCourses)
        .order('title');
      filterOptions.courses = courseOptions || [];
    }
    
    // Task-specific filter options
    if (taskColleges.length > 0) {
      const { data: taskCollegeOptions } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .in('id', taskColleges)
        .order('name');
      filterOptions.taskColleges = taskCollegeOptions || [];
    }
    
    if (taskDepartments.length > 0) {
      const { data: taskDeptOptions } = await supabaseAdmin
        .from('departments')
        .select('id, name, code')
        .in('id', taskDepartments)
        .order('name');
      filterOptions.taskDepartments = taskDeptOptions || [];
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        educator: staff, 
        assignments: data, 
        tasks,
        filterOptions 
      } 
    });
  } catch (error) {
    console.error('❌ [ASSIGNMENT DETAIL API] Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
