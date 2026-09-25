import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { NextResponse } from 'next/server';

import Logger from '@/lib/logger';

const logger = new Logger('OrganizationsSubscriptionsListAPI');

const ADMIN_ROLES = ['super_admin', 'platform_admin', 'rm_admin'];
const VALID_ORG_TYPES = ['school', 'college', 'university'];

/**
 * GET /api/organizations/subscriptions
 *
 * Lists organizations with their most recent subscription (any plan) —
 * backs the admin "Activate Hybrid Plan" org table. Query params:
 * search, planCode, status, page, limit.
 */
export async function GET(request) {
  try {
    const { error } = await authenticateSSORequest(request, ADMIN_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const planCode = searchParams.get('planCode') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 20;

    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    let result;
    try {
      result = await ssoClient.listOrganizationsWithSubscriptions({
        search,
        plan_code: planCode,
        status,
        page,
        limit,
      });
    } catch (rpcError) {
      logger.error('listOrganizationsWithSubscriptions RPC error', { error: rpcError.message });
      return NextResponse.json({ error: 'Failed to load organizations' }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    logger.error('Error listing organizations with subscriptions', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/subscriptions
 *
 * Creates a brand-new organization + owner user + Hybrid subscription in
 * one flow, for sales-negotiated new customers who don't have an account
 * yet. See performCreateHybridOrganization (sso-worker) for the
 * partial-failure story if subscription activation fails after org/owner
 * creation succeeds.
 *
 * Body: { org_name, org_type, owner_email, owner_password, owner_name?,
 *         plan_amount, seat_count, billing_cycle?, features?, notes? }
 */
export async function POST(request) {
  try {
    const { error, user } = await authenticateSSORequest(request, ADMIN_ROLES);
    if (error) return error;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      org_name, org_type, owner_email, owner_password, owner_name,
      plan_amount, seat_count, billing_cycle, features, notes,
    } = body || {};

    if (!org_name || typeof org_name !== 'string' || !org_name.trim()) {
      return NextResponse.json({ error: 'org_name is required' }, { status: 400 });
    }
    if (!VALID_ORG_TYPES.includes(org_type)) {
      return NextResponse.json({ error: `org_type must be one of: ${VALID_ORG_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!owner_email || typeof owner_email !== 'string') {
      return NextResponse.json({ error: 'owner_email is required' }, { status: 400 });
    }
    if (!owner_password || owner_password.length < 8) {
      return NextResponse.json({ error: 'owner_password must be at least 8 characters' }, { status: 400 });
    }
    if (typeof plan_amount !== 'number' || !Number.isFinite(plan_amount) || plan_amount < 0) {
      return NextResponse.json({ error: 'plan_amount must be a non-negative number' }, { status: 400 });
    }
    if (!Number.isInteger(seat_count) || seat_count < 1) {
      return NextResponse.json({ error: 'seat_count must be a positive integer' }, { status: 400 });
    }
    if (features !== undefined && !Array.isArray(features)) {
      return NextResponse.json({ error: 'features must be an array' }, { status: 400 });
    }

    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    let result;
    try {
      result = await ssoClient.createHybridOrganization({
        org_name: org_name.trim(),
        org_type,
        owner_email,
        owner_password,
        owner_name: owner_name || undefined,
        plan_amount,
        seat_count,
        billing_cycle: billing_cycle || undefined,
        features: features || [],
        notes: notes || undefined,
        admin_user_id: user.id,
      });
    } catch (rpcError) {
      logger.error('createHybridOrganization RPC error', { error: rpcError.message, adminUserId: user.id });
      const message = rpcError.message || 'Failed to create organization';
      const isPartialSuccess = message.includes('activation failed');
      const status = message.includes('already exists') ? 409 : 500;
      return NextResponse.json({ error: message, partialSuccess: isPartialSuccess }, { status });
    }

    logger.info('Hybrid organization created', {
      adminUserId: user.id,
      organizationId: result?.organization?.id,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    logger.error('Error creating Hybrid organization', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
