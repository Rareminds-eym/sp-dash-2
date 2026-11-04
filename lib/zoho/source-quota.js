// Integration-owned conservative budgets, not a claim about remaining provider
// credits. Recruit documents rolling windows and edition/user/app concurrency;
// no Recruit response-credit header contract is documented. Never infer CRM's
// X-API-CREDITS-REMAINING contract for Recruit.
// https://www.zoho.com/recruit/developer-guide/apiv2/limits.html
function valid(result) {
  if (result?.error || !result?.data) throw new Error('Source quota authority unavailable');
  return result.data;
}
export function createConnectionQuota(db, connectionId) {
  return {
    async reserve(kind = 'read') {
      return valid(await db.rpc('zoho_reserve_source_quota', { p_connection: connectionId, p_kind: kind }));
    },
    async settle(reservationId, status, retryAfterSeconds = 0) {
      return valid(await db.rpc('zoho_settle_source_quota', { p_connection: connectionId, p_reservation: reservationId,
        p_status: status, p_retry_after: retryAfterSeconds }));
    },
  };
}
export function createDiscoveryQuota(command, runId, lease) {
  return {
    reserve: (kind = 'read') => command('quota-reserve', { runId, lease, kind }),
    settle: (reservationId, status, retryAfterSeconds = 0) => command('quota-settle', {
      runId, lease, reservationId, status, retryAfterSeconds,
    }),
  };
}
