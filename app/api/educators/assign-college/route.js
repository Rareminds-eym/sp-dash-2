import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request) {
  console.log('=== ASSIGN TRAINER TO COLLEGE API ===')
  
  try {
    const body = await request.json()
    console.log('📥 Request body:', body)

    const {
      trainerId,
      collegeId,
      departmentId,
      programId,
      sectionId,
      assignedCourses,
      startDate,
      endDate,
      notes
    } = body

    // Validate required fields
    if (!trainerId) {
      return NextResponse.json(
        { success: false, error: 'Trainer ID is required' },
        { status: 400 }
      )
    }

    if (!collegeId) {
      return NextResponse.json(
        { success: false, error: 'College ID is required' },
        { status: 400 }
      )
    }

    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'Department ID is required' },
        { status: 400 }
      )
    }

    if (!assignedCourses || assignedCourses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one course must be assigned' },
        { status: 400 }
      )
    }

    if (!startDate) {
      return NextResponse.json(
        { success: false, error: 'Start date is required' },
        { status: 400 }
      )
    }

    const supabase = supabaseAdmin

    // Step 1: Verify trainer exists in organization_staff
    console.log('Step 1: Verifying trainer exists...')
    const { data: trainer, error: trainerError } = await supabase
      .from('organization_staff')
      .select('id, user_id')
      .eq('user_id', trainerId)
      .single()

    if (trainerError || !trainer) {
      console.error('❌ Trainer not found:', trainerError)
      return NextResponse.json(
        { success: false, error: 'Trainer not found in organization_staff' },
        { status: 404 }
      )
    }

    console.log('✅ Trainer found:', trainer.id)

    // Step 2: Verify college exists
    console.log('Step 2: Verifying college exists...')
    const { data: college, error: collegeError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', collegeId)
      .single()

    if (collegeError || !college) {
      console.error('❌ College not found:', collegeError)
      return NextResponse.json(
        { success: false, error: 'College not found' },
        { status: 404 }
      )
    }

    console.log('✅ College found:', college.name)

    // Step 3: Verify department exists and belongs to college
    console.log('Step 3: Verifying department...')
    const { data: department, error: deptError } = await supabase
      .from('departments')
      .select('id, name, college_id')
      .eq('id', departmentId)
      .eq('college_id', collegeId)
      .single()

    if (deptError || !department) {
      console.error('❌ Department not found or does not belong to college:', deptError)
      return NextResponse.json(
        { success: false, error: 'Department not found or does not belong to selected college' },
        { status: 404 }
      )
    }

    console.log('✅ Department found:', department.name)

    // Step 4: Verify courses exist
    console.log('Step 4: Verifying courses...')
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('course_id, code, title')
      .in('course_id', assignedCourses)

    if (coursesError || !courses || courses.length !== assignedCourses.length) {
      console.error('❌ Some courses not found:', coursesError)
      return NextResponse.json(
        { success: false, error: 'One or more courses not found' },
        { status: 404 }
      )
    }

    console.log('✅ All courses verified:', courses.length)

    // Step 5: Insert into organization_staff_assignments
    console.log('Step 5: Creating assignment...')
    const assignmentData = {
      staff_id: trainer.id,
      college_id: collegeId,
      department_id: departmentId,
      program_id: programId || null,
      section_id: sectionId || null,
      assigned_courses: assignedCourses,
      start_date: startDate,
      end_date: endDate || null,
      notes: notes || null,
      is_active: true
    }

    console.log('Assignment data:', assignmentData)

    const { data: assignment, error: assignmentError } = await supabase
      .from('organization_staff_assignments')
      .insert(assignmentData)
      .select()
      .single()

    if (assignmentError) {
      console.error('❌ Error creating assignment:', assignmentError)
      return NextResponse.json(
        { success: false, error: 'Failed to create assignment', details: assignmentError.message },
        { status: 500 }
      )
    }

    console.log('✅ Assignment created successfully:', assignment.id)

    return NextResponse.json({
      success: true,
      message: 'Trainer assigned to college successfully',
      data: {
        assignmentId: assignment.id,
        trainerId: trainer.id,
        collegeName: college.name,
        departmentName: department.name,
        coursesCount: courses.length
      }
    })

  } catch (error) {
    console.error('=== ASSIGN TRAINER TO COLLEGE FAILED ===')
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
