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
    const { recruiterId, userId, reason } = body;

    if (!recruiterId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Try new schema first
    let updateData = {
      approval_status: 'rejected',
      account_status: 'inactive',
      rejection_reason: reason
    };
    
    const { data, error: updateError } = await supabase
      .from('recruiters')
      .update(updateData)
      .eq('id', recruiterId)
      .select()
      .single();

    // If that fails, try old schema
    if (updateError) {
      const { data: oldData, error: oldUpdateError } = await supabase
        .from('recruiters')
        .update({ 
          verificationstatus: 'rejected',
          isactive: false
        })
        .eq('id', recruiterId)
        .select()
        .single();
      
      if (oldUpdateError) throw oldUpdateError;
    }

    // Log verification
    const { error: verifyError } = await supabase
      .from('verifications')
      .insert({
        id: uuidv4(),
        targetTable: 'recruiters',
        targetId: recruiterId,
        action: 'reject',
        performedBy: userId,
        note: reason || 'Recruiter rejected'
      });

    if (verifyError) throw verifyError;

    // Log audit
    await logAudit(userId, 'reject_recruiter', recruiterId, { reason });

    return NextResponse.json({ success: true, message: 'Recruiter rejected successfully', data: data || oldData });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
