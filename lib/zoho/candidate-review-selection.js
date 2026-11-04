/** UI guard only; SSO independently verifies canonical state before approval and execution. */
export function candidateApprovalReady(record, review, acknowledgedHash = null, now = Date.now()) {
  return Boolean(record && review && ['create', 'preserve_existing'].includes(review.decision) &&
    review.blockers?.length === 0 && acknowledgedHash === review.reviewHash &&
    record.id === review.recordId && record.revision === review.revision && record.source_hash === review.sourceHash &&
    record.config_revision === review.configRevision && record.target_id === review.targetId &&
    Date.parse(review.expiresAt) > now);
}
