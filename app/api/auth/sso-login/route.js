import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT, extractUserFromJWT } from '@/lib/jwt-utils'
import { loginWithSSO } from '@/lib/middleware/sso-auth'

export const runtime = 'nodejs'

/**
 * Enhanced SSO Worker Login Route with Service Binding Support
 * 
 * This route handles authentication through the SSO worker with improved
 * JWT verification, service binding support, and better error handling.
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

    // Use enhanced SSO login with service binding support
    const loginResult = await loginWithSSO(email, password, {
      SSO_SERVICE: process.env.SSO_SERVICE, // Cloudflare service binding
      SSO_WORKER_URL: process.env.SSO_WORKER_URL,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL
    })

    if (!loginResult.success) {
      // Enhanced error handling
      let errorMessage = loginResult.error || 'Invalid email or password'
      let statusCode = 401
      
      if (loginResult.error?.includes('Too many')) {
        statusCode = 429
        errorMessage = 'Too many login attempts. Please try again later.'
      } else if (loginResult.error?.includes('disabled') || loginResult.error?.includes('verification')) {
        statusCode = 403
        errorMessage = 'Account is disabled or requires verification.'
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      )
    }

    const { data: loginData, headers: loginHeaders } = loginResult

    // Extract tokens from response - SSO worker returns access_token in body
    const accessToken = loginHeaders.accessToken || loginData.access_token
    
    if (!loginData.user || !accessToken) {
      console.error('[SSO Login] Missing data:', { 
        hasUser: !!loginData.user, 
        hasAccessToken: !!accessToken,
        loginData: loginData,
        loginHeaders: loginHeaders
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

    // Check if user has admin role (super_admin, admin, or manager)
    const allowedRoles = ['super_admin', 'admin', 'manager']
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
      // Note: You can enforce email verification here if needed
      // return NextResponse.json({ success: false, error: 'Email verification required' }, { status: 403 })
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

    // Parse and set refresh token cookie from SSO worker
    let refreshToken = null
    if (loginHeaders.setCookie) {
      const refreshTokenMatch = loginHeaders.setCookie.match(/refresh_token=([^;]+)/)
      if (refreshTokenMatch) {
        refreshToken = refreshTokenMatch[1]
        cookieStore.set('sso_refresh_token', refreshToken, {
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
      tokenExpiry: new Date(user.expiresAt * 1000).toISOString(),
      method: loginResult.usedServiceBinding ? 'service-binding' : 'http-fallback'
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
