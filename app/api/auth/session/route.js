import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

    // Fetch additional user data from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        organization:organizationId (
          id,
          name,
          type
        )
      `)
      .eq('id', session.user.id)
      .single()

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
        organization: userData.organization,
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