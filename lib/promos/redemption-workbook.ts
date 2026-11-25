import * as ExcelJS from 'exceljs';
import type { Redemption } from './redemptions';
import { roles, type PromoRole } from './model';

function ist(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '';
}
type CampaignExport = { code: string; campaign_name: string; active?: boolean; starts_at?: string; expires_at?: string; overall_max_uses?: number; role_quotas?: Record<string, number>;
  target_plan_code?: string | null; fixed_price_minor?: number | null; price_adjustment?: number; created_at?: string; updated_at?: string };
export async function redemptionWorkbook(campaign: CampaignExport, rows: Redemption[], exportedAt: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SkillPassport'; workbook.created = new Date(exportedAt);
  const sheet = workbook.addWorksheet('Redemptions', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    ['Redemption ID', 'id', 38], ['User ID', 'userId', 38], ['Name', 'name', 28], ['Email', 'email', 36], ['Phone', 'phone', 22],
    ['Organization', 'organization', 32], ['Organization ID', 'organizationId', 38], ['Audience', 'audience', 22],
    ['Locked price', 'amount', 18], ['Currency', 'currency', 12], ['Billing period', 'period', 18], ['Plan revision', 'revision', 16],
    ['Redeemed at (IST)', 'redeemedAt', 28], ['Price locked at (IST)', 'acceptedAt', 28], ['Price locked at (UTC)', 'acceptedUtc', 28],
  ].map(([header, key, width]) => ({ header: String(header), key: String(key), width: Number(width) }));
  for (const row of rows) {
    // ExcelJS writes strings as literal text, including names beginning with =, + or @.
    sheet.addRow({ id: row.id, userId: row.user_id, name: row.user?.name || 'User details unavailable', email: row.user?.email || '', phone: row.user?.phone || '',
      organization: row.user?.organizationName || '', organizationId: row.user?.organizationId || '', audience: roles[row.role as PromoRole] || row.role,
      amount: row.accepted_amount_minor !== null && row.accepted_minor_unit !== null ? Number(row.accepted_amount_minor) / 10 ** row.accepted_minor_unit : null,
      currency: row.accepted_currency || '', period: row.accepted_interval_unit ? `${row.accepted_interval_count} ${row.accepted_interval_unit}` : '',
      revision: row.accepted_revision_number, redeemedAt: ist(row.redeemed_at), acceptedAt: ist(row.accepted_at), acceptedUtc: row.accepted_at || '' });
  }
  sheet.getColumn('amount').numFmt = '#,##0.00';
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  sheet.autoFilter = { from: 'A1', to: 'O1' };
  const info = workbook.addWorksheet('Campaign'); info.columns = [{ width: 28 }, { width: 100 }];
  info.addRows([['Promo code', campaign.code], ['Campaign', campaign.campaign_name], ['Exported at (IST)', ist(exportedAt)], ['Exported at (UTC)', exportedAt],
    ['Records', rows.length], ['Meaning of a redemption', 'A user locked a promotional price. This does not confirm payment.'],
    ['Missing saved price', 'Blank price fields indicate a legacy redemption without a saved price snapshot.'],
    ['User details', 'Current SkillPassport profile details at export time. Saved promotional prices are unchanged.']]);
  // Preserve useful campaign data even when an unused code has no redemption rows.
  info.addRows([['Active', campaign.active === undefined ? '' : campaign.active ? 'Yes' : 'No'], ['Starts at (IST)', ist(campaign.starts_at || null)], ['Expires at (IST)', ist(campaign.expires_at || null)],
    ['Maximum uses', campaign.overall_max_uses ?? ''], ['Learner quota', campaign.role_quotas?.learner ?? 0], ['School admin quota', campaign.role_quotas?.school_admin ?? 0], ['College admin quota', campaign.role_quotas?.college_admin ?? 0],
    ['Target plan code', campaign.target_plan_code || 'Default starter plan per audience'], ['Fixed price (minor units)', campaign.fixed_price_minor ?? ''], ['Additional amount (rupees)', campaign.price_adjustment ?? ''],
    ['Created at (UTC)', campaign.created_at || ''], ['Updated at (UTC)', campaign.updated_at || '']]);
  info.getColumn(1).font = { bold: true }; info.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  return workbook.xlsx.writeBuffer();
}
