export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin, ssoAuthAdmin } from '@/lib/supabase-admin';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';



/**
 * GET /api/debug/sales - Debug endpoint to check sales data availability
 */
export async function GET(request) {
    try {
        const { error: authError } = await authenticateSSORequest(request, ['super_admin', 'admin']);
        if (authError) return authError;

        const results = {};
        
        // Test SSO Auth Admin connection
        if (ssoAuthAdmin) {
            try {
                // Check users table
                const { data: users, error: usersError, count: usersCount } = await ssoAuthAdmin
                    .from('users')
                    .select('*', { count: 'exact' })
                    .limit(3);

                results.ssoAuthUsers = {
                    available: true,
                    totalCount: usersCount,
                    sampleData: users,
                    error: usersError?.message
                };

                // Check subscriptions table
                const { data: subscriptions, error: subsError, count: subsCount } = await ssoAuthAdmin
                    .from('subscriptions')
                    .select('*', { count: 'exact' })
                    .limit(3);

                results.ssoAuthSubscriptions = {
                    available: true,
                    totalCount: subsCount,
                    sampleData: subscriptions,
                    error: subsError?.message
                };
            } catch (err) {
                results.ssoAuthError = err.message;
            }
        } else {
            results.ssoAuthAdmin = 'Not available - check SSO_AUTH_SUPABASE_URL and SSO_AUTH_SERVICE_ROLE_KEY';
        }

        // Test SkillPassport connection for comparison
        try {
            const { data: courses, error: coursesError, count: coursesCount } = await supabaseAdmin
                .from('courses')
                .select('*', { count: 'exact' })
                .limit(3);

            results.skillPassportCourses = {
                available: true,
                totalCount: coursesCount,
                sampleData: courses,
                error: coursesError?.message
            };
        } catch (err) {
            results.skillPassportError = err.message;
        }

        return NextResponse.json({
            message: 'Sales data debug results',
            results,
            recommendation: 'Check if SSO Auth database has users and subscriptions data'
        });
    } catch (error) {
        console.error('Debug Sales API Error:', error);
        return NextResponse.json(
            { error: 'Debug failed', details: error.message },
            { status: 500 }
        );
    }
}