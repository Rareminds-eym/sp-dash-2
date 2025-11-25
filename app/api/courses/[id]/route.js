import { logAudit } from '@/lib/services/auditService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createRLSClient, getUserContext } from '@/lib/supabase-rls';
import { NextResponse } from 'next/server';
import { handleError, unauthorizedError, forbiddenError, validationError, parseSupabaseError, notFoundError } from '@/lib/middleware/errorHandler';
import { validateCourseData, sanitizeCourseData } from '@/lib/validators/courseValidator';

export const runtime = 'edge';

/**
 * GET /api/courses/[id] - Fetch a single course by ID
 */
export async function GET(request, { params }) {
    try {
        const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);

        if (!user || authError) {
            return unauthorizedError();
        }

        const { id } = await params;

        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            return validationError(['Course ID is required and must be valid']);
        }

        // Fetch course from database
        const { data, error } = await supabaseAdmin
            .from('courses')
            .select('*')
            .eq('course_id', id)
            .is('deleted_at', null) // Exclude deleted courses
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return notFoundError('Course');
            }
            const appError = parseSupabaseError(error);
            return handleError(appError, 'GET /api/courses/[id]', { courseId: id });
        }

        if (!data) {
            return notFoundError('Course');
        }

        // Map database schema to frontend format
        const mapped = {
            id: data.course_id,
            name: data.title,
            course_code: data.code,
            description: data.description,
            university: data.university,
            duration: data.duration,
            credits: data.credits,
            category: data.category,
            thumbnail_url: data.thumbnail,
            target_outcomes: data.target_outcomes,
            approval_status: data.status === 'Draft' ? 'pending' : data.status === 'Active' ? 'approved' : data.status,
            created_at: data.created_at,
            updated_at: data.updated_at,
            created_by: data.educator_id,
            educator_name: data.educator_name
        };

        return NextResponse.json({ success: true, data: mapped });
    } catch (error) {
        return handleError(error, 'GET /api/courses/[id]');
    }
}

/**
 * PUT /api/courses/[id] - Update a course
 */
export async function PUT(request, { params }) {
    try {
        const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);

        if (!user || authError) {
            return unauthorizedError();
        }

        const userContext = await getUserContext(rlsClient, user);

        if (!userContext) {
            return forbiddenError('User context not found');
        }

        const { id } = await params;

        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            return validationError(['Course ID is required and must be valid']);
        }

        // Parse and validate JSON body
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return handleError(e, 'PUT /api/courses/[id] - JSON parsing');
        }

        // Validate course data for update
        const validation = validateCourseData(body, true);
        if (!validation.valid) {
            return validationError(validation.errors);
        }

        // Sanitize course data
        const sanitizedData = sanitizeCourseData(body);

        // Update course
        const { data, error: updateError } = await supabaseAdmin
            .from('courses')
            .update({
                ...sanitizedData,
                updated_at: new Date().toISOString()
            })
            .eq('course_id', id)
            .is('deleted_at', null) // Only update non-deleted courses
            .select('course_id, title, code, description, university, duration, credits, category, thumbnail, target_outcomes, status, created_at, updated_at')
            .single();

        if (updateError) {
            if (updateError.code === 'PGRST116') {
                return notFoundError('Course');
            }
            const appError = parseSupabaseError(updateError);
            return handleError(appError, 'PUT /api/courses/[id]', { courseId: id, userId: user.id });
        }

        if (!data) {
            return notFoundError('Course');
        }

        // Log audit (non-blocking, errors logged but not thrown)
        try {
            await logAudit(user.id, 'update_course', id, {
                changes: body,
                updated_by: user?.metadata?.name || user?.email
            });
        } catch (auditError) {
            console.error('Audit log failed:', auditError);
        }

        // Map response
        const mapped = {
            id: data.course_id,
            name: data.title,
            course_code: data.code,
            description: data.description,
            university: data.university,
            duration: data.duration,
            credits: data.credits,
            category: data.category,
            thumbnail_url: data.thumbnail,
            target_outcomes: data.target_outcomes,
            approval_status: data.status === 'Draft' ? 'pending' : data.status === 'Active' ? 'approved' : data.status,
            created_at: data.created_at,
            updated_at: data.updated_at
        };

        return NextResponse.json({ success: true, data: mapped });
    } catch (error) {
        return handleError(error, 'PUT /api/courses/[id]');
    }
}

/**
 * DELETE /api/courses/[id] - Soft delete a course
 */
export async function DELETE(request, { params }) {
    try {
        const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);

        if (!user || authError) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userContext = await getUserContext(rlsClient, user);

        if (!userContext) {
            return NextResponse.json({ error: 'User context not found' }, { status: 403 });
        }

        const { id } = params;

        if (!id) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        // Soft delete course
        const { data, error: deleteError } = await supabaseAdmin
            .from('courses')
            .update({
                deleted_at: new Date().toISOString()
            })
            .eq('course_id', id)
            .is('deleted_at', null) // Only delete if not already deleted
            .select('course_id, title')
            .single();

        if (deleteError) {
            console.error('Error deleting course:', deleteError);
            return NextResponse.json(
                { error: deleteError.message },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: 'Course not found or already deleted' },
                { status: 404 }
            );
        }

        // Log audit
        await logAudit(user.id, 'delete_course', id, {
            course_name: data.title,
            deleted_by: user?.metadata?.name || user?.email
        });

        return NextResponse.json({
            success: true,
            message: `Course "${data.title}" has been deleted`
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
