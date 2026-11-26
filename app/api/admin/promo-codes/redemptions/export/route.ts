import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { promoDatabase, promoHeaders, promoResponse } from '@/lib/promos/server';
import { exportRedemptions, RedemptionExportLimit } from '@/lib/promos/redemptions';
import { redemptionWorkbook } from '@/lib/promos/redemption-workbook';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request); if (auth.error) return auth.error;
  const query = new URL(request.url).searchParams, id = query.get('id');
  if ([...query].length !== 1 || !z.string().uuid().safeParse(id).success) return promoResponse({ error: 'Select a valid campaign to export.' }, 400);
  try {
    const db = promoDatabase(auth.env);
    const campaign = await db.from('promo_codes').select('code,campaign_name,active,starts_at,expires_at,overall_max_uses,role_quotas,target_plan_code,fixed_price_minor,price_adjustment,created_at,updated_at').eq('id', id).maybeSingle();
    if (campaign.error) throw campaign.error;
    if (!campaign.data) return promoResponse({ error: 'Campaign not found.' }, 404);
    const exportedAt = new Date().toISOString();
    const rows = await exportRedemptions(db, id!, exportedAt);
    const buffer = await redemptionWorkbook(campaign.data, rows, exportedAt);
    return new Response(new Uint8Array(buffer), { headers: { ...promoHeaders,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="promo-redemptions-${id}-${exportedAt.slice(0, 10)}.xlsx"` } });
  } catch (error) {
    if (error instanceof RedemptionExportLimit) return promoResponse({ error: error.message }, 422);
    return promoResponse({ error: 'Excel export could not be completed. Please retry.' }, 503);
  }
}
