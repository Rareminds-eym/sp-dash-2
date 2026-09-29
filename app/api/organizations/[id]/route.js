import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { NextResponse } from 'next/server';

import Logger from '@/lib/logger';

const logger = new Logger('OrganizationDeletionAPI');

const ADMIN_ROLES = ['super_admin', 'platform_admin', 'rm_admin'];

/**
 * GET /api/organizations/[id]
 *
 * Preview what deleting this organization would affect (member/subscription
 * counts) — used by the delete confirmation dialog.
 */
export async function GET(request, { params }) {
  try {
    const { error } = await authenticateSSORequest(request, ADMIN_ROLES);
    if (error) return error;

    const { id: organizationId } = await params;
    if (!organizationId) {
      return NextResponse.json({ error: 'organization id is required' }, { status: 400 });
    }

    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    let preview;
    try {
      preview = await ssoClient.inspectOrganizationForDeletion(organizationId);
    } catch (rpcError) {
      logger.error('inspectOrganizationForDeletion RPC error', { error: rpcError.message, organizationId });
      const status = rpcError.message?.includes('not found') ? 404 : 500;
      return NextResponse.json({ error: rpcError.message || 'Failed to inspect organization' }, { status });
    }

    return NextResponse.json({ data: preview });
  } catch (err) {
    logger.error('Error inspecting organization', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[id]
 *
 * Removes an organization. This is a destructive admin action — see
 * performSoftDeleteOrganization / performHardDeleteOrganization (sso-worker)
 * for exactly what each mode does and does not touch.
 *
 * Body: { mode: 'soft' | 'hard', force?: boolean }
 *   mode='soft' (default): marks deleted_at, deactivates memberships. Reversible.
 *   mode='hard': irreversibly deletes the org, its subscriptions/transactions,
 *     memberships, and any user who is only a member of this org.
 *   force=true: proceed even if the org has an active/pending subscription
 *     (both modes block on this by default).
 */
export async function DELETE(request, { params }) {
  try {
    const { error, user } = await authenticateSSORequest(request, ADMIN_ROLES);
    if (error) return error;

    const { id: organizationId } = await params;
    if (!organizationId) {
      return NextResponse.json({ error: 'organization id is required' }, { status: 400 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — defaults to soft delete, no force.
    }

    const mode = body.mode === 'hard' ? 'hard' : 'soft';
    const force = body.force === true;

    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    let result;
    try {
      result = mode === 'hard'
        ? await ssoClient.hardDeleteOrganization({ organization_id: organizationId, admin_user_id: user.id, force })
        : await ssoClient.softDeleteOrganization({ organization_id: organizationId, admin_user_id: user.id, force });
    } catch (rpcError) {
      logger.error(`${mode}DeleteOrganization RPC error`, { error: rpcError.message, organizationId, adminUserId: user.id });
      const message = rpcError.message || `Failed to ${mode}-delete organization`;
      const status = message.includes('not found')
        ? 404
        : message.includes('active or pending subscription')
          ? 409
          : 500;
      return NextResponse.json({ error: message }, { status });
    }

    logger.info(`Organization ${mode}-deleted`, { organizationId, adminUserId: user.id, mode });

    return NextResponse.json({ data: result });
  } catch (err) {
    logger.error('Error deleting organization', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
