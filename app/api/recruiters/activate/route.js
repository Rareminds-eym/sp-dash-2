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
    const { recruiterId, userId, note } = body;

    // Update recruiter status in recruiters table
    const { error: updateError } = await supabase
      .from('recruiters')
      .update({ isactive: true })
      .eq('id', recruiterId);

    if (updateError) throw updateError;

    // Log verification
    const { error: verifyError } = await supabase
      .from('verifications')
      .insert({
        id: uuidv4(),
        targetTable: 'recruiters',
        targetId: recruiterId,
        action: 'activate',
        performedBy: userId,
        note: note || 'Recruiter activated'
      });

    if (verifyError) throw verifyError;

    // Log audit
    await logAudit(userId, 'activate_recruiter', recruiterId, { note });

    return NextResponse.json({ success: true, message: 'Recruiter activated successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
