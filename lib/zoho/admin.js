import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { verifyJWT } from '../jwt-utils';

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
export async function requireZohoAdmin(request, requiredRoles = ['super_admin']) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (!sameOrigin(request))
      return { error: Response.json({ error: 'Invalid request origin' }, { status: 403 }) };
  }
  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  const token = jar.get(secure ? '__Host-sso_access_token' : 'sso_access_token')?.value;
  if (!token) return { error: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  const verified = await verifyJWT(token, {
    issuer: 'sso-api', audience: 'sso-client', enforceClaims: true, allowDevelopmentFallback: false,
  });
  const claims = verified.payload;
  if (!verified.valid || !claims?.sub) return { error: Response.json({ error: 'Invalid session' }, { status: 401 }) };
  if (claims.org_id !== PLATFORM_ORG_ID || claims.membership_status !== 'active' || (!Array.isArray(claims.roles) || !requiredRoles.some(role=>claims.roles.includes(role))))
    return { error: Response.json({ error: 'Platform super administrator required' }, { status: 403 }) };
  try {
    const { env } = await getCloudflareContext({ async: true });
    const [identity, memberships] = await Promise.all([env.SSO.getUserById(claims.sub), env.SSO.getUserMemberships(claims.sub)]);
    const allowed = memberships?.memberships?.some(row => row.org_id === PLATFORM_ORG_ID && row.status === 'active' && Array.isArray(row.roles) && requiredRoles.some(role=>row.roles.includes(role)));
    if (!identity || identity.id !== claims.sub || identity.is_blocked !== false || !allowed)
      return { error: Response.json({ error: 'Administrator access is inactive' }, { status: 403 }) };
    return { user: { id: claims.sub }, env, accessToken: token };
  } catch {
    return { error: Response.json({ error: 'Administrator authority is unavailable' }, { status: 503 }) };
  }
}
