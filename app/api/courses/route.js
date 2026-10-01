import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';



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
        
        // Flexibly extract fields supporting both modal payload format and legacy API payload format
        const title = body.title || body.name;
        const code = body.code || body.course_code;
        const description = body.description;
        const thumbnail = body.thumbnail || body.thumbnail_url || null;
        const duration = body.duration;
        const credits = body.credits !== undefined && body.credits !== null && body.credits !== '' ? Number(body.credits) : null;
        const university = body.university || null;
        const category = body.category || null;
        const target_outcomes = body.targetOutcomes || body.target_outcomes || [];
        const status = body.status || 'Active';
        const approval_status = body.approval_status || 'approved';
        let educator_id = body.educatorId ?? body.educator_id ?? user?.id ?? null;
        const school_id = body.schoolId ?? body.school_id ?? null;
        const skillsCovered = body.skillsCovered || body.skills || [];
        const linkedClasses = body.linkedClasses || [];
        const modules = body.modules || [];

        // Validate educator_id against admin_users table to prevent foreign key constraint violation (courses_educator_id_fkey)
        if (educator_id) {
            const { data: validAdmin } = await supabaseAdmin
                .from('admin_users')
                .select('id')
                .eq('id', educator_id)
                .maybeSingle();
            if (!validAdmin) {
                educator_id = null;
            }
        }

        // Validate required core fields
        if (!title || !code || !description || !duration) {
            return NextResponse.json(
                { error: 'Missing required fields (title, code, description, duration)' },
                { status: 400 }
            );
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

        // 1. Insert course_skills
        if (skillsCovered.length > 0) {
            const skillsToInsert = skillsCovered.map(skill => ({
                course_id: courseId,
                skill_name: skill
            }));
            const { error: skillsError } = await supabaseAdmin.from('course_skills').insert(skillsToInsert);
            if (skillsError) {
                console.warn('[Course API] Skills insert warning:', skillsError.message);
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
                console.warn('[Course API] Classes insert warning:', classesError.message);
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

                if (moduleError) {
                    console.warn('[Course API] Module insert warning:', moduleError.message);
                    continue;
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

                        if (lessonError) {
                            console.warn('[Course API] Lesson insert warning:', lessonError.message);
                            continue;
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
                            await supabaseAdmin.from('lesson_resources').insert(resourcesToInsert);
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
