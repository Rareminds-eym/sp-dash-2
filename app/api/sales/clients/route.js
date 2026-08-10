import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

import Logger from '@/lib/logger';

export const runtime = 'edge';

// Skillpassport database admin client
const skillpassportAdmin = supabaseAdmin;



const logger = new Logger('SalesClientsAPI');

/**
 * GET handler for fetching sales clients with pagination and filters
 * Calls SSO Worker API to fetch subscription data
 * @param {Request} request - The incoming request object
 * @returns {Promise<Response>} JSON response with clients data and pagination
 */
export async function GET(request) {
  try {
    // Authenticate using SSO
    const { error } = await authenticateSSORequest(request, ['super_admin', 'admin', 'rm_admin']);
    if (error) return error;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const parsedPage = parseInt(searchParams.get('page'), 10);
    const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage);
    const parsedLimit = parseInt(searchParams.get('limit'), 10);
    const limit = Math.max(1, Math.min(100, Number.isNaN(parsedLimit) ? 20 : parsedLimit));
    const clientType = searchParams.get('clientType');
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // Call SSO Worker via RPC
    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    // Reconstruct search params — forward ALL params to SSO Worker
    const rpcParams = new URLSearchParams();
    rpcParams.set('page', page);
    rpcParams.set('limit', limit.toString());
    if (clientType) rpcParams.set('clientType', clientType);
    if (planType) rpcParams.set('planType', planType);
    if (status) rpcParams.set('status', status);
    if (startDate) rpcParams.set('startDate', startDate);
    if (endDate) rpcParams.set('endDate', endDate);
    if (search) rpcParams.set('search', search);

    let ssoData;
    try {
      ssoData = await ssoClient.getSalesSubscriptions(rpcParams.toString());
    } catch (ssoError) {
      logger.error('SSO Worker RPC error', {
        error: ssoError.message,
      });
      return NextResponse.json(
        { error: 'Failed to fetch subscription data' },
        { status: 500 }
      );
    }

    // Fetch user names and phone from SkillPassport database — SkillPassport's
    // users.phone is the single source of truth for phone numbers (subscriptions.phone
    // in the SSO database is no longer used).
    let skillpassportUsers = [];
    if (ssoData.data && ssoData.data.length > 0) {
      try {
        const { data: spUsers, error: spError } = await skillpassportAdmin
          .from('users')
          .select('id, "firstName", "lastName", email, phone')
          .in('id', ssoData.data.map(u => u.id));

        if (!spError && spUsers) {
          skillpassportUsers = spUsers;
        }
      } catch (err) {
        logger.warn('Failed to fetch SkillPassport user names', { error: err.message });
      }
    }

    // Create a map of SkillPassport users by ID for quick lookup
    const spUserMap = {};
    skillpassportUsers.forEach(spUser => {
      spUserMap[spUser.id] = spUser;
    });

    // Enrich with SkillPassport names and phone — override SSO fullName if SkillPassport
    // has fresher data, and always source phone from SkillPassport's users table.
    // Search/pagination is handled by the SSO Worker; this layer only enriches display fields.
    const enrichedClients = (ssoData.data || []).map(client => {
      const spUser = spUserMap[client.id];
      let fullName = client.fullName;

      if (spUser?.firstName || spUser?.lastName) {
        fullName = `${spUser.firstName || ''} ${spUser.lastName || ''}`.trim();
      }

      const phone = spUser?.phone ?? null;

      return { ...client, fullName, phone };
    });

    logger.debug('Clients fetched', {
      enrichedCount: enrichedClients.length,
      page: ssoData.pagination?.page,
      total: ssoData.pagination?.total,
    });

    return NextResponse.json({
      data: enrichedClients,
      pagination: ssoData.pagination || { page, limit, total: 0, totalPages: 0 },
    });
  } catch (error) {
    logger.error('Error fetching sales clients', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}