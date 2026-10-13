import { cookies } from 'next/headers';
import { verifyJWT } from './jwt-utils';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const PLATFORM_ORG_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ROLES = ['super_admin', 'admin', 'rm_admin', 'rm_manager'];

/** Only signed claims establish authority; the display-user cookie is never consulted. */
export async function requireEducatorAdmin(request) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) {
      return { error: Response.json({ error: 'Invalid request origin' }, { status: 403 }) };
    }
  }
  const jar = await cookies();
  const token = jar.get('__Host-sso_access_token')?.value || jar.get('sso_access_token')?.value;
  if (!token) return { error: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  const result = await verifyJWT(token, { issuer: 'sso-api', audience: 'sso-client', enforceClaims: true, allowDevelopmentFallback: false });
  const claims = result.payload;
  if (!result.valid || !claims?.sub) return { error: Response.json({ error: 'Invalid session' }, { status: 401 }) };
  if (claims.org_id !== PLATFORM_ORG_ID || claims.membership_status !== 'active' ||
      !Array.isArray(claims.roles) || !claims.roles.some(role => ADMIN_ROLES.includes(role))) {
    return { error: Response.json({ error: 'Platform educator administration required' }, { status: 403 }) };
  }
  // Check live authority as well: a still-valid JWT must not resurrect a suspended administrator.
  try {
    const { env } = await getCloudflareContext({ async: true });
    const [identity, memberships] = await Promise.all([
      env.SSO.getUserById(claims.sub), env.SSO.getUserMemberships(claims.sub),
    ]);
    const activeAdmin = memberships?.memberships?.some(row => row.org_id === PLATFORM_ORG_ID &&
      row.status === 'active' && (row.roles || []).some(role => ADMIN_ROLES.includes(role)));
    if (!identity || identity.is_blocked || !activeAdmin) {
      return { error: Response.json({ error: 'Platform administrator access is inactive' }, { status: 403 }) };
    }
  } catch {
    return { error: Response.json({ error: 'Administrator authority could not be verified' }, { status: 503 }) };
  }
  return { user: { id: claims.sub, roles: claims.roles, orgId: claims.org_id } };
}
