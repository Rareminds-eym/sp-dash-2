import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT, getTokenExpiry, getTimeUntilExpiry, extractUserFromJWT } from '@/lib/jwt-utils'

export const runtime = 'nodejs'

/**
 * Enhanced SSO Session Route with Optimized Token Handling
 * Returns the current user session with token expiry details and smart caching
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const ssoAccessToken = cookieStore.get('sso_access_token')?.value
    const ssoUserCookie = cookieStore.get('sso_user')?.value

    if (!ssoAccessToken || !ssoUserCookie) {
      return NextResponse.json(
        { authenticated: false, user: null, error: 'No active session' },
        { status: 401 }
      )
    }

    // Quick expiry check before expensive verification
    const expiresAt = getTokenExpiry(ssoAccessToken)
    const timeUntilExpiry = getTimeUntilExpiry(ssoAccessToken)
    
    if (timeUntilExpiry <= 0) {
      return NextResponse.json(
        { authenticated: false, user: null, error: 'Token expired' },
        { status: 401 }
      )
    }

    // Verify JWT token with enhanced error handling
    const verificationResult = await verifyJWT(ssoAccessToken)
    
    if (!verificationResult.valid) {
      console.error('[Session] JWT verification failed:', verificationResult.error)
      return NextResponse.json(
        { authenticated: false, user: null, error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Extract user data from JWT
    const user = extractUserFromJWT(ssoAccessToken)
    
    if (!user) {
      return NextResponse.json(
        { authenticated: false, user: null, error: 'Invalid token payload' },
        { status: 401 }
      )
    }

    // Merge with cookie data for backward compatibility
    try {
      const cookieUser = JSON.parse(ssoUserCookie)
      
      // Enhance user object with cookie data as fallback
      user.membershipStatus = user.membershipStatus || cookieUser.membershipStatus
      
      // Add legacy role field for backward compatibility
      user.role = user.roles?.[0] || 'member'
    } catch (e) {
      console.warn('[Session] Failed to parse user cookie, using JWT data only:', e.message)
      user.role = user.roles?.[0] || 'member'
    }

    // Calculate refresh timing
    const needsRefresh = timeUntilExpiry < 5 * 60 * 1000 // Less than 5 minutes
    const shouldRefreshSoon = timeUntilExpiry < 10 * 60 * 1000 // Less than 10 minutes

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role, // Legacy field
        roles: user.roles,
        orgId: user.orgId,
        isEmailVerified: user.isEmailVerified,
        membershipStatus: user.membershipStatus,
      },
      expiresAt,
      timeUntilExpiry,
      needsRefresh,
      shouldRefreshSoon,
      tokenInfo: {
        issuedAt: user.issuedAt,
        issuer: user.issuer,
        audience: user.audience,
      }
    })
  } catch (error) {
    console.error('[Session] Error:', error)
    return NextResponse.json(
      { authenticated: false, user: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}