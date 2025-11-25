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
        const { courseId, reason, notes, userId } = body;

        if (!courseId || !userId || !reason) {
            return NextResponse.json(
                { error: 'Missing required fields (courseId, userId, reason)' },
                { status: 400 }
            );
        }

        // Update course status using supabaseAdmin  
        const { data, error: updateError } = await supabaseAdmin
            .from('courses')
            .update({
                approval_status: 'rejected',
                rejection_reason: reason,
                rejected_by: userId,
                rejected_at: new Date().toISOString()
            })
            .eq('id', courseId)
            .select()
            .single();

        if (updateError) {
            console.error('Error rejecting course:', updateError);
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            );
        }

        // Log audit
        await logAudit(userId, 'reject_course', courseId, { reason, notes });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
