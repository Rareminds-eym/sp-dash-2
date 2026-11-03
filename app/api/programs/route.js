import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request) {
  console.log('=== FETCH PROGRAMS API ===')
  
  try {
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')

    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'departmentId query parameter is required' },
        { status: 400 }
      )
    }

    console.log('Fetching programs for department:', departmentId)

    const supabase = supabaseAdmin

    // Fetch programs for the specified department
    const { data: programs, error } = await supabase
      .from('programs')
      .select('id, name, code, description, degree_level, specializations')
      .eq('department_id', departmentId)
      .eq('status', 'active')
      .order('name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching programs:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch programs', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Fetched ${programs?.length || 0} programs`)

    return NextResponse.json({
      success: true,
      data: programs || []
    })

  } catch (error) {
    console.error('=== FETCH PROGRAMS FAILED ===')
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
