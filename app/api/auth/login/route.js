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
      .eq('id', authData.user.id)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      // Continue with auth user data if custom user data fetch fails
    }

    const user = userData || {
      id: authData.user.id,
      email: authData.user.email,
      role: authData.user.user_metadata?.role || 'user',
    }

    const userName = userData?.metadata?.name || authData.user.user_metadata?.name || authData.user.email.split('@')[0]

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: userName,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization,
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