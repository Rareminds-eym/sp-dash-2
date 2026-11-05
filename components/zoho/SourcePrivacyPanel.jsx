'use client';
import { browserResponse } from '@/lib/zoho/browser-response';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldOff, CircleCheck, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const endpoint = '/api/integrations/zoho-recruit';
async function request(path, body) {
  const response = await fetch(endpoint + path, { credentials: 'same-origin', cache: 'no-store',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const value = await browserResponse(response);
  if (!response.ok) throw Object.assign(new Error(value.error || 'Privacy settings unavailable.'),{status:response.status});
  return value;
}

export default function SourcePrivacyPanel({ connectionId, connectionStatus, configRevision, onChanged, onNavigateToDiscovery, refreshVersion = 0 }) {
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
  const cleanupDialog=useRef(null),cleanupTrigger=useRef(null);
  const [cleanupConfirm,setCleanupConfirm]=useState(false);
  const [cleanupReason,setCleanupReason]=useState('');
  const generation = useRef(0);
  const appliedRefresh = useRef(refreshVersion);
  const load = useCallback(async (version) => {
    const { privacy } = await request(`?view=privacy&connectionId=${encodeURIComponent(connectionId)}`);
    if (generation.current !== version) return;
    setSnapshot(privacy); setDays(privacy?.retentionDays ?? 30);
  }, [connectionId]);
  useEffect(() => {
    const version = ++generation.current;
    setSnapshot(null); setReason(''); setExternalId(''); setError(''); setNotice(''); setBusy(false);
    setCleanupConfirm(false);setCleanupReason('');setLoading(true);setDisconnectConfirm(false);setDisconnectText('');
    load(version).catch(error => { if (generation.current === version) setError(error.message); }).finally(()=>{if(generation.current===version)setLoading(false);});
    return () => { generation.current++; };
  }, [load]);
  useEffect(() => {
    if (appliedRefresh.current === refreshVersion || busy || loading) return;
    appliedRefresh.current = refreshVersion;
    const version = generation.current;
    setLoading(true); setError('');
    load(version).catch(error => {
      if (generation.current === version) { setSnapshot(null); setError(error.message); }
    }).finally(() => { if (generation.current === version) setLoading(false); });
  }, [refreshVersion, busy, loading, load]);
  useEffect(()=>{
    const handler=async()=>{if(busy)return;const version=generation.current;setError('');try{await load(version);}catch(error){if(generation.current===version)setError(error.message);}};
    window.addEventListener('refreshPage',handler);return()=>window.removeEventListener('refreshPage',handler);
  },[load,busy]);
  useEffect(()=>{
    if (!snapshot || busy || !connectionStatus || !Number.isInteger(configRevision) ||
        (snapshot.status===connectionStatus&&snapshot.configRevision===configRevision)) return;
    const version=generation.current;
    load(version).catch(error=>{if(generation.current===version)setError(error.message);});
  },[connectionStatus,configRevision,snapshot?.status,snapshot?.configRevision,busy,load]);
  useEffect(()=>{if(disconnectConfirm)confirmDialog.current?.showModal();else confirmDialog.current?.close();},[disconnectConfirm]);
  useEffect(()=>{if(cleanupConfirm)cleanupDialog.current?.showModal();else if(cleanupDialog.current?.open)cleanupDialog.current.close();},[cleanupConfirm]);
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
        : action === 'control_connection' ? `${input.command==='resume'?'Connection resumed. Discovery has not restarted; run fresh discovery before reviewing records.':input.command==='pause'?'Connection paused. Discovery is stopped; resume the connection before starting a fresh scan.':'Connection disconnected. Reconnect before discovery.'}${result.reconciliationRequired ? ' In-flight operations still need receipt reconciliation.' : ''}`
        : `${result.redacted} expired payloads cleaned across all sources.`);
      if(action==='cleanup_payloads')setCleanupConfirm(false);
      try{await load(version);if(generation.current===version)await onChanged?.();}catch(error){if(generation.current===version)setError(`Change saved. Refreshing the view failed: ${error.message}`);}
    } catch (error) { if (generation.current === version) {
      setError(error.status===409?'Source settings changed. Refreshing controls; review the current state and choose the action again.':error.message);
      if(error.status===409){try{await load(version);}catch{/* Preserve the conflict explanation. */}}
    } }
    finally { if (generation.current === version) setBusy(false); }
  }
  const ready = snapshot && !busy && !loading;
  const field = 'mt-2 block w-full rounded-lg border border-violet-200/80 bg-background p-2.5 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-60 dark:border-violet-400/25';
  const control = 'rounded-lg border-violet-200/80 bg-background text-xs shadow-sm hover:bg-violet-50 dark:border-violet-400/25 dark:hover:bg-violet-400/10';
  return <section className="rounded-2xl border border-violet-200/70 bg-background p-5 shadow-sm dark:border-violet-400/20">
    <div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300"><ShieldCheck aria-hidden="true" size={19} /></span><div><p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-300">Connection safeguards</p><h2 className="mt-0.5 text-sm font-semibold">Source privacy</h2></div></div>
    <p className="mt-3 max-w-3xl text-xs leading-5 text-muted-foreground">Keep review data for a limited time. Block a source record from being imported again. These controls do not delete learner accounts or published jobs.</p>
    {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200">{notice}</p>}
    {loading && snapshot && <p role="status" className="mt-3 text-xs text-muted-foreground">Refreshing privacy settings…</p>}
    {!snapshot ? <div className="mt-4 text-xs text-muted-foreground"><p role="status">{loading?'Loading source controls…':'Source controls could not be loaded. Check the displayed error and retry.'}</p>{!loading&&<Button className="mt-2" size="sm" variant="outline" onClick={async()=>{const version=generation.current;setLoading(true);setError('');try{await load(version);}catch(error){if(version===generation.current)setError(error.message);}finally{if(version===generation.current)setLoading(false);}}}>Retry source controls</Button>}</div> : <>
      <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">{snapshot.suppressionCount} source records suppressed · {snapshot.redactedCount} review payloads expired. In-flight or uncertain operations are retained for reconciliation.</p>
      <p className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${snapshot.status==='connected'?'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200':'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200'}`} role="status">{snapshot.status==='connected'?<CircleCheck aria-hidden="true" size={14} />:snapshot.status==='paused'?<PauseCircle aria-hidden="true" size={14} />:<ShieldOff aria-hidden="true" size={14} />}{snapshot.status==='connected'?'Connection active — discovery can be started.':snapshot.status==='paused'?'Connection paused — resume it before discovery.':`Connection ${snapshot.status.replaceAll('_',' ')}.`}</p>
      <label className="mt-4 block text-xs font-medium">Reason for this change<input aria-describedby="source-control-help" className={field} value={reason} onChange={event => setReason(event.target.value)} minLength={3} maxLength={500} disabled={busy} /></label>
      <p id="source-control-help" className="mt-2 text-xs text-muted-foreground">Enter at least 3 characters to enable these actions. To pause only a scan while preserving approvals, use Pause discovery in its progress panel.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {['connected','paused'].includes(snapshot.status) && <>
          <Button className={control} variant="outline" disabled={!ready || snapshot.status!=='paused' || reason.trim().length < 3} onClick={() => update('control_connection', {
            connectionId, expectedConfigRevision: snapshot.configRevision, command: 'resume', reason,
          })}>Resume connection</Button>
          <Button className={control} variant="outline" disabled={!ready || snapshot.status!=='connected' || reason.trim().length < 3} onClick={() => update('control_connection', {
            connectionId, expectedConfigRevision: snapshot.configRevision, command: 'pause', reason,
          })}>Pause connection</Button>
        </>}
        {snapshot.status==='connected'&&<Button className={control} variant="outline" disabled={busy} onClick={()=>{if(onNavigateToDiscovery){onNavigateToDiscovery();return;}const action=document.getElementById('zoho-discovery-action');action?.scrollIntoView?.({block:'center'});action?.focus();}}>Go to discovery</Button>}
        {snapshot.status !== 'not_connected' && <Button className={control} variant="outline" disabled={!ready || reason.trim().length < 3} onClick={() => {setDisconnectText('');setDisconnectConfirm(true);}}>Disconnect and remove saved credentials</Button>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Pause and disconnect invalidate queued approvals. Started operations may finish and remain recoverable. Resume requires fresh review, including the job publication policy. Disconnect removes local credentials; revoke source access in Zoho separately.</p>
      <form className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-violet-200/60 bg-violet-50/30 p-4 dark:border-violet-400/15 dark:bg-violet-400/5" onSubmit={event => { event.preventDefault(); update('configure_retention', { connectionId, days: Number(days), reason }); }}>
        <label className="text-xs font-medium">Review retention (days)<input className={field} type="number" min="1" max="365" value={days} onChange={event => setDays(event.target.value)} required disabled={busy} /></label>
        <Button className={control} type="submit" variant="outline" disabled={!ready || reason.trim().length < 3}>Save retention</Button>
      </form>
      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-violet-200/60 bg-violet-50/30 p-4 dark:border-violet-400/15 dark:bg-violet-400/5" onSubmit={event => { event.preventDefault(); update('suppress_source', { connectionId, module, externalId, suppressed: true, reason }); }}>
        <label className="text-xs font-medium">Record type<select className={field} value={module} onChange={event => setModule(event.target.value)} disabled={busy}><option value="Candidates">Candidate</option><option value="Job_Openings">Job opening</option></select></label>
        <label className="text-xs font-medium">Zoho record ID<input className={field} value={externalId} onChange={event => setExternalId(event.target.value)} pattern="[0-9]{1,40}" required disabled={busy} /></label>
        <Button className={control} type="submit" variant="outline" disabled={!ready || reason.trim().length < 3}>Suppress record</Button>
      </form>
      {snapshot.suppressed?.length > 0 && <ul className="mt-4 divide-y divide-border">{snapshot.suppressed.map(row => <li key={`${row.module}:${row.externalId}`} className="flex items-center justify-between gap-3 py-3 text-xs"><span>{row.module === 'Candidates' ? 'Candidate' : 'Job'} · {row.externalId}</span><Button className={control} variant="outline" size="sm" disabled={!ready || reason.trim().length < 3} onClick={() => update('suppress_source', { connectionId, module: row.module, externalId: row.externalId, suppressed: false, reason })}>Remove suppression</Button></li>)}</ul>}
      {snapshot.suppressionCount > 100 && <p className="mt-2 text-xs text-muted-foreground">Showing the newest 100 suppressions.</p>}
      <Button className={`mt-5 ${control}`} variant="outline" ref={cleanupTrigger} disabled={!ready} onClick={() => {setCleanupReason('');setCleanupConfirm(true);}}>Clean expired payloads across all sources</Button>
    </>}
    <dialog ref={cleanupDialog} aria-labelledby="cleanup-title" aria-describedby="cleanup-description" onCancel={event=>{event.preventDefault();if(!busy)setCleanupConfirm(false);}} onClose={()=>{setCleanupConfirm(false);cleanupTrigger.current?.focus();}} className="w-[min(92vw,560px)] rounded-2xl border border-border bg-background p-6 text-foreground shadow-xl backdrop:bg-slate-950/50">
      <form onSubmit={event=>{event.preventDefault();if(cleanupReason.trim().length>=3&&!busy)update('cleanup_payloads',{reason:cleanupReason.trim(),confirmed:true});}}>
        <h3 id="cleanup-title" className="text-lg font-semibold">Clean expired payloads across all sources?</h3>
        <p id="cleanup-description" className="mt-3 text-sm leading-6">This permanently removes review data that has passed its retention period or was suppressed. In-flight and uncertain operations stay available for reconciliation. Learner accounts and published jobs are retained. No emails are sent.</p>
        <label className="mt-4 block text-sm">Cleanup reason<textarea autoFocus required minLength={3} maxLength={500} value={cleanupReason} disabled={busy} onChange={event=>setCleanupReason(event.target.value)} className={field}/></label>
        {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={busy} onClick={()=>setCleanupConfirm(false)}>Cancel cleanup</Button><Button type="submit" disabled={busy||cleanupReason.trim().length<3}>{busy?'Cleaning…':'Confirm global cleanup'}</Button></div>
      </form>
    </dialog>
    <dialog ref={confirmDialog} aria-labelledby="disconnect-title" onCancel={event=>{if(busy)event.preventDefault();else setDisconnectConfirm(false);}} className="w-[min(92vw,480px)] rounded-2xl border border-violet-200 bg-background p-6 text-foreground shadow-xl backdrop:bg-slate-950/50 dark:border-violet-400/25">
      <h3 id="disconnect-title" className="font-semibold">Disconnect this Zoho source?</h3><p className="mt-3 text-sm">Saved credentials will be removed, discovery stopped and queued approvals invalidated. Existing learners and jobs are retained. Reconnection requires Zoho authorization.</p>
      <label className="mt-4 block text-sm">Type DISCONNECT to confirm<input aria-label="Disconnect confirmation" value={disconnectText} disabled={busy} onChange={event=>setDisconnectText(event.target.value)} className={field}/></label>
      <div className="mt-4 flex gap-3"><Button className={control} variant="outline" disabled={busy} onClick={()=>setDisconnectConfirm(false)}>Keep connection</Button><Button disabled={busy||disconnectText!=='DISCONNECT'||reason.trim().length<3} onClick={async()=>{await update('control_connection',{connectionId,expectedConfigRevision:snapshot.configRevision,command:'disconnect',reason});setDisconnectConfirm(false);}}>Confirm disconnect</Button></div>
    </dialog>
  </section>;
}
