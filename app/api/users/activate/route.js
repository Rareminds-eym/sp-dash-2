import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/services/auditService';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { NextResponse } from 'next/server';



export async function POST(request) {
  try {
    const auth = await requirePlatformAdmin(request, ['super_admin', 'admin']);
    if (auth.error) return auth.error;
    const userContext = { id: auth.user.id };

    const body = await request.json();
    const { targetUserId, actorId, note } = body;

    // Update user status using the authorized server client
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ isActive: true })
      .eq('id', targetUserId);

    if (updateError) throw updateError;

    // Log verification using the authorized server client
    const { error: verifyError } = await supabaseAdmin
      .from('verifications')
      .insert({
        targetTable: 'users',
        targetId: targetUserId,
        action: 'activate',
        performedBy: userContext.id,
        note: note || 'User activated'
      });

    if (verifyError) {
      console.error('Verification log error:', verifyError);
      // Don't throw - activation succeeded, just log failed
    }

    // Log audit
    await logAudit(userContext.id, 'activate_user', targetUserId, { note });

    return NextResponse.json({ success: true, message: 'User activated successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
