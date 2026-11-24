/** Drive Wrangler's local scheduled-event endpoint; deployed cron triggers are unchanged. */
export function startLocalRecovery({ crons, origin, fetchImpl = fetch, now = Date.now,
  schedule = setTimeout, cancel = clearTimeout, onError = () => {}, onSuccess = () => {} }) {
  const target = new URL(origin);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password ||
      target.pathname !== '/' || target.search || target.hash) throw new Error('Local recovery requires a loopback Worker origin.');
  const stops = crons.map(cron => {
    const match = /^\*\/(\d+) \* \* \* \*$/.exec(cron);
    const minutes = Number(match?.[1]);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 59)
      throw new Error('Unsupported local recovery schedule.');
    return { cron, minutes };
  }).map(({ cron, minutes }) => {
    let stopped = false, timer, controller;
    // Cron minute steps reset at each UTC hour, including steps not dividing 60.
    function nextDelay() {
      const current = now();
      const next = new Date(Math.floor(current / 60000) * 60000 + 60000);
      while (next.getUTCMinutes() % minutes !== 0) next.setUTCMinutes(next.getUTCMinutes() + 1);
      return next.getTime() - current;
    }
    function arm() { if (!stopped) timer = schedule(tick, nextDelay()); }
    async function tick() {
      if (stopped) return;
      controller = new AbortController();
      const timeout = schedule(() => controller?.abort(), 30000);
      try {
        const url = new URL('/cdn-cgi/local/scheduled', target);
        url.searchParams.set('cron', cron);
        const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error' });
        if (!response.ok) throw new Error('Local recovery unavailable.');
        await response.body?.cancel();
        if (!stopped) onSuccess(cron);
      } catch { if (!stopped) onError('Local scheduled recovery failed; retrying at the next scheduled time.'); }
      finally { cancel(timeout); controller = undefined; arm(); }
    }
    arm();
    return () => { stopped = true; cancel(timer); controller?.abort(); };
  });
  return () => stops.forEach(stop => stop());
}
