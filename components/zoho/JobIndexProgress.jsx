'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const processorErrors = {
  JOB_INDEX_MODEL_UNCONFIGURED: 'The stored search model needs configuration.',
  JOB_INDEX_MODEL_MISMATCH: 'The embedding provider and stored search model do not match.',
  JOB_INDEX_PROVIDER_INCOMPATIBLE: 'The embedding provider does not support this search index.',
  JOB_INDEX_PROVIDER_UNAVAILABLE: 'The embedding service is unavailable or needs updating.',
  JOB_INDEX_DB_UNCONFIGURED: 'The search processor database connection needs configuration.',
  JOB_INDEX_DB_UNAVAILABLE: 'The search processor cannot reach the application database.',
};

export default function JobIndexProgress({ connectionId, active, api }) {
  const [value, setValue] = useState(null), [error, setError] = useState('');
  const [processor, setProcessor] = useState(null);
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false);
  const retryRequest = useRef(null);
  useEffect(() => {
    setBusy(false);
    return () => {
      const request = retryRequest.current;
      retryRequest.current = null;
      if (request) { clearTimeout(request.timer); request.controller.abort(); }
    };
  }, [connectionId, active, api]);
  useEffect(() => {
    setValue(null); setProcessor(null); setError('');
    if (!active || !connectionId) return;
    let stopped = false, timer, controller, failures = 0;
    async function load() {
      if (stopped) return;
      if (document.hidden) { timer = setTimeout(load, 15000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const result = await api(`?${new URLSearchParams({ view: 'job_index', connectionId })}`, { signal: controller.signal });
        if (stopped) return;
        const progress = result.progress;
        if (!progress || !['total','verified','queued','processing','retry','failed'].every(key => Number.isSafeInteger(progress[key]) && progress[key] >= 0)
          || progress.verified > progress.total) throw new Error();
        setValue(progress); setProcessor(result.processor || null); setError(''); failures = 0;
        // Keep a low-frequency read after completion to notice new imports.
        timer = setTimeout(load, progress.total > progress.verified ? 15000 : 60000);
      } catch {
        if (!stopped) { setError('Search indexing progress is unavailable.'); timer = setTimeout(load, Math.min(120000, 15000 * 2 ** failures++)); }
      } finally { clearTimeout(timeout); }
    }
    load();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [connectionId, active, api, revision]);
  async function retry() {
    if (retryRequest.current || !active || !connectionId) return;
    const request = { controller: new AbortController(), timer: undefined };
    retryRequest.current = request;
    setBusy(true); setError('');
    const aborted = new Promise((_, reject) => {
      request.controller.signal.addEventListener('abort', () => reject(new Error('Retry interrupted')), { once: true });
    });
    request.timer = setTimeout(() => request.controller.abort(), 15000);
    try {
      await Promise.race([api('', { method: 'POST', signal: request.controller.signal,
        body: JSON.stringify({ action: 'retry_job_index', input: { connectionId } }) }), aborted]);
      if (retryRequest.current === request) setRevision(n => n + 1);
    } catch {
      if (retryRequest.current === request) setError(request.controller.signal.aborted
        ? 'The retry request timed out. Its outcome is not confirmed; refresh progress before retrying.'
        : 'Search indexing could not be retried.');
    } finally {
      clearTimeout(request.timer);
      if (retryRequest.current === request) { retryRequest.current = null; setBusy(false); }
    }
  }
  if (!active || !connectionId) return null;
  return <section aria-label="AI search indexing" className="rounded-xl border border-border bg-card p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">AI search indexing</h2>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setRevision(n => n + 1)}>Refresh progress</Button></div>
    {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
    {processor?.state === 'blocked' && <p role="alert" className="mt-2 text-destructive">Search indexing is blocked. {Object.hasOwn(processorErrors, processor.errorCode) ? processorErrors[processor.errorCode] : 'The search processor needs administrator attention.'} Queued jobs are retained.</p>}
    {processor?.state === 'stale' && <p role="alert" className="mt-2 text-destructive">Search indexing has not reported recent progress. Processing may be interrupted; queued jobs are retained.</p>}
    {processor?.state === 'unknown' && <p role="alert" className="mt-2 text-destructive">Search processor status is unavailable. Queued counts do not confirm that indexing is running; refresh progress to check again.</p>}
    {value ? <><p role="status" className="mt-2">{value.verified.toLocaleString()} of {value.total.toLocaleString()} published, eligible jobs indexed</p>
      <progress aria-label="Jobs indexed for AI recommendations" className="mt-2 h-2 w-full" max={value.total || 1} value={value.verified} />
      <p className="mt-2 text-xs text-muted-foreground">Queued: {value.queued} · Processing: {value.processing} · Waiting to retry: {value.retry} · Needs attention: {value.failed}</p>
      {value.failed > 0 && <Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy} onClick={retry}>Retry failed indexing</Button>}
    </> : !error && <p role="status" className="mt-2">Loading indexing progress…</p>}
    <p className="mt-2 text-xs text-muted-foreground">Search preparation runs after job creation. Only published jobs with current, verified search data enter AI recommendations.</p>
  </section>;
}
