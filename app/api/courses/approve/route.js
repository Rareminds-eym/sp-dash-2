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
        const { courseId, notes } = body;

        if (!courseId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Update course status using supabaseAdmin
        const { data, error: updateError } = await supabaseAdmin
            .from('courses')
            .update({
                status: 'Active',
                approval_status: 'approved',
                approved_by: user.id,
                approved_at: new Date().toISOString()
            })
            .eq('course_id', courseId)
            .select('course_id, title, code, description, thumbnail, status, approval_status, duration, created_at')
            .single();

        if (updateError) {
            console.error('Error approving course:', updateError);
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            );
        }

        // Log audit
        await logAudit(user.id, 'approve_course', courseId, { notes });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
