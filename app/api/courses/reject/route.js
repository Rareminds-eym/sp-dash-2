export const runtime = 'edge';
import { logAudit } from '@/lib/services/auditService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { NextResponse } from 'next/server';



export async function POST(request) {
    try {
        const { error: authError, user } = await authenticateSSORequest(request, ['super_admin', 'admin']);
        if (authError) return authError;

        const body = await request.json();
        const { courseId, reason, notes } = body;

        if (!courseId || !reason) {
            return NextResponse.json(
                { error: 'Missing required fields (courseId, reason)' },
                { status: 400 }
            );
        }

        // Update course status using supabaseAdmin  
        const { data, error: updateError } = await supabaseAdmin
            .from('courses')
            .update({
                approval_status: 'rejected',
                rejection_reason: reason,
                rejected_by: user.id,
                rejected_at: new Date().toISOString()
            })
            .eq('course_id', courseId)
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
        await logAudit(user.id, 'reject_course', courseId, { reason, notes });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
