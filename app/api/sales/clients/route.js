import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

    // Extract token from cookies for SSO Worker API call
    const cookieStore = await cookies();
    const token = cookieStore.get('sso_access_token')?.value;

    if (!token) {
      logger.error('No SSO access token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const clientType = searchParams.get('clientType');
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // Call SSO Worker via RPC
    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    // Reconstruct search params
    const rpcParams = new URLSearchParams();
    rpcParams.set('page', page);
    rpcParams.set('limit', limit.toString());
    if (clientType) rpcParams.set('clientType', clientType);
    if (planType) rpcParams.set('planType', planType);
    if (status) rpcParams.set('status', status);
    if (startDate) rpcParams.set('startDate', startDate);
    if (endDate) rpcParams.set('endDate', endDate);

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

    // Fetch user names from SkillPassport database for real client names
    let skillpassportUsers = [];
    if (ssoData.data && ssoData.data.length > 0) {
      try {
        const { data: spUsers, error: spError } = await skillpassportAdmin
          .from('users')
          .select('id, "firstName", "lastName", email')
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

    // Combine with SkillPassport names
    const enrichedClients = (ssoData.data || []).map(client => {
      const spUser = spUserMap[client.id];
      let fullName = client.fullName;

      // Override with SkillPassport name if available
      if (spUser?.firstName || spUser?.lastName) {
        fullName = `${spUser.firstName || ''} ${spUser.lastName || ''}`.trim();
      }

      return {
        ...client,
        fullName,
      };
    });

    // Apply name-based search filtering on enriched data (after SkillPassport name enrichment)
    // This ensures search works with actual display names, not just SSO names
    let filteredClients = enrichedClients;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredClients = enrichedClients.filter(client => {
        const matchesEmail = client.email?.toLowerCase().includes(searchLower) || false;
        const matchesName = client.fullName?.toLowerCase().includes(searchLower) || false;
        return matchesEmail || matchesName;
      });
    }

    // Apply pagination after filtering to maintain proper page boundaries
    const totalFiltered = filteredClients.length;
    const totalPagesFiltered = Math.ceil(totalFiltered / limit);
    const startIndex = (page - 1) * limit;
    const paginatedClients = filteredClients.slice(startIndex, startIndex + limit);

    logger.debug('Clients fetched', {
      enrichedCount: enrichedClients.length,
      filteredCount: totalFiltered,
      returnedCount: paginatedClients.length,
      page,
      limit,
    });

    return NextResponse.json({
      data: paginatedClients,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: totalPagesFiltered,
      },
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