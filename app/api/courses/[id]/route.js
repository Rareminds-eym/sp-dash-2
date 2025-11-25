import { logAudit } from '@/lib/services/auditService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createRLSClient, getUserContext } from '@/lib/supabase-rls';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/courses/[id] - Fetch a single course by ID
 */
export async function GET(request, { params }) {
    try {
        const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);

        if (!user || authError) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        if (!id) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        // Fetch course from database
        const { data, error } = await supabaseAdmin
            .from('courses')
            .select('*')
            .eq('course_id', id)
            .is('deleted_at', null) // Exclude deleted courses
            .single();

        if (error || !data) {
            console.error('Error fetching course:', error);
            return NextResponse.json(
                { error: 'Course not found' },
                { status: 404 }
            );
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
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/courses/[id] - Update a course
 */
export async function PUT(request, { params }) {
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
        const body = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        const {
            name,
            course_code,
            description,
            university,
            duration,
            credits,
            category,
            thumbnail_url,
            target_outcomes
        } = body;

        // Validate required fields
        if (!name || !course_code || !description || !university || !duration || !credits || !category || !thumbnail_url || !target_outcomes) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Update course
        const { data, error: updateError } = await supabaseAdmin
            .from('courses')
            .update({
                title: name,
                code: course_code,
                description,
                university,
                duration,
                credits: Number(credits),
                category,
                thumbnail: thumbnail_url,
                target_outcomes,
                updated_at: new Date().toISOString(),
                updated_by: user.id
            })
            .eq('course_id', id)
            .is('deleted_at', null) // Only update non-deleted courses
            .select('course_id, title, code, description, university, duration, credits, category, thumbnail, target_outcomes, status, created_at, updated_at')
            .single();

        if (updateError) {
            console.error('Error updating course:', updateError);
            return NextResponse.json(
                { error: updateError.message },
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
        await logAudit(user.id, 'update_course', id, {
            changes: body,
            updated_by: user?.metadata?.name || user?.email
        });

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
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
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
                deleted_at: new Date().toISOString(),
                updated_by: user.id
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
