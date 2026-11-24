import { createConnectionQuota } from './source-quota';
import { z } from 'zod';

const uuid = z.string().uuid();
/** Unknown editions and malformed seat counts must never grant a paid allowance. */
export function recruitLicense(organization) {
  const license = organization?.license_details;
  const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  const primary = normalize(license?.plan_type);
  const paidPlan = normalize(license?.paid_type);
  const subscription = normalize(license?.subscription);
  const aliases = { free:'free', standard:'standard', professional:'professional', enterprise:'enterprise',
    'zoho one':'enterprise', zohoone:'enterprise', 'people plus':'enterprise', peopleplus:'enterprise' };
  const edition = value => Object.hasOwn(aliases,value) ? aliases[value] : 'unknown';
  // Live Recruit IN bundle responses use paid_type/subscription instead of
  // the documented plan_type. Trial labels are never proof of paid entitlement.
  const fallbackAllowed = license?.paid === true && license?.trial === false;
  const invalidPrimary = license?.plan_type != null && typeof license.plan_type !== 'string';
  const plan = primary || (fallbackAllowed && !invalidPrimary ? paidPlan : '');
  const conflictingPaid = primary && paidPlan && (edition(primary) === 'unknown' || edition(paidPlan) === 'unknown' || edition(primary) !== edition(paidPlan));
  const conflictingSubscription = !primary && subscription && (edition(subscription) === 'unknown' || edition(subscription) !== edition(paidPlan));
  const invalidFlags = ['paid','trial'].some(key=>license?.[key] != null && typeof license[key] !== 'boolean');
  const trialOrUnpaid = license?.trial === true || (license?.paid === false && edition(plan) !== 'free');
  const users = license?.no_of_users;
  const validUsers = Number.isSafeInteger(users) && users >= 0 && users <= 1000000;
  return { plan: plan.length <= 80 ? plan : 'unknown',
    edition: validUsers && !invalidPrimary && !invalidFlags && !conflictingPaid && !conflictingSubscription && !trialOrUnpaid ? edition(plan) : 'unknown',
    users: validUsers ? users : null };
}
export function matchingRecruitOrganization(body, sourceOrgId) {
  return Array.isArray(body?.org) ? body.org.find(item => {
    if (!item || typeof item !== 'object') return false;
    const id = Object.hasOwn(item, 'zgid') ? item.zgid : item.id;
    return typeof id === 'string' && /^\d+$/.test(id) && id === sourceOrgId;
  }) : undefined;
}
async function rpc(db, name, args) {
  const result = await db.rpc(name, args);
  if (result.error) throw new Error('Source license storage unavailable');
  return result.data;
}
/** All provider access stays in the existing BFF. Lease + credential generation
 * fence late results; shared quota accounts for this metadata request as well. */
export async function refreshSourceLicense(db, env, connectionId, { force = false, organization, fetcher = fetch } = {}) {
  uuid.parse(connectionId);
  const lease = crypto.randomUUID();
  const claim = await rpc(db, 'zoho_claim_license_refresh', { p_connection:connectionId, p_lease:lease, p_force:force });
  if (claim?.acquired !== true) return { refreshed:false, reason:'cached_or_in_progress' };
  try {
    if (!Number.isSafeInteger(claim.generation) || claim.generation < 0 || typeof claim.sourceOrgId !== 'string' || !/^\d{1,40}$/.test(claim.sourceOrgId)) throw new Error('Invalid license claim');
    let observed = organization;
    if (!observed) {
      const { getConnectionAccessToken, recruitJson, ZOHO_HOSTS } = await import('./oauth');
      const { connection, accessToken } = await getConnectionAccessToken(db, env, connectionId, { fetcher });
      if (connection.credential_generation !== claim.generation) throw new Error('Source credentials changed');
      const body = await recruitJson(`${ZOHO_HOSTS[connection.region].api}/recruit/v2/org`,
        { headers:{ Authorization:`Zoho-oauthtoken ${accessToken}` } }, fetcher, createConnectionQuota(db, connectionId));
      observed = matchingRecruitOrganization(body, claim.sourceOrgId);
    } else observed = matchingRecruitOrganization({org:[observed]}, claim.sourceOrgId);
    if (!observed) throw new Error('Source organization mismatch');
    const license = recruitLicense(observed);
    const saved = await rpc(db, 'zoho_finish_license_refresh', { p_connection:connectionId, p_lease:lease, p_generation:claim.generation,
      p_plan:license.plan, p_edition:license.edition, p_users:license.users });
    if (saved !== true) throw new Error('License observation not saved');
    return { refreshed:true, edition:license.edition };
  } catch (error) {
    await rpc(db, 'zoho_fail_license_refresh', { p_connection:connectionId, p_lease:lease,
      p_retry_after:Number.isInteger(error.retryAfterSeconds) ? Math.min(86400,Math.max(60,error.retryAfterSeconds)) : 900 });
    const message=error.code==='RATE_LIMITED' ? 'Plan refresh is waiting for the shared connector budget or Zoho cooldown. Existing limits remain in effect.' : 'Could not refresh Zoho plan. The current allocation policy remains in effect.';
    throw new Error(message,{cause:error});
  }
}
