export const runtime = 'edge';
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
        const { error: authError } = await authenticateSSORequest(request, ['super_admin', 'admin']);
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
        const { error: authError, user } = await authenticateSSORequest(request, ['super_admin', 'admin']);
        if (authError) return authError;

        const body = await request.json();
        const {
            name,
            course_code,
            description,
            university,
            duration,
            credits,
            category,
            thumbnail_url,
            target_outcomes,
            // optional fields that don't exist in schema are ignored
        } = body;

        // Validate required fields
        if (!name || !course_code || !description || !university || !duration || !credits || !category || !thumbnail_url || !target_outcomes) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Insert course
        const { data, error: insertError } = await supabaseAdmin
            .from('courses')
            .insert([
                {
                    title: name,
                    code: course_code,
                    description,
                    university,
                    duration,
                    credits,
                    category,
                    thumbnail: thumbnail_url,
                    target_outcomes,
                    status: 'Draft', // default status for new courses
                    approval_status: 'pending', // default approval status
                    educator_id: user.id
                }
            ])
            .select('course_id, title, code, description, university, duration, credits, category, thumbnail, target_outcomes, status, approval_status, created_at')
            .single();

        if (insertError) {
            console.error('Error creating course:', insertError);
            return NextResponse.json(
                { error: insertError.message },
                { status: 500 }
            );
        }

        // Map inserted row to frontend shape
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
            approval_status: data.approval_status || 'pending',
            status: data.status,
            created_at: data.created_at
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
