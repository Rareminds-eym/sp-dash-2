import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT, extractUserFromJWT } from '@/lib/jwt-utils'

export const runtime = 'edge'

function respondError(status, error) {
  return NextResponse.json({ success: false, error }, { status })
}

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
      return respondError(400, 'Email and password are required')
    }

    // Convert to RPC call
    const { createSSOServiceClient } = await import('@/lib/sso-service-client')
    const ssoClient = await createSSOServiceClient()
    
    let loginData
    try {
      loginData = await ssoClient.login({
        email,
        password,
        ip: request.headers.get('x-forwarded-for') || '127.0.0.1',
        ua: request.headers.get('user-agent') || 'sp-dash'
      })
    } catch (err) {
      console.error('[SSO Login] RPC error:', err)
      let errorMessage = err.message || 'Login failed'
      let statusCode = 401
      
      if (errorMessage.includes('Too many') || errorMessage.includes('Rate limit')) {
        statusCode = 429
        errorMessage = 'Too many login attempts. Please try again later.'
      } else if (errorMessage.includes('disabled') || errorMessage.includes('verification') || errorMessage.includes('blocked')) {
        statusCode = 403
        errorMessage = 'Account is disabled or requires verification.'
      }
      
      return respondError(statusCode, errorMessage)
    }

    // Business-logic error from SSO Worker (normal return, not exception)
    // loginData.status is forwarded from performLogin() via RPC wrapper
    if (!loginData || !loginData.success || loginData.error) {
      const statusCode = loginData.status ?? 401
      const errorMessage = loginData.error || 'Login failed'
      console.warn('[SSO Login] Login failed:', { status: statusCode, error: errorMessage })
      return respondError(statusCode, errorMessage)
    }

    const accessToken = loginData.access_token

    if (!loginData.user || !accessToken) {
      console.error('[SSO Login] Missing data:', { 
        hasUser: !!loginData.user, 
        hasAccessToken: !!accessToken
      })
      return respondError(500, 'Login failed - incomplete response from SSO worker')
    }

    // Verify the JWT token we received
    const verificationResult = await verifyJWT(accessToken)
    
    if (!verificationResult.valid) {
      console.error('[SSO Login] JWT verification failed:', verificationResult.error)
      return respondError(500, 'Login failed - invalid token received')
    }

    // Extract user data from verified JWT payload
    const user = extractUserFromJWT(accessToken)
    
    if (!user) {
      return respondError(500, 'Login failed - invalid token payload')
    }

    // Check if user has super_admin or platform_admin role
    const allowedRoles = ['super_admin', 'platform_admin']
    const hasAdminRole = user.roles?.some(role => allowedRoles.includes(role)) ?? false
    
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
    if (error instanceof SyntaxError) {
      return respondError(400, 'Invalid JSON in request body')
    }
    console.error('[SSO Login] Error:', error)
    return respondError(500, 'An internal error occurred during login. Please try again.')
  }
}
