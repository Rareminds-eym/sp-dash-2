'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import styles from './ExecutionRecovery.module.css';

export default function ExecutionRecovery({ connectionId, active, api, onChanged }) {
  const [module, setModule] = useState('Candidates');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const running = useRef(false), refreshProgress = useRef(null);
  const [progress, setProgress] = useState(null);
  const [progressError, setProgressError] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(false);
  useEffect(() => {
    setProgress(null); setProgressError(''); setNotice(''); setError('');
    if (!active || !connectionId) return;
    let cancelled = false, inFlight = false, timer, controller, failures = 0;
    const schedule = delay => { clearTimeout(timer); if (!cancelled) timer = setTimeout(() => load(), delay); };
    async function load(manual = false) {
      if (cancelled || inFlight) return;
      clearTimeout(timer);
      if (document.hidden && !manual) { schedule(15000); return; }
      inFlight = true; controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      setLoadingProgress(true);
      try {
        const query = new URLSearchParams({ view: 'execution_progress', connectionId, module });
        const result = await api(`?${query}`, { signal: controller.signal });
        if (cancelled) return;
        setProgress(result.progress); setProgressError(''); failures = 0;
        if (result.progress.queued + result.progress.processing + result.progress.checking + (result.progress.syncing || 0) + result.progress.retrying > 0) schedule(15000);
      } catch (failure) {
        if (!cancelled) {
          setProgressError(`Progress could not be refreshed. ${failure.message} Previous counts, if shown, may be stale.`);
          failures++; schedule(Math.min(60000, 15000 * 2 ** Math.min(failures, 2)));
        }
      } finally { clearTimeout(timeout); inFlight = false; if (!cancelled) setLoadingProgress(false); }
    }
    refreshProgress.current = () => load(true);
    load();
    return () => { cancelled = true; clearTimeout(timer); controller?.abort(); refreshProgress.current = null; };
  }, [active, connectionId, module, api]);
  async function recover() {
    if (running.current || !connectionId) return;
    running.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const { result } = await api('', { method: 'POST', signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover_executions', input: { connectionId, module } }) });
      setNotice(`${result.retriesScheduled} existing operations scheduled for retry · ${result.receiptChecksScheduled} receipt checks scheduled. ${result.receiptChecksCheckedNow ? `${result.receiptChecksCheckedNow} receipts checked now; ${result.confirmedCompletions} completions confirmed. ` : ''}${result.executionAvailable ? '' : 'New execution is unavailable; only receipt checks can run. '}This schedules recovery; completion still requires a confirmed receipt.`);
      await refreshProgress.current?.();
      try { await onChanged(); } catch { setError('Recovery was scheduled, but refreshing statuses failed. Refresh status to check progress.'); }
    } catch (failure) {
      setError(['TimeoutError', 'AbortError'].includes(failure.name)
        ? 'Recovery delivery could not be confirmed. Retrying is safe; saved operation IDs prevent duplicate execution.' : failure.message);
    } finally { running.current = false; setBusy(false); }
  }
  return <div className="my-4 rounded-lg border border-border p-4" aria-label="Recover approved operations">
    <h3 className="text-sm font-semibold">Recover approved operations</h3>
    <p className="mt-2 text-xs text-muted-foreground">Approvals survive server restarts. Recovery reuses saved approvals, retries confirmed failures, and checks receipts for interrupted operations. It never approves more records or resets retry limits.</p>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-xs">Record type<select value={module} disabled={busy} onChange={event=>setModule(event.target.value)} className="mt-1 block rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="Candidates">Candidates</option><option value="Job_Openings">Job openings</option></select></label>
      <Button type="button" variant="outline" disabled={busy || !connectionId} onClick={recover}>{busy ? 'Scheduling recovery…' : 'Recover approved operations'}</Button>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Up to 25 retries and 25 receipt checks per request. Remaining work stays saved for background recovery. Expired approvals and exhausted retries require operator review.</p>
    <section className="mt-4 border-t border-border pt-4" aria-label="Execution recovery progress" aria-busy={loadingProgress}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Execution progress</h4><Button type="button" size="sm" variant="outline" disabled={loadingProgress || !active} onClick={()=>refreshProgress.current?.()}>{loadingProgress ? 'Checking progress…' : 'Refresh progress'}</Button></div>
      <p className="mt-1 text-xs text-muted-foreground">All approved {module==='Candidates'?'candidate':'job opening'} operations for this source, including earlier revisions and runs. Scheduled recovery is not confirmed completion.</p>
      {progress ? <>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><strong>{progress.completed.toLocaleString()} of {progress.total.toLocaleString()} completed</strong><span>{progress.total ? Math.floor(progress.completed / progress.total * 100) : 0}% confirmed</span></div>
        <progress className={styles.progress} aria-label="Confirmed execution completion" value={progress.completed} max={progress.total || 1} />
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{[['Completed','completed'],['Queued','queued'],['Processing','processing'],['Syncing application','syncing'],['Checking outcome','checking'],['Waiting for retry','retrying'],['Needs attention','attention']].map(([label,key])=><div key={key} className="rounded-md border border-border bg-muted/30 px-3 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{(progress[key] || 0).toLocaleString()}</dd></div>)}</dl>
        {progress.syncing>0 && <p className="mt-3 text-xs text-muted-foreground">{progress.syncing.toLocaleString()} accounts are confirmed in SSO and waiting for application sync or its confirmation. They will not be created again.</p>}
        {progress.checking>0 && <p className="mt-3 text-xs text-muted-foreground">{progress.checking.toLocaleString()} outcomes are unconfirmed. Receipt checks protect against creating duplicate accounts or jobs; unresolved outcomes need investigation.</p>}
        {progress.overdue>0 && <p role="status" className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-sm">Recovery needs checking: {progress.overdue.toLocaleString()} operations are more than 10 minutes past their retry time or execution lease. Running services alone do not confirm recovery is healthy.</p>}
        {progress.attention>0 && <p className="mt-2 text-xs text-muted-foreground">{progress.expired.toLocaleString()} approvals expired · {progress.exhausted.toLocaleString()} reached the retry limit. These counts can overlap. Other attention items need review in execution history.</p>}
        {progress.nextRetryAt && <p className="mt-2 text-xs text-muted-foreground">Next scheduled eligibility: {new Date(progress.nextRetryAt).toLocaleString()}. Service availability also affects execution.</p>}
        <p className="mt-2 text-xs text-muted-foreground">Last checked: {new Date(progress.checkedAt).toLocaleTimeString()}{progress.queued+progress.processing+progress.checking+(progress.syncing||0)+progress.retrying>0 ? ' · refreshes every 15 seconds while visible; backs off during outages' : ' · no automatic work pending'}</p>
      </> : <p className="mt-3 text-sm text-muted-foreground">{loadingProgress ? 'Loading saved execution progress…' : 'Execution progress is unavailable.'}</p>}
      {progressError && <p role="alert" className="mt-3 text-sm text-destructive">{progressError}</p>}
    </section>
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </div>;
}
