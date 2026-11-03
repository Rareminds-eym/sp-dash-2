'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const endpoint = '/api/integrations/zoho-recruit';
async function request(path, body) {
  const response = await fetch(endpoint + path, { credentials: 'same-origin', cache: 'no-store',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Privacy settings unavailable.');
  return value;
}

export default function SourcePrivacyPanel({ connectionId, onChanged }) {
  const [snapshot, setSnapshot] = useState(null);
  const [days, setDays] = useState(30);
  const [module, setModule] = useState('Candidates');
  const [externalId, setExternalId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading,setLoading]=useState(true);
  const [disconnectConfirm,setDisconnectConfirm]=useState(false);
  const [disconnectText,setDisconnectText]=useState('');
  const confirmDialog=useRef(null);
  const generation = useRef(0);
  const load = useCallback(async (version) => {
    const { privacy } = await request(`?view=privacy&connectionId=${encodeURIComponent(connectionId)}`);
    if (generation.current !== version) return;
    setSnapshot(privacy); setDays(privacy?.retentionDays ?? 30);
  }, [connectionId]);
  useEffect(() => {
    const version = ++generation.current;
    setSnapshot(null); setReason(''); setExternalId(''); setError(''); setNotice(''); setBusy(false);
    setLoading(true);setDisconnectConfirm(false);setDisconnectText('');
    load(version).catch(error => { if (generation.current === version) setError(error.message); }).finally(()=>{if(generation.current===version)setLoading(false);});
    return () => { generation.current++; };
  }, [load]);
  useEffect(()=>{
    const handler=async()=>{if(busy)return;const version=generation.current;setError('');try{await load(version);}catch(error){if(generation.current===version)setError(error.message);}};
    window.addEventListener('refreshPage',handler);return()=>window.removeEventListener('refreshPage',handler);
  },[load,busy]);
  useEffect(()=>{if(disconnectConfirm)confirmDialog.current?.showModal();else confirmDialog.current?.close();},[disconnectConfirm]);
  async function update(action, input) {
    const version = generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const { result } = await request('', { action, input });
      if (generation.current !== version) return;
      setReason('');
      setNotice(action === 'suppress_source'
        ? result.suppressed
          ? `Source blocked from future imports.${result.reconciliationRequired ? ' An in-flight operation still needs reconciliation.' : ''} Existing accounts and jobs were not deleted.`
          : 'Suppression removed. Fetch the source again and review it before approval.'
        : action === 'configure_retention' ? 'Retention policy saved.'
        : action === 'control_connection' ? `Connection ${result.status.replaceAll('_', ' ')}. Fresh discovery and review are required.${result.reconciliationRequired ? ' In-flight operations still need receipt reconciliation.' : ''}`
        : `${result.redacted} expired payloads cleaned across all sources.`);
      try{await load(version);if(generation.current===version)await onChanged?.();}catch(error){if(generation.current===version)setError(`Change saved. Refreshing the view failed: ${error.message}`);}
    } catch (error) { if (generation.current === version) setError(error.message); }
    finally { if (generation.current === version) setBusy(false); }
  }
  const ready = snapshot && !busy;
  const field = 'mt-2 block w-full rounded-lg border border-border bg-background p-2.5 text-sm';
  return <section className="rounded-2xl border border-border bg-background p-5">
    <h2 className="text-sm font-semibold">Source privacy</h2>
    <p className="mt-1 text-xs text-muted-foreground">Keep review data for a limited time. Block a source record from being imported again. These controls do not delete learner accounts or published jobs.</p>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    {!snapshot ? <div className="mt-4 text-xs text-muted-foreground"><p role="status">{loading?'Loading source controls…':'Source controls could not be loaded. Check the displayed error and retry.'}</p>{!loading&&<Button className="mt-2" size="sm" variant="outline" onClick={async()=>{const version=generation.current;setLoading(true);setError('');try{await load(version);}catch(error){if(version===generation.current)setError(error.message);}finally{if(version===generation.current)setLoading(false);}}}>Retry source controls</Button>}</div> : <>
      <p className="mt-4 text-xs text-muted-foreground">{snapshot.suppressionCount} source records suppressed · {snapshot.redactedCount} review payloads expired. In-flight or uncertain operations are retained for reconciliation.</p>
      <label className="mt-4 block text-xs font-medium">Reason for this change<input aria-describedby="source-control-help" className={field} value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={500} disabled={busy} /></label>
      <p id="source-control-help" className="mt-2 text-xs text-muted-foreground">Enter at least 3 characters to enable these actions. To pause only a scan while preserving approvals, use Pause discovery in its progress panel.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {['connected','paused'].includes(snapshot.status) && <Button variant="outline" disabled={!ready || reason.trim().length < 3} onClick={() => update('control_connection', {
          connectionId, expectedConfigRevision: snapshot.configRevision, command: snapshot.status === 'paused' ? 'resume' : 'pause', reason,
        })}>{snapshot.status === 'paused' ? 'Resume connection' : 'Pause connection'}</Button>}
        {snapshot.status !== 'not_connected' && <Button variant="outline" disabled={!ready || reason.trim().length < 3} onClick={() => {setDisconnectText('');setDisconnectConfirm(true);}}>Disconnect and remove saved credentials</Button>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Pause and disconnect invalidate queued approvals. Started operations may finish and remain recoverable. Resume requires fresh review, including the job publication policy. Disconnect removes local credentials; revoke source access in Zoho separately.</p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); update('configure_retention', { connectionId, days: Number(days), reason }); }}>
        <label className="text-xs font-medium">Review retention (days)<input className={field} type="number" min="1" max="365" value={days} onChange={event => setDays(event.target.value)} required disabled={busy} /></label>
        <Button type="submit" variant="outline" disabled={!ready || reason.trim().length < 3}>Save retention</Button>
      </form>
      <form className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5" onSubmit={event => { event.preventDefault(); update('suppress_source', { connectionId, module, externalId, suppressed: true, reason }); }}>
        <label className="text-xs font-medium">Record type<select className={field} value={module} onChange={event => setModule(event.target.value)} disabled={busy}><option value="Candidates">Candidate</option><option value="Job_Openings">Job opening</option></select></label>
        <label className="text-xs font-medium">Zoho record ID<input className={field} value={externalId} onChange={event => setExternalId(event.target.value)} pattern="[0-9]{1,40}" required disabled={busy} /></label>
        <Button type="submit" variant="outline" disabled={!ready || reason.trim().length < 3}>Suppress record</Button>
      </form>
      {snapshot.suppressed?.length > 0 && <ul className="mt-4 divide-y divide-border">{snapshot.suppressed.map(row => <li key={`${row.module}:${row.externalId}`} className="flex items-center justify-between gap-3 py-3 text-xs"><span>{row.module === 'Candidates' ? 'Candidate' : 'Job'} · {row.externalId}</span><Button variant="outline" size="sm" disabled={!ready || reason.trim().length < 3} onClick={() => update('suppress_source', { connectionId, module: row.module, externalId: row.externalId, suppressed: false, reason })}>Remove suppression</Button></li>)}</ul>}
      {snapshot.suppressionCount > 100 && <p className="mt-2 text-xs text-muted-foreground">Showing the newest 100 suppressions.</p>}
      <Button className="mt-5" variant="outline" disabled={!ready} onClick={() => update('cleanup_payloads', {})}>Clean expired payloads across all sources</Button>
    </>}
    <dialog ref={confirmDialog} aria-labelledby="disconnect-title" onCancel={event=>{if(busy)event.preventDefault();else setDisconnectConfirm(false);}} className="w-[min(92vw,480px)] rounded-xl border border-border bg-background p-5 text-foreground backdrop:bg-black/50">
      <h3 id="disconnect-title" className="font-semibold">Disconnect this Zoho source?</h3><p className="mt-3 text-sm">Saved credentials will be removed, discovery stopped and queued approvals invalidated. Existing learners and jobs are retained. Reconnection requires Zoho authorization.</p>
      <label className="mt-4 block text-sm">Type DISCONNECT to confirm<input aria-label="Disconnect confirmation" value={disconnectText} disabled={busy} onChange={event=>setDisconnectText(event.target.value)} className={field}/></label>
      <div className="mt-4 flex gap-3"><Button variant="outline" disabled={busy} onClick={()=>setDisconnectConfirm(false)}>Keep connection</Button><Button disabled={busy||disconnectText!=='DISCONNECT'||reason.trim().length<3} onClick={async()=>{await update('control_connection',{connectionId,expectedConfigRevision:snapshot.configRevision,command:'disconnect',reason});setDisconnectConfirm(false);}}>Confirm disconnect</Button></div>
    </dialog>
  </section>;
}
