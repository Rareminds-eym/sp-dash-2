import { logAudit } from '@/lib/services/auditService';
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
    const { passportId, userId, note } = body;

    // Update passport status using RLS client
    const { error: updateError } = await rlsClient
      .from('skill_passports')
      .update({ status: 'verified' })
      .eq('id', passportId);

    if (updateError) throw updateError;

    // Log verification using RLS client
    const { error: verifyError } = await rlsClient
      .from('verifications')
      .insert({
        id: uuidv4(),
        targetTable: 'skill_passports',
        targetId: passportId,
        action: 'verify',
        performedBy: userId || userContext.id,
        note: note || 'Passport verified'
      });

    if (verifyError) throw verifyError;

    // Log audit
    await logAudit(userContext.id, 'verify_passport', passportId, { note });

    return NextResponse.json({ success: true, message: 'Passport verified successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
