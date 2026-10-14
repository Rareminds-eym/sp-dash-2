import { logAudit } from '@/lib/services/auditService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { NextResponse } from 'next/server';
import {
    validateHierarchyPayload,
    validateOptionalUrl,
    validateResourceType,
    validateResourceUrl,
} from '@/lib/services/course-resource-validation';
import { z } from 'zod';

const CourseUpdateSchema = z.object({
    title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title is required'),
    code: z.string({ required_error: 'Code is required' }).trim().min(1, 'Code is required'),
    description: z.string({ required_error: 'Description is required' }).trim().min(1, 'Description is required'),
    duration: z.string({ required_error: 'Duration is required' }).trim().min(1, 'Duration is required'),
    credits: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
        z.number().finite('Credits must be a valid number').min(0, 'Credits cannot be negative').nullable().optional()
    ),
    thumbnail: z.string().nullable().optional(),
    university: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    target_outcomes: z.array(z.string()).optional().default([]),
    skillsCovered: z.array(z.string()).optional().default([]),
    linkedClasses: z.array(z.string()).optional().default([]),
    // Omitted (undefined) = hierarchy untouched. Explicit array (+ updateHierarchy
    // intent flag on the raw body) = replace. Never default to [] here: a
    // default would turn "field not sent" into "delete everything".
    modules: z.array(z.any()).optional(),
    expectedUpdatedAt: z.string().nullable().optional(),
});


/**
 * GET /api/courses/[id] - Fetch a single course by ID
 */
export async function GET(request, { params }) {
    try {
        const { error: authError } = await authenticateSSORequest(request, ['super_admin', 'admin', 'rm_admin']);
        if (authError) return authError;

        const { id } = await params;

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
        const { error: authError, user } = await authenticateSSORequest(request, ['super_admin', 'admin', 'rm_admin']);
        if (authError) return authError;

        const { id } = await params;
        const body = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
        }

        // Normalize target outcomes
        const rawTargetOutcomes = body.targetOutcomes ?? body.target_outcomes ?? [];
        const target_outcomes = Array.isArray(rawTargetOutcomes)
            ? rawTargetOutcomes.filter(o => typeof o === 'string' && o.trim() !== '')
            : typeof rawTargetOutcomes === 'string' && rawTargetOutcomes.trim() !== ''
                ? [rawTargetOutcomes.trim()]
                : [];

        const normalizedData = {
            title: (body.title || body.name || '').trim(),
            code: (body.code || body.course_code || '').trim(),
            description: (body.description || '').trim(),
            duration: (body.duration || '').trim(),
            credits: body.credits,
            thumbnail: body.thumbnail || body.thumbnail_url || null,
            university: body.university || null,
            category: body.category || null,
            target_outcomes,
            skillsCovered: Array.isArray(body.skillsCovered || body.skills) ? (body.skillsCovered || body.skills) : [],
            linkedClasses: Array.isArray(body.linkedClasses) ? body.linkedClasses : [],
            // Preserve "omitted" vs "explicit empty": only pass modules through
            // when the client actually sent the key.
            ...('modules' in body ? { modules: body.modules } : {}),
            expectedUpdatedAt: body.expectedUpdatedAt ?? body.expected_updated_at ?? undefined,
        };

        const validationResult = CourseUpdateSchema.safeParse(normalizedData);
        if (!validationResult.success) {
            const errorDetails = validationResult.error.errors
                .map(e => `${e.path.join('.')}: ${e.message}`)
                .join('; ');
            return NextResponse.json(
                { error: 'Validation failed', details: errorDetails },
                { status: 400 }
            );
        }

        const {
            title, code, description, duration, credits,
            thumbnail, university, category,
            skillsCovered, linkedClasses, modules,
            expectedUpdatedAt
        } = validationResult.data;

        // Explicit hierarchy-update contract (P0): the hierarchy is replaced
        // ONLY when the client sends BOTH `modules` (possibly []) AND a
        // verified `updateHierarchy: true` intent flag. An incompletely
        // initialized form that posts `modules: []` without the flag — or
        // omits the key entirely (metadata-only edit) — must never wipe
        // existing modules/lessons/resources.
        const hierarchyUpdateRequested = 'modules' in body;
        const hierarchyUpdateConfirmed =
            body.updateHierarchy === true || body.hierarchyIntent === 'replace';
        if (hierarchyUpdateRequested && !hierarchyUpdateConfirmed) {
            return NextResponse.json(
                {
                    error: 'Hierarchy update intent not confirmed',
                    details: 'Send updateHierarchy: true with a fully loaded modules array to replace the hierarchy. Omit modules for metadata-only updates.',
                },
                { status: 400 }
            );
        }
        const syncHierarchy = hierarchyUpdateRequested && hierarchyUpdateConfirmed;
        if (syncHierarchy && !Array.isArray(modules)) {
            return NextResponse.json(
                { error: 'Invalid course hierarchy', details: 'modules must be an array' },
                { status: 400 }
            );
        }

        // Optimistic concurrency: reject stale edits when the caller pins a version.
        if (expectedUpdatedAt) {
            const { data: currentRow, error: versionError } = await supabaseAdmin
                .from('courses')
                .select('updated_at')
                .eq('course_id', id)
                .is('deleted_at', null)
                .maybeSingle();
            if (versionError) {
                console.error('[Course API] Error checking course version:', versionError);
                return NextResponse.json(
                    { error: 'Failed to verify course version', details: versionError.message },
                    { status: 500 }
                );
            }
            if (!currentRow) {
                return NextResponse.json({ error: 'Course not found or already deleted' }, { status: 404 });
            }
            if (String(currentRow.updated_at) !== String(expectedUpdatedAt)) {
                return NextResponse.json(
                    {
                        error: 'Course was modified by another user',
                        details: 'Reload the course and reapply your changes.',
                        expectedUpdatedAt,
                        currentUpdatedAt: currentRow.updated_at,
                    },
                    { status: 409 }
                );
            }
        }

        // Handle educator_id validation if passed in payload
        let educator_id = body.educatorId ?? body.educator_id ?? undefined;
        if (educator_id) {
            const { data: validAdmin, error: lookupError } = await supabaseAdmin
                .from('admin_users')
                .select('id')
                .eq('id', educator_id)
                .maybeSingle();

            if (lookupError) {
                console.error('[Course API] Error validating educator_id on update:', lookupError);
                return NextResponse.json(
                    { error: 'Failed to validate educator ID', details: lookupError.message },
                    { status: 500 }
                );
            }

            if (!validAdmin) {
                console.info(`[Course API] educator_id '${educator_id}' not in admin_users; setting to null to satisfy foreign key constraint.`);
                educator_id = null;
            }
        }

        // Build main course update fields
        const updateFields = {
            title,
            code,
            description,
            university,
            duration,
            credits,
            category,
            thumbnail,
            target_outcomes,
            updated_at: new Date().toISOString()
        };

        if (educator_id !== undefined) {
            updateFields.educator_id = educator_id;
        }

        if (body.skillsCovered !== undefined || body.skills !== undefined) {
            updateFields.skills_mapped = skillsCovered.length;
            updateFields.total_skills = skillsCovered.length;
        }

        // Update primary course record
        const { data, error: updateError } = await supabaseAdmin
            .from('courses')
            .update(updateFields)
            .eq('course_id', id)
            .is('deleted_at', null)
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

        // Sync 1: course_skills (if provided in payload)
        if (body.skillsCovered !== undefined || body.skills !== undefined) {
            const { error: deleteSkillsErr } = await supabaseAdmin
                .from('course_skills')
                .delete()
                .eq('course_id', id);

            if (deleteSkillsErr) {
                console.error('[Course API] Error clearing existing skills:', deleteSkillsErr);
                return NextResponse.json(
                    { error: 'Failed to sync course skills', details: deleteSkillsErr.message },
                    { status: 500 }
                );
            }

            if (skillsCovered.length > 0) {
                const skillsToInsert = skillsCovered.map(skill => ({
                    course_id: id,
                    skill_name: skill
                }));
                const { error: insertSkillsErr } = await supabaseAdmin
                    .from('course_skills')
                    .insert(skillsToInsert);

                if (insertSkillsErr) {
                    console.error('[Course API] Error inserting course skills:', insertSkillsErr);
                    return NextResponse.json(
                        { error: 'Failed to sync course skills', details: insertSkillsErr.message },
                        { status: 500 }
                    );
                }
            }
        }

        // Sync 2: course_classes (if provided in payload)
        if (body.linkedClasses !== undefined) {
            const { error: deleteClassesErr } = await supabaseAdmin
                .from('course_classes')
                .delete()
                .eq('course_id', id);

            if (deleteClassesErr) {
                console.error('[Course API] Error clearing existing classes:', deleteClassesErr);
                return NextResponse.json(
                    { error: 'Failed to sync course classes', details: deleteClassesErr.message },
                    { status: 500 }
                );
            }

            if (linkedClasses.length > 0) {
                const classesToInsert = linkedClasses.map(className => ({
                    course_id: id,
                    class_name: className
                }));
                const { error: insertClassesErr } = await supabaseAdmin
                    .from('course_classes')
                    .insert(classesToInsert);

                if (insertClassesErr) {
                    console.error('[Course API] Error inserting course classes:', insertClassesErr);
                    return NextResponse.json(
                        { error: 'Failed to sync course classes', details: insertClassesErr.message },
                        { status: 500 }
                    );
                }
            }
        }

        // Sync 3: course_modules, lessons, lesson_resources — ONLY on explicit,
        // authorized, validated hierarchy-replace intent. Omitted modules (or
        // modules without updateHierarchy:true) leave existing hierarchy intact.
        // Pre-validate the full hierarchy BEFORE the destructive delete so a
        // malformed payload can never wipe existing modules/lessons/resources.
        // Explicit [] with intent = intentional clear-all (authorized deletion).
        if (syncHierarchy) {
            const hierarchyError = validateHierarchyPayload(modules);
            if (hierarchyError) {
                return NextResponse.json(
                    { error: 'Invalid course hierarchy', details: hierarchyError },
                    { status: 400 }
                );
            }
            // Re-verify the course still exists (and is not deleted) immediately
            // before the destructive step, so hierarchy rows can never be
            // orphaned/wiped for a missing or inaccessible course.
            const { data: hierarchyOwner, error: ownerError } = await supabaseAdmin
                .from('courses')
                .select('course_id')
                .eq('course_id', id)
                .is('deleted_at', null)
                .maybeSingle();
            if (ownerError) {
                console.error('[Course API] Error verifying course before hierarchy sync:', ownerError);
                return NextResponse.json(
                    { error: 'Failed to verify course', details: ownerError.message },
                    { status: 500 }
                );
            }
            if (!hierarchyOwner) {
                return NextResponse.json({ error: 'Course not found or already deleted' }, { status: 404 });
            }
            const { error: deleteModulesErr } = await supabaseAdmin
                .from('course_modules')
                .delete()
                .eq('course_id', id);

            if (deleteModulesErr) {
                console.error('[Course API] Error clearing existing modules:', deleteModulesErr);
                return NextResponse.json(
                    { error: 'Failed to sync course modules', details: deleteModulesErr.message },
                    { status: 500 }
                );
            }

            if (modules.length > 0) {
                for (const mod of modules) {
                    const { data: moduleRow, error: moduleError } = await supabaseAdmin
                        .from('course_modules')
                        .insert({
                            course_id: id,
                            title: mod.title,
                            description: mod.description || '',
                            order_index: mod.order ?? mod.orderIndex ?? 0,
                            skill_tags: mod.skillTags || [],
                            activities: mod.activities || []
                        })
                        .select()
                        .single();

                    if (moduleError || !moduleRow) {
                        console.error('[Course API] Module update error:', moduleError);
                        return NextResponse.json(
                            { error: 'Failed to update course modules', details: moduleError?.message },
                            { status: 500 }
                        );
                    }

                    if (mod.lessons?.length > 0) {
                        for (const lesson of mod.lessons) {
                            const { data: lessonRow, error: lessonError } = await supabaseAdmin
                                .from('lessons')
                                .insert({
                                    module_id: moduleRow.module_id,
                                    title: lesson.title,
                                    description: lesson.description || '',
                                    content: lesson.content || '',
                                    duration: lesson.duration || '',
                                    order_index: lesson.order ?? lesson.orderIndex ?? 0
                                })
                                .select()
                                .single();

                            if (lessonError || !lessonRow) {
                                console.error('[Course API] Lesson update error:', lessonError);
                                return NextResponse.json(
                                    { error: 'Failed to update lesson', details: lessonError?.message },
                                    { status: 500 }
                                );
                            }

                            if (lesson.resources?.length > 0) {
                                const resourcesToInsert = lesson.resources.map((res, index) => ({
                                    lesson_id: lessonRow.lesson_id,
                                    name: res.name,
                                    type: res.type,
                                    url: res.url,
                                    file_size: res.size ?? res.fileSize ?? null,
                                    thumbnail_url: res.thumbnailUrl ?? res.thumbnail_url ?? null,
                                    embed_url: res.embedUrl ?? res.embed_url ?? null,
                                    order_index: res.order ?? res.orderIndex ?? index
                                }));
                                const { error: resourceError } = await supabaseAdmin
                                    .from('lesson_resources')
                                    .insert(resourcesToInsert);

                                if (resourceError) {
                                    console.error('[Course API] Lesson resource update error:', resourceError);
                                    return NextResponse.json(
                                        { error: 'Failed to update lesson resources', details: resourceError.message },
                                        { status: 500 }
                                    );
                                }
                            }
                        }
                    }
                }
            }
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
        const { error: authError, user } = await authenticateSSORequest(request, ['super_admin', 'admin', 'rm_admin']);
        if (authError) return authError;

        const { id } = await params;

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
