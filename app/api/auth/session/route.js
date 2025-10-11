import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'edge'

export async function GET(request) {
  try {
    const supabase = await createClient()
    
    // Get current session from Supabase Auth
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, user: null },
        { status: 401 }
      )
    }

    // Fetch additional user data from users table (lookup by email since IDs may not match)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single()
    
    // Fetch organization data separately if organizationId exists
    let organizationData = null
    if (userData && userData.organizationId) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, type')
        .eq('id', userData.organizationId)
        .maybeSingle()
      organizationData = orgData
    }

    if (userError) {
      console.error('Error fetching user data:', userError)
      // Return auth user data if custom user data fetch fails
      return NextResponse.json({
        success: true,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          role: session.user.user_metadata?.role || 'user',
        },
      })
    }

    const userName = userData.metadata?.name || session.user.user_metadata?.name || session.user.email.split('@')[0]

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userName,
        role: userData.role,
        organizationId: userData.organizationId,
        organization: organizationData,
      },
    })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json(
      { success: false, user: null },
      { status: 500 }
    )
  }
}