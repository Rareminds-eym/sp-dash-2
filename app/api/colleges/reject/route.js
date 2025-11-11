import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';
import { createRLSClient, getUserContext } from '../../../../../lib/supabase-rls';
import { logAudit } from '../../../../../lib/services/auditService';

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
    const { collegeId, reason, userId } = body;

    if (!collegeId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update college status
    const { data, error: updateError } = await supabase
      .from('colleges')
      .update({
        approvalStatus: 'rejected',
        accountStatus: 'inactive',
        rejectionReason: reason
      })
      .eq('id', collegeId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting college:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log audit
    await logAudit(userId, 'reject_college', collegeId, { reason });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
