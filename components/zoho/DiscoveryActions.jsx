'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DiscoveryActions({ progress, configRevision, busy, connected, available, onStart, onControl }) {
  const [command, setCommand] = useState(null);
  const [reason, setReason] = useState('');
  const dialog = useRef(null);
  const primary = useRef(null);
  const phase = progress?.phase;
  const runId = progress?.run?.id;
  const controllable = Boolean(runId && ['queued', 'running', 'paused'].includes(phase));
  const paused = phase === 'paused';
  const outdated = controllable && Number.isInteger(configRevision) && Number.isInteger(progress.run.config_revision) && progress.run.config_revision !== configRevision;
  const starting = phase === 'submitting' || (progress?.active && !runId);
  useEffect(() => { setCommand(null); setReason(''); }, [runId, phase, connected]);
  useEffect(() => {
    if (command) dialog.current?.showModal();
    else if (dialog.current?.open) { dialog.current.close(); primary.current?.focus(); }
  }, [command]);
  function ask(action) { setReason(''); setCommand(action); }
  const actionLabel = command === 'pause' ? 'Pause discovery' : command === 'resume' ? 'Resume discovery' : 'Stop discovery';
  return <>
    <div className="flex flex-wrap gap-2" aria-label="Discovery actions">
      <Button ref={primary} id="zoho-discovery-action" type="button" variant="outline" size="sm"
        disabled={busy || starting || (!outdated && (!connected || ((!controllable || paused) && !available)))}
        onClick={() => controllable ? ask(outdated ? 'cancel' : paused ? 'resume' : 'pause') : onStart()}>
        {starting ? <LoaderCircle aria-hidden="true" size={14} className="mr-2 animate-spin motion-reduce:animate-none" /> : outdated ? <Square aria-hidden="true" size={14} className="mr-2" /> : controllable && !paused ? <Pause aria-hidden="true" size={14} className="mr-2" /> : <Play aria-hidden="true" size={14} className="mr-2" />}
        {starting ? 'Starting discovery…' : outdated ? 'Stop outdated discovery' : controllable ? paused ? 'Resume discovery' : 'Pause discovery' : 'Start discovery'}
      </Button>
      {controllable && !outdated && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ask('cancel')}><Square aria-hidden="true" size={13} className="mr-2" />Stop discovery</Button>}
    </div>
    {outdated && <p className="text-xs text-muted-foreground">Source settings changed. Stop this outdated scan, then start fresh discovery. Staged records are retained.</p>}
    {!available && !outdated && <p className="text-xs text-muted-foreground">Discovery service is unavailable. Refresh status after restoring its credentials and runtime.</p>}
    <dialog ref={dialog} aria-labelledby="discovery-action-title" aria-describedby="discovery-action-description"
      onCancel={event => { if (busy) event.preventDefault(); else setCommand(null); }}
      className="w-[min(92vw,480px)] rounded-2xl border border-violet-200 bg-background p-6 text-foreground shadow-xl backdrop:bg-slate-950/50 dark:border-violet-400/25">
      <h2 id="discovery-action-title" className="text-lg font-semibold">{actionLabel}</h2>
      <p id="discovery-action-description" className="mt-3 text-sm leading-6 text-muted-foreground">{command === 'cancel'
        ? 'Stop this scan? Already staged records and approvals stay available. A later start begins a fresh scan.'
        : command === 'pause' ? 'Pause at the saved checkpoint. An in-flight batch may finish. Resume continues this scan; the connection and approvals stay unchanged.'
        : 'Continue from the saved checkpoint. Previously staged records and approvals stay unchanged.'}</p>
      <label className="mt-4 block text-sm font-medium">Discovery control reason<input aria-label="Discovery control reason" minLength={3} maxLength={500}
        value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-sm" /></label>
      <p className="mt-2 text-xs text-muted-foreground">Enter at least 3 characters. No accounts, jobs or emails are created by this action.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={busy} onClick={() => setCommand(null)}>Keep current state</Button>
        <Button type="button" className="bg-violet-600 text-white hover:bg-violet-700" disabled={busy || !controllable || reason.trim().length < 3 || (command === 'resume' && (!connected || !available))}
          onClick={() => { const action = command, explanation = reason.trim(); setCommand(null); onControl(action, explanation); }}>Confirm {command === 'cancel' ? 'stop' : command}</Button>
      </div>
    </dialog>
  </>;
}
