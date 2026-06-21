import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';

export const runtime = 'edge';

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
                        status: response.status,
                        statusText: response.statusText,
                    };

                    let jsonData;
                    try {
                        jsonData = await response.json();
                    } catch (parseError) {
                        results.ssoWorkerApi.available = false;
                        return;
                    }

                    results.ssoWorkerApi.available = response.ok;

                    if (response.ok && jsonData) {
                        results.ssoWorkerData = {
                            sampleCount: jsonData.data?.length || 0,
                            totalCount: jsonData.pagination?.total || 0,
                        };
                    } else if (!response.ok && jsonData?.error) {
                        results.ssoWorkerApi.errorMessage = jsonData.error;
                    }
                }
            }
        } catch (err) {
            results.ssoWorkerError = err instanceof Error ? err.message : String(err);
        }

        // Test SkillPassport connection
        try {
            const { data: courses, error: coursesError, count: coursesCount } = await supabaseAdmin
                .from('courses')
                .select('*', { count: 'exact' })
                .limit(3);

            results.skillPassportCourses = {
                available: !coursesError,
                totalCount: coursesCount,
                error: coursesError?.message
            };
        } catch (err) {
            results.skillPassportError = err instanceof Error ? err.message : String(err);
        }

        return NextResponse.json({
            message: 'Sales data debug results',
            results,
            note: 'Subscription data flows through SSO Worker API, not direct database access'
        });
    } catch (error) {
        console.error('Debug Sales API Error:', error instanceof Error ? error.message : String(error));
        return NextResponse.json(
            { error: 'Debug failed' },
            { status: 500 }
        );
    }
}