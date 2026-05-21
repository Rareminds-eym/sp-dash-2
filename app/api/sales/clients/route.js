import { authenticateRequest } from '@/lib/middleware/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { rlsClient, error } = await authenticateRequest(request, ['/sales']);
    if (error) return error;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const clientType = searchParams.get('clientType');
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    console.log('API called with filters:', { clientType, planType, status, startDate, endDate, search });

    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
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

    // Apply date range filter to user registration date (created_at)
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

    console.log(`Found ${users.length} users`);

    // Step 2: Get subscriptions for these users
    const userEmails = users.map(u => u.email);
    
    if (userEmails.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }
    
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

    console.log(`Found ${subscriptions.length} subscriptions`);

    // Step 3: Join in code
    const subscriptionsByEmail = {};
    subscriptions.forEach(sub => {
      if (!subscriptionsByEmail[sub.email]) {
        subscriptionsByEmail[sub.email] = [];
      }
      subscriptionsByEmail[sub.email].push(sub);
    });

    // Create combined results (only users with subscriptions)
    const allClients = users
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

    console.log(`Combined: ${allClients.length} clients with subscriptions`);

    // Apply pagination
    const total = allClients.length;
    const paginatedClients = allClients.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedClients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sales clients:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}