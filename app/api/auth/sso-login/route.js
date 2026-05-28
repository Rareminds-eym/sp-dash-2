import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * SSO Worker Login Route
 * 
 * This route handles authentication through the SSO worker.
 * It calls the SSO worker's /auth/login endpoint and manages the session.
 */
export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const ssoWorkerUrl = process.env.SSO_WORKER_URL || 'http://localhost:8788'
    
    console.log('[SSO Login] Calling SSO worker at:', ssoWorkerUrl)
    
    // Call SSO worker login endpoint
    const loginResponse = await fetch(`${ssoWorkerUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })
    
    console.log('[SSO Login] SSO worker response status:', loginResponse.status)

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json().catch(() => ({}))
      console.log('[SSO Login] Error from SSO worker:', errorData)
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.error || 'Invalid email or password' 
        },
        { status: loginResponse.status }
      )
    }

    const loginData = await loginResponse.json()
    console.log('[SSO Login] Login successful, user:', loginData.user?.email)

    // Extract tokens from response
    const accessToken = loginResponse.headers.get('X-Access-Token') || loginData.access_token
    const setCookieHeader = loginResponse.headers.get('Set-Cookie')

    if (!loginData.user) {
      return NextResponse.json(
        { success: false, error: 'Login failed - no user data returned' },
        { status: 500 }
      )
    }

    // Decode JWT to get roles (JWT format: header.payload.signature)
    let userRoles = []
    try {
      if (accessToken) {
        const payloadBase64 = accessToken.split('.')[1]
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
        userRoles = payload.roles || []
        console.log('[SSO Login] User roles from JWT:', userRoles)
      }
    } catch (err) {
      console.error('[SSO Login] Failed to decode JWT:', err)
    }

    // Check if user has admin role (super_admin, admin, or manager)
    const allowedRoles = ['super_admin', 'admin', 'manager']
    const hasAdminRole = userRoles.some(role => allowedRoles.includes(role))
    
    console.log('[SSO Login] Has admin role:', hasAdminRole, 'Roles:', userRoles)
    
    if (!hasAdminRole) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Access denied. You are not authorized to access the admin dashboard.' 
        },
        { status: 403 }
      )
    }

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: loginData.user.id,
        email: loginData.user.email,
        roles: userRoles,
        orgId: loginData.active_org_id,
        isEmailVerified: false, // Will be in JWT payload
      },
      accessToken,
    })

    // Set cookies for session management
    const cookieStore = await cookies()
    
    // Set access token cookie
    if (accessToken) {
      cookieStore.set('sso_access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 15, // 15 minutes
        path: '/',
      })
    }

    // Parse and set refresh token cookie from SSO worker
    if (setCookieHeader) {
      const refreshTokenMatch = setCookieHeader.match(/refresh_token=([^;]+)/)
      if (refreshTokenMatch) {
        cookieStore.set('sso_refresh_token', refreshTokenMatch[1], {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: '/',
        })
      }
    }

    // Store user info in cookie for middleware access
    cookieStore.set('sso_user', JSON.stringify({
      id: loginData.user.id,
      email: loginData.user.email,
      roles: userRoles,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    console.log('[SSO Login] Login complete, cookies set')

    return response
  } catch (error) {
    console.error('SSO login error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An error occurred during login' 
      },
      { status: 500 }
    )
  }
}
