import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { NextResponse } from 'next/server';

import Logger from '@/lib/logger';


const logger = new Logger('OrganizationSubscriptionsAPI');

const ADMIN_ROLES = ['super_admin', 'platform_admin', 'rm_admin'];

/**
 * POST /api/organizations/[id]/subscriptions
 *
 * Admin-provisioned Hybrid subscription activation. Hybrid is a
 * "contact sales" plan — self-serve checkout always rejects it. This
 * endpoint is the deliberate bypass for an internal admin who has already
 * negotiated terms with the customer out-of-band.
 *
 * Body: { plan_amount: number, seat_count: number, billing_cycle?: string,
 *         features?: unknown[], notes?: string }
 */
export async function POST(request, { params }) {
  try {
    const { error, user } = await authenticateSSORequest(request, ADMIN_ROLES);
    if (error) return error;

    const { id: organizationId } = await params;
    if (!organizationId) {
      return NextResponse.json({ error: 'organization id is required' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { plan_amount, seat_count, billing_cycle, features, notes } = body || {};

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

    let subscription;
    try {
      subscription = await ssoClient.createHybridSubscription({
        organization_id: organizationId,
        plan_amount,
        seat_count,
        billing_cycle: billing_cycle || undefined,
        features: features || [],
        notes: notes || undefined,
        admin_user_id: user.id,
      });
    } catch (rpcError) {
      logger.error('createHybridSubscription RPC error', {
        error: rpcError.message,
        organizationId,
        adminUserId: user.id,
      });
      const message = rpcError.message || 'Failed to activate Hybrid subscription';
      const status = message.includes('not found')
        ? 404
        : message.includes('already has an active')
          ? 409
          : 500;
      return NextResponse.json({ error: message }, { status });
    }

    logger.info('Hybrid subscription activated', {
      organizationId,
      adminUserId: user.id,
      subscriptionId: subscription?.id,
    });

    return NextResponse.json({ data: subscription }, { status: 201 });
  } catch (err) {
    logger.error('Error activating Hybrid subscription', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
