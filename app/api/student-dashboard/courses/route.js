export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { handleError } from '@/lib/middleware/errorHandler';



/**
 * GET /api/student-dashboard/courses - Get student course enrollments and statistics
 */
export async function GET(request) {
    try {
        const { error: authError } = await authenticateSSORequest(request, ['super_admin', 'admin']);
        if (authError) return authError;

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;
        const search = url.searchParams.get('search') || '';

        // Get all active courses
        let query = supabaseAdmin
            .from('courses')
            .select('course_id, title, code, description, status, created_at', { count: 'exact' })
            .eq('status', 'Active')
            .is('deleted_at', null);

        if (search) {
            query = query.or(`title.ilike.%${search}%,code.ilike.%${search}%`);
        }

        query = query.order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data: courses, error: coursesError, count } = await query;

        if (coursesError) {
            console.error('Error fetching courses:', coursesError);
            return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
        }

        // For now, return mock enrollment data
        // TODO: Replace with actual enrollment data from your database
        const coursesWithStats = courses.map(course => ({
            id: course.course_id,
            name: course.title,
            code: course.code,
            description: course.description,
            status: course.status,
            enrollments: Math.floor(Math.random() * 100) + 10,
            completed: Math.floor(Math.random() * 50),
            inProgress: Math.floor(Math.random() * 30),
            completionRate: Math.floor(Math.random() * 100)
        }));

        // Calculate stats
        const stats = {
            totalEnrollments: coursesWithStats.reduce((sum, c) => sum + c.enrollments, 0),
            activeCourses: courses.length,
            completionRate: Math.floor(
                coursesWithStats.reduce((sum, c) => sum + c.completionRate, 0) / (courses.length || 1)
            )
        };

        return NextResponse.json({
            data: coursesWithStats,
            stats,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (error) {
        return handleError(error, 'Student Courses');
    }
}
