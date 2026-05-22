import { authenticateRequest } from '@/lib/middleware/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
// SECURITY NOTE: xlsx library has known vulnerabilities
// - CVE-2023-30533: Prototype pollution vulnerability (fixed in 0.18.5+)
// - CVE-2021-32012: XXE (XML External Entity) injection risk
// - Path traversal vulnerabilities in older versions
// Mitigations applied:
// - Using version ^0.18.5 from npm registry (not CDN) for integrity verification
// - Only generating files from server-controlled data (no user file uploads)
// - All cell values sanitized via sanitizeCell() to prevent formula injection (CSV injection)
// - No XML parsing of user-provided files (write-only usage)
// - Strict input validation applied, no user file parsing
// References: https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
import * as XLSX from 'xlsx';
import Logger from '@/lib/logger';
import { addSearchFilter, sanitizeSearchTerm } from '@/lib/supabase-utils';

const logger = new Logger('SalesExportAPI');

export const runtime = 'nodejs';

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
    const { error } = await authenticateRequest(request, ['/sales']);
    if (error) return error;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const clientType = searchParams.get('clientType');
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const format = searchParams.get('format') || 'csv';
    
    // Validate format parameter
    if (!['csv', 'excel'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "csv" or "excel"' },
        { status: 400 }
      );
    }

    // Build base query - fetch users
    let usersQuery = supabaseAdmin
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
      let subsQuery = supabaseAdmin
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

    logger.info('Export generated', { format, clientCount: clients.length });

    // Generate export based on format
    if (format === 'excel') {
      // Generate Excel file using xlsx
      const worksheetData = [
        // Headers
        [
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
        ],
        // Data rows
        ...clients.map(client => [
          sanitizeCell(client.id),
          sanitizeCell(client.email),
          sanitizeCell(client.fullName),
          sanitizeCell(client.phone),
          sanitizeCell(client.role),
          sanitizeCell(client.organizationId || ''),
          sanitizeCell(client.subscriptionId || ''),
          sanitizeCell(client.planType || ''),
          sanitizeCell(client.planAmount || ''),
          sanitizeCell(client.billingCycle || ''),
          sanitizeCell(client.subscriptionStatus || ''),
          sanitizeCell(client.startDate || ''),
          sanitizeCell(client.endDate || ''),
        ]),
      ];

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 36 }, // ID
        { wch: 30 }, // Email
        { wch: 25 }, // Full Name
        { wch: 15 }, // Phone
        { wch: 20 }, // Role
        { wch: 36 }, // Organization ID
        { wch: 36 }, // Subscription ID
        { wch: 15 }, // Plan Type
        { wch: 12 }, // Plan Amount
        { wch: 15 }, // Billing Cycle
        { wch: 18 }, // Subscription Status
        { wch: 20 }, // Start Date
        { wch: 20 }, // End Date
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Generate timestamp: YYYY-MM-DD_HH-MM-SS format for uniqueness
      const now = new Date();
      const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
      const filename = `clients_${timestamp}.xlsx`;

      return new Response(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else {
      // Generate CSV
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
    }
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
