import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'edge'

export async function POST(request) {
  try {
    const supabase = await createClient()
    
    // Sign out from Supabase Auth (this clears the session server-side)
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Logout error:', error)
      // Don't return error - still clear cookies and return success
      // to ensure user can always logout from client
    }
    
    // Create response with success
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
    
    // Explicitly clear all Supabase auth cookies
    const cookiesToClear = [
      'sb-access-token',
      'sb-refresh-token',
      `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`,
      `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token-code-verifier`
    ]
    
    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        maxAge: 0,
        path: '/',
      })
    })
    
    return response
  } catch (error) {
    console.error('Logout error:', error)
    // Even on error, return success to allow client-side cleanup
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
    return response
  }
}