'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, LockKeyhole, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createBulkCandidateApproval } from '@/lib/zoho/bulk-candidate-approval';
import { repeatedCandidateName } from '@/lib/zoho/candidate-review-selection';
import styles from './ZohoRecruitPage.module.css';
const candidateWord = count => count === 1 ? 'candidate' : 'candidates';

export default function BulkCandidateApproval({ api, connection, available, disabled, onQueued }) {
  const [open, setOpen] = useState(false), [state, setState] = useState(null);
  const [portalReady, setPortalReady] = useState(false);
  const [reason, setReason] = useState(''), [acknowledged, setAcknowledged] = useState(false);
  const [listPage, setListPage] = useState(0), [search, setSearch] = useState('');
  const dialog = useRef(null), trigger = useRef(null), flow = useRef(null), source = useRef(connection);
  const mounted = useRef(true), notified = useRef(0), active = useRef(false);
  source.current = connection;
  useEffect(() => { mounted.current = true; setPortalReady(true); return () => { mounted.current = false; flow.current?.stop(); }; }, []);
  useEffect(() => {
    if (!open) return;
    dialog.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const working = ['loading', 'checking', 'approving'].includes(state?.phase);
  const approvable = state?.phase === 'ready' && state.eligible.length > 0;
  const sourceChanged = state && (state.sourceId !== connection?.id || state.configRevision !== connection?.configRevision || connection?.status !== 'connected');
  const skipped = new Map(state?.skipped.map(item => [item.record.id, item]) || []);
  const eligibleIds = new Set(state?.eligible.map(item => item.record.id) || []);
  const approvedIds = new Set(state?.approvedIds || []);
  const entries = state ? [...state.eligible.map(item => ({ ...item,
    label: approvedIds.has(item.record.id) ? 'Approved · queued' : skipped.has(item.record.id) ? `Skipped: ${skipped.get(item.record.id).issue}`
      : item.review.decision === 'create' ? 'Create learner · Discover (free)' : 'Preserve existing learner access' })),
  ...state.skipped.filter(item => !eligibleIds.has(item.record.id)).map(item => ({ ...item, label: `Skipped: ${item.issue}` }))] : [];
  const matches = entries.filter(item => `${item.record.proposed_data?.name || ''} ${item.record.proposed_data?.email || ''} ${item.record.external_id}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(matches.length / 25)), page = Math.min(listPage, pages - 1);
  function update(next) {
    if (!mounted.current) return;
    setState({ ...next, sourceId: flow.current.sourceId, sourceName: flow.current.sourceName, configRevision: flow.current.configRevision });
  }
  async function perform(work) {
    if (active.current) return;
    active.current = true;
    try { await work(); }
    finally {
      active.current = false;
      const approved = flow.current?.state.approved || 0;
      if (mounted.current && approved > notified.current) {
        notified.current = approved;
        // Approval and execution are separate; the parent starts existing ledger polling.
        onQueued(flow.current.sourceId);
      }
    }
  }
  function start() {
    if (active.current) return;
    setReason(''); setAcknowledged(false); setSearch(''); setListPage(0); notified.current = 0;
    flow.current = Object.assign(createBulkCandidateApproval({ api, connection: { ...connection },
      currentConnection: () => source.current, onChange: update }),
    { sourceId: connection.id, sourceName: connection.name, configRevision: connection.configRevision });
    perform(() => flow.current.prepare());
  }
  function launch() {
    setOpen(true);
    if (!flow.current || (!flow.current.state.pendingBatch &&
      (flow.current.sourceId !== connection?.id || flow.current.configRevision !== connection?.configRevision || flow.current.state.phase === 'done'))) start();
  }
  function close() {
    if (active.current) return;
    dialog.current.close(); setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  return <>
    <Button ref={trigger} type="button" variant="outline" size="sm" disabled={disabled || (!state?.pendingBatch && (!available || connection?.status !== 'connected'))}
      aria-haspopup="dialog" aria-controls="zoho-bulk-candidate-approval" onClick={launch}>
      <Check aria-hidden="true" size={14} className="mr-2"/>Approve all staged candidates
    </Button>
    {portalReady && createPortal(<dialog id="zoho-bulk-candidate-approval" ref={dialog} className={`${styles.decisionDialog} ${styles.bulkDialog}`}
      aria-labelledby="zoho-bulk-title" aria-describedby="zoho-bulk-description" aria-busy={working}
      onCancel={event => { event.preventDefault(); if (working) flow.current.stop(); else close(); }}>
      <form className={styles.decisionForm} onSubmit={event => { event.preventDefault();
        if (approvable && acknowledged && !sourceChanged && available && reason.trim().length >= 3)
          perform(() => flow.current.approve(reason));
      }}>
        <header className={styles.decisionHeading}>
          <span className={styles.decisionIcon}><ShieldCheck aria-hidden="true" size={24}/></span>
          <div><p className={styles.decisionEyebrow}>Bulk candidate approval</p><h2 id="zoho-bulk-title">Approve all staged candidates</h2></div>
          <button type="button" aria-label="Close bulk approval" disabled={working} onClick={close}><X aria-hidden="true" size={20}/></button>
        </header>
        <div className={styles.decisionBody}>
          <p id="zoho-bulk-description">Includes every candidate awaiting approval for this source, across all pages and regardless of table filters. Held, rejected, completed and already approved records are excluded. Candidates discovered after this list was loaded are not added.</p>
          <div className={styles.decisionSummary}><div><span>Selected source</span><strong>{state?.sourceName || connection?.name}</strong></div><div><span>Staged candidates</span><strong>{state?.total?.toLocaleString() ?? (state?.phase === 'error' ? 'Unavailable' : 'Loading…')}</strong></div></div>
          <div role="status" aria-live="polite" className={styles.bulkProgress}>
            {working && <RefreshCw aria-hidden="true" size={16} className="animate-spin"/>}
            <p>{state?.phase === 'loading' ? state.total === null ? 'Loading the first 50 staged candidates…'
              : `Loading candidates: ${state.loadedCount} of ${state.total} · ${state.pagesLoaded} pages loaded` : state?.phase === 'checking'
              ? `Checking accounts: ${state.checked} of ${state.total}` : state?.phase === 'approving'
                ? state.pendingBatch ? `Recording batch approval… ${state.approved} approved so far`
                  : `Rechecking batch: ${state.rechecking} of ${state.batchSize} · ${state.approved} approved so far`
                : state?.phase === 'done' ? `Finished: ${state.approved} ${candidateWord(state.approved)} approved and queued. ${state.skipped.length} skipped.`
                  : state?.phase === 'paused' ? 'Stopped between requests. You can continue from here.'
                    : state?.phase === 'error' ? 'Bulk approval needs attention.' : state?.total === 0 ? 'No candidates are awaiting approval.'
                      : `${state?.eligible.length || 0} eligible · ${state?.skipped.length || 0} skipped`}</p>
          </div>
          {state?.stopRequested && working && <p role="status">Stopping after the current requests finish. Already recorded approvals are retained.</p>}
          {state?.error && <p role="alert" className={styles.decisionAlert}>{state.error}</p>}
          {state?.pendingBatch && !working && <p className={styles.decisionAlert}>The last batch may already have been recorded. Retry recovers the same request without creating another approval.</p>}
          {sourceChanged && <p role="alert" className={styles.decisionAlert}>The source connection changed. Review the remaining candidates again before approving. A pending decision can still be recovered.</p>}
          {state?.approved > 0 && <p>{state.approved} approved for processing. Account creation is confirmed separately in Approved execution history.{state.pendingDelivery > 0 ? ` Queue delivery is unconfirmed for ${state.pendingDelivery}; check execution history for their current state.` : ''}</p>}
          <div className={styles.decisionSafety}><LockKeyhole aria-hidden="true" size={18}/><div><strong>No emails will be sent</strong><p>New learners receive Discover and remain activation pending. Existing sign-in and paid or organization access are preserved. Invalid or changed records stay staged for individual review.</p></div></div>
          {entries.length > 0 && <section className={styles.decisionRecords} aria-label="Bulk candidate review results">
            <h3>Account check results <span>{entries.length.toLocaleString()}</span></h3>
            <label className={styles.bulkSearch}>Find a candidate<input type="search" value={search} onChange={event => { setSearch(event.target.value); setListPage(0); }} placeholder="Name, email or Zoho ID"/></label>
            <ul>{matches.slice(page * 25, (page + 1) * 25).map((item, index) => <li key={`${item.record.id}:${index}`}><div><strong>{item.record.proposed_data?.name || item.record.external_id}</strong><span>{item.record.proposed_data?.email} · Zoho ID: {item.record.external_id} · v{item.record.revision}</span><span>{item.label}</span>{repeatedCandidateName(item.record)&&<span>Source name contains repeated parts. Verify the name in Zoho; it will be imported unchanged.</span>}</div></li>)}</ul>
            <div className={styles.bulkPagination}><Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setListPage(page - 1)}>Previous</Button><span>Page {page + 1} of {pages} · {matches.length} results</span><Button type="button" variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setListPage(page + 1)}>Next</Button></div>
          </section>}
          {approvable && <>
            <label className={styles.bulkAcknowledge}><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/><span>I have reviewed the account check results and authorize all {state.eligible.length} eligible {candidateWord(state.eligible.length)}. Skipped candidates will remain unchanged.</span></label>
            <label htmlFor="zoho-bulk-reason" className={styles.decisionReason}>Decision reason <span>Required</span></label>
            <textarea id="zoho-bulk-reason" required minLength={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className={styles.decisionTextarea} placeholder="Explain why these candidates should be approved…"/>
          </>}
          <p className={styles.bulkHelp}>Approvals are submitted in batches of up to 50 with progress shown here. Keep this page open until queuing finishes. Stop prevents further batches; it does not undo approved ones.</p>
        </div>
        <footer className={styles.decisionFooter}><p>Only this reviewed snapshot is authorized.</p><div>
          {working ? <Button type="button" variant="outline" disabled={state.stopRequested} onClick={() => flow.current.stop()}>Stop bulk approval</Button> : <>
            <Button type="button" variant="outline" onClick={close}>{state?.phase === 'done' ? 'Done' : 'Close'}</Button>
            {['paused', 'error'].includes(state?.phase) && !state.reviewRequired && (!sourceChanged || state.pendingBatch) && (available || state.pendingBatch) && <Button type="button" variant="outline" onClick={() => perform(() => flow.current.resume())}>{state.pendingBatch ? 'Retry pending batch' : state.mode === 'load' ? 'Retry loading candidates' : 'Continue'}</Button>}
            {(['error', 'paused'].includes(state?.phase) || sourceChanged) && !state.pendingBatch && <Button type="button" className={styles.bulkRestart} variant="outline" disabled={!available || connection?.status !== 'connected'} onClick={start}>Review remaining staged candidates</Button>}
            {approvable && <Button type="submit" className={styles.primaryAction} disabled={!acknowledged || sourceChanged || !available || reason.trim().length < 3}>Approve {state.eligible.length} {candidateWord(state.eligible.length)}</Button>}
          </>}
        </div></footer>
      </form>
    </dialog>, document.body)}
  </>;
}
