import { NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/users/resend-email - Resend password reset email to an admin user
 */
export async function POST(request) {
  try {
    const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin']);
    if (error) return error;
    
    // Parse request body
    const body = await request.json();
    const { userId } = body;
    
    // Validate required fields
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }
    
    // Get user details
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, isActive')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }
    
    // Check if user is already active
    if (userData.isActive) {
      return NextResponse.json({
        success: false,
        error: 'User is already active. Password reset email cannot be resent.'
      }, { status: 400 });
    }
    
    // Resend password reset email
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      userData.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/reset-password`
      }
    );
    
    if (resetError) {
      console.error('Error sending password reset email:', resetError);
      
      // Handle rate limit error specifically
      if (resetError.message && resetError.message.includes('Email rate limit exceeded')) {
        return NextResponse.json({
          success: false,
          error: 'Email rate limit exceeded. Please wait a few minutes before trying again.'
        }, { status: 429 });
      }
      
      return NextResponse.json({
        success: false,
        error: resetError.message || 'Failed to send password reset email'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Password reset email sent successfully to ${userData.email}`
    });
    
  } catch (error) {
    console.error('Error in POST /api/users/resend-email:', error);
    return handleError(error, 'Resend Email');
  }
}
