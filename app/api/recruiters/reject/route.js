import { logAudit } from '@/lib/services/auditService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createRLSClient, getUserContext } from '@/lib/supabase-rls';
import { NextResponse } from 'next/server';

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
    const { recruiterId, reason, notes, userId } = body;

    if (!recruiterId || !userId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update recruiter status
    const { data, error: updateError } = await supabaseAdmin
      .from('recruiters')
      .update({
        approval_status: 'rejected',
        account_status: 'inactive',
        rejection_reason: reason,
        rejected_by: userId,
        rejected_at: new Date().toISOString()
      })
      .eq('id', recruiterId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting recruiter:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Also update the associated user's account status
    if (data?.user_id) {
      await supabaseAdmin
        .from('users')
        .update({
          account_status: 'inactive'
        })
        .eq('id', data.user_id);
    }

    // Log audit
    await logAudit(userId, 'reject_recruiter', recruiterId, { reason, notes });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
