import type { SupabaseClient } from '@supabase/supabase-js';

export const redemptionColumns = 'id,user_id,role,redeemed_at,accepted_at,accepted_currency,accepted_minor_unit,accepted_amount_minor,accepted_interval_unit,accepted_interval_count,accepted_revision_number';
export type RedemptionUser = { name: string; email: string | null; phone: string | null; organizationId: string | null; organizationName: string | null };
export type Redemption = { id: string; user_id: string; role: string; redeemed_at: string; accepted_at: string | null;
  accepted_currency: string | null; accepted_minor_unit: number | null; accepted_amount_minor: number | null;
  accepted_interval_unit: string | null; accepted_interval_count: number | null; accepted_revision_number: number | null; user: RedemptionUser | null };

/** Select public contact/profile fields explicitly. Never select credentials or arbitrary metadata. */
export async function withRedemptionUsers(db: SupabaseClient, rows: Omit<Redemption, 'user'>[]): Promise<Redemption[]> {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(row => row.user_id))];
  const users = await db.from('users').select('id,firstName,lastName,email,phone,organizationId').in('id', ids);
  if (users.error) throw users.error;
  const organizationIds = [...new Set((users.data || []).map(user => user.organizationId).filter(Boolean))];
  const organizations = organizationIds.length ? await db.from('organizations').select('id,name').in('id', organizationIds) : { data: [], error: null };
  if (organizations.error) throw organizations.error;
  const names = new Map((organizations.data || []).map(org => [org.id, org.name]));
  const profiles = new Map((users.data || []).map(user => [user.id, {
    name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Name unavailable',
    email: user.email || null, phone: user.phone || null, organizationId: user.organizationId || null,
    organizationName: names.get(user.organizationId) || null,
  }]));
  return rows.map(row => ({ ...row, user: profiles.get(row.user_id) || null }));
}

export const MAX_REDEMPTION_EXPORT = 10000;
export class RedemptionExportLimit extends Error {}
/** Stable keyset pagination avoids row limits and excludes later redemptions. No partial workbook is returned. */
export async function exportRedemptions(db: SupabaseClient, campaignId: string, cutoff: string): Promise<Redemption[]> {
  const size = await db.from('promo_redemptions').select('id', { count: 'exact', head: true }).eq('promo_code_id', campaignId).lte('redeemed_at', cutoff);
  if (size.error || size.count === null) throw size.error || new Error('Unable to count redemptions');
  if (size.count > MAX_REDEMPTION_EXPORT) throw new RedemptionExportLimit(`This campaign exceeds the ${MAX_REDEMPTION_EXPORT.toLocaleString('en-IN')}-record Excel export limit.`);
  const rows: Redemption[] = []; let cursor: string | null = null;
  for (;;) {
    let query = db.from('promo_redemptions').select(redemptionColumns).eq('promo_code_id', campaignId).lte('redeemed_at', cutoff).order('id').limit(500);
    if (cursor) query = query.gt('id', cursor);
    const page = await query;
    if (page.error) throw page.error;
    const data = page.data || [];
    if (!data.length) break;
    if (data.some((row, i) => (i > 0 && row.id <= data[i - 1].id) || (cursor !== null && row.id <= cursor))) throw new Error('Invalid pagination');
    rows.push(...await withRedemptionUsers(db, data));
    if (rows.length > MAX_REDEMPTION_EXPORT) throw new RedemptionExportLimit('Campaign exceeds the Excel export limit.');
    cursor = data[data.length - 1].id;
  }
  if (rows.length !== size.count) throw new Error('Redemptions changed during export. Please retry.');
  return rows;
}
