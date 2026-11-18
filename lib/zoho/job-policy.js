import { z } from 'zod';

// Suggested exact-label mappings, never an approval or permission to publish.
export const DEFAULT_JOB_POLICY_MAPPINGS = Object.freeze({
  statusMap: Object.freeze({ 'In-progress': 'open', Inactive: 'closed', Filled: 'closed', Cancelled: 'closed', 'On-Hold': 'draft' }),
  employmentMap: Object.freeze({ 'Full time': 'job', Permanent: 'job', 'Part time': 'job', Contract: 'contract', Internship: 'internship' }),
});

const label = z.string().min(1).max(100).refine(value => value.trim() === value && !value.includes('\0') && value.isWellFormed());
const mapping = value => z.record(label, value).refine(map => Object.keys(map).length >= 1 && Object.keys(map).length <= 50);
export const jobPolicySchema = z.object({
  connectionId: z.string().uuid(), expectedConfigRevision: z.number().int().positive(),
  statusMap: mapping(z.enum(['open', 'closed', 'draft'])),
  employmentMap: mapping(z.enum(['job', 'internship', 'contract'])),
  enabled: z.boolean(), noEmailReviewed: z.boolean(),
  reason: z.string().trim().min(3).max(500),
}).strict().refine(value => !value.enabled || value.noEmailReviewed, 'Confirm the no-email policy before enabling job imports');

export async function readJobPolicy(db, connectionId) {
  const parsed = z.string().uuid().parse(connectionId);
  const { data, error } = await db.rpc('zoho_read_job_policy', { p_connection: parsed });
  if (error) throw Object.assign(new Error('Job publication policy unavailable'), { code: error.code });
  const capacity = await db.rpc('zoho_job_publishing_preflight', { p_connection: parsed });
  if (capacity.error) throw Object.assign(new Error('Job publication preflight unavailable'), { code: capacity.error.code });
  // Only source mappings and current publishing capacity cross the browser boundary.
  return { publishing: capacity.data, ...Object.fromEntries(['connectionId','configRevision','policy','emailPolicy'].filter(key=>data?.[key]!==undefined).map(key=>[key,data[key]])) };
}
export async function configureJobPolicy(db, input, actorId) {
  const policy = jobPolicySchema.parse(input);
  const { data, error } = await db.rpc('zoho_configure_job_policy', {
    p_connection: policy.connectionId, p_actor: actorId, p_expected_config: policy.expectedConfigRevision,
    p_status_map: policy.statusMap, p_employment_map: policy.employmentMap,
    p_enabled: policy.enabled, p_no_email_reviewed: policy.noEmailReviewed,
    p_reason: policy.reason,
  });
  if (error) throw Object.assign(new Error('Job publication policy could not be updated'), { code: error.code });
  return data;
}
