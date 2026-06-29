import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Logger from '@/lib/logger';

export const runtime = 'edge';

// SECURITY NOTE: CSV export with proper sanitization
// - All cell values sanitized via sanitizeCell() to prevent formula injection
// - Only generating files from server-controlled data (no user file uploads)
// - Edge Runtime compatible (no Node.js dependencies)



const logger = new Logger('SalesExportAPI');

// Sanitize cell values to prevent CSV/Excel injection
const sanitizeCell = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  
  // Prevent formula injection by prefixing dangerous characters
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  
  return str;
};

// Convert to CSV cell with proper escaping
const toCsvCell = (value) => {
  const safe = sanitizeCell(value);
  // Escape double quotes by doubling them
  const escaped = safe.replace(/"/g, '""');
  // Wrap in quotes if contains comma, quote, or newline
  if (/[,"\n\r]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
};

/**
 * GET handler for exporting sales clients data as CSV
 * Calls SSO Worker API to fetch subscription data
 * @param {Request} request - The incoming request object
 * @returns {Promise<Response>} File download response (CSV)
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
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const clientType = searchParams.get('clientType');
    const search = searchParams.get('search');
    const format = searchParams.get('format') || 'csv';

    // Validate format parameter - only CSV supported in Edge Runtime
    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV format is supported. Excel export requires Node.js runtime.' },
        { status: 400 }
      );
    }

    // Call SSO Worker via RPC with pagination to overcome the 100-record limit cap
    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    // Build base params (shared across all pages)
    const baseParams = new URLSearchParams();
    baseParams.set('limit', '100'); // SSO Worker caps at 100
    if (planType) baseParams.set('planType', planType);
    if (status) baseParams.set('status', status);
    if (startDate) baseParams.set('startDate', startDate);
    if (endDate) baseParams.set('endDate', endDate);
    if (clientType) baseParams.set('clientType', clientType);
    // NOTE: Search is NOT passed to SSO because we filter by enriched SkillPassport names client-side

    const allClients = [];
    let currentPage = 1;
    let totalPages = 1;
    const MAX_EXPORT_PAGES = 30; // Stay under Cloudflare's 32-subrequest limit (buffer for jwks cache miss)

    // Fetch first page to get pagination metadata
    const firstParams = new URLSearchParams(baseParams);
    firstParams.set('page', '1');
    let ssoData;
    try {
      ssoData = await ssoClient.getSalesSubscriptions(firstParams.toString());
    } catch (ssoError) {
      logger.error('SSO Worker RPC error', {
        error: ssoError.message,
      });
      return NextResponse.json(
        { error: 'Failed to fetch subscription data' },
        { status: 500 }
      );
    }

    if (!ssoData?.data?.length) {
      // No data at all — skip pagination loop
      allClients.push(...(ssoData?.data || []));
      totalPages = 0;
    } else {
      allClients.push(...ssoData.data);
      totalPages = ssoData.pagination?.totalPages || 1;

      // Fetch remaining pages if any, capped at MAX_EXPORT_PAGES
      const maxFetch = Math.min(totalPages, MAX_EXPORT_PAGES);
      for (let p = 2; p <= maxFetch; p++) {
        const pageParams = new URLSearchParams(baseParams);
        pageParams.set('page', String(p));
        try {
          const pageData = await ssoClient.getSalesSubscriptions(pageParams.toString());
          if (pageData?.data?.length) {
            allClients.push(...pageData.data);
          }
        } catch (pageError) {
          logger.warn('SSO Worker RPC error on page', {
            page: p,
            error: pageError.message,
          });
          // Continue with data collected so far
        }
      }

      if (totalPages > MAX_EXPORT_PAGES) {
        logger.warn('Export truncated', {
          totalPages,
          maxPages: MAX_EXPORT_PAGES,
          recordsFetched: allClients.length,
        });
      }
    }

    const clients = allClients;

    // Fetch user names from SkillPassport database for real client names
    let skillpassportUsers = [];
    if (clients.length > 0) {
      try {
        const { data: spUsers, error: spError } = await supabaseAdmin
          .from('users')
          .select('id, "firstName", "lastName", email')
          .in('id', clients.map(c => c.id));

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

    // Enrich with SkillPassport names
    let enrichedClients = clients.map(client => {
      const spUser = spUserMap[client.id];
      let fullName = client.fullName;

      // Override with SkillPassport name if available
      if (spUser?.firstName || spUser?.lastName) {
        fullName = `${spUser.firstName || ''} ${spUser.lastName || ''}`.trim();
      }

      return { ...client, fullName };
    });

    // Apply search filtering on enriched data by enriched SkillPassport names
    // Search is not passed to SSO to ensure we find clients by enriched names, not just SSO names
    let filteredClients = enrichedClients;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredClients = enrichedClients.filter(client => {
        const matchesEmail = client.email?.toLowerCase().includes(searchLower) || false;
        const matchesName = client.fullName?.toLowerCase().includes(searchLower) || false;
        return matchesEmail || matchesName;
      });
    }

    logger.info('Export generated', {
      format: 'csv',
      rawCount: clients.length,
      enrichedCount: enrichedClients.length,
      filteredCount: filteredClients.length,
    });

    // Generate CSV export
    const headers = [
      'ID',
      'Email',
      'Full Name',
      'Phone',
      'Subscription ID',
      'Plan Type',
      'Plan Amount',
      'Billing Cycle',
      'Subscription Status',
      'Start Date',
      'End Date',
    ];

    const csvRows = [
      headers.join(','),
      ...filteredClients.map(client => {
        return [
          toCsvCell(client.id),
          toCsvCell(client.email),
          toCsvCell(client.fullName),
          toCsvCell(client.phone),
          toCsvCell(client.subscriptionId || ''),
          toCsvCell(client.planType || ''),
          toCsvCell(client.planAmount || ''),
          toCsvCell(client.billingCycle || ''),
          toCsvCell(client.subscriptionStatus || ''),
          toCsvCell(client.startDate || ''),
          toCsvCell(client.endDate || ''),
        ].join(',');
      }),
    ];

    const csvContent = csvRows.join('\n');

    // Generate timestamp: YYYY-MM-DD_HH-MM-SS format for uniqueness
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const filename = `clients_${timestamp}.csv`;

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Error exporting sales clients', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
