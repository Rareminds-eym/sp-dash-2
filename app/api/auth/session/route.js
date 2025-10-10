import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET(request) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, user: null },
        { status: 401 }
      )
    }
    
    return NextResponse.json({
      success: true,
      user: session.user,
    })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json(
      { success: false, user: null },
      { status: 500 }
    )
  }
}