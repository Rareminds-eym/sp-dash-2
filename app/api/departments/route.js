import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request) {
  console.log('=== FETCH DEPARTMENTS API ===')
  
  try {
    const { searchParams } = new URL(request.url)
    const collegeId = searchParams.get('collegeId')

    if (!collegeId) {
      return NextResponse.json(
        { success: false, error: 'collegeId query parameter is required' },
        { status: 400 }
      )
    }

    console.log('Fetching departments for college:', collegeId)

    const supabase = supabaseAdmin

    // Fetch departments for the specified college
    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name, code, description')
      .eq('college_id', collegeId)
      .order('name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching departments:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch departments', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Fetched ${departments?.length || 0} departments`)

    return NextResponse.json({
      success: true,
      data: departments || []
    })

  } catch (error) {
    console.error('=== FETCH DEPARTMENTS FAILED ===')
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
