import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { NextResponse } from 'next/server';

import Logger from '@/lib/logger';

const logger = new Logger('OrganizationsFeatureKeysAPI');

const ADMIN_ROLES = ['super_admin', 'platform_admin', 'rm_admin'];

/**
 * GET /api/organizations/feature-keys
 *
 * Lists the canonical admin-dashboard feature key catalog (source of truth:
 * sso-worker's public.feature_keys) — backs the feature checkboxes in the
 * New Hybrid Organization and Upgrade-to-Hybrid dialogs. Optional `role`
 * query param filters to a single admin role (college_admin/school_admin/
 * university_admin); omitted returns the full catalog across all roles.
 */
export async function GET(request) {
  try {
    const { error } = await authenticateSSORequest(request, ADMIN_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || undefined;

    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    let result;
    try {
      result = await ssoClient.listFeatureKeys();
    } catch (rpcError) {
      logger.error('listFeatureKeys RPC error', { error: rpcError.message });
      return NextResponse.json({ error: 'Failed to load feature keys' }, { status: 500 });
    }

    const featureKeys = (result?.featureKeys || []).filter((f) =>
      f.product_code === 'skillpassport' && f.is_active === true && (!role || f.role === role));

    return NextResponse.json({ featureKeys });
  } catch (err) {
    logger.error('Error listing feature keys', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
