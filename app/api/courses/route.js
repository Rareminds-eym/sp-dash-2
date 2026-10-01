import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { z } from 'zod';

const CourseSchema = z.object({
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
    modules: z.array(z.any()).optional().default([])
});

/**
 * GET /api/courses - List all courses with pagination, search, and filters
 */
export async function GET(request) {
    try {
        const { error: authError } = await authenticateSSORequest(request, ['super_admin', 'admin', 'rm_admin']);
        if (authError) return authError;

        const url = new URL(request.url);

        // Pagination parameters
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        // Filter parameters (using existing column names)
        const statusFilter = url.searchParams.get('approval_status'); // maps to status column
        const searchTerm = url.searchParams.get('search');
        const sortBy = url.searchParams.get('sort') || 'date-newest';

        // Build query using supabaseAdmin (bypass RLS)
        // Join with admin_users and users tables to get educator name
        let query = supabaseAdmin
            .from('courses')
            .select(`
                course_id, title, code, description, thumbnail, status, approval_status, 
                duration, university, category, credits, target_outcomes, educator_id, 
                created_at, updated_at,
                admin_users (
                    id,
                    users (
                        firstName,
                        lastName
                    )
                )
            `, { count: 'exact' })
            .is('deleted_at', null); // Exclude soft-deleted courses

        // Apply filters using approval_status column
        if (statusFilter) {
            query = query.eq('approval_status', statusFilter);
        }

        // Additional filters
        const universityFilter = url.searchParams.get('university');
        const categoryFilter = url.searchParams.get('category');

        if (universityFilter && universityFilter !== 'all') {
            query = query.eq('university', universityFilter);
        }
        if (categoryFilter && categoryFilter !== 'all') {
            query = query.eq('category', categoryFilter);
        }

        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }

        // Apply sorting using existing columns
        switch (sortBy) {
            case 'name-asc':
                query = query.order('title', { ascending: true });
                break;
            case 'name-desc':
                query = query.order('title', { ascending: false });
                break;
            case 'university-asc':
                query = query.order('university', { ascending: true, nullsFirst: false });
                break;
            case 'credits-desc':
                query = query.order('credits', { ascending: false, nullsFirst: false });
                break;
            case 'date-oldest':
                query = query.order('created_at', { ascending: true });
                break;
            case 'date-newest':
            default:
                query = query.order('created_at', { ascending: false });
                break;
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: courses, error, count } = await query;

        if (error) {
            // Handle range error (offset beyond data) gracefully
            if (error.code === 'PGRST103' || error.message?.includes('range') || error.message?.includes('offset')) {
                return NextResponse.json({
                    data: [],
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 0
                    }
                });
            }
            console.error('Error fetching courses:', error);
            return NextResponse.json({ error: 'Failed to fetch courses', details: error.message }, { status: 500 });
        }

        // If offset is beyond total count, return empty result
        if (count !== null && offset >= count) {
            const response = NextResponse.json({
                data: [],
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            });
            return addCacheHeaders(response, 'static');
        }

        // Deduplicate courses by course_id
        const uniqueCoursesMap = new Map();
        (courses || []).forEach(c => {
            if (!uniqueCoursesMap.has(c.course_id)) {
                uniqueCoursesMap.set(c.course_id, c);
            }
        });
        const uniqueCourses = Array.from(uniqueCoursesMap.values());

        // Map database columns to frontend expected fields
        const mapped = uniqueCourses.map(c => {
            // Extract educator name from joined data
            const adminUser = c.admin_users;
            const user = adminUser?.users;
            const educatorName = user 
                ? [user.firstName, user.lastName].filter(Boolean).join(' ') 
                : null;
            
            return {
                id: c.course_id,
                name: c.title,
                course_code: c.code,
                description: c.description,
                university: c.university,
                duration: c.duration,
                credits: c.credits,
                category: c.category,
                thumbnail_url: c.thumbnail,
                target_outcomes: c.target_outcomes,
                approval_status: c.approval_status || 'pending',
                status: c.status,
                educator_id: c.educator_id,
                educator_name: educatorName,
                created_at: c.created_at,
                updated_at: c.updated_at
            };
        });

        const response = NextResponse.json({
            data: mapped,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

        return addCacheHeaders(response, 'static');
    } catch (error) {
        return handleError(error, 'Courses');
    }
}

/**
 * POST /api/courses - Create a new course
 */
export async function POST(request) {
    try {
        const { error: authError, user } = await authenticateSSORequest(request, [
            'super_admin', 'admin', 'rm_admin', 'educator', 'college_admin', 'university_admin'
        ]);
        if (authError) return authError;

        const body = await request.json();
        
        // Normalize target outcomes
        const rawTargetOutcomes = body.targetOutcomes ?? body.target_outcomes ?? [];
        const target_outcomes = Array.isArray(rawTargetOutcomes)
            ? rawTargetOutcomes.filter(o => typeof o === 'string' && o.trim() !== '')
            : typeof rawTargetOutcomes === 'string' && rawTargetOutcomes.trim() !== ''
                ? [rawTargetOutcomes.trim()]
                : [];

        // Prepare normalized payload for Zod validation
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
            modules: Array.isArray(body.modules) ? body.modules : []
        };

        const validationResult = CourseSchema.safeParse(normalizedData);
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
            skillsCovered, linkedClasses, modules
        } = validationResult.data;

        // Role-based privilege separation
        const userRole = user?.role || (user?.roles && user.roles[0]) || '';
        const isAdmin = ['super_admin', 'admin', 'rm_admin'].includes(userRole);

        // Admins can specify custom status, approval_status, educator_id, school_id.
        // Non-admins are restricted to pending / Draft / caller's ID and caller scope.
        const approval_status = isAdmin ? (body.approval_status ?? 'approved') : 'pending';
        const status = isAdmin ? (body.status ?? 'Active') : 'Draft';
        let educator_id = isAdmin
            ? (body.educatorId ?? body.educator_id ?? user?.id ?? null)
            : (user?.id ?? null);
        const school_id = isAdmin
            ? (body.schoolId ?? body.school_id ?? null)
            : (user?.orgId || user?.schoolId || user?.school_id || null);

        // Validate educator_id against admin_users table to prevent foreign key constraint violation (courses_educator_id_fkey)
        if (educator_id) {
            const { data: validAdmin, error: lookupError } = await supabaseAdmin
                .from('admin_users')
                .select('id')
                .eq('id', educator_id)
                .maybeSingle();

            if (lookupError) {
                console.error('[Course API] Error validating educator_id:', lookupError);
                return NextResponse.json(
                    { error: 'Failed to validate educator', details: lookupError.message },
                    { status: 500 }
                );
            }

            if (!validAdmin) {
                // SSO user IDs are valid for authentication, but not in legacy admin_users table.
                // Nullify educator_id to satisfy database foreign key constraint (courses_educator_id_fkey).
                console.info(`[Course API] educator_id '${educator_id}' not in admin_users; setting to null to satisfy foreign key constraint.`);
                educator_id = null;
            }
        }

        // Insert primary course record
        const { data: courseRow, error: insertError } = await supabaseAdmin
            .from('courses')
            .insert([
                {
                    title,
                    code,
                    description,
                    thumbnail,
                    duration,
                    credits,
                    university,
                    category,
                    target_outcomes,
                    status,
                    approval_status,
                    skills_mapped: skillsCovered.length,
                    total_skills: skillsCovered.length,
                    educator_id,
                    school_id
                }
            ])
            .select()
            .single();

        if (insertError) {
            console.error('Error creating course in DB:', insertError);
            return NextResponse.json(
                { error: insertError.message || 'Failed to create course' },
                { status: 400 }
            );
        }

        const courseId = courseRow.course_id;

        // Cleanup helper to delete primary course record if any child inserts fail (maintaining atomicity)
        const rollbackCourse = async (id) => {
            try {
                await supabaseAdmin.from('courses').delete().eq('course_id', id);
            } catch (cleanupErr) {
                console.error('[Course API] Failed to rollback course on error:', cleanupErr);
            }
        };

        // 1. Insert course_skills
        if (skillsCovered.length > 0) {
            const skillsToInsert = skillsCovered.map(skill => ({
                course_id: courseId,
                skill_name: skill
            }));
            const { error: skillsError } = await supabaseAdmin.from('course_skills').insert(skillsToInsert);
            if (skillsError) {
                console.error('[Course API] Skills insert error:', skillsError);
                await rollbackCourse(courseId);
                return NextResponse.json(
                    { error: 'Failed to insert course skills', details: skillsError.message },
                    { status: 500 }
                );
            }
        }

        // 2. Insert course_classes (only if tied to a school)
        if (school_id && linkedClasses.length > 0) {
            const classesToInsert = linkedClasses.map(className => ({
                course_id: courseId,
                class_name: className
            }));
            const { error: classesError } = await supabaseAdmin.from('course_classes').insert(classesToInsert);
            if (classesError) {
                console.error('[Course API] Classes insert error:', classesError);
                await rollbackCourse(courseId);
                return NextResponse.json(
                    { error: 'Failed to insert course classes', details: classesError.message },
                    { status: 500 }
                );
            }
        }

        // 3. Insert course_modules, lessons, and lesson_resources
        if (modules.length > 0) {
            for (const mod of modules) {
                const { data: moduleRow, error: moduleError } = await supabaseAdmin
                    .from('course_modules')
                    .insert({
                        course_id: courseId,
                        title: mod.title,
                        description: mod.description || '',
                        order_index: mod.order || 0,
                        skill_tags: mod.skillTags || [],
                        activities: mod.activities || []
                    })
                    .select()
                    .single();

                if (moduleError || !moduleRow) {
                    console.error('[Course API] Module insert error:', moduleError);
                    await rollbackCourse(courseId);
                    return NextResponse.json(
                        { error: 'Failed to insert course module', details: moduleError?.message },
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
                                order_index: lesson.order || 0
                            })
                            .select()
                            .single();

                        if (lessonError || !lessonRow) {
                            console.error('[Course API] Lesson insert error:', lessonError);
                            await rollbackCourse(courseId);
                            return NextResponse.json(
                                { error: 'Failed to insert lesson', details: lessonError?.message },
                                { status: 500 }
                            );
                        }

                        if (lesson.resources?.length > 0) {
                            const resourcesToInsert = lesson.resources.map((res, index) => ({
                                lesson_id: lessonRow.lesson_id,
                                name: res.name,
                                type: res.type,
                                url: res.url,
                                file_size: res.size,
                                thumbnail_url: res.thumbnailUrl,
                                embed_url: res.embedUrl,
                                order_index: index
                            }));
                            const { error: resourceError } = await supabaseAdmin.from('lesson_resources').insert(resourcesToInsert);
                            if (resourceError) {
                                console.error('[Course API] Lesson resources insert error:', resourceError);
                                await rollbackCourse(courseId);
                                return NextResponse.json(
                                    { error: 'Failed to insert lesson resources', details: resourceError.message },
                                    { status: 500 }
                                );
                            }
                        }
                    }
                }
            }
        }

        // Map inserted row to standard frontend response shape
        const mapped = {
            id: courseRow.course_id,
            name: courseRow.title,
            title: courseRow.title,
            course_code: courseRow.code,
            code: courseRow.code,
            description: courseRow.description,
            university: courseRow.university,
            duration: courseRow.duration,
            credits: courseRow.credits,
            category: courseRow.category,
            thumbnail_url: courseRow.thumbnail,
            thumbnail: courseRow.thumbnail,
            target_outcomes: courseRow.target_outcomes,
            approval_status: courseRow.approval_status || 'approved',
            status: courseRow.status || 'Active',
            educator_id: courseRow.educator_id,
            school_id: courseRow.school_id,
            created_at: courseRow.created_at,
            updated_at: courseRow.updated_at
        };

        return NextResponse.json({ success: true, data: mapped }, { status: 201 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
