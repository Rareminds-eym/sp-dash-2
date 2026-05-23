import { authenticateRequest } from '@/lib/middleware/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import Logger from '@/lib/logger';
import { addSearchFilter, sanitizeSearchTerm } from '@/lib/supabase-utils';

export const runtime = 'edge';

const logger = new Logger('SalesClientsAPI');

/**
 * GET handler for fetching sales clients with pagination and filters
 * @param {Request} request - The incoming request object
 * @returns {Promise<Response>} JSON response with clients data and pagination
 */
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
    
    // Step 1: Build base users query with filters
    let usersCountQuery = supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
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
      usersCountQuery = usersCountQuery.not('email', 'ilike', domain);
    });

    // Apply user filters to count query
    if (clientType) {
      const clientTypes = clientType.split(',').filter(Boolean);
      if (clientTypes.length > 0) {
        usersCountQuery = usersCountQuery.in('role', clientTypes);
      }
    }

    if (search) {
      const sanitizedSearch = sanitizeSearchTerm(search);
      if (sanitizedSearch) {
        usersCountQuery = addSearchFilter(usersCountQuery, ['firstName', 'lastName', 'email'], sanitizedSearch);
      }
    }

    if (startDate) {
      usersCountQuery = usersCountQuery.gte('createdAt', startDate);
    }

    if (endDate) {
      usersCountQuery = usersCountQuery.lte('createdAt', endDate);
    }

    // Step 2: Get users with subscriptions (using EXISTS-like filter)
    // First get all subscription emails that match our filters
    let subsEmailQuery = supabaseAdmin
      .from('subscriptions')
      .select('email');

    if (planType) {
      subsEmailQuery = subsEmailQuery.eq('plan_type', planType);
    }

    if (status) {
      subsEmailQuery = subsEmailQuery.eq('status', status);
    }

    const { data: subsEmails, error: subsEmailError } = await subsEmailQuery;
    
    if (subsEmailError) {
      logger.error('Subscription emails query failed', { error: subsEmailError.message });
      throw new Error(subsEmailError.message);
    }

    if (!subsEmails || subsEmails.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    const subscriptionEmails = [...new Set(subsEmails.map(s => s.email))];
    
    // Add subscription email filter to count query
    usersCountQuery = usersCountQuery.in('email', subscriptionEmails);

    // Get total count
    const { count: totalCount, error: countError } = await usersCountQuery;
    
    if (countError) {
      logger.error('Count query failed', { error: countError.message });
      throw new Error(countError.message);
    }

    const total = totalCount || 0;

    if (total === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // Step 3: Fetch paginated users
    let usersQuery = supabaseAdmin
      .from('users')
      .select('*')
      .eq('isActive', true)
      .in('email', subscriptionEmails);
    
    excludedDomains.forEach(domain => {
      usersQuery = usersQuery.not('email', 'ilike', domain);
    });

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

    if (startDate) {
      usersQuery = usersQuery.gte('createdAt', startDate);
    }

    if (endDate) {
      usersQuery = usersQuery.lte('createdAt', endDate);
    }

    // Apply database-level pagination
    usersQuery = usersQuery.range(offset, offset + limit - 1);

    const { data: users, error: usersError } = await usersQuery;
    
    if (usersError) {
      logger.error('Users query failed', { error: usersError.message });
      throw new Error(usersError.message);
    }

    logger.debug('Users fetched', { count: users?.length || 0, total });

    if (!users || users.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // Step 4: Fetch subscriptions for paginated users only
    const userEmails = users.map(u => u.email);
    
    let subsQuery = supabaseAdmin
      .from('subscriptions')
      .select('email, id, plan_type, plan_amount, billing_cycle, status, subscription_start_date, subscription_end_date, phone, created_at')
      .in('email', userEmails);

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
    const paginatedClients = users
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

    logger.debug('Clients combined', { count: paginatedClients.length });

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