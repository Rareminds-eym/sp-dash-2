import { NextResponse } from 'next/server';
import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'edge';

/**
 * POST /api/users/verify-and-activate - Activate user after email verification and password setup
 * This endpoint is called when a user successfully completes password reset
 */
export async function POST(request) {
  try {
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
    
    // Get user from Supabase Auth to check if email is verified
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError || !authUser) {
      return NextResponse.json({
        success: false,
        error: 'User not found in authentication system'
      }, { status: 404 });
    }
    
    // Check if email is confirmed
    if (!authUser.user.email_confirmed_at) {
      return NextResponse.json({
        success: false,
        error: 'Email is not yet verified'
      }, { status: 400 });
    }
    
    // Update user status to active and remove email verification pending flag
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        isActive: true,
        metadata: {
          ...authUser.user.user_metadata,
          emailVerificationPending: false,
          activatedAt: new Date().toISOString()
        }
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('Error activating user:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to activate user'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'User activated successfully'
    });
    
  } catch (error) {
    console.error('Error in POST /api/users/verify-and-activate:', error);
    return handleError(error, 'Verify and Activate User');
  }
}
