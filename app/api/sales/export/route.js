import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin, ssoAuthAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
// SECURITY NOTE: CSV export with proper sanitization
// - All cell values sanitized via sanitizeCell() to prevent formula injection
// - Only generating files from server-controlled data (no user file uploads)
// - Edge Runtime compatible (no Node.js dependencies)
import Logger from '@/lib/logger';
import { addSearchFilter, sanitizeSearchTerm } from '@/lib/supabase-utils';

export const runtime = 'nodejs'; // Changed from 'edge' to support cookies()

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
 * GET handler for exporting sales clients data as CSV or Excel
 * @param {Request} request - The incoming request object
 * @returns {Promise<Response>} File download response (CSV or Excel)
 */
export async function GET(request) {
  try {
    // Authenticate using SSO - allow super_admin, admin roles
    const { error } = await authenticateSSORequest(request, ['super_admin', 'admin']);
    if (error) return error;

    // Check if SSO Auth database client is available
    if (!ssoAuthAdmin) {
      logger.error('SSO Auth database client not available');
      return NextResponse.json(
        { error: 'SSO Auth database not configured' }, 
        { status: 500 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const clientType = searchParams.get('clientType');
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const format = searchParams.get('format') || 'csv';
    
    // Validate format parameter - only CSV supported in Edge Runtime
    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV format is supported. Excel export requires Node.js runtime.' },
        { status: 400 }
      );
    }

    // Build base query - fetch users
    let usersQuery = ssoAuthAdmin
      .from('users')
      .select('*')
      .eq('isActive', true);
    
    // Exclude tempmail and rareminds domain emails
    const excludedDomains = [
      '%@tempmail.%',
      '%@temp-mail.%',
      '%@guerrillamail.%',
      '%@10minutemail.%',
      '%@throwaway.%',
      '%@mailinator.%',
      '%@maildrop.%',
      '%@trashmail.%',
      '%@yopmail.%',
      '%@fakeinbox.%',
      '%@rareminds.%',
      '%@rareminds.com%',
      '%@rareminds.in%'
    ];
    
    excludedDomains.forEach(domain => {
      usersQuery = usersQuery.not('email', 'ilike', domain);
    });

    // Apply user filters
    if (clientType) {
      const clientTypes = clientType.split(',').filter(Boolean);
      if (clientTypes.length > 0) {
        usersQuery = usersQuery.in('role', clientTypes);
      }
    }

    if (search) {
      const sanitizedSearch = sanitizeSearchTerm(search);
      if (sanitizedSearch) {
        usersQuery = addSearchFilter(usersQuery, ['firstName', 'lastName', 'email'], sanitizedSearch);
      }
    }

    // Apply date range filter
    if (startDate) {
      usersQuery = usersQuery.gte('createdAt', startDate);
    }

    if (endDate) {
      usersQuery = usersQuery.lte('createdAt', endDate);
    }

    // Fetch users
    const { data: users, error: usersError } = await usersQuery;
    
    if (usersError) {
      logger.error('Users query failed', { error: usersError.message });
      throw new Error(usersError.message);
    }

    logger.debug('Users fetched for export', { count: users?.length || 0 });

    let clients = [];

    if (!users || users.length === 0) {
      logger.info('No users found for export');
    } else {
      // Get user emails for subscription lookup
      const userEmails = users.map(u => u.email);

      // Build subscription query
      let subsQuery = ssoAuthAdmin
        .from('subscriptions')
        .select('*')
        .in('email', userEmails);

      // Apply subscription filters
      if (planType) {
        subsQuery = subsQuery.eq('plan_type', planType);
      }

      if (status) {
        subsQuery = subsQuery.eq('status', status);
      }

      const { data: subscriptions, error: subsError } = await subsQuery;
      
      if (subsError) {
        logger.error('Subscriptions query failed', { error: subsError.message });
        throw new Error(subsError.message);
      }

      logger.debug('Subscriptions fetched for export', { count: subscriptions?.length || 0 });

      // Create a map of subscriptions by email
      const subscriptionsByEmail = {};
      (subscriptions || []).forEach(sub => {
        if (!subscriptionsByEmail[sub.email]) {
          subscriptionsByEmail[sub.email] = [];
        }
        subscriptionsByEmail[sub.email].push(sub);
      });

      // Helper function to select subscription deterministically
      const selectSubscription = (subs) => {
        if (!subs || subs.length === 0) return null;
        
        // Sort by: 1) active status first, 2) most recent created_at
        const sorted = subs.sort((a, b) => {
          // Active subscriptions first
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          
          // Then by most recent created_at
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        
        return sorted[0];
      };

      // Combine users with their subscriptions
      clients = users
        .filter(user => subscriptionsByEmail[user.email])
        .map(user => {
          const subscription = selectSubscription(subscriptionsByEmail[user.email]);
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
          
          return {
            id: user.id,
            email: user.email,
            fullName: fullName,
            phone: user.phone || subscription?.phone || '-',
            role: user.role,
            organizationId: user.organizationId,
            subscriptionId: subscription?.id || null,
            planType: subscription?.plan_type || null,
            planAmount: subscription?.plan_amount || null,
            billingCycle: subscription?.billing_cycle || null,
            subscriptionStatus: subscription?.status || null,
            startDate: subscription?.subscription_start_date || null,
            endDate: subscription?.subscription_end_date || null,
          };
        });

      logger.debug('Clients combined for export', { count: clients.length });
      
      // NOTE: Export only includes users with subscriptions
      // This matches the API endpoint behavior but may differ from total user count
    }

    logger.info('Export generated', { format: 'csv', clientCount: clients.length });

    // Generate CSV export
    const headers = [
      'ID',
      'Email',
      'Full Name',
      'Phone',
      'Role',
      'Organization ID',
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
      ...clients.map(client => {
        return [
          toCsvCell(client.id),
          toCsvCell(client.email),
          toCsvCell(client.fullName),
          toCsvCell(client.phone),
          toCsvCell(client.role),
          toCsvCell(client.organizationId || ''),
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
      error: error.message, 
      stack: error.stack 
    });
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
