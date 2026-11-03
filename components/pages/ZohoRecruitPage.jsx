'use client';
import OperationsPanel from '@/components/zoho/OperationsPanel';
import DiscoveryProgress from '@/components/zoho/DiscoveryProgress';
import { discoveryProgress } from '@/lib/zoho/discovery-progress';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Database, LockKeyhole, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JobPolicyPanel from '@/components/zoho/JobPolicyPanel';
import CandidateReview from '@/components/zoho/CandidateReview';
import SourcePrivacyPanel from '@/components/zoho/SourcePrivacyPanel';
import { candidateApprovalReady } from '@/lib/zoho/candidate-review-selection';
import { ZOHO_REGIONS, ZOHO_POLICY } from '@/lib/zoho/contracts';

const API = '/api/integrations/zoho-recruit';
const tabs = [{ id: 'Candidates', label: 'Candidates' }, { id: 'Job_Openings', label: 'Job openings' }];
const captions = {
  pending_approval: 'Awaiting review', held: 'On hold', rejected: 'Rejected', approved: 'Approved · queued',
  approval_stale: 'Review again', processing: 'Processing', completed: 'Completed', failed: 'Failed',
};
const discoveryErrors = {
  CHECKPOINT_AVAILABLE: 'Checkpoint saved; the next discovery continues from this page.', INVENTORY_LIMIT: 'Configured inventory limit reached; review required.',
  SOURCE_UNAVAILABLE: 'Source temporarily unavailable; retry scheduled.', RATE_LIMITED: 'Source rate limit reached; retry scheduled.',
  AUTH_REVOKED: 'Source authorization expired or revoked; reconnect required.', PERMISSION_DENIED: 'Source permission denied; review access and reconnect.',
  SOURCE_INVALID: 'Source response is invalid; review required.', BUDGET_EXHAUSTED: 'Discovery budget exhausted; review before starting another run.',
  CANCELLED_BY_OPERATOR: 'Discovery cancelled by an operator. Staged records were retained.',
  CONNECTION_CHANGED: 'Source configuration changed; start a fresh discovery.', CREDENTIALS_UNAVAILABLE: 'Source credentials unavailable; reconnect required.',
  CREDENTIALS_CHANGED: 'Source credentials renewed; discovery will resume.', WORKER_LOST: 'Discovery interrupted; recovery scheduled.',
};
const initialConnection = { name: '', sourceOrgId: '', region: 'in', publisherOrganizationId: '' };
async function api(path = '', options) {
  const response = await fetch(`${API}${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The integration request failed.');
  return result;
}

export default function ZohoRecruitPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [connectionId, setConnectionId] = useState('');
  const [module, setModule] = useState('Candidates');
  const [records, setRecords] = useState([]);
  const [runs, setRuns] = useState([]);
  const [discoveryRequest, setDiscoveryRequest] = useState(null);
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [deferred, setDeferred] = useState([]);
  const [pendingHistoryConnection, setPendingHistoryConnection] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [recordTotal,setRecordTotal]=useState(null);
  const [recordsLoading,setRecordsLoading]=useState(false);
  const [searchDraft,setSearchDraft]=useState('');
  const [search,setSearch]=useState('');
  const [stateFilter,setStateFilter]=useState('');
  const [historyErrors,setHistoryErrors]=useState({});
  const [historyMore,setHistoryMore]=useState({});
  const [decisionError,setDecisionError]=useState('');
  const [compact,setCompact]=useState(false);
  const detailPanel=useRef(null),detailOpener=useRef(null);
  const [selection, setSelection] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailOpen,setDetailOpen]=useState(false);
  const [candidateReviews, setCandidateReviews] = useState({});
  const [reviewing, setReviewing] = useState({});
  const candidateRequests = useRef(new Map());
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [configuration, setConfiguration] = useState(initialConnection);
  const [showSetup, setShowSetup] = useState(false);
  const dialog = useRef(null);
  const requestGeneration = useRef(0);
  const recordRead = useRef(0);
  const historyGeneration = useRef(0);
  const activeConnection = useRef(connectionId);
  activeConnection.current = connectionId;
  const loadedRecordCount = useRef(records.length);
  loadedRecordCount.current = records.length;
  const backgroundPoll = useRef(false);
  const decisionAttempt = useRef(null);
  const connection = snapshot?.connections?.find(item => item.id === connectionId);
  const progress = discoveryProgress(runs, discoveryRequest, connectionId, module);
  const discoveryActive = Boolean(progress?.active);
  const discoveryPaused=progress?.phase==='paused';
  useEffect(()=>{
    if(!connectionId)return;
    try{window.sessionStorage.setItem('zoho-selected-source',connectionId);const target=new URL(window.location.href);target.searchParams.set('source',connectionId);window.history.replaceState(null,'',target);}catch{}
  },[connectionId]);

  useEffect(()=>{const timer=setTimeout(()=>setSearch(searchDraft.trim()),300);return()=>clearTimeout(timer);},[searchDraft]);
  useEffect(()=>{
    if(typeof window.matchMedia!=='function')return;
    const media=window.matchMedia('(max-width: 1023px)'),change=()=>setCompact(media.matches);
    change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[]);
  useEffect(()=>{if(detail?.id&&compact&&detailOpen)detailPanel.current?.focus();},[detail?.id,compact,detailOpen]);
  function closeDetail(){setDetailOpen(false);if(!compact)setDetail(null);detailOpener.current?.focus();}
  function detailKeys(event){
    if(!compact)return;
    if(event.key==='Escape'){event.preventDefault();closeDetail();}
    if(event.key==='Tab'){
      const items=[...detailPanel.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')];
      if(!items.length){event.preventDefault();return;}
      if(event.shiftKey&&(document.activeElement===items[0]||document.activeElement===detailPanel.current)){event.preventDefault();items.at(-1).focus();}
      else if(!event.shiftKey&&(document.activeElement===items.at(-1)||document.activeElement===detailPanel.current)){event.preventDefault();items[0].focus();}
    }
  }
  function selectSource(value){
    setConnectionId(value);setError('');setNotice('');
    try{const target=new URL(window.location.href);target.searchParams.set('source',value);target.searchParams.delete('connection');target.searchParams.delete('reason');window.history.replaceState(null,'',target);window.sessionStorage.setItem('zoho-selected-source',value);}catch{/* Storage restrictions must not block source selection. */}
  }

  const loadSummary = useCallback(async () => {
    const result = await api();
    setSnapshot(result);
    setConnectionId(previous => {
      let requested='';try{requested=new URL(window.location.href).searchParams.get('source')||window.sessionStorage.getItem('zoho-selected-source')||'';}catch{}
      return result.connections.some(item=>item.id===previous)?previous:result.connections.some(item=>item.id===requested)?requested:result.connections[0]?.id||'';
    });
    return result;
  }, []);
  useEffect(() => {
    let active = true;
    loadSummary().catch(e => active && setError(e.message)).finally(() => active && setLoading(false));
    const outcome = new URL(window.location.href).searchParams.get('connection');
    if (outcome === 'failed') setError(new URL(window.location.href).searchParams.get('reason') === 'organization_mismatch'
      ? 'Zoho signed in successfully, but its organization identifier does not match the registered source. Review the source organization ID before reconnecting.'
      : 'Zoho authorization could not be verified. Check the registered organization, data center and server configuration.');
    if (outcome === 'verified') setNotice('Zoho organization verified. No accounts or jobs were created and no email was sent.');
    return () => { active = false; };
  }, [loadSummary]);
  const loadRecords = useCallback(async ({ background = false } = {}) => {
    const generation = background ? requestGeneration.current : ++requestGeneration.current;
    const read=++recordRead.current;
    const current=()=>generation===requestGeneration.current&&read===recordRead.current&&activeConnection.current===connectionId;
    if (!background) {
      setSelection([]); setRecords([]); setDetail(null); setCandidateReviews({}); setReviewing({}); candidateRequests.current.clear();
      setDetailOpen(false);setRecordTotal(null);setRecordsLoading(Boolean(connectionId));
    }
    if (!connectionId) return;
    const params = new URLSearchParams({ view: 'records', connectionId, module });
    if(search)params.set('search',search);if(stateFilter)params.set('state',stateFilter);
    let result;
    try{
      result=await api(`?${params}`);
      // Refresh the whole loaded window, including later pages whose records
      // may have changed state or stopped matching the current filter.
      const target=background?Math.max(50,loadedRecordCount.current):50;
      let page=result.records;
      const fresh=new Map(page.map(row=>[row.id,row]));
      while(current()&&fresh.size<target&&page.length===50&&(result.total==null||fresh.size<result.total)){
        const last=page.at(-1);params.set('before',last.created_at);params.set('beforeId',last.id);
        const next=await api(`?${params}`);page=next.records;
        const size=fresh.size;for(const row of page)fresh.set(row.id,row);
        if(fresh.size===size)break;
      }
      result.records=[...fresh.values()];
      result.hasMore=result.total!=null?fresh.size<result.total:page.length===50;
    }catch(error){if(current())throw error;return;}
    finally{if(current())setRecordsLoading(false);}
    if (current()) {
      setRecordTotal(result.total??null);
      if (background) {
        const fresh = new Map(result.records.map(row => [row.id, row]));
        setRecords(result.records);setHasMore(result.hasMore);
        const unchanged = item => {
          const row = fresh.get(item.id || item.recordId);
          return row && ['pending_approval', 'held', 'rejected'].includes(row.decision) &&
            row.revision === item.revision && row.source_hash === item.sourceHash &&
            row.config_revision === item.configRevision && row.target_id === item.targetId;
        };
        setSelection(previous => previous.filter(unchanged));
        setCandidateReviews(previous => Object.fromEntries(Object.entries(previous).filter(([, review]) => unchanged(review))));
        setDetail(previous => previous ? fresh.get(previous.id) || null : null);
      } else {
        setRecords(result.records); setHasMore(result.hasMore);
      }
    }
  }, [connectionId, module,search,stateFilter]);
  useEffect(() => { loadRecords().catch(e => setError(e.message)); }, [loadRecords]);
  const loadRuns = useCallback(async () => {
    const generation = ++historyGeneration.current;
    if (!connectionId) { setRuns([]); setExecutions([]); setDeferred([]); return; }
    try {
      const results=await Promise.allSettled(['runs','executions','deferred'].map(async kind=>{
        try{
          const result=await api(`?view=${kind}&connectionId=${encodeURIComponent(connectionId)}`);
          if(generation!==historyGeneration.current||activeConnection.current!==connectionId)return;
          const items=result[kind];
          const limit=kind==='deferred'?50:20;
          const timestamp=kind==='deferred'?'updated_at':'created_at';
          const boundary=items.at(-1);
          // Only retain older loaded pages. Rows removed from the refreshed
          // window (for example resolved deferred changes) must disappear.
          const merge=previous=>items.length<limit?items:[...items,...previous.filter(item=>
            !items.some(fresh=>fresh.id===item.id)&&(item[timestamp]<boundary[timestamp]||
              (item[timestamp]===boundary[timestamp]&&item.id<boundary.id)))];
          if(kind==='runs'){setRuns(merge);setHistoryUpdatedAt(Date.now());}
          if(kind==='executions')setExecutions(merge);if(kind==='deferred')setDeferred(merge);
          setHistoryMore(previous=>({...previous,[kind]:items.length===(kind==='deferred'?50:20)}));
          setHistoryErrors(previous=>({...previous,[kind]:''}));
          if(kind==='executions')setPendingHistoryConnection(current=>current===connectionId?'':current);
        }catch(error){if(generation===historyGeneration.current&&activeConnection.current===connectionId)setHistoryErrors(previous=>({...previous,[kind]:error.message}));throw error;}
      }));
      const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
    } catch (e) {
      if (generation === historyGeneration.current && activeConnection.current === connectionId) throw e;
    }
  }, [connectionId]);
  const refreshViews = useCallback(async (background = false) => {
    const results = await Promise.allSettled([loadSummary(), loadRecords({ background }), loadRuns()]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }, [loadSummary, loadRecords, loadRuns]);
  useEffect(() => {
    setRuns([]);
    setExecutions([]);
    setDeferred([]);
    setHistoryErrors({});setHistoryMore({});setHistoryUpdatedAt(null);
    loadRuns().catch(e => setError(e.message));
    return () => { historyGeneration.current++; };
  }, [loadRuns]);
  useEffect(()=>{const handler=()=>refresh();window.addEventListener('refreshPage',handler);return()=>window.removeEventListener('refreshPage',handler);},[refreshViews]);
  async function moreHistory(kind){
    const items=kind==='runs'?runs:kind==='executions'?executions:deferred,last=items.at(-1);if(!last)return;
    const generation=historyGeneration.current,source=connectionId;setBusy(true);
    try{
      const params=new URLSearchParams({view:kind,connectionId,before:kind==='deferred'?last.updated_at:last.created_at,beforeId:last.id});
      const result=await api(`?${params}`);if(generation!==historyGeneration.current||activeConnection.current!==source)return;
      const append=previous=>[...new Map([...previous,...result[kind]].map(item=>[item.id,item])).values()];
      if(kind==='runs')setRuns(append);if(kind==='executions')setExecutions(append);if(kind==='deferred')setDeferred(append);
      setHistoryMore(previous=>({...previous,[kind]:result[kind].length===(kind==='deferred'?50:20)}));setHistoryErrors(previous=>({...previous,[kind]:''}));
    }catch(error){if(activeConnection.current===source)setHistoryErrors(previous=>({...previous,[kind]:error.message}));}finally{setBusy(false);}
  }
  async function controlDiscovery(command,reason){
    if(!progress?.run)return;const source=connectionId;setBusy(true);setError('');
    try{const result=await api('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'control_discovery',input:{connectionId,runId:progress.run.id,command,reason}})});
      if(activeConnection.current!==source)return;
      setNotice(command==='resume'?`Discovery resumed from batch ${result.result.nextPage}.`:`Discovery ${command==='pause'?'paused at its saved checkpoint':'cancelled'}. Staged records and approvals were retained.`);
      await loadRuns();
    }catch(error){if(activeConnection.current===source)setError(error.message);}finally{setBusy(false);}
  }
  useEffect(() => {
    if (!discoveryActive && (!pendingHistoryConnection || pendingHistoryConnection !== connectionId) && !deferred.some(item => item.state === 'waiting_execution') && !runs.some(run => ['queued', 'running'].includes(run.state)) &&
      !executions.some(item => ['queued', 'processing'].includes(item.state) || (item.state === 'failed' && item.execution_attempts < 8))) return;
    const timer = setInterval(async () => {
      if (document.hidden || backgroundPoll.current) return;
      backgroundPoll.current = true;
      try { await refreshViews(true); }
      catch (e) { if (activeConnection.current === connectionId) setError(e.message); }
      finally { backgroundPoll.current = false; }
    }, discoveryActive ? 3000 : 15000);
    return () => clearInterval(timer);
  }, [runs, executions, deferred, refreshViews, connectionId, pendingHistoryConnection, discoveryActive]);
  async function discover() {
    if (discoveryActive||discoveryPaused) return;
    const scope = { connectionId, module, startedAt: new Date().toISOString() };
    setDiscoveryRequest({ ...scope, phase: 'submitting' });
    setBusy(true); setError('');
    try {
      const result = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discover', input: { connectionId, module } }) });
      setDiscoveryRequest({ ...scope, phase: 'queued', runId: result.result.runId });
      if (activeConnection.current !== scope.connectionId) return;
      setNotice(`Discovery ${result.result.delivery === 'pending' ? 'saved; delivery pending' : 'queued'} (${result.result.runId}). Records will be staged for review; no accounts, jobs or emails are created.`);
      await loadRuns();
    } catch (e) {
      if (activeConnection.current === scope.connectionId) setError(e.message);
      setDiscoveryRequest(previous => previous?.runId ? previous : { ...scope, phase: 'error', message: e.message });
      setPendingHistoryConnection(scope.connectionId);
    } finally { setBusy(false); }
  }
  async function loadMore() {
    const last = records[records.length - 1];
    if (!last) return;
    const generation = requestGeneration.current,read=++recordRead.current;
    const current=()=>generation===requestGeneration.current&&read===recordRead.current&&activeConnection.current===connectionId;
    setBusy(true);
    try {
      const params = new URLSearchParams({ view: 'records', connectionId, module, before: last.created_at, beforeId: last.id });
      if(search)params.set('search',search);if(stateFilter)params.set('state',stateFilter);
      const result = await api(`?${params}`);
      if (current()) {
        setRecords(previous=>{const combined=[...new Map([...previous,...result.records].map(row=>[row.id,row])).values()];return combined;});
        setRecordTotal(result.total??null);
        setHasMore(result.total!=null?records.length+result.records.length<result.total:result.records.length===50);
      }
    } catch (e) { if(current())setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (decision && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [decision]);
  async function connect() {
    setBusy(true); setError('');
    try {
      const result = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', input: { connectionId } }) });
      window.location.assign(result.authorizationUrl);
    } catch (e) { setError(e.message); setBusy(false); }
  }
  async function refresh() {
    setError(''); setBusy(true);
    try { await refreshViews(true); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function toggle(record) {
    setSelection(previous => previous.some(item => item.id === record.id)
      ? previous.filter(item => item.id !== record.id) : previous.length>=ZOHO_POLICY.maxApprovalBatch?previous:[...previous, { id: record.id, revision: record.revision, sourceHash: record.source_hash, configRevision: record.config_revision, targetId: record.target_id }]);
  }
  async function reviewCandidate(record) {
    const generation = requestGeneration.current;
    const sequence = (candidateRequests.current.get(record.id) || 0) + 1;
    candidateRequests.current.set(record.id, sequence);
    const current = () => generation === requestGeneration.current && activeConnection.current === connectionId && candidateRequests.current.get(record.id) === sequence;
    setReviewing(previous => ({ ...previous, [record.id]: true })); setError('');
    try {
      const { review } = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action: 'review_candidate', input: { connectionId, recordId: record.id, revision: record.revision,
          sourceHash: record.source_hash, configRevision: record.config_revision, targetId: record.target_id },
      }) });
      if (!current()) return;
      setCandidateReviews(previous => ({ ...previous, [record.id]: review }));
      // A new canonical snapshot always needs an explicit human acknowledgement.
      setSelection(previous => previous.map(item => item.id === record.id ? { ...item, candidateReviewHash: undefined } : item));
    } catch (e) { if (current()) setError(e.message); }
    finally { if (current()) setReviewing(previous => ({ ...previous, [record.id]: false })); }
  }
  function acknowledgeCandidate(record, review) {
    if (!candidateApprovalReady(record, review, review?.reviewHash)) return;
    if(selection.length>=ZOHO_POLICY.maxApprovalBatch&&!selection.some(item=>item.id===record.id)){setError('Select at most 50 records per decision.');return;}
    setSelection(previous => [...previous.filter(item => item.id !== record.id), { id: record.id, revision: record.revision,
      sourceHash: record.source_hash, configRevision: record.config_revision, targetId: record.target_id,
      candidateReviewHash: review.reviewHash }]);
  }
  function closeDecision() { dialog.current?.close(); setDecision(null); setReason('');setDecisionError(''); }
  async function submitDecision() {
    if (!decision || !connectionId) return;
    if(!selection.length){setDecisionError('The selection changed. Close this dialog and select current records before confirming.');return;}
    if(selection.length>ZOHO_POLICY.maxApprovalBatch){setDecisionError('Select at most 50 records per decision.');return;}
    if (decision === 'approve' && !canApprove) { setError('Refresh and acknowledge every candidate review before approval.'); return; }
    setBusy(true); setError('');setDecisionError('');
    const command = { connectionId, items: selection, decision, reason };
    const fingerprint = JSON.stringify(command);
    if (decisionAttempt.current?.fingerprint !== fingerprint) decisionAttempt.current = { fingerprint, requestId: crypto.randomUUID() };
    const input = { ...command, requestId: decisionAttempt.current.requestId };
    try {
      const { result } = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decide', input }) });
      decisionAttempt.current = null;
      closeDecision();
      if (decision === 'approve') setPendingHistoryConnection(connectionId);
      setNotice(result.replayed ? 'Original decision recovered. No new action was applied. Check execution history for the current outcome.' : result.decision === 'approve'
        ? `${result.count} record(s) approved. ${result.delivery === 'pending' ? 'Queue delivery is pending automatic recovery.' : 'Execution is queued.'} Creation is reported separately. No email will be sent.`
        : `${result.count} record(s) ${result.decision === 'hold' ? 'put on hold' : 'rejected'}.`);
      try{await refreshViews();}catch(error){setError(`Decision recorded. Refreshing the view failed: ${error.message}`);}
    } catch (e) { setDecisionError(e.message); }
    finally { setBusy(false); }
  }
  async function configure(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result=await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'configure', input: configuration }) });
      setConfiguration(initialConnection); setShowSetup(false);
      setNotice('Source registered. It remains disconnected until authenticated Zoho access is configured. No records were imported.');
      await loadSummary();
      if(result.result?.id||result.result?.connectionId)selectSource(result.result.id||result.result.connectionId);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const sourceCounts = snapshot?.countsByConnection?.[connectionId] || {};
  const pending = sourceCounts.pending_approval || 0;
  const counts = [
    ['Awaiting approval', pending], ['Approved', sourceCounts.approved || 0],
    ['Completed', sourceCounts.completed || 0], ['Staged exceptions', (sourceCounts.held || 0) + (sourceCounts.failed || 0) + (sourceCounts.reconciliation_required || 0)],
  ];
  const canApprove = snapshot?.capabilities?.execution?.ready && snapshot.capabilities.execution.modules.includes(module) && selection.length > 0 && selection.length<=ZOHO_POLICY.maxApprovalBatch && connection?.status === 'connected' &&
    selection.every(selected => {
      const record = records.find(row => row.id === selected.id);
      return record?.validation_errors?.length === 0 && (module !== 'Candidates' ||
        candidateApprovalReady(record, candidateReviews[record.id], selected.candidateReviewHash));
    });

  return (
    <div className="mx-auto min-w-0 max-w-[1440px] space-y-7 pb-12">
      <Link href="/integrations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Integrations</Link>
      <header className="flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recruiting operations</p>
          <h1 className="text-3xl font-semibold tracking-tight">Zoho Recruit</h1>
          <p className="max-w-xl text-sm text-muted-foreground">Review first. Create only what you approve. Keep every source record accountable.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium"><LockKeyhole size={13} /> Email prohibited</span>
          <Button variant="outline" onClick={refresh} disabled={busy || loading}><RefreshCw size={14} className={busy ? 'mr-2 animate-spin' : 'mr-2'} /> Refresh status</Button>
        </div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-border bg-muted/40 p-4 text-sm">{notice}</div>}
      {loading ? <p role="status" className="p-8 text-sm text-muted-foreground">Loading integration state…</p> : snapshot && <>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
          {counts.map(([label, value]) => <div key={label} className="bg-background p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{value.toLocaleString()}</p></div>)}
        </div>
        <section className="rounded-2xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><Database size={19} className="text-muted-foreground" /><div><h2 className="text-sm font-semibold">Source connection</h2><p className="text-xs text-muted-foreground">Credential values are never displayed.</p></div></div>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || !connectionId || !snapshot.capabilities?.oauth} onClick={connect}>{connection?.status === 'connected' ? 'Reconnect Zoho' : 'Connect Zoho'}</Button><Button variant="outline" size="sm" onClick={() => setShowSetup(value => !value)}>{showSetup ? 'Close setup' : 'Register source'}</Button></div>
          </div>
          {!snapshot.capabilities?.oauth && <p className="mt-4 text-xs text-muted-foreground">OAuth requires the server-side Zoho client, callback URL and encryption key. Connection remains disabled until configured.</p>}
          {snapshot.connections.length > 0 ? <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="min-w-0 text-xs font-medium">Source<select aria-label="Source connection" value={connectionId} onChange={e => selectSource(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-2.5 text-sm">{snapshot.connections.map(row => <option key={row.id} value={row.id}>{row.name} · {row.region.toUpperCase()}</option>)}</select></label>
            <div><p className="text-xs font-medium">Connection state</p><p className="mt-3 text-sm">{connection?.status?.replaceAll('_', ' ') || 'Unknown'}</p></div>
            <div><p className="text-xs font-medium">Last discovery</p><p className="mt-3 text-sm">{connection?.lastDiscoveredAt ? new Date(connection.lastDiscoveredAt).toLocaleString() : 'No completed discovery'}</p></div>
          </div> : <p className="mt-5 text-sm text-muted-foreground">No source registered. Add your organization details to begin setup.</p>}
          {showSetup && <form onSubmit={configure} className="mt-5 grid gap-4 border-t border-border pt-5 md:grid-cols-2">
            {[['name', 'Connection name'], ['sourceOrgId', 'Zoho organization ID'], ['publisherOrganizationId', 'Platform publishing organization UUID']].map(([key, label]) => <label key={key} className="text-xs font-medium">{label}<input required value={configuration[key]} onChange={e => setConfiguration(value => ({ ...value, [key]: e.target.value }))} className="mt-2 block w-full rounded-lg border border-border bg-background p-2.5 text-sm" /></label>)}
            <label className="text-xs font-medium">Data center<select value={configuration.region} onChange={e => setConfiguration(value => ({ ...value, region: e.target.value }))} className="mt-2 block w-full rounded-lg border border-border bg-background p-2.5 text-sm">{ZOHO_REGIONS.map(region => <option key={region} value={region}>{region.toUpperCase()}</option>)}</select></label>
            <div className="md:col-span-2"><Button disabled={busy} type="submit">Register disconnected source</Button><p className="mt-2 text-xs text-muted-foreground">Registration does not authorize access, import data, or create accounts.</p></div>
          </form>}
        </section>
        {module === 'Job_Openings' && connectionId && <JobPolicyPanel connectionId={connectionId} onSaved={async () => {
          setNotice('Job publication policy saved. Previous reviews are stale. Run fresh job discovery, inspect the mapped proposal, then approve it.');
          await loadSummary(); await loadRecords(); await loadRuns();
        }} />}
        {connectionId && <SourcePrivacyPanel key={connectionId} connectionId={connectionId} onChanged={refresh} />}
        <section className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div role="tablist" aria-label="Record type" className="flex gap-1" onKeyDown={event=>{
              if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
              const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(tabs.findIndex(tab=>tab.id===module)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
              setModule(tabs[index].id);event.currentTarget.querySelectorAll('[role="tab"]')[index]?.focus();
            }}>{tabs.map(tab => <button key={tab.id} id={`record-tab-${tab.id}`} role="tab" tabIndex={module===tab.id?0:-1} aria-controls={`record-panel-${tab.id}`} aria-selected={module === tab.id} onClick={() => setModule(tab.id)} className={`rounded-lg px-4 py-2 text-sm font-medium ${module === tab.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>{tab.label}</button>)}</div>
            <div className="flex flex-wrap items-center gap-3"><span className="text-xs text-muted-foreground">{selection.length} selected · maximum 50 per decision</span><Button variant="outline" size="sm" disabled={busy || discoveryActive || discoveryPaused || connection?.status !== 'connected' || !snapshot.capabilities?.discovery} onClick={discover}>{discoveryActive ? <><RefreshCw aria-hidden="true" size={14} className="mr-2 animate-spin motion-reduce:animate-none" />Discovering…</> : <>Discover {module === 'Candidates' ? 'candidates' : 'jobs'}</>}</Button></div>
          </div>
          <DiscoveryProgress progress={progress} errorText={progress?.run?.last_error ? discoveryErrors[progress.run.last_error] || 'Discovery needs review.' : ''} updatedAt={historyUpdatedAt} onControl={controlDiscovery} busy={busy} />
          <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
            <label className="min-w-0 flex-1 text-xs font-medium">Search records<input aria-label="Search records" type="search" maxLength={100} value={searchDraft} onChange={event=>setSearchDraft(event.target.value)} placeholder="Name, email, job title or Zoho ID" className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" /></label>
            <label className="text-xs font-medium">Review state<select aria-label="Review state" value={stateFilter} onChange={event=>setStateFilter(event.target.value)} className="mt-1 block rounded-lg border border-border bg-background p-2 text-sm"><option value="">All states</option>{Object.entries(captions).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <p className="text-xs text-muted-foreground" role="status">{recordsLoading?'Loading records…':<>{records.length} displayed{recordTotal!==null?` of ${recordTotal} matching records`:''}</>}</p>
          </div>
          <div id={`record-panel-${module}`} role="tabpanel" aria-labelledby={`record-tab-${module}`} aria-busy={recordsLoading} className="grid min-h-[300px] min-w-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="w-12 px-5 py-4"><span className="sr-only">Select</span></th><th className="py-4">Source record</th><th className="px-3 py-4">Review state</th><th className="px-5 py-4 text-right">Revision</th></tr></thead><tbody>
                {records.map(row => <tr key={row.id} className={`border-b border-border/60 ${detail?.id === row.id ? 'bg-muted/60' : 'hover:bg-muted/30'}`}>
                  <td className="px-5 py-4"><input type="checkbox" aria-label={`Select source ${row.external_id}`} checked={selection.some(item => item.id === row.id)} disabled={busy || (!selection.some(item=>item.id===row.id)&&selection.length>=ZOHO_POLICY.maxApprovalBatch) || !['pending_approval', 'held', 'rejected'].includes(row.decision)} onChange={() => toggle(row)} /></td>
                  <td className="py-4"><button onClick={event => {detailOpener.current=event.currentTarget;setDetail(row);setDetailOpen(true);}} className="text-left font-medium underline-offset-4 hover:underline">{row.proposed_data.name || row.proposed_data.title || row.external_id}</button><p className="mt-1 font-mono text-xs text-muted-foreground">{row.external_id}</p></td>
                  <td className="px-3 py-4"><span className="text-xs">{captions[row.decision] || row.decision}</span>{row.validation_errors.length > 0 && <p className="mt-1 text-xs text-destructive">{row.validation_errors.length} validation issue(s)</p>}</td>
                  <td className="px-5 py-4 text-right font-mono text-xs">v{row.revision}</td>
                </tr>)}
              </tbody></table>
              {hasMore && <div className="p-4 text-center"><Button variant="outline" size="sm" disabled={busy} onClick={loadMore}>Load more records</Button></div>}
              {!recordsLoading && !records.length && <div className="p-10 text-center"><ShieldCheck size={28} className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-medium">{search||stateFilter?'No matching records':`No staged ${module==='Candidates'?'candidates':'job openings'}`}</p><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{search||stateFilter?'Change your search or review-state filter.':'Source discovery will place records here for review. Nothing is created automatically.'}</p></div>}
            </div>
            {detail&&detailOpen&&compact&&<button type="button" tabIndex={-1} aria-label="Close record review backdrop" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={closeDetail}/>}
            <aside ref={detailPanel} tabIndex={-1} onKeyDown={detailKeys} role={compact&&detail&&detailOpen?'dialog':undefined} aria-modal={compact&&detail&&detailOpen?true:undefined} className={`min-w-0 border-t border-border bg-background p-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:border-t-0 ${detail&&(!compact||detailOpen)?'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl shadow-xl lg:inset-auto lg:z-auto lg:rounded-none lg:shadow-none':'hidden lg:block'}`} aria-label="Record review">
              <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Review before approval</h3>{detail&&<button type="button" aria-label="Close record review" onClick={closeDetail} className="rounded p-2 hover:bg-muted"><X size={18}/></button>}</div>
              {detail ? <><p className="mt-4 font-semibold">{detail.proposed_data.name || detail.proposed_data.title}</p><p className="mt-3 break-all text-xs text-muted-foreground">{detail.target_id ? `Existing target: ${detail.target_id}` : 'No target linked. Canonical identity matching still requires review before provisioning.'}</p><dl className="mt-5 space-y-4">{Object.entries(detail.proposed_data).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{key.replaceAll('_', ' ')}</dt><dd className="mt-1 break-words text-sm">{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl>{detail.module === 'Candidates' && <CandidateReview record={detail} review={candidateReviews[detail.id]} loading={Boolean(reviewing[detail.id])}
                acknowledged={selection.find(item => item.id === detail.id)?.candidateReviewHash === candidateReviews[detail.id]?.reviewHash && Boolean(candidateReviews[detail.id])}
                onReview={() => reviewCandidate(detail)} onAcknowledge={() => acknowledgeCandidate(detail, candidateReviews[detail.id])} />}{compact&&detail.module==='Candidates'&&<Button className="mt-4" variant="outline" onClick={()=>{setDetailOpen(false);requestAnimationFrame(()=>{const panel=document.getElementById('zoho-source-operations');panel?.scrollIntoView({behavior:'smooth',block:'start'});panel?.querySelector('textarea')?.focus({preventScroll:true});});}}>Go to candidate administration</Button>}
              {detail.validation_errors.length > 0 && <ul className="mt-5 list-inside list-disc space-y-2 text-xs text-destructive">{detail.validation_errors.map(message => <li key={message}>{message}</li>)}</ul>}</> : <p className="mt-4 text-sm leading-6 text-muted-foreground">Choose a record to inspect its source details and validation findings. Approval applies only to selected records and revisions.</p>}
              <p className="mt-7 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">New learners receive Discover. Existing access is preserved. No invitation, password, verification or job email is sent.</p>
            </aside>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4">
            <p className="max-w-lg text-xs text-muted-foreground">{snapshot.capabilities?.execution?.ready ? 'Approvals are recorded atomically. Completed creation is reported separately.' : 'Account/job creation remains disabled until the silent approval executor is deployed and verified. Review, hold and reject are available.'}</p>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || !selection.length} onClick={() => setDecision('hold')}>Hold</Button><Button variant="outline" size="sm" disabled={busy || !selection.length} onClick={() => setDecision('reject')}>Reject</Button><Button size="sm" disabled={busy || !canApprove} onClick={() => setDecision('approve')}><Check size={14} className="mr-2" /> Approve selection</Button></div>
            {selection.length>0&&!canApprove&&<p className="w-full text-xs text-muted-foreground">Approval requires a connected source, no validation issues, and an acknowledged current account check for each selected candidate. Maximum 50 records per decision.</p>}
          </div>
        </section>
        <div id="zoho-source-operations"><OperationsPanel connectionId={connectionId} module={module} record={detail} onChanged={()=>refreshViews(true)} /></div>
      <section className="rounded-2xl border border-border bg-background p-5"><h2 className="text-sm font-semibold">Discovery history</h2><p className="mt-1 text-xs text-muted-foreground">Discovery covers saved records only; drafts are excluded. Destination creation requires a separate reviewed approval.</p>{!runs.length ? <p className="mt-5 text-sm text-muted-foreground">No discovery runs recorded.</p> : <div className="mt-4 space-y-3">{runs.map(run => <div key={run.id} className="flex flex-wrap justify-between gap-3 border-t border-border pt-3 text-sm"><div><p className="font-medium">{run.module === 'Candidates' ? 'Candidates' : 'Job openings'} · {run.state.replaceAll('_', ' ')}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{run.id}</p></div><div className="text-right text-xs text-muted-foreground"><p>{run.received_count} received · {run.staged_count} staged · {run.deferred_count ?? 0} deferred at discovery</p><p className="mt-1">{run.failure_count ?? 0}/8 discovery failures · saved records</p><p className="mt-1">{run.modified_since ? 'Incremental scan' : 'Full reconciliation'} · next page {run.next_page}{run.scan_had_exceptions ? ' · earlier exceptions retained' : ''}</p><p className="mt-1">{new Date(run.created_at).toLocaleString()}</p>{run.last_error && <p className="mt-1 text-destructive">{discoveryErrors[run.last_error] || 'Discovery needs review.'}{run.state === 'failed' && ' Run stopped.'}</p>}</div></div>)}</div>}{historyErrors.runs&&<p role="alert" className="mt-3 text-xs text-destructive">{historyErrors.runs}</p>}{historyMore.runs&&<Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={()=>moreHistory('runs')}>Load older discovery runs</Button>}</section>
        <section className="rounded-2xl border border-border bg-background p-5" aria-label="Deferred source changes">
          <h2 className="text-sm font-semibold">Deferred source changes</h2>
          <p className="mt-1 text-xs text-muted-foreground">Unresolved source changes, newest first. Load older changes below. Recovered changes still require approval.</p>
          {!deferred.length ? <p className="mt-5 text-sm text-muted-foreground">No deferred source changes.</p> : <div className="mt-4 space-y-3">{deferred.map(item => <div key={item.id} className="border-t border-border pt-3 text-sm">
            <p className="font-medium">{item.module === 'Candidates' ? 'Candidate' : 'Job opening'} · {item.external_id}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.state === 'waiting_execution' ? 'Waiting for the current execution to be reconciled. Retained changes can then return to review.' : item.reason === 'REFETCH_REQUIRED' ? 'A fresh source read is required before review.' : 'Source validation needs correction and a fresh discovery.'}</p>
          </div>)}</div>}
          {historyErrors.deferred&&<p role="alert" className="mt-3 text-xs text-destructive">{historyErrors.deferred}</p>}{historyMore.deferred&&<Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={()=>moreHistory('deferred')}>Load older deferred changes</Button>}
        </section>
        <section className="rounded-2xl border border-border bg-background p-5" aria-label="Approved execution history">
          <h2 className="text-sm font-semibold">Approved execution history</h2>
          <p className="mt-1 text-xs text-muted-foreground">Approved operations for this source, newest first. Load older operations below. Completion requires a confirmed destination receipt.</p>
          {!executions.length ? <p className="mt-5 text-sm text-muted-foreground">No approved execution recorded.</p> : <div className="mt-4 space-y-3">{executions.map(item => {
            const unresolved = item.state === 'processing' && (item.last_error === 'OUTCOME_UNKNOWN' || new Date(item.lease_expires_at).getTime() <= Date.now());
            return <div key={item.id} className="flex flex-wrap justify-between gap-3 border-t border-border pt-3 text-sm">
              <div><p className="font-medium">{item.zoho_staged_records.module === 'Candidates' ? 'Candidate' : 'Job opening'} · {item.zoho_staged_records.external_id}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.id}</p></div>
              <div className="text-right text-xs text-muted-foreground"><p>{unresolved ? 'Awaiting receipt reconciliation' : item.state.replaceAll('_', ' ')}</p><p className="mt-1">Attempt {item.execution_attempts} of 8 · reviewed revision {item.record_revision}</p>
                {item.state === 'failed' && <p className="mt-1 text-destructive">{item.execution_attempts >= 8 ? 'Retry limit reached. Operator review required.' : `Retry eligible after ${new Date(item.next_attempt_at).toLocaleString()}.`}</p>}
                {unresolved && <p className="mt-1 text-destructive">Outcome is unconfirmed. No automatic repeat write.</p>}
                {item.state === 'approval_stale' && item.last_error === 'JOB_REVIEW_REQUIRED' && <p className="mt-1 text-muted-foreground">No job change was applied. Refresh records, resolve the job policy, ownership or quota issue, then review and approve again.</p>}
              </div>
            </div>;
          })}</div>}
          {historyErrors.executions&&<p role="alert" className="mt-3 text-xs text-destructive">{historyErrors.executions}</p>}{historyMore.executions&&<Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={()=>moreHistory('executions')}>Load older executions</Button>}
        </section>
      </>}
      <dialog ref={dialog} aria-labelledby="decision-title" aria-describedby="decision-description" onCancel={event=>{if(busy)event.preventDefault();else closeDecision();}} className="w-[min(92vw,520px)] rounded-2xl border border-border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50">
        <div className="flex justify-between gap-4"><h2 id="decision-title" className="text-lg font-semibold">{decision === 'approve' ? 'Approve reviewed records' : decision === 'hold' ? 'Hold selection' : 'Reject selection'}</h2><button aria-label="Close confirmation" disabled={busy} onClick={closeDecision}><X size={18} /></button></div>
        <p id="decision-description" className="mt-3 text-sm text-muted-foreground">{selection.length} selected record(s). Changed revisions require a fresh review. Email is permanently prohibited.</p>
        {decisionError&&<p role="alert" className="mt-3 text-sm text-destructive">{decisionError}</p>}
        <label className="mt-5 block text-sm font-medium">Decision reason<textarea minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm" /></label>
        <div className="mt-5 flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={closeDecision}>Cancel</Button><Button disabled={busy || !selection.length || reason.trim().length < 3 || (decision === 'approve' && !canApprove)} onClick={submitDecision}>{busy ? 'Recording…' : 'Confirm decision'}</Button></div>
      </dialog>
    </div>
  );
}
