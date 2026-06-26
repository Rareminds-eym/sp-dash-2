import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSSOServiceClient } from '@/lib/sso-service-client'

export const runtime = 'edge'

/**
 * SSO Session Check Route - Uses RPC service binding
 * 
 * This route checks if the user has a valid SSO session.
 * It verifies the access token with the SSO worker via RPC.
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

    // Verify token with SSO worker via RPC
    const ssoClient = await createSSOServiceClient()
    const userData = await ssoClient.verifyToken(accessToken)

    if (!userData || !userData.user) {
      // Token is invalid, clear cookies
      cookieStore.delete('sso_access_token')
      cookieStore.delete('sso_refresh_token')
      cookieStore.delete('sso_user')
      
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: userData.user,
    })
  } catch (error) {
    console.error('[SSO Session] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'An error occurred checking session' 
      },
      { status: 500 }
    )
  }
}
