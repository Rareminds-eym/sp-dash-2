import { authenticateRequest } from '@/lib/middleware/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
// SECURITY NOTE: Using exceljs instead of xlsx for better security
// - exceljs is actively maintained with better security practices
// - No known CVEs for formula injection or XXE attacks
// - All cell values sanitized via sanitizeCell() to prevent formula injection
// - Only generating files from server-controlled data (no user file uploads)
import ExcelJS from 'exceljs';
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
      // Generate Excel file using exceljs
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Clients');

      // Define columns with headers and widths
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Full Name', key: 'fullName', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Role', key: 'role', width: 20 },
        { header: 'Organization ID', key: 'organizationId', width: 36 },
        { header: 'Subscription ID', key: 'subscriptionId', width: 36 },
        { header: 'Plan Type', key: 'planType', width: 15 },
        { header: 'Plan Amount', key: 'planAmount', width: 12 },
        { header: 'Billing Cycle', key: 'billingCycle', width: 15 },
        { header: 'Subscription Status', key: 'subscriptionStatus', width: 18 },
        { header: 'Start Date', key: 'startDate', width: 20 },
        { header: 'End Date', key: 'endDate', width: 20 },
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows with sanitized values
      clients.forEach(client => {
        worksheet.addRow({
          id: sanitizeCell(client.id),
          email: sanitizeCell(client.email),
          fullName: sanitizeCell(client.fullName),
          phone: sanitizeCell(client.phone),
          role: sanitizeCell(client.role),
          organizationId: sanitizeCell(client.organizationId || ''),
          subscriptionId: sanitizeCell(client.subscriptionId || ''),
          planType: sanitizeCell(client.planType || ''),
          planAmount: sanitizeCell(client.planAmount || ''),
          billingCycle: sanitizeCell(client.billingCycle || ''),
          subscriptionStatus: sanitizeCell(client.subscriptionStatus || ''),
          startDate: sanitizeCell(client.startDate || ''),
          endDate: sanitizeCell(client.endDate || ''),
        });
      });

      // Generate Excel file buffer
      const excelBuffer = await workbook.xlsx.writeBuffer();
      
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
