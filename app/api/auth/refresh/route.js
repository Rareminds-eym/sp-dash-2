import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { refreshSSOTokens } from '@/lib/middleware/sso-auth'
import { verifyJWT, extractUserFromJWT } from '@/lib/jwt-utils'

export const runtime = 'nodejs'

/**
 * Enhanced Token Refresh Route with Service Binding Support
 * 
 * This route handles refreshing expired access tokens using refresh tokens.
 * It's called automatically by the frontend when tokens are about to expire.
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get('sso_refresh_token')?.value

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'No refresh token available' },
        { status: 401 }
      )
    }

    // Refresh tokens via SSO Worker with service binding support
    const refreshResult = await refreshSSOTokens(refreshToken, {
      SSO_SERVICE: process.env.SSO_SERVICE, // Cloudflare service binding
      SSO_WORKER_URL: process.env.SSO_WORKER_URL,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL
    })

    if (!refreshResult.success) {
      // Clear invalid refresh token
      cookieStore.delete('sso_refresh_token')
      cookieStore.delete('sso_access_token')
      cookieStore.delete('sso_user')

      return NextResponse.json(
        { success: false, error: refreshResult.error || 'Token refresh failed' },
        { status: 401 }
      )
    }

    const { access_token: newAccessToken, refresh_token: newRefreshToken } = refreshResult.tokens

    // Verify the new access token
    const verificationResult = await verifyJWT(newAccessToken)
    
    if (!verificationResult.valid) {
      console.error('[Token Refresh] New token verification failed:', verificationResult.error)
      return NextResponse.json(
        { success: false, error: 'Invalid token received from refresh' },
        { status: 500 }
      )
    }

    // Extract user data from new token
    const user = extractUserFromJWT(newAccessToken)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid token payload received from refresh' },
        { status: 500 }
      )
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        orgId: user.orgId,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken: newAccessToken,
      expiresAt: user.expiresAt * 1000, // Convert to milliseconds
    })

    // Update cookies with new tokens
    const tokenExpirySeconds = user.expiresAt - Math.floor(Date.now() / 1000)
    
    cookieStore.set('sso_access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.max(tokenExpirySeconds, 60), // At least 1 minute
      path: '/',
    })

    if (newRefreshToken) {
      cookieStore.set('sso_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }

    // Update user cookie
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

    console.log('[Token Refresh] Successful refresh for user:', {
      userId: user.id,
      email: user.email,
      method: refreshResult.usedServiceBinding ? 'service-binding' : 'http-fallback'
    })

    return response
  } catch (error) {
    console.error('[Token Refresh] Error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred during token refresh' },
      { status: 500 }
    )
  }
}