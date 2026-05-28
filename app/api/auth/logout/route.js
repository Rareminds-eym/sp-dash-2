import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * SSO Logout Route
 * Clears SSO session cookies and redirects to login
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies()
    
    // Get refresh token for SSO worker logout
    const refreshToken = cookieStore.get('sso_refresh_token')?.value
    
    // Call SSO worker logout endpoint if we have a refresh token
    if (refreshToken) {
      const ssoWorkerUrl = process.env.SSO_WORKER_URL || 'http://localhost:8788'
      
      try {
        await fetch(`${ssoWorkerUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
      } catch (err) {
        console.error('[SSO Logout] Failed to call SSO worker:', err)
        // Continue anyway to clear local cookies
      }
    }
    
    // Clear all SSO cookies
    cookieStore.delete('sso_access_token')
    cookieStore.delete('sso_refresh_token')
    cookieStore.delete('sso_user')
    
    // Also clear old Supabase cookies if they exist
    cookieStore.delete('sb-access-token')
    cookieStore.delete('sb-refresh-token')
    
    console.log('[SSO Logout] Cookies cleared')
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    console.error('[SSO Logout] Error:', error)
    // Even on error, return success to allow client-side cleanup
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  }
}