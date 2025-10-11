import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'edge'

export async function GET(request) {
  try {
    const supabase = await createClient()
    
    // Use getUser() instead of getSession() for better security and JWT validation
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      // Handle JWT expiration and other auth errors gracefully
      if (authError?.message?.includes('JWT') || authError?.message?.includes('expired')) {
        console.warn('JWT expired in session API:', authError.message)
        return NextResponse.json(
          { success: false, user: null, error: 'JWT expired' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { success: false, user: null, error: authError?.message || 'Authentication failed' },
        { status: 401 }
      )
    }

    // Fetch additional user data from users table (lookup by email since IDs may not match)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle()
    
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
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email.split('@')[0],
          role: user.user_metadata?.role || 'user',
        },
      })
    }

    const userName = userData?.metadata?.name || user.user_metadata?.name || user.email.split('@')[0]

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
      { success: false, user: null, error: error.message },
      { status: 500 }
    )
  }
}