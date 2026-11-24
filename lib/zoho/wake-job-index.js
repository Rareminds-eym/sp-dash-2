let nextWake = 0;
/** Wake once per isolate/window, rather than once per imported job. */
export async function wakeJobIndex(env) {
  if (Date.now() < nextWake || typeof env.JOB_INDEX_SERVICE?.kickJobIndexing !== 'function') return;
  nextWake = Date.now() + 30000;
  let timeout;
  try {
    await Promise.race([(async () => { const result = await env.JOB_INDEX_SERVICE.kickJobIndexing(); result?.[Symbol.dispose]?.(); })(), new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Wake deferred')), 3000);
    })]);
  } catch { nextWake = Date.now() + 30000; /* Committed outbox is reconciled by alarms/cron. */ }
  finally { clearTimeout(timeout); }
}
