import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin, ssoAuthAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import Logger from '@/lib/logger';
import { addSearchFilter, sanitizeSearchTerm } from '@/lib/supabase-utils';

export const runtime = 'nodejs'; // Changed from 'edge' to support cookies()

const logger = new Logger('SalesClientsAPI');

/**
 * GET handler for fetching sales clients with pagination and filters
 * @param {Request} request - The incoming request object
 * @returns {Promise<Response>} JSON response with clients data and pagination
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
    
    // Step 1: Get user IDs with subscriptions that match filters
    let subsUserIdQuery = ssoAuthAdmin
      .from('subscriptions')
      .select('user_id');

    if (planType) {
      subsUserIdQuery = subsUserIdQuery.eq('plan_type', planType);
    }

    if (status) {
      subsUserIdQuery = subsUserIdQuery.eq('status', status);
    }

    const { data: subsUserIds, error: subsUserIdError } = await subsUserIdQuery;
    
    if (subsUserIdError) {
      logger.error('Subscription user IDs query failed', { error: subsUserIdError.message });
      throw new Error(subsUserIdError.message);
    }

    if (!subsUserIds || subsUserIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    const subscriptionUserIds = [...new Set(subsUserIds.map(s => s.user_id))];
    
    // Step 2: Build users count query with filters
    let usersCountQuery = ssoAuthAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('id', subscriptionUserIds);
    
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

    if (search) {
      const sanitizedSearch = sanitizeSearchTerm(search);
      if (sanitizedSearch) {
        usersCountQuery = addSearchFilter(usersCountQuery, ['email'], sanitizedSearch);
      }
    }

    if (startDate) {
      usersCountQuery = usersCountQuery.gte('created_at', startDate);
    }

    if (endDate) {
      usersCountQuery = usersCountQuery.lte('created_at', endDate);
    }

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
    let usersQuery = ssoAuthAdmin
      .from('users')
      .select('*')
      .in('id', subscriptionUserIds);
    
    excludedDomains.forEach(domain => {
      usersQuery = usersQuery.not('email', 'ilike', domain);
    });

    if (search) {
      const sanitizedSearch = sanitizeSearchTerm(search);
      if (sanitizedSearch) {
        usersQuery = addSearchFilter(usersQuery, ['email'], sanitizedSearch);
      }
    }

    if (startDate) {
      usersQuery = usersQuery.gte('created_at', startDate);
    }

    if (endDate) {
      usersQuery = usersQuery.lte('created_at', endDate);
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
    const userIds = users.map(u => u.id);
    
    let subsQuery = ssoAuthAdmin
      .from('subscriptions')
      .select('user_id, id, plan_type, plan_amount, billing_cycle, status, subscription_start_date, subscription_end_date, phone, email, full_name, created_at')
      .in('user_id', userIds);

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

    // Create a map of subscriptions by user_id
    const subscriptionsByUserId = {};
    (subscriptions || []).forEach(sub => {
      if (!subscriptionsByUserId[sub.user_id]) {
        subscriptionsByUserId[sub.user_id] = [];
      }
      subscriptionsByUserId[sub.user_id].push(sub);
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
      .filter(user => subscriptionsByUserId[user.id])
      .map(user => {
        const subscription = selectSubscription(subscriptionsByUserId[user.id]);
        const fullName = subscription?.full_name || user.email;
        
        return {
          id: user.id,
          email: user.email,
          fullName: fullName,
          phone: subscription?.phone || '-',
          role: 'user', // New schema doesn't have role on users table
          organizationId: subscription?.organization_id || null,
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