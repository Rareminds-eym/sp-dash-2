import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ⚠️ DEVELOPMENT ONLY - Bypasses RLS using service role
// This should only be used for local development testing

export async function POST(request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const courseData = await request.json()

    // Create admin client with service role key (server-side only)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Server-only, not exposed to browser
    )

    // Insert course
    const { data: courseRow, error: courseError } = await supabase
      .from('courses')
      .insert({
        title: courseData.title,
        code: courseData.code,
        description: courseData.description,
        thumbnail: courseData.thumbnail,
        status: 'Active',
        approval_status: 'approved',
        duration: courseData.duration,
        skills_mapped: courseData.skillsCovered?.length || 0,
        total_skills: courseData.skillsCovered?.length || 0,
        target_outcomes: courseData.targetOutcomes,
        educator_id: courseData.educatorId ?? null,
        school_id: courseData.schoolId ?? null,
        credits: courseData.credits
      })
      .select()
      .single()

    if (courseError) {
      console.error('Error creating course:', courseError)
      return NextResponse.json(
        { error: courseError.message },
        { status: 400 }
      )
    }

    // Handle related data (skills, modules, etc.)
    const courseId = courseRow.course_id

    if (courseData.skillsCovered?.length > 0) {
      const skillsToInsert = courseData.skillsCovered.map(skill => ({
        course_id: courseId,
        skill_name: skill
      }))
      
      await supabase.from('course_skills').insert(skillsToInsert)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: courseId,
        ...courseData,
        createdAt: courseRow.created_at,
        updatedAt: courseRow.updated_at
      }
    })

  } catch (error) {
    console.error('Dev API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create course' },
      { status: 500 }
    )
  }
}
