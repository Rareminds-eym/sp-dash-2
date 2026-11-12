import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/lib/services/auditService';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { NextResponse } from 'next/server';



export async function DELETE(request, { params }) {
  try {
    const auth = await requirePlatformAdmin(request, ['super_admin', 'admin']);
    if (auth.error) return auth.error;
    const userContext = { id: auth.user.id };

    const body = await request.json();
    const { userId, actorId, reason } = body;
    const targetUserId = userId || (await params).id;

    // Soft delete by deactivating using the authorized server client
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ isActive: false })
      .eq('id', targetUserId);

    if (updateError) throw updateError;

    // Log verification using the authorized server client
    const { error: verifyError } = await supabaseAdmin
      .from('verifications')
      .insert({
        targetTable: 'users',
        targetId: targetUserId,
        action: 'delete',
        performedBy: userContext.id,
        note: reason || 'User deleted'
      });

    if (verifyError) {
      console.error('Verification log error:', verifyError);
      // Don't throw - deletion succeeded, just log failed
    }

    // Log audit
    await logAudit(userContext.id, 'delete_user', targetUserId, { reason });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
