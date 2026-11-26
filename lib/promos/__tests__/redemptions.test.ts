import { describe, expect, it } from 'vitest';
import * as ExcelJS from 'exceljs';
import { exportRedemptions, RedemptionExportLimit, withRedemptionUsers } from '../redemptions';
import { redemptionWorkbook } from '../redemption-workbook';
const row = (i: number) => ({ id: `redemption-${String(i).padStart(6, '0')}`, user_id: `user-${i}`, role: 'learner', redeemed_at: '2026-11-25T00:00:00Z', accepted_at: '2026-11-25T00:00:00Z', accepted_currency: 'INR', accepted_minor_unit: 2, accepted_amount_minor: 100001, accepted_interval_unit: 'year', accepted_interval_count: 1, accepted_revision_number: 2 });
function database(count: number, options: { missingUser?: boolean; profileError?: boolean; mismatch?: boolean } = {}) {
  const calls: { table: string; columns?: string; cursor?: string }[] = [];
  const db: any = { from(table: string) {
    const call: any = { table }; calls.push(call); let head = false, cursor = '', ids: string[] = [], limit = count;
    const chain: any = { select(columns: string, settings?: any) { call.columns = columns; head = !!settings?.head; return chain; },
      eq: () => chain, lte: () => chain, order: () => chain, limit(value: number) { limit = value; return chain; },
      gt(_key: string, value: string) { call.cursor = value; cursor = value; return chain; }, in(_key: string, values: string[]) { ids = values; return chain; },
      then(resolve: any) {
        if (table === 'users') return Promise.resolve({ data: options.missingUser ? [] : ids.map(id => ({ id, firstName: '=SUM(A1:A2)', lastName: 'Example', email: 'user@example.invalid', phone: '+919999999999', organizationId: 'org-1', temporary_password: 'never expose' })), error: options.profileError ? { message: 'profile failure' } : null }).then(resolve);
        if (table === 'organizations') return Promise.resolve({ data: [{ id: 'org-1', name: 'Example School' }], error: null }).then(resolve);
        if (head) return Promise.resolve({ count, error: null }).then(resolve);
        const data = Array.from({ length: options.mismatch ? count - 1 : count }, (_, i) => row(i)).filter(row => row.id > cursor).slice(0, limit);
        return Promise.resolve({ data, error: null }).then(resolve);
      } };
    return chain;
  } };
  return { db, calls };
}
describe('redemption profiles and full campaign export', () => {
  it('joins name/contact/organization using allowlisted fields only', async () => {
    const { db, calls } = database(1); const [result] = await withRedemptionUsers(db, [row(0)]);
    expect(result.user).toEqual({ name: '=SUM(A1:A2) Example', email: 'user@example.invalid', phone: '+919999999999', organizationName: 'Example School', organizationId: 'org-1' });
    expect(calls.find(call => call.table === 'users')?.columns).toBe('id,firstName,lastName,email,phone,organizationId');
    expect(JSON.stringify(result)).not.toContain('never expose');
  });
  it('keeps redemption history if a profile is unavailable but fails on database outages', async () => {
    expect((await withRedemptionUsers(database(1, { missingUser: true }).db, [row(0)]))[0].user).toBeNull();
    await expect(withRedemptionUsers(database(1, { profileError: true }).db, [row(0)])).rejects.toBeTruthy();
  });
  it('exports beyond both the UI page and the database 1000-row cap using keyset pages', async () => {
    const { db, calls } = database(1201);
    const result = await exportRedemptions(db, 'campaign', '2026-11-25T01:00:00Z');
    expect(result).toHaveLength(1201); expect(new Set(result.map(row => row.id)).size).toBe(1201);
    expect(calls.filter(call => call.table === 'promo_redemptions' && call.cursor).length).toBe(3);
  });
  it('returns an empty export and refuses over-limit or changing exports rather than truncating', async () => {
    expect(await exportRedemptions(database(0).db, 'campaign', '2026-11-25T01:00:00Z')).toEqual([]);
    await expect(exportRedemptions(database(10001).db, 'campaign', '2026-11-25T01:00:00Z')).rejects.toBeInstanceOf(RedemptionExportLimit);
    await expect(exportRedemptions(database(2, { mismatch: true }).db, 'campaign', '2026-11-25T01:00:00Z')).rejects.toThrow('changed during export');
  });
  it('produces a real Excel workbook with contacts, numeric price, IST dates and literal spreadsheet text', async () => {
    const rows = await withRedemptionUsers(database(1).db, [row(0)]);
    const bytes = await redemptionWorkbook({ code: 'TEST', campaign_name: 'Example campaign' }, rows, '2026-11-25T00:00:00Z');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet('Redemptions')!;
    expect(sheet.rowCount).toBe(2); expect(sheet.getCell('C2').value).toBe('=SUM(A1:A2) Example');
    expect(sheet.getCell('C2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('E2').value).toBe('+919999999999'); expect(sheet.getCell('E2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('F2').value).toBe('Example School'); expect(sheet.getCell('I2').value).toBe(1000.01);
    expect(sheet.getCell('N2').value).toContain('05:30:00');
    expect(workbook.getWorksheet('Campaign')!.getCell('B6').value).toContain('does not confirm payment');
  });
  it('preserves legacy records without inventing a price', async () => {
    const bytes = await redemptionWorkbook({ code: 'OLD', campaign_name: 'Legacy' }, [{ ...row(0), user: null, accepted_at: null, accepted_amount_minor: null, accepted_minor_unit: null }], '2026-11-25T00:00:00Z');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    expect(workbook.getWorksheet('Redemptions')!.getCell('I2').value).toBeNull();
  });
  it('includes campaign settings when exporting an unused code before deletion', async () => {
    const bytes = await redemptionWorkbook({ code: 'UNUSED', campaign_name: 'Unused campaign', active: false, starts_at: '2026-11-25T00:00:00Z', expires_at: '2026-12-25T00:00:00Z', overall_max_uses: 100,
      role_quotas: { learner: 100, school_admin: 0, college_admin: 0 }, target_plan_code: 'plan-reference', fixed_price_minor: 100000, price_adjustment: 0, created_at: '2026-11-24T00:00:00Z', updated_at: '2026-11-25T00:00:00Z' }, [], '2026-11-25T00:00:00Z');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    expect(workbook.getWorksheet('Redemptions')!.rowCount).toBe(1);
    const values = new Map<string, unknown>(); workbook.getWorksheet('Campaign')!.eachRow(row => values.set(String(row.getCell(1).value), row.getCell(2).value));
    expect(values.get('Promo code')).toBe('UNUSED'); expect(values.get('Records')).toBe(0); expect(values.get('Active')).toBe('No');
    expect(values.get('Maximum uses')).toBe(100); expect(values.get('Learner quota')).toBe(100); expect(values.get('Fixed price (minor units)')).toBe(100000);
    expect(values.get('Starts at (IST)')).toContain('05:30:00'); expect(values.get('Target plan code')).toBe('plan-reference');
  });
});
