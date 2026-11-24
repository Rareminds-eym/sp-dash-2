import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { verifyJWT } from './jwt-utils';
import { integrationFailure } from './zoho/diagnostics';

const failure = (error, status, extra = {}) => ({ error: Response.json({ error, ...extra }, { status, headers: { 'Cache-Control': 'private, no-store' } }) });

const PLATFORM_ORG_ID = '00000000-0000-0000-0000-000000000001';
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const source = new URL(origin); const target = new URL(request.url);
    if (origin !== source.origin) return false;
    if (source.origin === target.origin) return true;
    return process.env.NODE_ENV === 'development' && ['0.0.0.0', '[::]'].includes(target.hostname) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) && source.protocol === target.protocol &&
      source.port === target.port && request.headers.get('host') === source.host;
  } catch { return false; }
}
/** Signed JWT + live platform membership; display cookies never establish authority. */
export async function requirePlatformAdmin(request, requiredRoles = ['super_admin']) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (!sameOrigin(request))
      return failure('Invalid request origin', 403);
  }
  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  const token = jar.get(secure ? '__Host-sso_access_token' : 'sso_access_token')?.value;
  if (!token) return failure('Authentication required', 401);
  const verified = await verifyJWT(token, {
    issuer: 'sso-api', audience: 'sso-client', enforceClaims: true, allowDevelopmentFallback: false,
  });
  const claims = verified.payload;
  if (!verified.valid || !claims?.sub) return failure('Invalid session', 401);
  if (claims.org_id !== PLATFORM_ORG_ID || claims.membership_status !== 'active' || (!Array.isArray(claims.roles) || !requiredRoles.some(role=>claims.roles.includes(role))))
    return failure('Platform super administrator required', 403);
  try {
    const { env } = await getCloudflareContext({ async: true });
    const [identity, memberships] = await Promise.all([env.SSO.getUserById(claims.sub), env.SSO.getUserMemberships(claims.sub)]);
    const allowed = memberships?.memberships?.some(row => row.org_id === PLATFORM_ORG_ID && row.status === 'active' && Array.isArray(row.roles) && requiredRoles.some(role=>row.roles.includes(role)));
    if (!identity || identity.id !== claims.sub || identity.is_blocked !== false || !allowed)
      return failure('Administrator access is inactive', 403);
    return { user: { id: claims.sub }, env, accessToken: token };
  } catch (error) {
    const requestId = integrationFailure('zoho_admin_authority_error', error);
    return failure('Administrator authority is unavailable', 503, { requestId });
  }
}
