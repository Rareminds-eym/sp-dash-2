export function executionRecoveryStatus(item, now = Date.now()) {
  if (item.state === 'completed') return { label: 'Completed', detail: 'Destination receipt confirmed.' };
  if (item.state === 'processing') {
    if (item.destination_phase === 'projection_pending') return { label: 'Syncing to application', detail: 'SSO confirmed account creation or preservation. Application sync and its confirmation are still pending.' };
    if (item.last_error === 'OUTCOME_UNKNOWN' || Date.parse(item.lease_expires_at) <= now)
      return { label: 'Checking interrupted operation', detail: 'Account creation may have happened. Recovery checks receipts before any further write.' };
    return { label: 'Processing', detail: 'An execution lease is active. Recovery will not start a second execution.' };
  }
  if (['queued', 'failed'].includes(item.state)) {
    if (Date.parse(item.expires_at) <= now) return { label: 'Approval expired', detail: 'Operator review is required. Recovery will not extend or bypass this approval.' };
    if (item.execution_attempts >= 8) return { label: 'Retry limit reached', detail: 'Operator investigation is required. Recovery will not reset attempts.' };
    if (item.state === 'failed') return { label: 'Waiting for safe retry', detail: 'The previous attempt was confirmed not applied. The existing approval will be reused.' };
    return { label: 'Approved · queued', detail: 'Saved approval is waiting for the background processor.' };
  }
  return { label: item.state.replaceAll('_', ' '), detail: 'Review the current record before taking further action.' };
}
