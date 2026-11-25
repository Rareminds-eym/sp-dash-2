import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { promoDatabase, promoResponse } from '@/lib/promos/server';
import { redemptionColumns, withRedemptionUsers } from '@/lib/promos/redemptions';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request); if (auth.error) return auth.error;
  const query = new URL(request.url).searchParams, page = Number(query.get('page') || '1');
  if (!z.string().uuid().safeParse(query.get('id')).success || !Number.isInteger(page) || page < 1 || page > 10000 || [...query.keys()].some(key => !['id', 'page'].includes(key))) return promoResponse({ error: 'Invalid redemption query.' }, 400);
  try {
    const db = promoDatabase(auth.env);
    const { data, error, count } = await db.from('promo_redemptions')
      .select(redemptionColumns, { count: 'exact' })
      .eq('promo_code_id', query.get('id')).order('redeemed_at', { ascending: false }).order('id').range((page - 1) * 20, page * 20 - 1);
    if (error) throw error;
    const counts = await Promise.all(['learner', 'school_admin', 'college_admin'].map(async role => {
      const result = await db.from('promo_redemptions').select('id', { count: 'exact', head: true }).eq('promo_code_id', query.get('id')).eq('role', role);
      if (result.error || result.count === null) throw result.error || new Error('Missing count');
      return [role, result.count];
    }));
    return promoResponse({ items: await withRedemptionUsers(db, data || []), total: count, page, usedByRole: Object.fromEntries(counts) });
  } catch { return promoResponse({ error: 'Redemptions could not be loaded. Please retry.' }, 503); }
}
