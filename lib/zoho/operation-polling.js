/** Match persisted source-work states; terminal work must not keep a polling loop alive. */
export function sourceOperationPollDelay(snapshot, failures = 0, now = Date.now()) {
  const active = [
    ...(snapshot?.bulk || []).filter(row => ['queued','creating','polling','staging'].includes(row.state)),
    ...(snapshot?.deletedScans || []).filter(row => ['queued','running'].includes(row.state)),
  ];
  if (!active.length) return 0;
  const earliest = Math.min(...active.map(row => {
    const scheduled = Date.parse(row.next_attempt_at);
    return Number.isFinite(scheduled) ? scheduled : now;
  }));
  const remaining = earliest - now;
  const base = remaining > 60000 ? 60000 : remaining > 10000 ? 15000 : 5000;
  return Math.min(120000, base * 2 ** Math.min(Math.max(0, failures), 5));
}
