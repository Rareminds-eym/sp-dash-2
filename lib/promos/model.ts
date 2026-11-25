import { z } from 'zod';
import type { PublishedCatalog } from '../subscriptions/workspace';

export const roles = { learner: 'Learner', school_admin: 'School admin', college_admin: 'College admin' } as const;
export type PromoRole = keyof typeof roles;
const audiences = { learner: 'individual', school_admin: 'school', college_admin: 'college' };
export const money = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(minor / 100);
/** Parse decimal rupees without floating point multiplication/rounding. */
export function rupeesToMinor(value: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) throw new Error('Enter a positive rupee amount with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new Error('Amount is too large.');
  return amount;
}
export const createPromoSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/, 'Use 3–40 letters, numbers, hyphens or underscores.'),
  campaign_name: z.string().trim().min(1).max(120),
  role: z.enum(['learner', 'school_admin', 'college_admin']),
  target_plan_code: z.string().regex(/^pln_[0-9a-f]{32}$/),
  mode: z.enum(['fixed', 'addition']), amount: z.string().max(20),
  starts_at: z.string().datetime({ offset: true }), expires_at: z.string().datetime({ offset: true }),
  overall_max_uses: z.number().int().min(1).max(2147483647),
}).strict().superRefine((value, ctx) => {
  if (Date.parse(value.expires_at) <= Date.parse(value.starts_at)) ctx.addIssue({ code: 'custom', path: ['expires_at'], message: 'Expiry must be after the start date.' });
  try { if (rupeesToMinor(value.amount) < 1) throw new Error('Amount must be greater than zero.'); }
  catch (error) { ctx.addIssue({ code: 'custom', path: ['amount'], message: (error as Error).message }); }
});
export type PromoInput = z.infer<typeof createPromoSchema>;
export const editPromoSchema = z.object({
  id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }),
  campaign_name: z.string().trim().min(1).max(120),
  mode: z.enum(['fixed', 'addition']), amount: z.string().max(20),
  starts_at: z.string().datetime({ offset: true }), expires_at: z.string().datetime({ offset: true }),
  overall_max_uses: z.number().int().min(1).max(2147483647),
  role_quotas: z.object({ learner: z.number().int().min(0).max(2147483647), school_admin: z.number().int().min(0).max(2147483647), college_admin: z.number().int().min(0).max(2147483647) }).strict(),
}).strict().superRefine((value, ctx) => {
  if (Date.parse(value.expires_at) <= Date.parse(value.starts_at)) ctx.addIssue({ code: 'custom', message: 'Expiry must be after the start date.' });
  try { if (value.mode === 'fixed' && rupeesToMinor(value.amount) < 1) throw new Error('Amount must be greater than zero.'); else rupeesToMinor(value.amount); }
  catch (error) { ctx.addIssue({ code: 'custom', message: (error as Error).message }); }
});
export function editCampaignValues(input: z.infer<typeof editPromoSchema>, target: string | null, plans: PromoPlan[]) {
  const amount = rupeesToMinor(input.amount);
  const defaults = { learner: 'skill starter', school_admin: 'school starter', college_admin: 'college starter' };
  for (const role of Object.keys(roles) as PromoRole[]) {
    if (!input.role_quotas[role]) continue;
    const matches = plans.filter(plan => plan.role === role && (target ? plan.code === target || plan.name.toLowerCase().trim() === target : plan.name.toLowerCase().trim() === defaults[role]));
    if (matches.length !== 1) throw new Error(`The target plan is unavailable or incompatible with ${roles[role]}. Set its quota to zero or choose a different campaign.`);
    const delta = input.mode === 'fixed' ? amount - matches[0].baseMinor : amount;
    if (delta > 1_000_000) throw new Error('The additional charge cannot exceed ₹10,000 above the published price.');
  }
  return { campaign_name: input.campaign_name, starts_at: input.starts_at, expires_at: input.expires_at, overall_max_uses: input.overall_max_uses,
    role_quotas: input.role_quotas, fixed_price_minor: input.mode === 'fixed' ? amount : null, price_adjustment: input.mode === 'addition' ? amount / 100 : 0 };
}
export type PromoPlan = { code: string; name: string; role: PromoRole; baseMinor: number; intervalUnit: string; intervalCount: number };
export function eligiblePlans(plans: PublishedCatalog['plans']): PromoPlan[] {
  return plans.flatMap(plan => Object.keys(roles).flatMap(value => {
    const role = value as PromoRole;
    if (plan.purchaseMode !== 'self_service' || !plan.audiences.includes(audiences[role])) return [];
    // Checkout currently requires exactly one published price for this audience.
    const prices = plan.prices.filter(price => price.audiences.includes(audiences[role]));
    if (prices.length !== 1) return [];
    const price = prices[0];
    if (price.currency !== 'INR' || price.minorUnit !== 2 || price.quantityBasis !== 'subscription' || price.amountMinor < 1) return [];
    return [{ code: plan.plan.code, name: plan.name, role, baseMinor: price.amountMinor, intervalUnit: price.intervalUnit, intervalCount: price.intervalCount }];
  }));
}
export function campaignValues(input: PromoInput, plans: PromoPlan[]) {
  const plan = plans.find(plan => plan.code === input.target_plan_code && plan.role === input.role);
  if (!plan) throw new Error('Select an available published plan for this audience.');
  const amount = rupeesToMinor(input.amount);
  const delta = input.mode === 'fixed' ? amount - plan.baseMinor : amount;
  if (delta > 1_000_000) throw new Error('The additional charge cannot exceed ₹10,000 above the published price.');
  return { code: input.code, campaign_name: input.campaign_name, target_plan_code: input.target_plan_code,
    fixed_price_minor: input.mode === 'fixed' ? amount : null, price_adjustment: input.mode === 'addition' ? amount / 100 : 0,
    active: true, starts_at: input.starts_at, expires_at: input.expires_at, overall_max_uses: input.overall_max_uses,
    role_quotas: Object.fromEntries(Object.keys(roles).map(role => [role, role === input.role ? input.overall_max_uses : 0])) };
}
export function promoStatus(row: { active: boolean; starts_at: string; expires_at: string; overall_max_uses: number; used: number }, now = Date.now()) {
  return !row.active ? 'Paused' : Date.parse(row.expires_at) <= now ? 'Expired' : row.used >= row.overall_max_uses ? 'Exhausted' : Date.parse(row.starts_at) > now ? 'Scheduled' : 'Active';
}
