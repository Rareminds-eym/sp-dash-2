import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import Logger from '@/lib/logger';

export const runtime = 'edge';

const logger = new Logger('DebugSalesAPI');

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
                    let parseSuccess = true;
                    try {
                        jsonData = await response.json();
                    } catch (parseError) {
                        parseSuccess = false;
                        results.ssoWorkerApi.parseError = parseError instanceof Error ? parseError.message : String(parseError);
                    }

                    results.ssoWorkerApi.available = response.ok && parseSuccess;

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
            const { error: coursesError, count: coursesCount } = await supabaseAdmin
                .from('courses')
                .select('id', { count: 'estimated' })
                .limit(1);

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
        logger.error('Debug Sales API Error', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json(
            { error: 'Debug failed' },
            { status: 500 }
        );
    }
}