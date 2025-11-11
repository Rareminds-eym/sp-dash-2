import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../../../lib/supabase';
import { createRLSClient, getUserContext } from '../../../../../lib/supabase-rls';

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
    const { recruiterIds, action, userId, note, reason } = body;
    
    if (!recruiterIds || !Array.isArray(recruiterIds) || recruiterIds.length === 0) {
      return NextResponse.json({ error: 'recruiterIds array is required' }, { status: 400 });
    }
    
    if (!action || !['approve', 'reject', 'suspend', 'activate'].includes(action)) {
      return NextResponse.json({ error: 'Valid action is required (approve, reject, suspend, activate)' }, { status: 400 });
    }
    
    let updateData = {};
    let verificationAction = action;
    let logMessage = '';
    
    if (action === 'approve') {
      updateData = { verificationstatus: 'approved' };
      logMessage = note || 'Recruiters approved in bulk';
    } else if (action === 'reject') {
      updateData = { verificationstatus: 'rejected', isactive: false };
      logMessage = reason || 'Recruiters rejected in bulk';
    } else if (action === 'suspend') {
      updateData = { isactive: false };
      logMessage = reason || 'Recruiters suspended in bulk';
    } else if (action === 'activate') {
      updateData = { isactive: true };
      logMessage = note || 'Recruiters activated in bulk';
    }
    
    // Update all recruiters
    const { error: updateError } = await supabase
      .from('recruiters')
      .update(updateData)
      .in('id', recruiterIds);
    
    if (updateError) throw updateError;
    
    // Log verification and audit for each recruiter
    const verificationRecords = recruiterIds.map(id => ({
      id: uuidv4(),
      targetTable: 'recruiters',
      targetId: id,
      action: verificationAction,
      performedBy: userId,
      note: logMessage
    }));
    
    const auditRecords = recruiterIds.map(id => ({
      id: uuidv4(),
      actorId: userId,
      action: `${action}_recruiter`,
      target: id,
      payload: { note: logMessage, bulk: true }
    }));
    
    // Insert in bulk
    await supabase.from('verifications').insert(verificationRecords);
    await supabase.from('audit_logs').insert(auditRecords);
    
    return NextResponse.json({ 
      success: true, 
      message: `${recruiterIds.length} recruiter(s) ${action}d successfully` 
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    return NextResponse.json({ error: 'Bulk action failed', details: error.message }, { status: 500 });
  }
}
