import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { createPromoSchema, campaignValues, editPromoSchema, editCampaignValues } from '@/lib/promos/model';
import { promoDatabase, promoResponse, publishedPromoPlans, smallJson } from '@/lib/promos/server';

export const dynamic = 'force-dynamic';
const columns = 'id,code,campaign_name,active,starts_at,expires_at,overall_max_uses,role_quotas,price_adjustment,target_plan_code,fixed_price_minor,created_at,updated_at';
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request); if (auth.error) return auth.error;
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => !['page', 'q', 'kind'].includes(key)) || [...query.keys()].length !== new Set(query.keys()).size) return promoResponse({ error: 'Invalid query' }, 400);
  if (query.get('kind') === 'plans') {
    try { return promoResponse({ plans: await publishedPromoPlans(request) }); }
    catch { return promoResponse({ error: 'Published plans could not be loaded. Please retry.' }, 503); }
  }
  const page = Number(query.get('page') || '1'), search = query.get('q') || '';
  if (!Number.isInteger(page) || page < 1 || page > 10000 || search.length > 40 || !/^[a-zA-Z0-9_-]*$/.test(search)) return promoResponse({ error: 'Search by code using letters, numbers, hyphens or underscores.' }, 400);
  try {
    const db = promoDatabase(auth.env);
    let query = db.from('promo_codes').select(`${columns},promo_redemptions(count)`, { count: 'exact' }).order('created_at', { ascending: false }).order('id').range((page - 1) * 20, page * 20 - 1);
    if (search) query = query.ilike('code', `%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    // A relation count is calculated by PostgreSQL, unaffected by the API row cap.
    const items = (data || []).map(({ promo_redemptions, ...row }) => ({ ...row, used: promo_redemptions[0].count }));
    return promoResponse({ items, total: count, page });
  } catch { return promoResponse({ error: 'Promo codes could not be loaded. Please retry.' }, 503); }
}
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request); if (auth.error) return auth.error;
  let input;
  try { input = createPromoSchema.parse(await smallJson(request)); }
  catch (error) { return promoResponse({ error: error instanceof z.ZodError ? error.issues[0].message : 'Invalid campaign details.' }, 400); }
  let values;
  try { values = campaignValues(input, await publishedPromoPlans(request)); }
  catch (error) { return promoResponse({ error: error instanceof Error ? error.message : 'Plan validation failed.' }, 400); }
  try {
    const db = promoDatabase(auth.env);
    const actor = await db.from('users').select('id').eq('id', auth.user.id).maybeSingle();
    if (actor.error) throw actor.error;
    if (!actor.data) return promoResponse({ error: 'Your administrator account must be synced to SkillPassport before creating codes.' }, 409);
    const { data, error } = await db.from('promo_codes').insert({ ...values, created_by: auth.user.id, updated_by: auth.user.id }).select(columns).single();
    if (error?.code === '23505') return promoResponse({ error: 'This promo code already exists. Choose another code.' }, 409);
    if (error) throw error;
    return promoResponse({ item: data }, 201);
  } catch { return promoResponse({ error: 'Campaign creation could not be confirmed. Refresh the list before trying again.' }, 503); }
}
export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin(request); if (auth.error) return auth.error;
  let input;
  try { input = z.union([z.object({ id: z.string().uuid(), active: z.boolean(), updated_at: z.string().datetime({ offset: true }) }).strict(), editPromoSchema]).parse(await smallJson(request)); }
  catch { return promoResponse({ error: 'Invalid campaign update. Check the price, dates and limits.' }, 400); }
  try {
    const db = promoDatabase(auth.env);
    let changes: Record<string, unknown>;
    if ('active' in input) changes = { active: input.active };
    else {
      const current = await db.from('promo_codes').select(columns).eq('id', input.id).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data || current.data.updated_at !== input.updated_at) return promoResponse({ error: 'This campaign changed. Refresh before editing it.' }, 409);
      try { changes = editCampaignValues(input, current.data.target_plan_code, await publishedPromoPlans(request)); }
      catch (error) { return promoResponse({ error: error instanceof Error ? error.message : 'Invalid campaign terms.' }, 400); }
      // Legacy redemptions have no immutable price snapshot: do not change their effective pricing.
      if (Number(changes.fixed_price_minor) !== Number(current.data.fixed_price_minor) || (changes.fixed_price_minor === null) !== (current.data.fixed_price_minor === null) || Number(changes.price_adjustment) !== Number(current.data.price_adjustment)) {
        const legacy = await db.from('promo_redemptions').select('id', { count: 'exact', head: true }).eq('promo_code_id', input.id).is('accepted_amount_minor', null);
        if (legacy.error || legacy.count === null) throw legacy.error || new Error('Cannot verify saved prices');
        if (legacy.count > 0) return promoResponse({ error: 'This code has legacy redemptions without saved prices. Create a new code to change its price.' }, 409);
      }
    }
    const { data, error } = await db.from('promo_codes').update({ ...changes, updated_by: auth.user.id, updated_at: new Date().toISOString() }).eq('id', input.id).eq('updated_at', input.updated_at).select(columns).maybeSingle();
    if (error) throw error;
    if (!data) return promoResponse({ error: 'This campaign changed. Refresh before updating it.' }, 409);
    return promoResponse({ item: data });
  } catch { return promoResponse({ error: 'The update could not be confirmed. Refresh before trying again.' }, 503); }
}
export async function DELETE(request: Request) {
  const auth = await requirePlatformAdmin(request); if (auth.error) return auth.error;
  let input;
  try { input = z.object({ id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }) }).strict().parse(await smallJson(request)); }
  catch { return promoResponse({ error: 'Invalid deletion request.' }, 400); }
  try {
    // The restrictive FK prevents deletion even if a redemption arrives concurrently.
    const { data, error } = await promoDatabase(auth.env).from('promo_codes').delete().eq('id', input.id).eq('updated_at', input.updated_at).select('id,code').maybeSingle();
    if (error?.code === '23503') return promoResponse({ error: 'This code has existing history and cannot be deleted. Pause it instead.' }, 409);
    if (error) throw error;
    if (!data) return promoResponse({ error: 'This campaign changed or was deleted. Refresh before continuing.' }, 409);
    return promoResponse({ deleted: true, id: data.id });
  } catch { return promoResponse({ error: 'Deletion could not be confirmed. Refresh before trying again.' }, 503); }
}
