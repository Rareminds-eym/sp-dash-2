import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/session'

export async function POST(request) {
  try {
    await deleteSession()
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred during logout' },
      { status: 500 }
    )
  }
}