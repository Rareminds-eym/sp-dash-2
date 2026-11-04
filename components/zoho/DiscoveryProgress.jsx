'use client';
import React, { useEffect, useState } from 'react';
import { Check, LoaderCircle, AlertCircle } from 'lucide-react';

export default function DiscoveryProgress({ progress, errorText, updatedAt, onControl, busy }) {
  const [now, setNow] = useState(Date.now());
  const [reason,setReason]=useState('');
  const [confirmCancel,setConfirmCancel]=useState(false);
  useEffect(()=>{setReason('');setConfirmCancel(false);},[progress?.run?.id,progress?.phase]);
  useEffect(() => {
    if (!progress?.active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [progress?.active]);
  if (!progress) return null;
  const { active, phase, title, run } = progress;
  const elapsed = Math.max(0, Math.floor((now - Date.parse(progress.startedAt)) / 1000)) || 0;
  const Icon = active ? LoaderCircle : phase === 'completed' ? Check : AlertCircle;
  return <section aria-label="Discovery progress" className="border-b border-border bg-muted/30 px-5 py-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" size={18} className={`mt-0.5 ${active ? 'animate-spin motion-reduce:animate-none' : phase === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`} />
        <div>
          <p role="status" aria-live="polite" className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{phase === 'submitting' ? 'Saving your request. Candidates and jobs will only be staged for review.'
            : phase === 'queued' ? (run?.last_error ? `Retry eligible after ${new Date(run.next_attempt_at).toLocaleTimeString()}.` : 'Waiting for the background processor. This page updates automatically.')
            : phase === 'running' ? 'Reading saved records, including both conversion states. Total size is not known yet.'
            : phase === 'completed' ? 'Staging finished. Review each record before approving account or job creation.'
            : phase === 'completed_with_exceptions' ? 'Some source records were not staged. Review exceptions before treating this inventory as complete.'
            : phase === 'incomplete' ? 'The next discovery continues from the saved checkpoint.'
            : phase === 'paused' ? 'The saved batch is retained. Resume continues from that checkpoint without changing approvals or the connection.'
            : phase === 'cancelled' ? 'Staged records were retained. A new discovery starts a fresh scan.'
            : phase === 'error' ? 'The response was not confirmed. Refresh status before trying again; the request may already be queued.'
            : 'Review the error below before starting a new discovery.'}</p>
        </div>
      </div>
      {active && <span className="text-xs tabular-nums text-muted-foreground">{elapsed}s elapsed</span>}
    </div>
    {active && <div role="progressbar" aria-label="Discovery activity" aria-valuetext={title} className="mt-3 h-1 overflow-hidden rounded-full bg-border"><div className="h-full w-full animate-pulse bg-foreground/40 motion-reduce:animate-none" /></div>}
    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs tabular-nums">
      {[[progress.received,'received'],[progress.staged,'staged'],[progress.deferred,'deferred'],[progress.notStaged,'not staged'],[progress.batches,'batches saved']].map(([value,label]) => <div key={label} className="flex gap-1"><dd className="font-semibold">{value}</dd><dt className="text-muted-foreground">{label}</dt></div>)}
    </dl>
    {(errorText || progress.message) && <p className="mt-2 text-xs text-destructive">{errorText || progress.message}</p>}
    {active && updatedAt && <p className="mt-2 text-xs text-muted-foreground">Last checked {new Date(updatedAt).toLocaleTimeString()} · refreshing every 3 seconds</p>}
    {onControl&&run&&['queued','running','paused'].includes(phase)&&<div className="mt-4 space-y-2 border-t border-border pt-3">
      <label className="block text-xs font-medium">Discovery control reason<input aria-label="Discovery control reason" aria-describedby="discovery-control-help" minLength={3} maxLength={500} value={reason} disabled={busy} onChange={event=>setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"/></label>
      <p id="discovery-control-help" className="text-xs text-muted-foreground">Enter at least 3 characters to pause, resume or cancel this scan. Connection access and queued approvals stay unchanged.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50" disabled={busy||reason.trim().length<3} onClick={()=>onControl(phase==='paused'?'resume':'pause',reason.trim())}>{phase==='paused'?'Resume discovery':'Pause discovery'}</button><button type="button" className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50" disabled={busy||reason.trim().length<3} onClick={()=>setConfirmCancel(true)}>Cancel discovery</button></div>
      {confirmCancel&&<div className="rounded-lg border border-amber-400 p-3 text-xs" role="group" aria-label="Confirm discovery cancellation"><p>Cancel this scan? Staged records stay available. A later discovery starts again from the beginning.</p><div className="mt-2 flex gap-3"><button type="button" disabled={busy} onClick={()=>setConfirmCancel(false)}>Keep scan</button><button type="button" disabled={busy||reason.trim().length<3} onClick={()=>onControl('cancel',reason.trim())}>Confirm cancellation</button></div></div>}
    </div>}
  </section>;
}
