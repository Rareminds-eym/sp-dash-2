import { logAudit } from '@/lib/services/auditService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createRLSClient, getUserContext } from '@/lib/supabase-rls';
import { NextResponse } from 'next/server';
import { handleError, unauthorizedError, forbiddenError, validationError, parseSupabaseError, notFoundError } from '@/lib/middleware/errorHandler';
import { validateApprovalData } from '@/lib/validators/courseValidator';

export const runtime = 'edge';

export async function POST(request) {
    try {
        const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);

        if (!user || authError) {
            return unauthorizedError();
        }

        const userContext = await getUserContext(rlsClient, user);

        if (!userContext) {
            return forbiddenError('User context not found');
        }

        // Parse and validate JSON body
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return handleError(e, 'POST /api/courses/approve - JSON parsing');
        }

        // Validate approval data
        const validation = validateApprovalData(body);
        if (!validation.valid) {
            return validationError(validation.errors);
        }

        const { courseId, notes, userId } = body;

        // Check if course exists and is not already approved
        const { data: existingCourse, error: checkError } = await supabaseAdmin
            .from('courses')
            .select('course_id, status, title')
            .eq('course_id', courseId)
            .is('deleted_at', null)
            .single();

        if (checkError) {
            if (checkError.code === 'PGRST116') {
                return notFoundError('Course');
            }
            const appError = parseSupabaseError(checkError);
            return handleError(appError, 'POST /api/courses/approve', { courseId });
        }

        if (!existingCourse) {
            return notFoundError('Course');
        }

        if (existingCourse.status === 'Active') {
            return validationError(['Course is already approved']);
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
            .is('deleted_at', null)
            .select('course_id, title, code, description, thumbnail, status, duration, created_at')
            .single();

        if (updateError) {
            const appError = parseSupabaseError(updateError);
            return handleError(appError, 'POST /api/courses/approve', { courseId, userId });
        }

        if (!data) {
            return notFoundError('Course');
        }

        // Log audit (non-blocking, errors logged but not thrown)
        try {
            await logAudit(userId, 'approve_course', courseId, { notes, course_name: data.title });
        } catch (auditError) {
            console.error('Audit log failed:', auditError);
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return handleError(error, 'POST /api/courses/approve');
    }
}
