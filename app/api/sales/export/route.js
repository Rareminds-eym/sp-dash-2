import { authenticateRequest } from '@/lib/middleware/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { rlsClient, error } = await authenticateRequest(request, ['/sales']);
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

    console.log('Export API called with filters:', { clientType, planType, status, startDate, endDate, search, format });

    // FIXED APPROACH: Fetch users and subscriptions separately, then join in code
    // This avoids issues with Supabase !inner join syntax
    
    // Step 1: Fetch users with filters
    let usersQuery = supabaseAdmin
      .from('users')
      .select('*')
      .eq('isActive', true);
    
    // Exclude tempmail and rareminds domain emails
    // Common tempmail domains and internal rareminds emails
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
    
    // Apply email domain exclusions
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
      usersQuery = usersQuery.or(`"firstName".ilike.%${search}%,"lastName".ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply date range filter to user registration date (createdAt)
    if (startDate) {
      usersQuery = usersQuery.gte('createdAt', startDate);
    }

    if (endDate) {
      usersQuery = usersQuery.lte('createdAt', endDate);
    }

    const { data: users, error: usersError } = await usersQuery;
    
    if (usersError) {
      console.error('Users query error:', usersError);
      throw new Error(usersError.message);
    }

    console.log(`Found ${users.length} users for export`);

    // Step 2: Get subscriptions for these users
    const userEmails = users.map(u => u.email);
    let clients = [];
    
    if (userEmails.length === 0) {
      console.log('No users found, returning empty export');
    } else {
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
        console.error('Subscriptions query error:', subsError);
        throw new Error(subsError.message);
      }

      console.log(`Found ${subscriptions.length} subscriptions for export`);

      // Step 3: Join in code
      const subscriptionsByEmail = {};
      subscriptions.forEach(sub => {
        if (!subscriptionsByEmail[sub.email]) {
          subscriptionsByEmail[sub.email] = [];
        }
        subscriptionsByEmail[sub.email].push(sub);
      });

      // Create combined results (only users with subscriptions)
      clients = users
        .filter(user => subscriptionsByEmail[user.email])
        .map(user => {
          const subscription = subscriptionsByEmail[user.email][0];
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

      console.log(`Combined: ${clients.length} clients with subscriptions for export`);
    }

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
          client.id,
          client.email,
          client.fullName,
          client.phone,
          client.role,
          client.organizationId || '',
          client.subscriptionId || '',
          client.planType || '',
          client.planAmount || '',
          client.billingCycle || '',
          client.subscriptionStatus || '',
          client.startDate || '',
          client.endDate || '',
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

      return new Response(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="clients.xlsx"',
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
            client.id,
            `"${client.email}"`,
            `"${client.fullName}"`,
            `"${client.phone}"`,
            client.role,
            client.organizationId || '',
            client.subscriptionId || '',
            client.planType || '',
            client.planAmount || '',
            client.billingCycle || '',
            client.subscriptionStatus || '',
            client.startDate || '',
            client.endDate || '',
          ].join(',');
        }),
      ];

      const csvContent = csvRows.join('\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="clients.csv"',
        },
      });
    }
  } catch (error) {
    console.error('Error exporting sales clients:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}