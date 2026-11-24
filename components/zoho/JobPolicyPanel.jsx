'use client';
import ZohoSelect from './ZohoSelect';
import { browserResponse } from '@/lib/zoho/browser-response';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DEFAULT_JOB_POLICY_MAPPINGS, jobPolicySchema } from '@/lib/zoho/job-policy';

const API = '/api/integrations/zoho-recruit';
const blankRow = () => ({ source: '', destination: '' });
const rows = map => Object.entries(map || {}).map(([source, destination]) => ({ source, destination }));
function toMap(entries) {
  const result = Object.create(null);
  for (const row of entries) {
    if (Object.hasOwn(result, row.source)) throw new Error('Each source label must appear once.');
    result[row.source] = row.destination;
  }
  return result;
}
function MappingRows({ title, entries, destinations, disabled, onChange }) {
  return <fieldset disabled={disabled} className="space-y-3"><legend className="mb-3 text-sm font-medium">{title}</legend>
    {entries.map((row, index) => <div key={index} className="flex flex-wrap gap-2">
      <input aria-label={`${title} source ${index + 1}`} maxLength={100} value={row.source}
        placeholder="Exact Zoho label" className="min-w-32 flex-1 rounded-lg border border-border bg-background p-2 text-sm"
        onChange={event => onChange(entries.map((value, position) => position === index ? { ...value, source: event.target.value } : value))} />
      <ZohoSelect aria-label={`${title} destination ${index + 1}`} value={row.destination} disabled={disabled}
        className="min-w-40 flex-1"
        onValueChange={destination => onChange(entries.map((value, position) => position === index ? { ...value, destination } : value))}
        options={[{value:'',label:'Choose mapping'},...destinations.map(value => ({value,label:value}))]}/>
      <button type="button" aria-label={`Remove ${title.toLowerCase()} mapping ${index + 1}`} className="px-2 text-xs underline" onClick={() => onChange(entries.filter((_, position) => position !== index))}>Remove</button>
    </div>)}
    <Button type="button" size="sm" variant="outline" disabled={disabled || entries.length >= 50} onClick={() => onChange([...entries, blankRow()])}>Add mapping</Button>
  </fieldset>;
}

export default function JobPolicyPanel({ connectionId, onSaved, refreshVersion = 0 }) {
  const [snapshot, setSnapshot] = useState(null);
  const [reload, setReload] = useState(0);
  const [statusRows, setStatusRows] = useState([]);
  const [employmentRows, setEmploymentRows] = useState([]);
  const [enabled, setEnabled] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice,setNotice]=useState('');
  const [refreshWarning,setRefreshWarning]=useState('');
  const generation = useRef(0);
  const appliedRefresh = useRef(refreshVersion);
  useEffect(() => {
    if (appliedRefresh.current === refreshVersion || busy) return;
    appliedRefresh.current = refreshVersion;
    setReload(value => value + 1);
  }, [refreshVersion, busy]);
  const activeConnection = useRef(connectionId);
  activeConnection.current = connectionId;
  useEffect(()=>{setNotice('');setRefreshWarning('');},[connectionId]);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setSnapshot(null); setReviewed(false); setReason(''); setError(''); setBusy(true);
    if (!connectionId) { setBusy(false); return; }
    (async () => {
      try {
        const response = await fetch(`${API}?view=job_policy&connectionId=${encodeURIComponent(connectionId)}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        const result = await browserResponse(response);
        if (!response.ok) throw new Error(result.error || 'Job publication policy unavailable.');
        if (generation.current !== current || activeConnection.current !== connectionId) return;
        const policy = result.policy.policy ?? DEFAULT_JOB_POLICY_MAPPINGS;
        setSnapshot(result.policy); setStatusRows(rows(policy.statusMap));
        setEmploymentRows(rows(policy.employmentMap)); setEnabled(result.policy.policy?.enabled === true);
      } catch (error) { if (!controller.signal.aborted && generation.current === current) setError(error.message); }
      finally { if (generation.current === current) setBusy(false); }
    })();
    return () => { controller.abort(); generation.current++; };
  }, [connectionId, reload]);
  async function save(event) {
    event.preventDefault(); setError('');setRefreshWarning('');
    const current = generation.current;
    try {
      const parsed = jobPolicySchema.safeParse({ connectionId, expectedConfigRevision: snapshot.configRevision,
        statusMap: toMap(statusRows), employmentMap: toMap(employmentRows), enabled, noEmailReviewed: reviewed,
        reason });
      if (!parsed.success) throw new Error('Set unique exact source mappings, a reason of at least 3 characters and confirm the source mappings before enabling.');
      setBusy(true);
      const response = await fetch(API, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'configure_job_policy', input: parsed.data }) });
      const result = await browserResponse(response);
      if (generation.current !== current || activeConnection.current !== connectionId) return;
      if (!response.ok) throw new Error(result.error || 'Job publication policy could not be saved.');
      // Saving changes the connection revision. The old review cannot authorize another save.
      setSnapshot(null); setReviewed(false); setReason('');
      setNotice('Publication policy saved. Previous reviews require a fresh check.');
      try{await onSaved();}catch(error){if(generation.current===current)setRefreshWarning(`Policy saved. Refreshing related records failed: ${error.message}`);}
      finally{if (generation.current === current && activeConnection.current === connectionId) setReload(value => value + 1);}
    } catch (error) { if (generation.current === current && activeConnection.current === connectionId) setError(error.message); }
    finally { if (generation.current === current) setBusy(false); }
  }
  return <section aria-label="Job publication policy" className="rounded-2xl border border-border bg-background p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Job publication policy</h2><Button variant="outline" size="sm" disabled={busy || !connectionId} onClick={() => setReload(value => value + 1)}>Refresh policy</Button></div>
    <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">Map exact Zoho statuses and employment labels before discovery. Unmapped values stay blocked. Saving changes the configuration revision and requires fresh discovery and approval. Runtime execution controls remain separate.</p>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {notice&&<p role="status" className="mt-4 text-sm">{notice}</p>}
    {refreshWarning&&<p role="alert" className="mt-4 text-sm text-amber-700 dark:text-amber-300">{refreshWarning}</p>}
    {!snapshot ? <p className="mt-4 text-sm text-muted-foreground">{busy ? 'Loading publication policy…' : 'Refresh status to load the current policy.'}</p> : <form onSubmit={save} className="mt-5 space-y-5">
      {!snapshot.policy && <p className="text-xs leading-5 text-muted-foreground">Standard status and employment mappings are prefilled. Review and save them for this source. Unmapped Zoho labels stay blocked.</p>}
      <div className="grid gap-6 xl:grid-cols-2">
        <MappingRows title="Job status" entries={statusRows} destinations={['open', 'closed', 'draft']} disabled={busy} onChange={setStatusRows} />
        <MappingRows title="Employment type" entries={employmentRows} destinations={['job', 'internship', 'contract']} disabled={busy} onChange={setEmploymentRows} />
      </div>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={event => setReviewed(event.target.checked)} /><span>I reviewed these status and employment mappings. Approved job imports send no emails.</span></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} /><span>Enable job imports using these mappings. Each job still requires approval.</span></label>
      <label className="block text-sm font-medium">Change reason<textarea value={reason} disabled={busy} minLength={3} maxLength={500} onChange={event => setReason(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-border bg-background p-3 text-sm" /></label>
      <Button type="submit" disabled={busy || reason.trim().length < 3 || (enabled && !reviewed)}>{busy ? 'Saving…' : 'Save mappings'}</Button>
    </form>}
  </section>;
}
