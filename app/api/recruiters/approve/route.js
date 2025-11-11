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
    const { recruiterId, userId, notes, note } = body;

    if (!recruiterId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if using new schema or old schema
    const finalNote = notes || note || 'Recruiter approved';
    
    // Try to update with new schema first
    let updateData = { 
      approval_status: 'approved',
      account_status: 'active',
      approved_by: userId,
      approved_at: new Date().toISOString()
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
          verificationstatus: 'approved'
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
        action: 'approve',
        performedBy: userId,
        note: finalNote
      });

    if (verifyError) throw verifyError;

    // Log audit
    await logAudit(userId, 'approve_recruiter', recruiterId, { note: finalNote });

    return NextResponse.json({ success: true, message: 'Recruiter approved successfully', data: data || oldData });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
