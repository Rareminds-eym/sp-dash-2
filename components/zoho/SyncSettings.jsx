'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { browserResponse } from '@/lib/zoho/browser-response';
const API = '/api/integrations/zoho-recruit';

export default function SyncSettings({ connectionId, refreshVersion, captures }) {
  const [state, setState] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const [secret, setSecret] = useState(''), [notice, setNotice] = useState('');
  const visit = useRef(null);
  useEffect(() => {
    const controller = new AbortController(), token = {}; visit.current = token;
    setState(null); setSecret(''); setError(''); setNotice(''); setBusy(false);
    (async () => {
      try {
        const response = await fetch(`${API}?view=sync&connectionId=${encodeURIComponent(connectionId)}`, { cache: 'no-store', signal: controller.signal });
        const body = await browserResponse(response);
        if (!response.ok || !body.sync?.policies) throw new Error(body.error || 'Synchronization settings unavailable');
        if (visit.current === token) setState(body.sync);
      } catch (e) { if (visit.current === token && !controller.signal.aborted) setError(e.message); }
    })();
    return () => { controller.abort(); if (visit.current === token) visit.current = null; };
  }, [connectionId, refreshVersion]);
  async function submit(action, input) {
    const token = visit.current; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, input: { connectionId, expectedConfigRevision: state.configRevision, ...input } }) });
      const body = await browserResponse(response);
      if (visit.current !== token) return;
      if (!response.ok) throw new Error(body.error || 'Synchronization settings could not be saved');
      if (action === 'rotate_webhook') { setSecret(body.result.secret); setState(value => ({ ...value, webhookConfigured: true })); setNotice('Webhook secret created. Copy it now; it will not be shown again.'); }
      else { setState(body.result); setNotice('Synchronization policy saved. Approval is still required before account or job creation.'); }
    } catch (e) { if (visit.current === token) setError(e.message); }
    finally { if (visit.current === token) setBusy(false); }
  }
  return <section aria-label="Synchronization settings" className="rounded-2xl border border-border bg-background p-5">
    <h2 className="text-sm font-semibold">Synchronization</h2>
    <p className="mt-2 text-sm text-muted-foreground">A resumable baseline is followed by changed-record discovery. Periodic full scans reconcile drift. Paused or cancelled scans stay stopped.</p>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    {!state ? <p className="mt-3 text-sm text-muted-foreground">{error ? 'Close and reopen settings to retry.' : 'Loading synchronization settings…'}</p> : <>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">{state.policies.map(policy => <form key={policy.module} className="space-y-3 rounded-xl border border-border p-4" onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        submit('configure_sync', { module: policy.module, enabled: data.has('enabled'), intervalMinutes: Number(data.get('interval')),
          reconciliationDays: Number(data.get('reconciliation')), preferBulk: false });
      }}>
        <h3 className="text-sm font-semibold">{policy.module === 'Candidates' ? 'Candidates' : 'Job openings'}</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={policy.enabled} disabled={busy}/>Automatic incremental discovery</label>
        <label className="block text-sm">Check every (minutes)<input name="interval" type="number" required min="5" max="1440" defaultValue={policy.intervalMinutes} disabled={busy} className="mt-1 block w-full rounded-lg border border-border bg-background p-2"/></label>
        <label className="block text-sm">Full reconciliation every (days)<input name="reconciliation" type="number" required min="1" max="30" defaultValue={policy.reconciliationDays} disabled={busy} className="mt-1 block w-full rounded-lg border border-border bg-background p-2"/></label>
        <p className="text-xs text-muted-foreground">Discovery uses one resumable REST scan covering both conversion states, followed by changed-record checks. Automatic checks begin after the first manual discovery.</p>
        <p className="text-xs text-muted-foreground">Captured through: {(() => { const through = captures === undefined ? policy.capturedThrough : captures.find(item => item.module === policy.module && item.config_revision === state.configRevision)?.scan_started_at; return through ? new Date(through).toLocaleString() : 'Baseline not established'; })()}</p>
        <Button type="submit" variant="outline" size="sm" disabled={busy}>Save {policy.module === 'Candidates' ? 'candidate' : 'job'} sync policy</Button>
      </form>)}</div>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Zoho workflow notifications</h3>
        <p className="mt-2 text-sm text-muted-foreground">{state.webhookConfigured ? 'Webhook credential configured.' : 'No webhook credential configured.'} Notifications accelerate discovery; scheduled checks recover missed events.</p>
        <p className="mt-2 text-xs text-muted-foreground">In Zoho Recruit, associate a POST webhook with candidate and job create/edit/delete workflows. Send form or JSON body parameters: connectionId, module (Candidates or Job_Openings), and secret. Do not put the secret in the URL.</p>
        <p className="mt-2 break-all text-xs">Endpoint: {origin}{API}/webhook</p>
        <p className="mt-1 break-all text-xs">connectionId: {connectionId}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled={busy} onClick={() => submit('rotate_webhook', {})}>{state.webhookConfigured ? 'Replace webhook secret' : 'Create webhook secret'}</Button>
        {state.webhookConfigured && <p className="mt-2 text-xs text-muted-foreground">Replacing the secret immediately invalidates the previous one. Update the Zoho workflow after replacing it.</p>}
        {secret && <div className="mt-3 rounded-lg border border-border p-3"><label className="block text-xs">Webhook secret · shown once<input readOnly value={secret} className="mt-2 w-full rounded border border-border bg-background p-2 font-mono text-sm" onFocus={event => event.target.select()}/></label><Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setSecret('')}>Hide secret</Button></div>}
      </div>
    </>}
  </section>;
}
