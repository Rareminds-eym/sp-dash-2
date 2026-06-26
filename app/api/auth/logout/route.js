import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSSOServiceClient } from '@/lib/sso-service-client'

export const runtime = 'edge'

/**
 * Enhanced Logout Route
 * 
 * Handles logout by calling SSO Worker via RPC service binding and cleaning up all session data.
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies()
    const ssoRefreshToken = cookieStore.get('sso_refresh_token')?.value

    // Call SSO Worker logout via RPC if we have a refresh token
    if (ssoRefreshToken) {
      try {
        const ssoClient = await createSSOServiceClient()
        
        // Optionally get IP and UA from request headers
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown'
        const ua = request.headers.get('user-agent') || 'unknown'

        await ssoClient.logout({
          refresh_token: ssoRefreshToken,
          ip,
          ua
        })
        
        console.log('[Logout] SSO Worker logout RPC called successfully')
      } catch (error) {
        console.error('[Logout] SSO Worker logout RPC failed:', error)
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