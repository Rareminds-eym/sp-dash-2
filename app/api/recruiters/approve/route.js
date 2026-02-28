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
    const { recruiterId, notes, userId } = body;

    if (!recruiterId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update recruiter status
    const { data, error: updateError } = await supabaseAdmin
      .from('recruiters')
      .update({
        approval_status: 'approved',
        account_status: 'active',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', recruiterId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving recruiter:', updateError);
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
          account_status: 'active'
        })
        .eq('id', data.user_id);
    }

    // Log audit
    await logAudit(userId, 'approve_recruiter', recruiterId, { notes });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
