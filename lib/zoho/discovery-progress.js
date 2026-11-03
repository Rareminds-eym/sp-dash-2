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
