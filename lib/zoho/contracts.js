import { z } from 'zod';

export const ZOHO_POLICY = Object.freeze({
  emailPolicy: 'forbidden', maxApprovalBatch: 50, pageSize: 50,
  maxRequestBytes: 131072, source: 'zoho_recruit', approvalHours: 24,
});
export const ZOHO_PUBLISHER_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';
/** IDs copied into diagnostics must also be safe for PostgreSQL JSON. */
export const safeSourceId = value => typeof value === 'string' && /^\d{1,40}$/.test(value) ? value : null;
export const MODULES = ['Candidates', 'Job_Openings'];
// Only data centers with verified Recruit OAuth/API hosts are offered in setup.
export const ZOHO_REGIONS = ['us', 'in', 'eu', 'jp', 'cn'];
export const DECISION_STATES = ['pending_approval', 'held', 'rejected', 'approved', 'approval_stale', 'processing', 'completed', 'failed'];
export const scopeSchema = z.object({ connectionId: z.string().uuid() }).strict();
export const discoverySchema = scopeSchema.extend({ module: z.enum(MODULES) }).strict();
export const decisionSchema = scopeSchema.extend({
  decision: z.enum(['approve', 'hold', 'reject']),
  items: z.array(z.object({ id: z.string().uuid(), revision: z.number().int().positive(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), configRevision: z.number().int().positive().optional(),
    targetId: z.string().uuid().nullable().optional(),
    candidateReviewHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict())
    .min(1).max(ZOHO_POLICY.maxApprovalBatch),
  reason: z.string().trim().min(3).max(500),
  requestId: z.string().uuid(),
}).strict().superRefine((body, ctx) => {
  if (body.decision === 'approve' && body.items.some(item => !item.sourceHash || !item.configRevision || item.targetId === undefined))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Review source hash, mapping revision and target before approval' });
  if (new Set(body.items.map(item => item.id)).size !== body.items.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Duplicate selection' });
});
export const configureSchema = z.object({
  name: z.string().trim().min(2).max(100),
  sourceOrgId: z.string().regex(/^\d{1,40}$/),
  region: z.enum(ZOHO_REGIONS),
  publisherOrganizationId: z.literal(ZOHO_PUBLISHER_ORGANIZATION_ID).default(ZOHO_PUBLISHER_ORGANIZATION_ID),
}).strict();

/** SHA-256 of stable source-owned JSON; keys and arrays have unambiguous encoding. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function normalizeRecruitRecord(module, record, companyField = 'Client_Name', titleField = 'Posting_Title') {
  if (!MODULES.includes(module) || !record || typeof record !== 'object') throw new Error('Invalid source record');
  if (typeof record.id !== 'string' || !/^\d{1,40}$/.test(record.id)) throw new Error('Source ID must be a decimal string');
  const modified = z.string().datetime({ offset: true }).parse(record.Modified_Time);
  const text = (value, max = 500) => {
    if (typeof value !== 'string') return '';
    if (value.includes('\0') || !value.isWellFormed()) throw new Error('Unsupported source text');
    let result = value.trim().slice(0, max);
    // A UTF-16 length limit must not turn a valid emoji into an unpaired surrogate.
    if (/[\uD800-\uDBFF]$/.test(result)) result = result.slice(0, -1);
    return result;
  };
  if (module === 'Candidates') {
    const email = text(record.Email, 320).toLowerCase();
    const name = [text(record.First_Name, 150), text(record.Last_Name, 150)].filter(Boolean).join(' ');
    const errors = [];
    if (!z.string().email().safeParse(email).success) errors.push('A valid primary email is required.');
    if (name.length < 2) errors.push('Candidate name is required.');
    if (name.length > 150) errors.push('Candidate name exceeds the profile length limit.');
    return { externalId: record.id, modified, data: { email, name }, errors };
  }
  // Source approval/publication policy is reviewed separately; source fields never authorize writes.
  const data = {
    title: text(record[titleField] || record.Job_Opening_Name, 500),
    company_name: text(record[companyField]?.name || record[companyField], 300),
    // Retain the internal payload shape; Zoho does not supply a department.
    department: '',
    location: text(record.City, 100),
    employment_type: text(record.Job_Type, 100),
    description: text(record.Job_Description, 32000),
    source_status: text(record.Job_Opening_Status, 100),
    application_link: text(record.Application_Link, 2048),
  };
  const errors = Object.entries({ title: data.title, company_name: data.company_name,
    location: data.location, employment_type: data.employment_type }).filter(([, value]) => !value).map(([key]) => `${key} mapping is required.`);
  // Custom status/publication mappings are deliberately fail-closed until configured and reviewed.
  errors.push('Job publication and status mapping requires review.');
  return { externalId: record.id, modified, data, errors };
}
