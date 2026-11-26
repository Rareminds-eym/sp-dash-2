import { describe, expect, it } from 'vitest';
import { campaignValues, createPromoSchema, editPromoSchema, editCampaignValues, eligiblePlans, promoStatus, rupeesToMinor } from '../model';
const code = `pln_${'a'.repeat(32)}`;
const input = { code: ' learner1000 ', campaign_name: 'Test', role: 'learner' as const, target_plan_code: code, mode: 'fixed' as const, amount: '1000', overall_max_uses: 100, starts_at: '2026-11-25T00:00:00Z', expires_at: '2026-12-25T00:00:00Z' };
const plan = { code, name: 'Starter', role: 'learner' as const, baseMinor: 250000, intervalUnit: 'year', intervalCount: 1 };
describe('campaign price and eligibility rules', () => {
  it.each(['learner', 'school_admin', 'college_admin'] as const)('validates edits for %s including zero quota and legacy default mapping', role => {
    const name = { learner: 'Skill Starter', school_admin: 'School Starter', college_admin: 'College Starter' }[role];
    const edit = editPromoSchema.parse({ id: 'a0000000-0000-4000-8000-000000000001', updated_at: input.starts_at, campaign_name: 'Updated', mode: 'fixed', amount: '1000', starts_at: input.starts_at, expires_at: input.expires_at, overall_max_uses: 100, role_quotas: { learner: 0, school_admin: 0, college_admin: 0, [role]: 50 } });
    expect(editCampaignValues(edit, code, [{ ...plan, name, role }]).fixed_price_minor).toBe(100000);
    expect(editCampaignValues(edit, null, [{ ...plan, name, role }]).role_quotas[role]).toBe(50);
    expect(editCampaignValues(edit, name.toLowerCase(), [{ ...plan, name, role }]).campaign_name).toBe('Updated');
    expect(() => editCampaignValues({ ...edit, amount: '12500.01' }, code, [{ ...plan, name, role }])).toThrow('₹10,000');
    expect(() => editCampaignValues(edit, code, [])).toThrow('unavailable');
    expect(editPromoSchema.safeParse({ ...edit, role_quotas: { ...edit.role_quotas, [role]: -1 } }).success).toBe(false);
  });
  it.each([['100', 10000], ['1000.01', 100001], ['0.29', 29], ['5500', 550000]])('converts rupees %s exactly', (value, minor) => expect(rupeesToMinor(value)).toBe(minor));
  it.each(['-100', '1.001', '1e3', 'Infinity', 'NaN', '', ' 100', '+100'])('rejects invalid amount %s', value => expect(() => rupeesToMinor(value)).toThrow());
  it.each(['learner', 'school_admin', 'college_admin'] as const)('creates fixed price with only %s eligible', role => {
    const value = campaignValues(createPromoSchema.parse({ ...input, role }), [{ ...plan, role }]);
    expect(value.fixed_price_minor).toBe(100000); expect(value.price_adjustment).toBe(0);
    expect(value.role_quotas[role]).toBe(100); expect(Object.values(value.role_quotas).reduce((a, b) => a + b, 0)).toBe(100);
    expect(value.code).toBe('LEARNER1000');
  });
  it('stores additive amounts in rupees and fixed prices in paise', () => {
    const value = campaignValues(createPromoSchema.parse({ ...input, mode: 'addition', amount: '100.25' }), [plan]);
    expect(value.price_adjustment).toBe(100.25); expect(value.fixed_price_minor).toBeNull();
  });
  it.each(['0', '-1', '100.001'])('rejects nonpayable/invalid fixed amount %s', amount => expect(createPromoSchema.safeParse({ ...input, amount }).success).toBe(false));
  it('allows discounts and surcharge up to checkout cap but rejects excess', () => {
    expect(campaignValues(createPromoSchema.parse({ ...input, amount: '1' }), [plan]).fixed_price_minor).toBe(100);
    expect(campaignValues(createPromoSchema.parse({ ...input, amount: '12500' }), [plan]).fixed_price_minor).toBe(1250000);
    expect(() => campaignValues(createPromoSchema.parse({ ...input, amount: '12500.01' }), [plan])).toThrow('₹10,000');
    expect(() => campaignValues(createPromoSchema.parse({ ...input, mode: 'addition', amount: '10000.01' }), [plan])).toThrow();
  });
  it('rejects incompatible roles, stale plans, invalid quotas and dates', () => {
    expect(() => campaignValues(createPromoSchema.parse({ ...input, role: 'school_admin' }), [plan])).toThrow();
    expect(() => campaignValues(createPromoSchema.parse(input), [])).toThrow();
    for (const overall_max_uses of [0, -1, 1.5, 2147483648]) expect(createPromoSchema.safeParse({ ...input, overall_max_uses }).success).toBe(false);
    expect(createPromoSchema.safeParse({ ...input, expires_at: input.starts_at }).success).toBe(false);
    expect(createPromoSchema.safeParse({ ...input, fixed_price_minor: 1 }).success).toBe(false);
  });
  it.each([['individual', 'learner'], ['school', 'school_admin'], ['college', 'college_admin']])('maps %s catalog audience to %s', (audience, role) => {
    const price = { currency: 'INR', minorUnit: 2, amountMinor: 250000, quantityBasis: 'subscription', audiences: [audience], intervalUnit: 'year', intervalCount: 1 };
    const published: any = { plan: { code }, name: 'Starter', audiences: [audience], purchaseMode: 'self_service', prices: [price] };
    expect(eligiblePlans([published])[0].role).toBe(role);
    for (const purchaseMode of ['free', 'contact_sales']) expect(eligiblePlans([{ ...published, purchaseMode }])).toEqual([]);
    expect(eligiblePlans([{ ...published, prices: [price, price] }])).toEqual([]);
    expect(eligiblePlans([{ ...published, prices: [{ ...price, currency: 'USD' }] }])).toEqual([]);
    expect(eligiblePlans([{ ...published, prices: [{ ...price, quantityBasis: 'seat' }] }])).toEqual([]);
  });
  it('reports paused, scheduled, expired and exhausted correctly', () => {
    const row = { ...input, active: true, used: 0 }; const now = Date.parse('2026-12-01T00:00:00Z');
    expect(promoStatus(row, now)).toBe('Active'); expect(promoStatus({ ...row, active: false }, now)).toBe('Paused');
    expect(promoStatus({ ...row, used: 100 }, now)).toBe('Exhausted'); expect(promoStatus(row, Date.parse('2026-12-25T00:00:00Z'))).toBe('Expired');
    expect(promoStatus(row, Date.parse('2026-11-24T00:00:00Z'))).toBe('Scheduled');
  });
});
