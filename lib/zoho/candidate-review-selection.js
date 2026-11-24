/** UI guard only; SSO independently verifies canonical state before approval and execution. */
export function candidateReviewUnavailable(record, connection) {
  if (record?.payload_redacted_at || record?.suppressed) return 'Review data was erased or suppressed. Review source privacy controls; this record cannot be selected or checked.';
  const reviewing = record?.module === 'Job_Openings' ? 'reviewing jobs' : 'checking accounts';
  if (!connection) return 'Source connection is unavailable. Refresh status.';
  if (connection.status === 'paused') return `Source is paused. Resume connection in Source privacy, then run fresh discovery before ${reviewing}.`;
  if (connection.status !== 'connected') return `Connect this source, then run discovery before ${reviewing}.`;
  if (record && Number.isInteger(connection.configRevision) && record.config_revision !== connection.configRevision)
    return 'Source configuration changed. Run fresh discovery before checking this record.';
  if (record && !['pending_approval', 'held', 'rejected'].includes(record.decision))
    return 'This record is no longer awaiting review. Refresh the records.';
  return null;
}

export function candidateApprovalReady(record, review, acknowledgedHash = null, now = Date.now()) {
  return Boolean(record && !record.payload_redacted_at && !record.suppressed && review && ['create', 'preserve_existing'].includes(review.decision) &&
    review.blockers?.length === 0 && acknowledgedHash === review.reviewHash &&
    record.id === review.recordId && record.revision === review.revision && record.source_hash === review.sourceHash &&
    record.config_revision === review.configRevision && record.target_id === review.targetId &&
    Date.parse(review.expiresAt) > now);
}

/** Explain the first actionable blocker without granting any approval authority. */
export function selectionApprovalIssue(record, selected, review, now = Date.now()) {
  if (record?.payload_redacted_at || record?.suppressed) return 'Review data was erased or suppressed.';
  if (!record || !['pending_approval', 'held', 'rejected'].includes(record.decision))
    return 'Record changed. Refresh the records.';
  if (!Array.isArray(record.validation_errors) || record.validation_errors.length) return 'Resolve the validation issues and discover again.';
  if (record.module !== 'Candidates') return null;
  if (!review) return 'Check canonical account, then acknowledge the result.';
  if (Date.parse(review.expiresAt) <= now) return 'Account check expired. Refresh check and acknowledge again.';
  if (review.decision === 'blocked' || review.blockers?.length) return 'Account check has blockers. Open the review for details.';
  if (!candidateApprovalReady(record, review, review.reviewHash, now)) return 'Account check is stale. Refresh check.';
  if (selected.candidateReviewHash !== review.reviewHash) return 'Click Acknowledge and select after reviewing the account.';
  return null;
}

/** Warning only: repeated names can be legitimate. Never alter source identity silently. */
export function repeatedCandidateName(record) {
  if (record?.module !== 'Candidates') return false;
  const words = record.proposed_data?.name?.trim().split(/\s+/) || [];
  return words.length > 1 && words.length % 2 === 0 &&
    words.slice(0, words.length / 2).join(' ').toLocaleLowerCase() === words.slice(words.length / 2).join(' ').toLocaleLowerCase();
}
