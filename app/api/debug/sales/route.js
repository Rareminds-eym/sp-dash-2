export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';

/**
 * GET /api/debug/sales - Debug endpoint to check sales data availability
 * All subscription data flows through SSO Worker API
 */
export async function GET(request) {
    try {
        const { error: authError } = await authenticateSSORequest(request, ['super_admin', 'admin']);
        if (authError) return authError;

        const results = {};

        // Test SSO Worker API connection
        try {
            const ssoWorkerUrl = process.env.SSO_WORKER_URL;

            if (!ssoWorkerUrl) {
                results.ssoWorkerError = 'SSO_WORKER_URL not configured';
            } else {
                const cookieStore = await cookies();
                const token = cookieStore.get('sso_access_token')?.value;

                if (!token) {
                    results.ssoWorkerError = 'No SSO access token found';
                } else {
                    const response = await fetch(`${ssoWorkerUrl}/api/sales/subscriptions?page=1&limit=1`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    results.ssoWorkerApi = {
                        available: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                    };

                    if (response.ok) {
                        const data = await response.json();
                        results.ssoWorkerData = {
                            sampleCount: data.data?.length || 0,
                            totalCount: data.pagination?.total || 0,
                        };
                    }
                }
            }
        } catch (err) {
            results.ssoWorkerError = err.message;
        }

        // Test SkillPassport connection
        try {
            const { data: courses, error: coursesError, count: coursesCount } = await supabaseAdmin
                .from('courses')
                .select('*', { count: 'exact' })
                .limit(3);

            results.skillPassportCourses = {
                available: true,
                totalCount: coursesCount,
                error: coursesError?.message
            };
        } catch (err) {
            results.skillPassportError = err.message;
        }

        return NextResponse.json({
            message: 'Sales data debug results',
            results,
            note: 'Subscription data flows through SSO Worker API, not direct database access'
        });
    } catch (error) {
        console.error('Debug Sales API Error:', error);
        return NextResponse.json(
            { error: 'Debug failed', details: error.message },
            { status: 500 }
        );
    }
}