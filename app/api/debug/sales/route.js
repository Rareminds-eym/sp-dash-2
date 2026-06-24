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

        // Test SSO Worker API connection via RPC
        try {
            const { createSSOServiceClient } = await import('@/lib/sso-service-client');
            const ssoClient = await createSSOServiceClient();

            results.ssoWorkerApi = {
                status: 200,
                statusText: 'RPC OK',
            };

            let jsonData;
            let parseSuccess = true;
            try {
                // Testing connection via RPC
                jsonData = await ssoClient.getSalesSubscriptions('page=1&limit=1');
            } catch (rpcError) {
                parseSuccess = false;
                results.ssoWorkerApi.parseError = rpcError instanceof Error ? rpcError.message : String(rpcError);
            }

            results.ssoWorkerApi.available = parseSuccess;

            if (parseSuccess && jsonData) {
                results.ssoWorkerData = {
                    sampleCount: jsonData.data?.length || 0,
                    totalCount: jsonData.pagination?.total || 0,
                };
            } else if (!parseSuccess && jsonData?.error) {
                results.ssoWorkerApi.errorMessage = jsonData.error;
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