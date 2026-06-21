export const runtime = 'edge';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Logger from '@/lib/logger';

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
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // Build SSO Worker API URL with query params
    const ssoWorkerUrl = process.env.SSO_WORKER_URL;

    if (!ssoWorkerUrl) {
      logger.error('SSO_WORKER_URL not configured');
      return NextResponse.json({ error: 'SSO service not configured' }, { status: 500 });
    }

    const url = new URL(`${ssoWorkerUrl}/api/sales/subscriptions`);
    url.searchParams.set('page', page);
    url.searchParams.set('limit', limit);
    if (planType) url.searchParams.set('planType', planType);
    if (status) url.searchParams.set('status', status);
    if (startDate) url.searchParams.set('startDate', startDate);
    if (endDate) url.searchParams.set('endDate', endDate);
    if (search) url.searchParams.set('search', search);

    // Call SSO Worker API with auth token
    const ssoResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!ssoResponse.ok) {
      logger.error('SSO Worker API error', {
        status: ssoResponse.status,
        statusText: ssoResponse.statusText,
      });
      return NextResponse.json(
        { error: 'Failed to fetch subscription data' },
        { status: ssoResponse.status }
      );
    }

    let ssoData;
    try {
      ssoData = await ssoResponse.json();
    } catch (parseError) {
      logger.error('Failed to parse SSO response', { error: parseError.message });
      return NextResponse.json(
        { error: 'Invalid response from SSO service' },
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
    const enrichedClients = ssoData.data.map(client => {
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

    logger.debug('Clients fetched', { count: enrichedClients.length });

    return NextResponse.json({
      data: enrichedClients,
      pagination: ssoData.pagination,
    });
  } catch (error) {
    logger.error('Error fetching sales clients', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}