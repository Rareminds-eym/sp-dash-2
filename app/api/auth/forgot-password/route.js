import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'edge'

export async function POST(request) {
  try {
    const { email } = await request.json()

    // Validate email
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if user exists in our database using admin client
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, isActive')
      .eq('email', email)
      .maybeSingle()

    if (userError) {
      console.error('Error checking user:', userError)
      // Don't reveal if email exists or not for security
      return NextResponse.json(
        { 
          success: true, 
          message: 'If this email exists in our system, you will receive a password reset link shortly.' 
        },
        { status: 200 }
      )
    }

    if (!userData) {
      // Don't reveal if email exists or not for security
      return NextResponse.json(
        { 
          success: true, 
          message: 'If this email exists in our system, you will receive a password reset link shortly.' 
        },
        { status: 200 }
      )
    }

    // Get the base URL from environment or construct it
    const requestUrl = new URL(request.url)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${requestUrl.protocol}//${requestUrl.host}`
    const redirectUrl = `${baseUrl}/reset-password`

    // Send password reset email using Supabase Auth
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (resetError) {
      console.error('Password reset error:', resetError)
      
      // Check if it's a rate limit error
      if (resetError.message?.includes('rate limit') || resetError.status === 429) {
        return NextResponse.json(
          { error: 'Too many password reset attempts. Please try again later.' },
          { status: 429 }
        )
      }

      // For other errors, return generic message
      return NextResponse.json(
        { 
          success: true, 
          message: 'If this email exists in our system, you will receive a password reset link shortly.' 
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Password reset instructions have been sent to your email.' 
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
