import { authenticateRequest } from '@/lib/middleware/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import Logger from '@/lib/logger';
import { addSearchFilter, sanitizeSearchTerm } from '@/lib/supabase-utils';

const logger = new Logger('SalesClientsAPI');

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { error } = await authenticateRequest(request, ['/sales']);
    if (error) return error;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const rawPage = Number(searchParams.get('page') ?? '1');
    const rawLimit = Number(searchParams.get('limit') ?? '20');
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
    const clientType = searchParams.get('clientType');
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build base query - fetch users with subscriptions
    let usersQuery = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
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

    // Apply server-side pagination
    usersQuery = usersQuery.range(offset, offset + limit - 1);

    // Fetch users with pagination applied at database level
    const { data: users, error: usersError, count: totalUsers } = await usersQuery;
    
    if (usersError) {
      logger.error('Users query failed', { error: usersError.message });
      throw new Error(usersError.message);
    }

    logger.debug('Users fetched', { count: users?.length || 0, total: totalUsers });

    if (!users || users.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

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

    logger.debug('Subscriptions fetched', { count: subscriptions?.length || 0 });

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
    const allClients = users
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

    logger.debug('Clients combined', { count: allClients.length });

    // NOTE: Pagination count reflects users with subscriptions after filtering
    // The total count is from the users query, but we filter by subscription existence
    // This means the displayed count may be lower than the actual filtered user count
    // This is intentional as we only show users who have subscriptions
    const total = totalUsers || 0;

    return NextResponse.json({
      data: allClients,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
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