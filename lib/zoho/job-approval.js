/** Advisory UI checks only. The transactional publisher remains authoritative. */
export function jobPolicyContextIssue(context, connection) {
  if (!context || context.connectionId !== connection?.id || context.configRevision !== connection?.configRevision ||
      context.emailPolicy !== 'forbidden' || context.policy?.enabled !== true || context.policy.noEmailReviewed !== true ||
      typeof context.triggerFingerprint !== 'string' || context.policy.triggerFingerprint !== context.triggerFingerprint)
    return 'Job publication policy is unavailable or changed. Refresh status and review the publication policy.';
  const capacity = context.publishing;
  if (typeof capacity?.entitlementReady !== 'boolean' || !Array.isArray(capacity.activeTargetIds) ||
      !(capacity.remainingSlots === null || Number.isFinite(capacity.remainingSlots) && capacity.remainingSlots >= 0))
    return 'Job publishing capacity is unavailable. Refresh status before approving jobs.';
  return null;
}

export function jobNeedsPublishingSlot(record, policy, publishing) {
  return policy?.statusMap?.[record?.proposed_data?.source_status] === 'open' && !publishing?.activeTargetIds?.includes(record?.target_id);
}

export function jobPublicationIssue(record, policy, publishing) {
  if (!policy?.statusMap || !policy?.employmentMap) return 'Review the job publication policy first.';
  const status = policy.statusMap[record?.proposed_data?.source_status];
  const employment = policy.employmentMap[record?.proposed_data?.employment_type];
  if (!['open', 'draft', 'closed'].includes(status) || !['job', 'internship', 'contract'].includes(employment))
    return 'Job status or employment type is not mapped by the publication policy.';
  if (status === 'closed' && !record.target_id) return 'Closed jobs cannot be created. Only an existing linked job can be closed.';
  if (jobNeedsPublishingSlot(record, policy, publishing) && !publishing?.entitlementReady)
    return 'Publishing entitlement is unavailable for this organization. Configure an active job-posting entitlement before approving open jobs.';
  return null;
}

export function jobSelectionIssues(records, connection, context) {
  const contextIssue = jobPolicyContextIssue(context, connection);
  let slots = 0;
  return records.map(record => {
    let message = !record ? 'Record changed. Refresh the records.' :
      record.config_revision !== connection?.configRevision ? 'Source configuration changed. Run fresh discovery.' :
      !Array.isArray(record.validation_errors) || record.validation_errors.length ? 'Resolve source validation issues and discover again.' :
      contextIssue || jobPublicationIssue(record, context.policy, context.publishing);
    if (!message && jobNeedsPublishingSlot(record, context.policy, context.publishing)) {
      if (context.publishing.remainingSlots !== null && slots >= context.publishing.remainingSlots)
        message = 'Job publishing capacity is exhausted. Increase available capacity or close active jobs before approving more open jobs.';
      slots++;
    }
    return {id:record?.id,record,message};
  }).filter(item => item.message);
}
