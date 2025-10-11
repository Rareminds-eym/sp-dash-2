import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'edge'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Fetch additional user data from users table (lookup by email since IDs may not match)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', authData.user.email)
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
      // Continue with auth user data if custom user data fetch fails
    }

    if (userError) {
      console.error('Error fetching user data:', userError)
      // Return basic auth user data if custom user data fetch fails
      return NextResponse.json({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.user_metadata?.name || authData.user.email.split('@')[0],
          role: authData.user.user_metadata?.role || 'user',
        },
        session: authData.session,
      })
    }

    const userName = userData?.metadata?.name || authData.user.user_metadata?.name || authData.user.email.split('@')[0]

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
      session: authData.session,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}