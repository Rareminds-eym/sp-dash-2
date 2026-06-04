import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Enhanced Logout Route
 * 
 * Handles logout by calling SSO Worker and cleaning up all session data.
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const ssoAccessToken = cookieStore.get('sso_access_token')?.value
    const ssoRefreshToken = cookieStore.get('sso_refresh_token')?.value

    // Call SSO Worker logout if we have tokens
    if (ssoAccessToken) {
      try {
        const ssoWorkerUrl = process.env.SSO_WORKER_URL || 'http://localhost:8788'
        
        await fetch(`${ssoWorkerUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ssoAccessToken}`,
            'Content-Type': 'application/json',
            'Origin': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          },
          body: JSON.stringify({
            refresh_token: ssoRefreshToken
          }),
        })
        
        console.log('[Logout] SSO Worker logout called successfully')
      } catch (error) {
        console.error('[Logout] SSO Worker logout failed:', error)
        // Continue with local cleanup even if SSO logout fails
      }
    }

    // Clear all SSO-related cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // Expire immediately
    }

    cookieStore.set('sso_access_token', '', cookieOptions)
    cookieStore.set('sso_refresh_token', '', cookieOptions)
    cookieStore.set('sso_user', '', cookieOptions)

    console.log('[Logout] Session cleanup completed')

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('[Logout] Error:', error)
    
    // Even if there's an error, try to clear cookies
    try {
      const cookieStore = await cookies()
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      }

      cookieStore.set('sso_access_token', '', cookieOptions)
      cookieStore.set('sso_refresh_token', '', cookieOptions)
      cookieStore.set('sso_user', '', cookieOptions)
    } catch (cookieError) {
      console.error('[Logout] Cookie cleanup failed:', cookieError)
    }

    return NextResponse.json(
      { success: false, error: 'Logout failed, but local session cleared' },
      { status: 500 }
    )
  }
}