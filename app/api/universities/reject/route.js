import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { logAudit } from '../../../../../lib/services/auditService';
import { createRLSClient, getUserContext } from '../../../lib/supabase-rls';

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
    const { universityId, reason, userId } = body;

    if (!universityId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update university status
    const { data, error: updateError } = await supabase
      .from('universities')
      .update({
        approval_status: 'rejected',
        account_status: 'inactive',
        rejection_reason: reason
      })
      .eq('id', universityId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting university:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log audit
    await logAudit(userId, 'reject_university', universityId, { reason });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
