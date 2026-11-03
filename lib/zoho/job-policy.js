import { z } from 'zod';

const label = z.string().min(1).max(100).refine(value => value.trim() === value && !value.includes('\0') && value.isWellFormed());
const mapping = value => z.record(label, value).refine(map => Object.keys(map).length >= 1 && Object.keys(map).length <= 50);
export const jobPolicySchema = z.object({
  connectionId: z.string().uuid(), expectedConfigRevision: z.number().int().positive(),
  statusMap: mapping(z.enum(['open', 'closed', 'draft'])),
  employmentMap: mapping(z.enum(['job', 'internship', 'contract'])),
  enabled: z.boolean(), noEmailReviewed: z.boolean(),
  triggerFingerprint: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(20).max(500),
}).strict().refine(value => !value.enabled || value.noEmailReviewed, 'Review the no-email effects before enabling job writes');

export async function readJobPolicy(db, connectionId) {
  const parsed = z.string().uuid().parse(connectionId);
  const { data, error } = await db.rpc('zoho_read_job_policy', { p_connection: parsed });
  if (error) throw Object.assign(new Error('Job publication policy unavailable'), { code: error.code });
  return data;
}
export async function configureJobPolicy(db, input, actorId) {
  const policy = jobPolicySchema.parse(input);
  const { data, error } = await db.rpc('zoho_configure_job_policy', {
    p_connection: policy.connectionId, p_actor: actorId, p_expected_config: policy.expectedConfigRevision,
    p_status_map: policy.statusMap, p_employment_map: policy.employmentMap,
    p_enabled: policy.enabled, p_no_email_reviewed: policy.noEmailReviewed,
    p_trigger_fingerprint: policy.triggerFingerprint, p_reason: policy.reason,
  });
  if (error) throw Object.assign(new Error('Job publication policy could not be updated'), { code: error.code });
  return data;
}
