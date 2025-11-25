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
        const { courseId, notes, userId } = body;

        if (!courseId || !userId) {
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
                approved_by: userId,
                approved_at: new Date().toISOString()
            })
            .eq('course_id', courseId)
            .select('course_id, title, code, description, thumbnail, status, duration, created_at')
            .single();

        if (updateError) {
            console.error('Error approving course:', updateError);
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            );
        }

        // Log audit
        await logAudit(userId, 'approve_course', courseId, { notes });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
