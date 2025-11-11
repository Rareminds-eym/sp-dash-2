import { logAudit } from '@/lib/services/auditService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createRLSClient, getUserContext } from '@/lib/supabase-rls';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);
    
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userContext = await getUserContext(rlsClient, user);
    
    if (!userContext) {
      return NextResponse.json({ error: 'User context not found' }, { status: 403 });
    }
    
    const body = await request.json();
    const { passportId, userId, reason } = body;

    // Update passport status
    const { error: updateError } = await supabase
      .from('skill_passports')
      .update({ status: 'rejected' })
      .eq('id', passportId);

    if (updateError) throw updateError;

    // Log verification
    const { error: verifyError } = await supabase
      .from('verifications')
      .insert({
        id: uuidv4(),
        targetTable: 'skill_passports',
        targetId: passportId,
        action: 'reject',
        performedBy: userId,
        note: reason || 'Passport rejected'
      });

    if (verifyError) throw verifyError;

    // Log audit
    await logAudit(userId, 'reject_passport', passportId, { reason });

    return NextResponse.json({ success: true, message: 'Passport rejected successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
