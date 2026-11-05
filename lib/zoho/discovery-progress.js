/** Derive progress only from this source/module and persisted run state. */
export function discoveryProgress(runs, request, connectionId, module) {
  const current = request?.connectionId === connectionId && request.module === module ? request : null;
  const scoped=runs.filter(item=>item.connection_id===connectionId&&item.module===module);
  const requested=scoped.find(item=>item.id===current?.runId);
  // A request ID only pins its own outstanding request. A later scheduled or
  // operator-started scan must take over after that request reaches a terminal state.
  const activeRun=scoped.find(item=>['queued','running'].includes(item.state));
  const run = current?.phase === 'submitting' ? null : activeRun || (requested || !current?.runId ? scoped[0] : null);
  if (!run && !current) return null;
  const controllable=run&&['queued','running'].includes(run.state);
  const phase = controllable&&run.control_state==='paused'?'paused':run?.control_state==='cancelled'?'cancelled':run?.state || current?.phase || 'queued';
  const active = ['submitting', 'queued', 'running'].includes(phase);
  const title = phase === 'submitting' ? 'Starting discovery…' : phase === 'queued'
    ? (run?.last_error ? 'Waiting to retry' : 'Queued for discovery') : phase === 'running'
    ? `Reading batch ${run.next_page}` : phase === 'completed' ? 'Discovery complete'
    : phase === 'completed_with_exceptions' ? 'Discovery finished with exceptions'
    : phase === 'paused' ? 'Discovery paused' : phase==='cancelled'?'Discovery cancelled'
    : phase === 'incomplete' ? 'Discovery checkpoint saved' : phase === 'error'
    ? 'Discovery request interrupted' : 'Discovery stopped';
  return { run, phase, active, title, startedAt: run?.created_at || current?.startedAt,
    message: run?undefined:current?.message, received: run?.received_count ?? 0, staged: run?.staged_count ?? 0,
    deferred: run?.deferred_count ?? 0,
    notStaged: Math.max(0, (run?.received_count ?? 0) - (run?.staged_count ?? 0) - (run?.deferred_count ?? 0)),
    batches: Math.max(0, (run?.next_page ?? 1) - 1) };
}

/** Human-readable time; round waits up so eligibility is never announced early. */
export function formatDiscoveryDuration(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', remainder || (!hours && !minutes) ? `${remainder}s` : ''].filter(Boolean).join(' ');
}

/** A queued retry is still active for polling/controls, but is not processing. */
export function discoveryTiming(progress, now = Date.now()) {
  const retryAt = Date.parse(progress?.run?.next_attempt_at);
  const validRetry = Number.isFinite(retryAt);
  const waiting = progress?.phase === 'queued' && (Boolean(progress.run?.last_error) || (validRetry && retryAt > now));
  const remainingSeconds = validRetry ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
  const description = !waiting ? 'Waiting for the background processor. This page updates automatically.'
    : !validRetry ? 'Waiting for retry scheduling. This page updates automatically.'
    : remainingSeconds > 0 ? `Retry eligible after ${new Date(retryAt).toLocaleString()}. The background processor resumes from the saved checkpoint.`
    : 'The retry time has arrived. Waiting for the background processor to claim the saved checkpoint.';
  return { waiting, validRetry, remainingSeconds, description };
}

export const discoveryErrors = {
  CHECKPOINT_AVAILABLE: 'Checkpoint saved; the next discovery continues from this page.', INVENTORY_LIMIT: 'Configured inventory limit reached; review required.',
  SOURCE_RETRY_DEFERRED: 'Source work is waiting until its scheduled retry. Saved records are retained.',
  SOURCE_UNAVAILABLE: 'Source temporarily unavailable; retry scheduled.', RATE_LIMITED: 'Connector request budget or source throttling reached; retry scheduled. Saved records are retained.',
  AUTH_REVOKED: 'Source authorization expired or revoked; reconnect required.', PERMISSION_DENIED: 'Source permission denied; review access and reconnect.',
  SOURCE_INVALID: 'Source response is invalid; review required.', BUDGET_EXHAUSTED: 'Discovery budget exhausted; review before starting another run.',
  CANCELLED_BY_OPERATOR: 'Discovery cancelled by an operator. Staged records were retained.',
  CONNECTION_CHANGED: 'Source configuration changed; start a fresh discovery.', CREDENTIALS_UNAVAILABLE: 'Source credentials unavailable; reconnect required.',
  CREDENTIALS_CHANGED: 'Source credentials renewed; discovery will resume.', WORKER_LOST: 'Discovery interrupted; recovery scheduled.',
};

export const discoveryErrorText = code => discoveryErrors[code] || 'Source operation needs review.';
/** Controls remain active while waiting; network cadence follows eligibility and failures. */
export function discoveryPollDelay(progress, failures = 0, now = Date.now()) {
  const timing = discoveryTiming(progress, now);
  const base = timing.waiting && timing.remainingSeconds > 60 ? 60000 : timing.waiting && timing.remainingSeconds > 10 ? 15000 : progress?.active ? 3000 : 15000;
  return Math.min(120000, base * 2 ** Math.min(failures, 5));
}
