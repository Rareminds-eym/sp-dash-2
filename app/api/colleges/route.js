import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request) {
  console.log('=== FETCH COLLEGES API ===')
  
  try {
    const supabase = supabaseAdmin

    // Fetch all organizations that are colleges (active only)
    const { data: colleges, error } = await supabase
      .from('organizations')
      .select('id, name, code, city, state')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching colleges:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch colleges', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Fetched ${colleges?.length || 0} colleges`)

    return NextResponse.json({
      success: true,
      data: colleges || []
    })

  } catch (error) {
    console.error('=== FETCH COLLEGES FAILED ===')
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
