import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT, extractUserFromJWT } from '@/lib/jwt-utils'

export const runtime = 'edge'

/**
 * SSO Login Route
 *
 * Direct HTTP POST to SSO worker with Origin header.
 * Server-to-server authentication.
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

    const ssoWorkerUrl = process.env.SSO_WORKER_URL

    if (!ssoWorkerUrl) {
      throw new Error('SSO_WORKER_URL not configured')
    }

    // Get origin safely
    let serverOrigin

    if (process.env.NODE_ENV === 'production') {
      // Production: use X-Forwarded-Host header (set by reverse proxy/load balancer)
      const forwardedHost = request.headers.get('x-forwarded-host')
      const protocol = request.headers.get('x-forwarded-proto') || 'https'
      serverOrigin = `${protocol}://${forwardedHost || request.headers.get('host')}`
    } else {
      // Development: use safe default localhost
      serverOrigin = 'http://localhost:3000'
    }

    // Direct HTTP POST with Origin header and timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    let ssoResponse
    try {
      ssoResponse = await fetch(`${ssoWorkerUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': serverOrigin,
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!ssoResponse.ok) {
      let errorData = {}
      try {
        errorData = await ssoResponse.json()
      } catch {
        errorData = { error: ssoResponse.statusText || 'Request failed' }
      }
      console.error('[SSO Login] HTTP error:', { status: ssoResponse.status, error: errorData })
      return NextResponse.json(
        { success: false, error: errorData.error || 'Login failed' },
        { status: ssoResponse.status }
      )
    }

    const loginData = await ssoResponse.json()

    if (loginData.error) {
      let errorMessage = loginData.error || 'Invalid email or password'
      let statusCode = loginData.status || 401
      
      if (errorMessage.includes('Too many')) {
        statusCode = 429
        errorMessage = 'Too many login attempts. Please try again later.'
      } else if (errorMessage.includes('disabled') || errorMessage.includes('verification') || errorMessage.includes('blocked')) {
        statusCode = 403
        errorMessage = 'Account is disabled or requires verification.'
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      )
    }

    const accessToken = loginData.access_token
    
    if (!loginData.user || !accessToken) {
      console.error('[SSO Login] Missing data:', { 
        hasUser: !!loginData.user, 
        hasAccessToken: !!accessToken
      })
      return NextResponse.json(
        { success: false, error: 'Login failed - incomplete response from SSO worker' },
        { status: 500 }
      )
    }

    // Verify the JWT token we received
    const verificationResult = await verifyJWT(accessToken)
    
    if (!verificationResult.valid) {
      console.error('[SSO Login] JWT verification failed:', verificationResult.error)
      return NextResponse.json(
        { success: false, error: 'Login failed - invalid token received' },
        { status: 500 }
      )
    }

    // Extract user data from verified JWT payload
    const user = extractUserFromJWT(accessToken)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Login failed - invalid token payload' },
        { status: 500 }
      )
    }

    // Check if user has rm_admin role only
    const allowedRoles = ['rm_admin']
    const hasAdminRole = user.roles.some(role => allowedRoles.includes(role))
    
    if (!hasAdminRole) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Access denied. You are not authorized to access the admin dashboard.',
          userRoles: user.roles,
          requiredRoles: allowedRoles
        },
        { status: 403 }
      )
    }

    // Check email verification
    if (!user.isEmailVerified) {
      console.warn('[SSO Login] User email not verified:', user.email)
    }

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        orgId: user.orgId,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      expiresAt: user.expiresAt * 1000, // Convert to milliseconds
    })

    // Set cookies for session management
    const cookieStore = await cookies()
    
    // Set access token cookie with proper expiry
    const tokenExpirySeconds = user.expiresAt - Math.floor(Date.now() / 1000)
    cookieStore.set('sso_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.max(tokenExpirySeconds, 60), // At least 1 minute
      path: '/',
    })

    // Set refresh token cookie from RPC response
    const refreshToken = loginData.refresh_token
    if (refreshToken) {
      cookieStore.set('sso_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }

    // Store user info in cookie for middleware access
    cookieStore.set('sso_user', JSON.stringify({
      id: user.id,
      email: user.email,
      roles: user.roles,
      orgId: user.orgId,
      isEmailVerified: user.isEmailVerified,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    // Log successful login (without sensitive data)
    console.log('[SSO Login] Successful login:', {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      hasRefreshToken: !!refreshToken,
      tokenExpiry: new Date(user.expiresAt * 1000).toISOString()
    })

    return response
  } catch (error) {
    console.error('[SSO Login] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'An internal error occurred during login. Please try again.' 
      },
      { status: 500 }
    )
  }
}
