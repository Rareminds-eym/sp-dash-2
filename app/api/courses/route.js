import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError, validationError, parseSupabaseError } from '@/lib/middleware/errorHandler';
import { createRLSClient, getUserContext } from '@/lib/supabase-rls';
import { validatePagination } from '@/lib/validators/courseValidator';

export const runtime = 'edge';

/**
 * GET /api/courses - List all courses with pagination, search, and filters
 */
export async function GET(request) {
    try {
        const url = new URL(request.url);

        // Pagination parameters
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        
        // Validate pagination
        const paginationValidation = validatePagination(page, limit);
        if (!paginationValidation.valid) {
            return validationError(paginationValidation.errors);
        }
        
        const offset = (page - 1) * limit;

        // Filter parameters (using existing column names)
        const statusFilter = url.searchParams.get('approval_status'); // maps to status column
        const searchTerm = url.searchParams.get('search');
        const sortBy = url.searchParams.get('sort') || 'date-newest';

        // Build query using supabaseAdmin (bypass RLS)
        let query = supabaseAdmin
            .from('courses')
            .select('course_id, title, code, description, thumbnail, status, duration, university, category, credits, target_outcomes, educator_name, created_at, updated_at', { count: 'exact' })
            .is('deleted_at', null); // Exclude soft-deleted courses

        // Apply filters (using existing column names)
        if (statusFilter) {
            // Map frontend status to database status
            const mappedStatus = statusFilter === 'pending' ? 'Draft' : statusFilter === 'approved' ? 'Active' : statusFilter;
            query = query.eq('status', mappedStatus);
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
            const appError = parseSupabaseError(error);
            return handleError(appError, 'GET /api/courses', { page, limit, filters: { statusFilter, searchTerm, sortBy } });
        }

        // Map database columns to frontend expected fields
        const mapped = (courses || []).map(c => ({
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
            approval_status: c.status === 'Draft' ? 'pending' : c.status === 'Active' ? 'approved' : c.status,
            educator_name: c.educator_name,
            created_at: c.created_at,
            updated_at: c.updated_at
        }));

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
            return handleError(e, 'POST /api/courses - JSON parsing');
        }

        // Validate course data
        const validation = validateCourseData(body, false);
        if (!validation.valid) {
            return validationError(validation.errors);
        }

        // Sanitize course data
        const sanitizedData = sanitizeCourseData(body);

        // Insert course
        const { data, error: insertError } = await supabaseAdmin
            .from('courses')
            .insert([
                {
                    ...sanitizedData,
                    status: 'Draft', // default status for new courses
                    educator_id: user.id,
                    educator_name: user?.metadata?.name || user?.email || ''
                }
            ])
            .select('course_id, title, code, description, university, duration, credits, category, thumbnail, target_outcomes, status, created_at')
            .single();

        if (insertError) {
            const appError = parseSupabaseError(insertError);
            return handleError(appError, 'POST /api/courses', { userId: user.id });
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
            approval_status: data.status,
            created_at: data.created_at
        };
        return NextResponse.json({ success: true, data: mapped }, { status: 201 });
    } catch (error) {
        return handleError(error, 'POST /api/courses');
    }
}
