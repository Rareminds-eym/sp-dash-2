import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * SSO Session Route
 * Returns the current user session from SSO cookies
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const ssoAccessToken = cookieStore.get('sso_access_token')?.value
    const ssoUserCookie = cookieStore.get('sso_user')?.value

    if (!ssoAccessToken || !ssoUserCookie) {
      return NextResponse.json(
        { success: false, user: null, error: 'No active session' },
        { status: 401 }
      )
    }

    // Parse user data from cookie
    let user
    try {
      user = JSON.parse(ssoUserCookie)
    } catch (e) {
      return NextResponse.json(
        { success: false, user: null, error: 'Invalid session data' },
        { status: 401 }
      )
    }

    // Decode JWT to get additional claims
    try {
      const payloadBase64 = ssoAccessToken.split('.')[1]
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
      
      // Add JWT claims to user object
      user.orgId = payload.org_id
      user.isEmailVerified = payload.is_email_verified
      user.membershipStatus = payload.membership_status
    } catch (err) {
      console.error('[Session] Failed to decode JWT:', err)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.roles?.[0] || 'member', // Use first role for compatibility
        roles: user.roles || [],
        orgId: user.orgId,
        isEmailVerified: user.isEmailVerified,
        membershipStatus: user.membershipStatus,
      },
    })
  } catch (error) {
    console.error('[Session] Error:', error)
    return NextResponse.json(
      { success: false, user: null, error: error.message },
      { status: 500 }
    )
  }
}