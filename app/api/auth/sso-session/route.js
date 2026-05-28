import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * SSO Worker Session Check Route
 * 
 * This route checks if the user has a valid SSO session.
 * It verifies the access token with the SSO worker.
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sso_access_token')?.value
    const userCookie = cookieStore.get('sso_user')?.value

    if (!accessToken || !userCookie) {
      return NextResponse.json(
        { success: false, error: 'No active session' },
        { status: 401 }
      )
    }

    const ssoWorkerUrl = process.env.SSO_WORKER_URL || 'http://localhost:8787'
    
    // Verify token with SSO worker
    const meResponse = await fetch(`${ssoWorkerUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Origin': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      },
    })

    if (!meResponse.ok) {
      // Token is invalid, clear cookies
      cookieStore.delete('sso_access_token')
      cookieStore.delete('sso_refresh_token')
      cookieStore.delete('sso_user')
      
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    const userData = await meResponse.json()

    return NextResponse.json({
      success: true,
      user: {
        id: userData.user.id,
        email: userData.user.email,
        roles: userData.user.roles,
        orgId: userData.user.orgId,
        orgName: userData.user.orgName,
        isEmailVerified: userData.user.isEmailVerified,
      },
    })
  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'An error occurred checking session' 
      },
      { status: 500 }
    )
  }
}
