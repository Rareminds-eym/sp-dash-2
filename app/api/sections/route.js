import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request) {
  console.log('=== FETCH SECTIONS API ===')
  
  try {
    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('programId')

    if (!programId) {
      return NextResponse.json(
        { success: false, error: 'programId query parameter is required' },
        { status: 400 }
      )
    }

    console.log('Fetching sections for program:', programId)

    const supabase = supabaseAdmin

    // Fetch sections for the specified program
    const { data: sections, error } = await supabase
      .from('program_sections')
      .select('id, section, semester, academic_year, status')
      .eq('program_id', programId)
      .eq('status', 'active')
      .order('semester', { ascending: true })
      .order('section', { ascending: true })

    if (error) {
      console.error('❌ Error fetching sections:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sections', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Fetched ${sections?.length || 0} sections`)

    return NextResponse.json({
      success: true,
      data: sections || []
    })

  } catch (error) {
    console.error('=== FETCH SECTIONS FAILED ===')
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
