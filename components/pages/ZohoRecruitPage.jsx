'use client';
import { jobSelectionIssues } from '@/lib/zoho/job-approval';
import JobDescription from '@/components/zoho/JobDescription';
import { browserResponse } from '@/lib/zoho/browser-response';
import ExecutionRecovery from '@/components/zoho/ExecutionRecovery';
import { executionRecoveryStatus } from '@/lib/zoho/execution-recovery-status';
import OperationsPanel from '@/components/zoho/OperationsPanel';
import styles from '@/components/zoho/ZohoRecruitPage.module.css';
import SyncSettings from '@/components/zoho/SyncSettings';
import SourceSelector from '@/components/zoho/SourceSelector';
import ZohoSelect from '@/components/zoho/ZohoSelect';
import DiscoveryProgress from '@/components/zoho/DiscoveryProgress';
import DiscoveryActions from '@/components/zoho/DiscoveryActions';
import { discoveryProgress, discoveryTiming, discoveryPollDelay, discoveryErrorText } from '@/lib/zoho/discovery-progress';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Database, FileCheck2, ListChecks, LockKeyhole, RefreshCw, Settings2, ShieldCheck, UsersRound, X, AlertTriangle, Home, BriefcaseBusiness, History, Layers, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JobPolicyPanel from '@/components/zoho/JobPolicyPanel';
import CandidateReview from '@/components/zoho/CandidateReview';
import BulkCandidateApproval from '@/components/zoho/BulkCandidateApproval';
import SourcePrivacyPanel from '@/components/zoho/SourcePrivacyPanel';
import { candidateApprovalReady, selectionApprovalIssue, candidateReviewUnavailable, repeatedCandidateName } from '@/lib/zoho/candidate-review-selection';
import { ZOHO_REGIONS, ZOHO_POLICY } from '@/lib/zoho/contracts';

const API = '/api/integrations/zoho-recruit';
const tabs = [{ id: 'Candidates', label: 'Candidates' }, { id: 'Job_Openings', label: 'Job openings' }];
const sections = [
  { id:'overview', label:'Overview', Icon:Home },
  { id:'Candidates', label:'Candidates', Icon:UsersRound },
  { id:'Job_Openings', label:'Job openings', Icon:BriefcaseBusiness },
  { id:'approvals', label:'Approvals', Icon:ListChecks },
  { id:'history', label:'Discovery history', Icon:History },
  { id:'advanced', label:'Advanced', Icon:Layers },
];
const captions = {
  pending_approval: 'Awaiting review', held: 'On hold', rejected: 'Rejected', approved: 'Approved · queued',
  approval_stale: 'Review again', processing: 'Processing', completed: 'Completed', failed: 'Failed',
};
const initialConnection = { name: '', sourceOrgId: '', region: 'in', publisherOrganizationId: '' };
async function api(path = '', options) {
  const response = await fetch(`${API}${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
  const result = await browserResponse(response);
  if (!response.ok) throw Object.assign(new Error(result.error || 'The integration request failed.'), {status:response.status,code:result.code});
  return result;
}

export default function ZohoRecruitPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [connectionId, setConnectionId] = useState('');
  const [module, setModule] = useState('Candidates');
  const [activeSection, setActiveSection] = useState('overview');
  const recordSection = tabs.some(tab => tab.id === activeSection);
  const [records, setRecords] = useState([]);
  const [runs, setRuns] = useState([]);
  const [liveDiscovery, setLiveDiscovery] = useState(null);
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
  const detailPanel=useRef(null),detailOpener=useRef(null),pageRoot=useRef(null),sectionFocus=useRef(null),workspaceRoot=useRef(null);
  const [selection, setSelection] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailOpen,setDetailOpen]=useState(false);
  const [profileTab,setProfileTab]=useState('profile');
  useEffect(()=>setProfileTab('profile'),[detail?.id]);
  const [jobPolicy, setJobPolicy] = useState(null);
  const [jobPolicyError, setJobPolicyError] = useState('');
  const [jobPolicyVersion, setJobPolicyVersion] = useState(0);
  const [candidateReviews, setCandidateReviews] = useState({});
  const [candidateAcknowledgements, setCandidateAcknowledgements] = useState({});
  const [reviewNow, setReviewNow] = useState(() => Date.now());
  const [reviewing, setReviewing] = useState({});
  const [reviewErrors, setReviewErrors] = useState({});
  const [reviewFocus, setReviewFocus] = useState(0);
  const candidateRequests = useRef(new Map());
  const [decision, setDecision] = useState(null);
  const [decisionContext,setDecisionContext]=useState(null);
  const decisionTrigger=useRef(null);
  const [reason, setReason] = useState('');
  const [configuration, setConfiguration] = useState(initialConnection);
  const [showSetup, setShowSetup] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [operationsVisited, setOperationsVisited] = useState(false);
  const [pollFailures, setPollFailures] = useState(0);
  const recordWindow = useRef(null);
  const [settingsRefreshVersion, setSettingsRefreshVersion] = useState(0);
  const [settingsRefreshing, setSettingsRefreshing] = useState(false);
  const [settingsRefreshError, setSettingsRefreshError] = useState('');
  const settingsRefreshRequest = useRef(0);
  const settingsDialog = useRef(null), settingsTrigger = useRef(null);
  useEffect(() => {
    if (settingsOpen) settingsDialog.current?.showModal();
    else if (settingsDialog.current?.open) settingsDialog.current.close();
  }, [settingsOpen]);
  useEffect(() => {
    if (!settingsOpen && !(compact && detailOpen)) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [settingsOpen, compact, detailOpen]);
  async function refreshSettings() {
    const request = ++settingsRefreshRequest.current;
    setSettingsRefreshVersion(value => value + 1);
    setSettingsRefreshing(true); setSettingsRefreshError('');
    try { await loadSummary(); }
    catch (error) { if (request === settingsRefreshRequest.current) setSettingsRefreshError(`Settings refresh failed: ${error.message}`); }
    finally { if (request === settingsRefreshRequest.current) setSettingsRefreshing(false); }
  }
  function activateSection(id, focusPanel = false) {
    sectionFocus.current = focusPanel ? id : null;
    setActiveSection(id);
    if (id === 'advanced') setOperationsVisited(true);
    if (tabs.some(tab => tab.id === id)) setModule(id);
    if (id !== activeSection) {
      detailOpener.current = null;
      setDetailOpen(false);
    }
  }
  useEffect(() => {
    if (loading || sectionFocus.current !== activeSection) return;
    const panel = document.getElementById(`zoho-panel-${activeSection}`);
    if (panel && !panel.hidden) panel.focus({preventScroll:true});
    sectionFocus.current = null;
  }, [activeSection, loading]);
  useEffect(() => {
    const tab = document.getElementById(`zoho-tab-${activeSection}`);
    const nav = tab?.parentElement;
    if (!nav) return;
    const reveal = () => {
      const item = tab.getBoundingClientRect(), row = nav.getBoundingClientRect();
      // Reveal the active tab horizontally without moving the page vertically.
      if (item.left < row.left) nav.scrollLeft += item.left - row.left;
      else if (item.right > row.right) nav.scrollLeft += item.right - row.right;
    };
    reveal();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeSection, loading]);
  function goToDiscovery() {
    setSettingsOpen(false);
    activateSection(module);
    requestAnimationFrame(() => {
      const action = document.getElementById('zoho-discovery-action');
      action?.focus({preventScroll:true});
    });
  }
  const dialog = useRef(null);
  const requestGeneration = useRef(0);
  const recordRead = useRef(0);
  const historyGeneration = useRef(0);
  const activeConnection = useRef(connectionId);
  activeConnection.current = connectionId;
  const loadedRecordCount = useRef(records.length);
  loadedRecordCount.current = records.length;
  const backgroundPoll = useRef(false);
  const visibleSection = useRef(activeSection);
  visibleSection.current = activeSection;
  const historyActivity = useRef(null);

  const historyReadAt = useRef({});
  const decisionAttempt = useRef(null);
  const connection = snapshot?.connections?.find(item => item.id === connectionId);
  useEffect(() => {
    const controller = new AbortController();
    setJobPolicy(null);setJobPolicyError('');
    if (module !== 'Job_Openings' || !connectionId || connection?.status !== 'connected') return;
    api(`?${new URLSearchParams({view:'job_policy',connectionId})}`, {signal:controller.signal})
      .then(result => {if (!controller.signal.aborted) setJobPolicy(result.policy);})
      .catch(error => {if (!controller.signal.aborted) setJobPolicyError(error.message);});
    return () => controller.abort();
  }, [module, connectionId, connection?.configRevision, connection?.status, jobPolicyVersion]);

  const statusRuns = liveDiscovery?.connectionId === connectionId ? liveDiscovery.latestRuns : runs;
  const captures = liveDiscovery?.connectionId === connectionId ? liveDiscovery.captures : undefined;
  historyActivity.current = { executions, deferred, pendingHistoryConnection, runs: statusRuns };
  const progress = discoveryProgress(statusRuns, discoveryRequest, connectionId, module);
  const discoveryActive = Boolean(progress?.active);
  const discoveryPaused=progress?.phase==='paused';
  const sourceDiscoveries = tabs.map(tab => ({...tab, progress:discoveryProgress(statusRuns, discoveryRequest, connectionId, tab.id)}))
    .filter(item => item.progress?.active || item.progress?.phase === 'paused');
  const sourceActivity = sourceDiscoveries.map(item => `${item.label}: ${discoveryTiming(item.progress).waiting?'Waiting to retry':item.progress.active?'Discovery in progress':'Discovery paused'}`).join(' · ');
  useEffect(()=>{setReviewErrors({});},[connectionId,connection?.status,connection?.configRevision]);
  // Re-render at the next expiry even when discovery/execution polling is idle.
  useEffect(() => {
    const expiries = Object.values(candidateReviews).map(review => Date.parse(review.expiresAt))
      .filter(value => Number.isFinite(value) && value > reviewNow);
    if (!expiries.length) return;
    const timer = setTimeout(() => setReviewNow(Date.now()), Math.max(0, Math.min(...expiries) - Date.now()) + 1);
    return () => clearTimeout(timer);
  }, [candidateReviews, reviewNow]);
  useEffect(() => {
    const update = () => setReviewNow(Date.now());
    window.addEventListener('focus', update); document.addEventListener('visibilitychange', update);
    return () => { window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
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
  useEffect(() => {
    const header = document.querySelector('[data-dashboard-topbar]');
    if (!header) return;
    const measure = () => pageRoot.current?.style.setProperty('--zoho-review-top', `${Math.ceil(header.getBoundingClientRect().height) + 16}px`);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (loading || !recordSection || compact) return;
    const workspace = workspaceRoot.current;
    const card = workspace?.querySelector('#zoho-record-workspace');
    if (!card) return;
    const controls = [...card.children].filter(element => !element.classList.contains(styles.recordsPanel));
    const measure = () => {
      // Leave room for the table header and rows when controls wrap or warnings expand.
      const controlsHeight = controls.reduce((height, element) => height + element.getBoundingClientRect().height, 0);
      workspace.style.setProperty('--zoho-workspace-min-height', `${Math.max(480, Math.ceil(controlsHeight + 162))}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    controls.forEach(element => observer?.observe(element));
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [loading, recordSection, compact, selection.length]);
  useEffect(() => {
    if (!compact || !detailOpen || !detail?.id) return;
    // Keep the page and shared navigation out of the modal's focus/accessibility tree.
    // Native confirmation dialogs remain available above the review drawer.
    const blocked = [];
    for (let branch = detailPanel.current; branch?.parentElement && branch !== document.body; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || sibling.matches('dialog, [data-review-backdrop]')) continue;
        blocked.push([sibling, sibling.getAttribute('inert')]);
        sibling.setAttribute('inert', '');
      }
    }
    return () => {
      for (const [element, previous] of blocked) {
        if (previous === null) element.removeAttribute('inert');
        else element.setAttribute('inert', previous);
      }
    };
  }, [compact, detailOpen, detail?.id]);
  useEffect(()=>{
    if(detail?.id&&detailOpen){
      detailPanel.current.scrollTop=0;
      detailPanel.current.focus({preventScroll:true});
    }
    else detailOpener.current?.focus({preventScroll:true});
  },[detail?.id,compact,detailOpen,reviewFocus]);
  function closeDetail(){setDetailOpen(false);if(!compact)setDetail(null);}
  function openRecord(record, opener) {
    if (activeSection !== record.module) activateSection(record.module);
    detailOpener.current = opener; setDetail(record); setDetailOpen(true);
    setReviewFocus(value => value + 1);
  }
  function detailKeys(event){
    if(!compact)return;
    if(event.key==='Escape'){event.preventDefault();closeDetail();}
    if(event.key==='Tab'){
      const items=[...detailPanel.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')]
        .filter(item => item.tabIndex >= 0 && !item.closest('[hidden], [inert]'));
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
      : new URL(window.location.href).searchParams.get('reason') === 'consent_denied'
      ? 'Zoho authorization was cancelled. The existing source connection was not changed.'
      : new URL(window.location.href).searchParams.get('reason') === 'authority_unavailable'
      ? 'Administrator verification is temporarily unavailable. Your source connection was not changed. Retry connecting when the service recovers.'
      : new URL(window.location.href).searchParams.get('reason') === 'session_expired'
      ? 'Your administrator session expired during Zoho authorization. Sign in again if needed, then reconnect Zoho.'
      : new URL(window.location.href).searchParams.get('reason') === 'administrator_required'
      ? 'An active platform super administrator is required to connect Zoho.'
      : 'Zoho authorization could not be verified. Check the registered organization, data center and server configuration.');
    if (outcome === 'verified') setNotice('Zoho organization verified. No accounts or jobs were created and no email was sent.');
    return () => { active = false; };
  }, [loadSummary]);
  const loadRecords = useCallback(async ({ background = false } = {}) => {
    const generation = background ? requestGeneration.current : ++requestGeneration.current;
    const read=++recordRead.current;
    const current=()=>generation===requestGeneration.current&&read===recordRead.current&&activeConnection.current===connectionId;
    if (!background) {
      recordWindow.current = null;
      setSelection([]); setRecords([]); setDetail(null); setCandidateReviews({}); setCandidateAcknowledgements({}); setReviewing({}); setReviewErrors({}); candidateRequests.current.clear();
      setDetailOpen(false);setRecordTotal(null);setRecordsLoading(Boolean(connectionId));
    }
    if (!connectionId) return;
    const params = new URLSearchParams({ view: 'records', connectionId, module });
    if(search)params.set('search',search);if(stateFilter)params.set('state',stateFilter);
    let result;
    try{
      if(background){
        params.set('view','record_window');params.set('limit',String(Math.max(50,loadedRecordCount.current)));
        if(recordWindow.current)params.set('fingerprint',recordWindow.current);
        result=await api(`?${params}`);
        if(!current())return;
        recordWindow.current=result.fingerprint||null;
        if(result.unchanged){setRecordTotal(result.total??null);setHasMore(result.total!=null?loadedRecordCount.current<result.total:false);return;}
      }else result=await api(`?${params}`);
      const fresh=new Map(result.records.map(row=>[row.id,row]));
      result.records=[...fresh.values()];
      result.hasMore=result.total!=null?fresh.size<result.total:result.records.length===50;
    }catch(error){if(current())throw error;return;}
    finally{if(current())setRecordsLoading(false);}
    if (current()) {
      setRecordTotal(result.total??null);
      if (background) {
        const fresh = new Map(result.records.map(row => [row.id, row]));
        setRecords(result.records);setHasMore(result.hasMore);
        const unchanged = item => {
          const row = fresh.get(item.id || item.recordId);
          return row && !row.payload_redacted_at && !row.suppressed && ['pending_approval', 'held', 'rejected'].includes(row.decision) &&
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
  const loadRuns = useCallback(async ({ kinds = ['runs', 'executions', 'deferred'] } = {}) => {
    const generation = ++historyGeneration.current;
    if (!connectionId) { setRuns([]); setExecutions([]); setDeferred([]); return; }
    try {
      const results=await Promise.allSettled(kinds.map(async kind=>{
        try{
          const result=await api(`?view=${kind}&connectionId=${encodeURIComponent(connectionId)}${kind === 'runs' ? '&live=1' : ''}`);
          if(generation!==historyGeneration.current||activeConnection.current!==connectionId)return;
          historyReadAt.current[`${connectionId}:${kind}`] = Date.now();
          const items=result[kind];
          const limit=kind==='deferred'?50:20;
          const timestamp=kind==='deferred'?'updated_at':'created_at';
          const boundary=items.at(-1);
          // Only retain older loaded pages. Rows removed from the refreshed
          // window (for example resolved deferred changes) must disappear.
          const merge=previous=>items.length<limit?items:[...items,...previous.filter(item=>
            !items.some(fresh=>fresh.id===item.id)&&(item[timestamp]<boundary[timestamp]||
              (item[timestamp]===boundary[timestamp]&&item.id<boundary.id)))];
          if(kind==='runs'){setRuns(merge);if(result.latestRuns)setLiveDiscovery({connectionId,latestRuns:result.latestRuns,captures:result.captures || []});setHistoryUpdatedAt(Date.now());}
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
    await loadSummary(); // An authority outage needs one request, not a fan-out of failures.
    const results = await Promise.allSettled([loadRecords({ background }), loadRuns()]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }, [loadSummary, loadRecords, loadRuns]);
  const pollViews = useCallback(async () => {
    await loadSummary(); // Live authority still gates all reads in this tick.
    if (activeConnection.current !== connectionId) return;
    const section = visibleSection.current, activity = historyActivity.current;
    const kinds = ['runs']; // Discovery progress is shared by the page header.
    const pendingExecution = activity.pendingHistoryConnection === connectionId || activity.executions.some(item =>
      ['queued', 'processing'].includes(item.state) || item.state === 'failed' && item.execution_attempts < 8);
    const pendingDeferred = activity.deferred.some(item => item.state === 'waiting_execution');
    // Fast discovery ticks must not also fetch secondary histories every three seconds.
    // Without active discovery the existing fifteen-second tick already bounds these reads.
    const fastDiscovery = activity.runs.some(run => ['queued','running'].includes(run.state) && run.control_state !== 'paused');
    const due = kind => !fastDiscovery || Date.now() - (historyReadAt.current[`${connectionId}:${kind}`] || 0) >= 15000;
    if ((section === 'approvals' || pendingExecution) && due('executions')) kinds.push('executions');
    if ((section === 'advanced' || pendingDeferred) && due('deferred')) kinds.push('deferred');
    const requests = [loadRuns({ kinds })];
    if (tabs.some(tab => tab.id === section)) requests.push(loadRecords({ background: true }));
    const results = await Promise.allSettled(requests);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }, [connectionId, loadSummary, loadRecords, loadRuns]);
  const previousSection = useRef(activeSection);
  const previousModule = useRef(module);
  useEffect(() => {
    const previous = previousSection.current;
    previousSection.current = activeSection;
    const moduleChanged = previousModule.current !== module;
    previousModule.current = module;
    if (previous === activeSection) return;
    if (tabs.some(tab => tab.id === activeSection)) {
      // A module change already triggers the initial record load. Returning from
      // another section revalidates the cached window before it can be approved.
      if (!moduleChanged && !tabs.some(tab => tab.id === previous)) loadRecords({ background: true }).catch(e => setError(e.message));
    } else {
      const kind = { approvals: 'executions', history: 'runs', advanced: 'deferred' }[activeSection];
      if (kind) loadRuns({ kinds: [kind] }).catch(e => setError(e.message));
    }
  }, [activeSection, module, loadRecords, loadRuns]);
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
  const sourceCounts = snapshot?.countsByConnection?.[connectionId] || {};
  const sourceExecutionPending = ['approved', 'processing', 'reconciliation_required'].some(state => sourceCounts[state] > 0);
  const pollNeeded = sourceExecutionPending || discoveryActive || pendingHistoryConnection===connectionId && Boolean(connectionId) ||
    deferred.some(item=>item.state==='waiting_execution') ||
    statusRuns.some(run=>['queued','running'].includes(run.state)&&run.control_state!=='paused') ||
    executions.some(item=>['queued','processing'].includes(item.state)||(item.state==='failed'&&item.execution_attempts<8));
  const activeDiscoveries = sourceDiscoveries.filter(item => item.progress.active);
  const pollDelay = Math.min(...(activeDiscoveries.length ? activeDiscoveries.map(item => item.progress) : [progress])
    .map(item => discoveryPollDelay(item,pollFailures)));
  useEffect(()=>setPollFailures(0),[connectionId]);
  useEffect(() => {
    if (!connectionId) return;
    let cancelled = false, idleTimer;
    const idleDelay = Math.min(120000, 45000 * 2 ** Math.min(pollFailures, 2));
    const tick = async () => {
      if (cancelled) return;
      if (!document.hidden && !backgroundPoll.current) {
        backgroundPoll.current = true;
        try { await pollViews(); if (!cancelled) setPollFailures(0); }
        catch (e) { if (!cancelled && activeConnection.current === connectionId) { setError(e.message); setPollFailures(value => value + 1); } }
        finally { backgroundPoll.current = false; }
      }
      if (!pollNeeded && !cancelled) idleTimer = setTimeout(tick, idleDelay);
    };
    const timer = pollNeeded ? setInterval(tick, pollDelay) : null;
    if (!pollNeeded) idleTimer = setTimeout(tick, idleDelay);
    const wake = () => { if (!document.hidden && !backgroundPoll.current) { clearTimeout(idleTimer); void tick(); } };
    window.addEventListener('focus', wake); document.addEventListener('visibilitychange', wake);
    return () => { cancelled = true; clearInterval(timer); clearTimeout(idleTimer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  },[pollNeeded,pollDelay,pollViews,connectionId,pollFailures]);
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
        recordWindow.current=null;
        setRecords(previous=>{const combined=[...new Map([...previous,...result.records].map(row=>[row.id,row])).values()];setHasMore(result.total!=null?combined.length<result.total:result.records.length===50);return combined;});
        setRecordTotal(result.total??null);

      }
    } catch (e) { if(current())setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (decision && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      dialog.current.querySelector('#zoho-decision-reason')?.focus({preventScroll:true});
    }
  }, [decision]);
  async function connect() {
    setBusy(true); setError('');
    try {
      const result = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', input: { connectionId } }) });
      window.location.assign(result.authorizationUrl);
    } catch (e) { setError(e.message); setBusy(false); }
  }
  async function refresh() {
    setJobPolicyVersion(value => value + 1);
    setError(''); setBusy(true);
    try { await refreshViews(true); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function toggle(record) {
    setSelection(previous => previous.some(item => item.id === record.id)
      ? previous.filter(item => item.id !== record.id) : previous.length>=ZOHO_POLICY.maxApprovalBatch?previous:[...previous, { id: record.id, revision: record.revision, sourceHash: record.source_hash, configRevision: record.config_revision, targetId: record.target_id }]);
  }
  async function reviewCandidate(record) {
    if (candidateReviewUnavailable(record, connection)) return;
    const generation = requestGeneration.current;
    const sequence = (candidateRequests.current.get(record.id) || 0) + 1;
    candidateRequests.current.set(record.id, sequence);
    const current = () => generation === requestGeneration.current && activeConnection.current === connectionId && candidateRequests.current.get(record.id) === sequence;
    setCandidateAcknowledgements(previous => {const next={...previous};delete next[record.id];return next;});
    setReviewing(previous => ({ ...previous, [record.id]: true })); setReviewErrors(previous => ({...previous,[record.id]:''})); setError('');
    try {
      const { review } = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action: 'review_candidate', input: { connectionId, recordId: record.id, revision: record.revision,
          sourceHash: record.source_hash, configRevision: record.config_revision, targetId: record.target_id },
      }) });
      if (!current()) return;
      setCandidateReviews(previous => ({ ...previous, [record.id]: review }));
      // A new canonical snapshot always needs an explicit human acknowledgement.
      setSelection(previous => previous.map(item => item.id === record.id ? { ...item, candidateReviewHash: undefined } : item));
    } catch (e) { if (current()) {
      setReviewErrors(previous => ({...previous,[record.id]:e.message}));
      if (e.status === 409 || e.status === 422) {
        setCandidateReviews(previous => {const next={...previous};delete next[record.id];return next;});
        setSelection(previous => previous.map(item => item.id===record.id?{...item,candidateReviewHash:undefined}:item));
        try { await refreshViews(true); } catch { /* Keep the specific account-review error visible. */ }
      }
    } }
    finally { if (current()) setReviewing(previous => ({ ...previous, [record.id]: false })); }
  }
  function acknowledgeCandidate(record, review) {
    if (candidateReviewUnavailable(record, connection)) return;
    if (!candidateApprovalReady(record, review, review?.reviewHash)) return;
    setCandidateAcknowledgements(previous => ({...previous,[record.id]:review.reviewHash}));
    if(selection.length>=ZOHO_POLICY.maxApprovalBatch&&!selection.some(item=>item.id===record.id)){setError('Select at most 50 records per decision.');return;}
    setSelection(previous => [...previous.filter(item => item.id !== record.id), { id: record.id, revision: record.revision,
      sourceHash: record.source_hash, configRevision: record.config_revision, targetId: record.target_id,
      candidateReviewHash: review.reviewHash }]);
  }
  function selectionFingerprint(items) {
    return JSON.stringify(items.map(item=>({id:item.id,revision:item.revision,sourceHash:item.sourceHash,configRevision:item.configRevision,
      targetId:item.targetId,candidateReviewHash:item.candidateReviewHash})).sort((a,b)=>a.id.localeCompare(b.id)));
  }
  function recordDecisionItem(record) {
    return {id:record.id,revision:record.revision,sourceHash:record.source_hash,configRevision:record.config_revision,
      targetId:record.target_id,...(record.module === 'Candidates' ? {candidateReviewHash:candidateAcknowledgements[record.id]} : {})};
  }
  function openDecision(action, record = null) {
    const items = record ? [recordDecisionItem(record)] : selection;
    decisionTrigger.current=document.activeElement;
    setDecisionContext({connectionId,module,scope:record?'record':'selection',requestItems:items,sourceName:connection?.name||'Selected source',fingerprint:selectionFingerprint(items),
      items:items.map(item=>{const row=records.find(record=>record.id===item.id);const review=candidateReviews[item.id];return {...item,
        name:row?.proposed_data?.name||row?.proposed_data?.title||'Selected record',email:row?.proposed_data?.email,
        externalId:row?.external_id,outcome:review?.decision==='create'?'Create learner · Discover (free)':review?.decision==='preserve_existing'?'Preserve existing learner access':module==='Job_Openings'?'Apply reviewed job changes':'Review required'};})});
    setReason('');setDecisionError('');setDecision(action);
  }
  function closeDecision() {
    dialog.current?.close();setDecision(null);setDecisionContext(null);setReason('');setDecisionError('');
    if(decisionTrigger.current?.isConnected&&!decisionTrigger.current.disabled)decisionTrigger.current.focus();
    else document.querySelector('[data-zoho-breadcrumb]')?.focus();
  }
  async function submitDecision() {
    if (!decision || !connectionId) return;
    if(selectionChanged){setDecisionError('The reviewed selection changed. Close this dialog and review the current records before confirming.');return;}
    if(reason.trim().length<3||reason.trim().length>500){setDecisionError('Enter a decision reason between 3 and 500 characters.');return;}
    if(!decisionItems.length){setDecisionError('The selection changed. Close this dialog and select current records before confirming.');return;}
    if(decisionItems.length>ZOHO_POLICY.maxApprovalBatch){setDecisionError('Select at most 50 records per decision.');return;}
    if (decision === 'approve' && !canApproveDecision) { setDecisionError(module === 'Candidates' ? 'Refresh and acknowledge every candidate review before approval.' : 'Resolve the job publication requirements before approval.'); return; }
    setBusy(true); setError('');setDecisionError('');
    const command = { connectionId, items: decisionItems, decision, reason:reason.trim() };
    const fingerprint = JSON.stringify(command);
    const retrying = decisionAttempt.current?.fingerprint === fingerprint;
    try {
      if (decision === 'approve' && module === 'Job_Openings' && !retrying) {
        const fresh = await api(`?${new URLSearchParams({view:'job_policy',connectionId})}`, {signal:AbortSignal.timeout(30000)});
        setJobPolicy(fresh.policy);
        const issues = jobSelectionIssues(decisionItems.map(item => records.find(row => row.id === item.id)),connection,fresh.policy);
        if (issues.length) throw new Error(issues[0].message);
      }
      if (!retrying) decisionAttempt.current = {fingerprint,requestId:crypto.randomUUID()};
      const input = {...command,requestId:decisionAttempt.current.requestId};
      const { result } = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decide', input }) });
      decisionAttempt.current = null;
      if (module === 'Job_Openings') setJobPolicyVersion(value => value + 1);
      closeDecision();
      if (decision === 'approve') setPendingHistoryConnection(connectionId);
      setNotice(result.replayed ? 'Original decision recovered. No new action was applied. Check execution history for the current outcome.' : result.decision === 'approve'
        ? `${result.count} record(s) approved. ${result.delivery === 'pending' ? 'Queue delivery is pending automatic recovery.' : 'Execution is queued.'} Creation is reported separately. No email will be sent.`
        : `${result.count} record(s) ${result.decision === 'hold' ? 'put on hold' : 'rejected'}.`);
      try{await refreshViews(decisionContext?.scope === 'record');}catch(error){setError(`Decision recorded. Refreshing the view failed: ${error.message}`);}
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
  const pending = snapshot?.countsByConnection?.[connectionId]?.pending_approval || 0;
  const moduleCountsAvailable = Boolean(snapshot?.countsByConnectionAndModule);
  const sourceModuleCounts = snapshot?.countsByConnectionAndModule?.[connectionId] || {};
  const overviewGroups = tabs.map(tab => {
    const totals = sourceModuleCounts[tab.id] || {};
    return { ...tab, counts: [
      ['Awaiting approval', moduleCountsAvailable ? totals.pending_approval || 0 : null],
      ['Approved', moduleCountsAvailable ? totals.approved || 0 : null],
      ['Completed', moduleCountsAvailable ? totals.completed || 0 : null],
      ['Needs attention', moduleCountsAvailable ? (totals.held || 0) + (totals.failed || 0) + (totals.reconciliation_required || 0) : null],
    ] };
  });
  const selectedJobIssues = module === 'Job_Openings' ? jobSelectionIssues(selection.map(item => records.find(row => row.id === item.id)),connection,jobPolicy) : [];
  const approvalIssues = selection.map(selected => {
    const record = records.find(row => row.id === selected.id);
    return { id: selected.id, record, message: candidateReviewUnavailable(record, connection) || selectionApprovalIssue(record, selected, candidateReviews[selected.id]) || selectedJobIssues.find(item => item.id === selected.id)?.message };
  }).filter(item => item.message);
  const nextCandidateReview = approvalIssues.find(item => item.record?.module === 'Candidates');
  const executionReady = snapshot?.capabilities?.execution?.ready && snapshot.capabilities.execution.modules.includes(module);
  const canApprove = executionReady && selection.length > 0 && selection.length<=ZOHO_POLICY.maxApprovalBatch &&
    connection?.status === 'connected' && approvalIssues.length === 0;
  const detailItem = detail ? recordDecisionItem(detail) : null;
  const detailApprovalIssue = !detail ? null : busy ? 'An operation is in progress. Wait for it to finish.' :
    candidateReviewUnavailable(detail, connection) ||
    (!executionReady ? 'Account / job execution is unavailable. Refresh status after restoring the required services.' : null) ||
    selectionApprovalIssue(detail, detailItem, candidateReviews[detail.id]) ||
    (detail.module === 'Job_Openings' ? jobSelectionIssues([detail],connection,jobPolicy)[0]?.message : null) || null;
  const canDecideDetail = detail && !busy && !detail.payload_redacted_at && !detail.suppressed &&
    ['pending_approval','held','rejected'].includes(detail.decision);
  const decisionItems = decisionContext?.scope === 'record' ? decisionContext.requestItems : selection;
  const currentDecisionItems = decisionContext?.scope === 'record' ? decisionItems.map(item => {
    const row = records.find(record => record.id === item.id);
    return row ? recordDecisionItem(row) : {...item,revision:null};
  }) : selection;
  const decisionJobIssues = module === 'Job_Openings' ? jobSelectionIssues(decisionItems.map(item => records.find(row => row.id === item.id)),connection,jobPolicy) : [];
  const decisionIssues = decisionItems.map(selected => {
    const record = records.find(row => row.id === selected.id);
    return {id:selected.id,record,message:candidateReviewUnavailable(record,connection) ||
      selectionApprovalIssue(record,selected,candidateReviews[selected.id]) ||
      decisionJobIssues.find(item => item.id === selected.id)?.message};
  }).filter(item => item.message);
  const canApproveDecision = executionReady && connection?.status === 'connected' && decisionItems.length > 0 &&
    decisionItems.length <= ZOHO_POLICY.maxApprovalBatch && decisionIssues.length === 0;
  const selectionChanged=Boolean(decisionContext&&(decisionContext.connectionId!==connectionId||decisionContext.module!==module||decisionContext.fingerprint!==selectionFingerprint(currentDecisionItems)));
  const decisionCount=decisionContext?.items.length||0;
  const decisionLabel=decision==='approve'?`Approve ${decisionCount} ${decisionContext?.module==='Candidates'?(decisionCount===1?'candidate':'candidates'):(decisionCount===1?'job':'jobs')}`:decision==='hold'?`Hold ${decisionCount} records`:`Reject ${decisionCount} records`;

  const selectionControls = (
<div id="zoho-selection-actions" tabIndex={-1} aria-label="Selection actions" className={styles.selectionActions}>
            <p className="sr-only">{executionReady ? 'Approvals are recorded atomically. Completed creation is reported separately.' : 'Account/job execution is unavailable. Refresh status after restoring the required services. Review, hold and reject are available.'}</p>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || !selection.length} onClick={() => openDecision('hold')}>Hold</Button><Button variant="outline" size="sm" disabled={busy || !selection.length} onClick={() => openDecision('reject')}>Reject</Button><Button className={styles.primaryAction} size="sm" disabled={busy || !canApprove} onClick={() => openDecision('approve')}><Check size={14} className="mr-2" /> Approve selection</Button></div>
            {selection.length>0&&connection?.status!=='connected'&&<p className="w-full text-xs text-destructive">Connect or resume this source before approving records.</p>}
            {approvalIssues.length>0&&<div className="w-full space-y-2 text-xs" aria-label="Approval requirements">
              <p role="status">{approvalIssues.length} selected record(s) need attention before approval.</p>
              <ul className="list-inside list-disc space-y-1">{approvalIssues.slice(0,5).map(item=><li key={item.id}>
                {item.record?.proposed_data?.name || item.record?.proposed_data?.title || 'Selected record'}: {item.message}
              </li>)}</ul>
              {approvalIssues.length>5&&<p>{approvalIssues.length-5} more selected records need attention.</p>}
              {nextCandidateReview&&<Button type="button" size="sm" variant="outline" disabled={busy} onClick={event=>openRecord(nextCandidateReview.record,recordSection?event.currentTarget:document.querySelector(`[data-review-record="${nextCandidateReview.id}"]`))}>Review next candidate</Button>}
            </div>}
          </div>
  );

  return (
    <div ref={pageRoot} className={`${styles.dashboard} mx-auto min-w-0 max-w-[1440px] pb-4`}>
      <Link data-zoho-breadcrumb href="/integrations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Integrations <span aria-hidden="true">/</span><span className={styles.breadcrumbCurrent}>Zoho Recruit</span></Link>
      <header className={styles.hero}>
        <div className={styles.heroIdentity}>
          <span className={styles.brandMark} aria-hidden="true"><span>Z</span><span>O</span><span>H</span><span>O</span></span>
          <div><div className={styles.titleRow}><h1>Zoho Recruit</h1><span className={styles.integrationTag}>Integration</span></div>
            <p>Discover candidates and jobs. Review every change before it reaches your platform.</p>
          </div>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.connectionSummary}><span className={`${styles.statusChip} ${connection?.status==='connected'?styles.connected:styles.neutral}`}><span className={styles.statusDot}/>{connection?.status?.replaceAll('_',' ')||(loading?'Loading status…':!snapshot?'Status unavailable':'No source selected')}</span><span>Last discovery: {connection?.lastDiscoveredAt?new Date(connection.lastDiscoveredAt).toLocaleString():connection?'No completed discovery':snapshot?'No source selected':'Unavailable'}</span></div>
          <Button variant="outline" onClick={refresh} disabled={busy || loading}><RefreshCw size={14} className={busy ? 'mr-2 animate-spin' : 'mr-2'} /> Refresh status</Button>
          <Button type="button" className={styles.primaryAction} disabled={loading||busy||!snapshot||connection?.status!=='connected'||!snapshot.capabilities?.discovery} onClick={()=>{goToDiscovery();if(!discoveryActive&&!discoveryPaused)discover();}}><Database size={13} className="mr-2"/>{discoveryActive||discoveryPaused?'Discovery controls':'Run discovery'}</Button>
          <Button ref={settingsTrigger} type="button" variant="outline" aria-haspopup="dialog" aria-controls="zoho-connection-settings" disabled={loading || !snapshot} onClick={()=>{setSettingsOpen(true);refreshSettings();}}><Settings2 size={14} className="mr-2"/>Integration settings</Button>
        </div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-border bg-muted/40 p-4 text-sm">{notice}</div>}
      {loading ? <p role="status" className="p-8 text-sm text-muted-foreground">Loading integration state…</p> : snapshot && <>
        <nav role="tablist" className={styles.sectionNav} aria-label="Zoho Recruit sections" onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
          const index=event.key==='Home'?0:event.key==='End'?sections.length-1:(sections.findIndex(tab=>tab.id===activeSection)+(event.key==='ArrowRight'?1:-1)+sections.length)%sections.length;
          activateSection(sections[index].id);event.currentTarget.querySelectorAll('[role="tab"]')[index]?.focus();
        }}>
          {sections.map(({id,label,Icon})=><button key={id} type="button" id={`zoho-tab-${id}`} role="tab" tabIndex={activeSection===id?0:-1} aria-controls={`zoho-panel-${id}`} aria-selected={activeSection===id} onClick={()=>activateSection(id)} className={activeSection===id?styles.activeTab:undefined}><Icon size={14} aria-hidden="true"/>{label}</button>)}
        </nav>
        <section id="zoho-overview" className={styles.overviewCard} aria-label="Integration overview">
          <div className={styles.cardHeading}><span className={styles.sectionIcon}><RefreshCw size={21}/></span><div><h2>Discovery overview</h2><p>Controlled imports · explicit approval</p></div><span className={`${styles.statusChip} ${styles.neutral}`}>Manual discovery</span></div>
          <div className={styles.overviewFacts}><div className={styles.sourcePicker}><label htmlFor="zoho-source-selector">Selected source</label><SourceSelector connections={snapshot.connections} value={connectionId} onValueChange={selectSource}/></div><div><span>Current activity</span><strong>{sourceActivity || (connection?.status==='connected'?'Awaiting operator action':connection?.status==='paused'?'Connection paused':'Connection required')}</strong></div><div><span>Email policy</span><strong className={styles.safeText}><LockKeyhole size={13}/>No emails sent</strong></div></div>
        </section>
        <section id="zoho-panel-overview" role="tabpanel" aria-labelledby="zoho-tab-overview" tabIndex={0} hidden={activeSection!=='overview'} className={styles.sectionPanel}>
        <p className="text-xs text-muted-foreground">Selected source totals, separated by record type. These cards show selected review states; use the table filter for rejected or stale reviews.</p>
        {!moduleCountsAvailable && <p role="status" className="text-sm text-muted-foreground">Separate record totals are currently unavailable. Refresh status to try again.</p>}
        {overviewGroups.map(group => <section key={group.id} className={styles.overviewTotals} aria-labelledby={`zoho-totals-${group.id}`}>
          <div className={styles.overviewTotalsHeading}>{group.id==='Candidates'?<UsersRound aria-hidden="true" size={20}/>:<BriefcaseBusiness aria-hidden="true" size={20}/>}<h2 id={`zoho-totals-${group.id}`}>{group.label}</h2></div>
          <div className={styles.metrics} aria-label={`${group.label} totals for selected source`}>
            {group.counts.map(([label,value],index)=>{const MetricIcon=[group.id==='Candidates'?UsersRound:BriefcaseBusiness,ListChecks,CheckCircle2,AlertTriangle][index];return <article key={label} className={`${styles.metric} ${index===0?styles.metricFeatured:''}`}><span className={`${styles.metricIcon} ${styles[`metricIcon${index}`]}`}><MetricIcon size={20} aria-hidden="true"/></span><p>{label}</p><strong>{value===null?'—':value.toLocaleString()}</strong></article>;})}
          </div>
        </section>)}
        <section className={styles.pipeline} aria-label="Approval workflow">
          <ol className={styles.pipelineSteps}>{[[Database,'Discover','Stage source records'],[ShieldCheck,'Validate & review','Check identity and access'],[ListChecks,'Approve','Explicit operator decision'],[FileCheck2,'Create / update','Confirm destination receipt']].map(([Icon,title,description],index)=><li key={title}><span className={styles.stepIcon}><Icon size={21}/><small>{index+1}</small></span><div><strong>{title}</strong><span>{description}</span></div>{index<3&&<ArrowRight size={17} aria-hidden="true" className={styles.stepArrow}/>}</li>)}</ol>
        </section>
          <section className={styles.overviewCard} aria-label="Review and delivery"><h2 className="text-lg font-semibold">Review before anything is created</h2><p className="mt-2 text-sm text-muted-foreground">Discover and review candidates or job openings in their tabs. Approvals shows queued operations and confirmed destination outcomes. Discovery history contains scan results; Advanced contains budgets, recovery and deferred changes.</p><div className="mt-4 flex flex-wrap gap-3">{tabs.map(tab=><Button key={tab.id} type="button" variant="outline" onClick={()=>activateSection(tab.id,true)}>Review {tab.label.toLowerCase()}</Button>)}</div></section>
        </section>
        <section id={`zoho-panel-${module==='Candidates'?'Job_Openings':'Candidates'}`} role="tabpanel" aria-labelledby={`zoho-tab-${module==='Candidates'?'Job_Openings':'Candidates'}`} hidden />
        <section id={`zoho-panel-${module}`} role="tabpanel" aria-labelledby={`zoho-tab-${module}`} tabIndex={0} aria-busy={recordsLoading} hidden={!recordSection} className={styles.sectionPanel}>
          <DiscoveryProgress capture={captures?.find(item => item.module === module && item.config_revision === connection?.configRevision)} checkpointKnown={captures !== undefined} connection={connection} progress={progress} errorText={progress?.run?.last_error ? discoveryErrorText(progress.run.last_error) : ''} updatedAt={historyUpdatedAt} pollDelay={pollDelay} onViewHistory={()=>activateSection('history',true)} />
        <div ref={workspaceRoot} className={styles.workspace}>
          <div className={styles.workspaceMain}>
        <section id="zoho-record-workspace" tabIndex={-1} className={`${styles.recordCard} rounded-2xl border border-border bg-background`}>
          <div className={styles.recordsTitle}><div><h2>{module==='Candidates'?'Candidate records':'Job opening records'} <span>({recordTotal??records.length})</span></h2></div><div className={styles.recordToolbar}><span className="sr-only">{selection.length} selected · maximum 50 per decision</span>{<BulkCandidateApproval key={`bulk-${connectionId}-${module}`} module={module} api={api} connection={connection} available={executionReady} disabled={busy || recordsLoading} onQueued={sourceId=>{setPendingHistoryConnection(sourceId);refreshViews(true).catch(error=>setError(`Approvals recorded. Refreshing the view failed: ${error.message}`));}}/>}<DiscoveryActions key={`${connectionId}:${module}`} progress={progress} configRevision={connection?.configRevision} busy={busy} connected={connection?.status === 'connected'} available={Boolean(snapshot.capabilities?.discovery)} onStart={discover} onControl={controlDiscovery} /></div></div>
          <div className={styles.recordFilters}>
            <label className="min-w-0 flex-1 text-xs font-medium">Search records<input aria-label="Search records" type="search" maxLength={100} value={searchDraft} onChange={event=>setSearchDraft(event.target.value)} placeholder="Name, email, job title or Zoho ID" className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" /></label>
            <label className="text-xs font-medium">Review state<ZohoSelect aria-label="Review state" value={stateFilter} onValueChange={setStateFilter} className="min-w-40" options={[{value:'',label:'All states'},...Object.entries(captions).map(([value,label])=>({value,label}))]}/></label>

          </div>
          {module === 'Job_Openings' && jobPolicyError && <p role="alert" className="px-4 text-sm text-destructive">Job publication checks are unavailable: {jobPolicyError} Refresh status to retry.</p>}
          {recordSection && selectionControls}
          <div className={styles.recordsPanel}>
            <div aria-label="Source records" tabIndex={0} className={styles.tableScroller}>
              <table className="w-full text-left text-sm"><thead className="sticky top-0 z-10 border-b border-border bg-background text-xs text-muted-foreground"><tr><th className="w-12 px-5 py-4"><span className="sr-only">Select</span></th><th className="py-4">{module==='Candidates'?'Candidate':'Job posting'}</th><th>Zoho ID</th><th>Job / Role</th><th className="px-3 py-4">Review state</th><th className="px-5 py-4 text-right">Revision</th><th>Updated</th></tr></thead><tbody>
                {records.map(row => <tr key={row.id} className={`border-b border-border/60 ${detail?.id === row.id ? 'bg-muted/60' : 'hover:bg-muted/30'}`}>
                  <td className="px-5 py-4"><input type="checkbox" aria-label={`Select source ${row.external_id}`} checked={selection.some(item => item.id === row.id)} disabled={busy || Boolean(row.payload_redacted_at || row.suppressed) || (!selection.some(item=>item.id===row.id)&&selection.length>=ZOHO_POLICY.maxApprovalBatch) || !['pending_approval', 'held', 'rejected'].includes(row.decision)} onChange={() => toggle(row)} /></td>
                  <td className="py-4"><button data-review-record={row.id} onClick={event => openRecord(row, event.currentTarget)} className="text-left font-medium underline-offset-4 hover:underline">{row.proposed_data.name || row.proposed_data.title || row.external_id}</button></td><td className={styles.externalId}>{row.external_id}</td><td>{row.proposed_data.job_title||row.proposed_data.designation||row.proposed_data.role||row.proposed_data.title||'—'}</td>
                  <td className="px-3 py-4"><span className={`${styles.recordState} ${row.decision==='completed'?styles.connected:styles.neutral}`}>{row.payload_redacted_at||row.suppressed?'Erased / suppressed':['pending_approval','held','rejected'].includes(row.decision)&&Number.isInteger(connection?.configRevision)&&row.config_revision!==connection.configRevision?'Fresh discovery required':captions[row.decision] || row.decision}</span>{row.validation_errors.length > 0 && <p className="mt-1 text-xs text-destructive">{row.validation_errors.length} validation issue(s)</p>}</td>
                  <td className="px-5 py-4 text-right font-mono text-xs">v{row.revision}</td><td className={styles.updatedAt}>{row.updated_at&&Number.isFinite(Date.parse(row.updated_at))?new Date(row.updated_at).toLocaleDateString():'—'}</td>
                </tr>)}
              </tbody></table>
              {hasMore && <div className="p-4 text-center"><Button variant="outline" size="sm" disabled={busy} onClick={loadMore}>Load more records</Button></div>}
              {!recordsLoading && !records.length && <div className="p-10 text-center"><ShieldCheck size={28} className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-medium">{search||stateFilter?'No matching records':`No staged ${module==='Candidates'?'candidates':'job openings'}`}</p><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{search||stateFilter?'Change your search or review-state filter.':'Source discovery will place records here for review. Nothing is created automatically.'}</p></div>}
            </div>

          </div>
          <div className={styles.recordsFooter}>            <p className="text-xs text-muted-foreground" role="status">{recordsLoading?'Loading records…':<>{records.length} displayed{recordTotal!==null?` of ${recordTotal} matching records`:''}</>}</p><span>Review batch · up to 50 records</span></div>
        </section>
          </div>
          <div className={`${styles.workspaceSide} ${!detail ? styles.workspaceSideEmpty : ''}`}>
          <section className={styles.overviewCard} aria-label="Integration health">
            <div className={styles.cardHeading}><span className={styles.sectionIcon}><ShieldCheck size={21}/></span><div><h2>Integration health</h2><p>Connection and delivery readiness</p></div></div>
            <div className={styles.healthRows}><div><span>Source authorization</span><span className={`${styles.statusChip} ${connection?.status==='connected'?styles.connected:styles.neutral}`}>{connection?.status==='connected'?'Connected':connection?.status?.replaceAll('_',' ')||(loading?'Loading status…':!snapshot?'Status unavailable':'No source selected')}</span></div><div><span>Account / job execution</span><span className={`${styles.statusChip} ${executionReady?styles.connected:styles.neutral}`}>{executionReady?'Ready':'Unavailable'}</span></div></div>
          </section>
            {detail&&detailOpen&&compact&&<button type="button" data-review-backdrop tabIndex={-1} aria-label="Close record review backdrop" className={styles.reviewBackdrop} onClick={closeDetail}/>}
            <aside ref={detailPanel} hidden={compact && (!detail || !detailOpen)} tabIndex={-1} onKeyDown={detailKeys} role={compact&&detail&&detailOpen?'dialog':undefined} aria-modal={compact&&detail&&detailOpen?true:undefined} className={`${styles.reviewCard} ${detail&&(!compact||detailOpen)?styles.reviewVisible:styles.reviewEmpty} ${compact&&detail&&detailOpen?styles.reviewMobile:''}`} aria-label="Record review">
              <div className={styles.reviewToolbar}><h3 className="text-xs font-semibold text-muted-foreground">Review before approval</h3>{detail&&<button type="button" aria-label="Close record review" onClick={closeDetail} className="rounded p-2 hover:bg-muted"><X size={18}/></button>}</div>
              {detail ? <><div className={styles.profileHeader}><span className={styles.avatar}>{(detail.proposed_data.name||detail.proposed_data.title||'?').split(' ').filter(Boolean).slice(0,2).map(word=>word[0]).join('')}</span><div><h3>{detail.proposed_data.name || detail.proposed_data.title || detail.external_id}</h3><p>{detail.proposed_data.job_title||detail.proposed_data.designation||detail.proposed_data.role||'Zoho Recruit source record'}</p><span className={`${styles.recordState} ${styles.neutral}`}>{detail.payload_redacted_at||detail.suppressed?'Erased / suppressed':captions[detail.decision]||detail.decision}</span></div></div><div className={styles.profileActions}><Button type="button" className={styles.primaryAction} size="sm" aria-describedby="zoho-detail-approval-requirement" disabled={!canDecideDetail||Boolean(detailApprovalIssue)} onClick={()=>openDecision('approve',detail)}><Check size={13}/>Approve</Button><Button type="button" className={styles.rejectAction} variant="outline" size="sm" disabled={!canDecideDetail} onClick={()=>openDecision('reject',detail)}><X size={13}/>Reject</Button></div><p id="zoho-detail-approval-requirement" role="status" className={styles.profileActionHelp}>{detailApprovalIssue || (detail.module === 'Candidates' ? 'Account review acknowledged. Approve opens a confirmation for this candidate.' : 'Ready for review confirmation. Approve opens a confirmation for this job opening.')}</p><div role="tablist" aria-label={module==='Candidates'?'Candidate detail views':'Job detail views'} className={styles.profileTabs} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=['profile','activity'];const index=event.key==='Home'?0:event.key==='End'?1:(keys.indexOf(profileTab)+1)%2;setProfileTab(keys[index]);event.currentTarget.querySelectorAll('[role="tab"]')[index]?.focus();}}>{['profile','activity'].map(key=><button key={key} type="button" role="tab" id={`zoho-profile-tab-${key}`} aria-selected={profileTab===key} aria-controls={`zoho-profile-panel-${key}`} tabIndex={profileTab===key?0:-1} onClick={()=>setProfileTab(key)}>{key[0].toUpperCase()+key.slice(1)}</button>)}</div><div role="tabpanel" id="zoho-profile-panel-profile" aria-labelledby="zoho-profile-tab-profile" hidden={profileTab!=='profile'}>{repeatedCandidateName(detail)&&<p role="status" className="mt-3 rounded-lg border border-amber-300 p-3 text-sm text-amber-900 dark:text-amber-200">The source name contains repeated parts. Verify the name in Zoho before approval. The imported name has not been changed.</p>}<h4 className={styles.profileSectionTitle}><UserRound size={13}/>Basic information</h4><p className="mt-3 break-all text-xs text-muted-foreground">{detail.target_id ? `Existing target: ${detail.target_id}` : detail.module === 'Candidates' ? 'No target linked. Canonical identity matching still requires review before provisioning.' : 'No destination job linked. The publication policy determines whether this job can be created.'}</p><dl className={styles.profileFields}>{Object.entries(detail.proposed_data).filter(([key, value]) => value && key !== 'description').map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{key.replaceAll('_', ' ')}</dt><dd className="mt-1 break-words text-sm">{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl>{detail.module === 'Job_Openings' && detail.proposed_data.description && <section className={styles.jobDescription}><h4 className={styles.profileSectionTitle}>Job description</h4><JobDescription value={detail.proposed_data.description}/></section>}<h4 className={styles.profileSectionTitle}><Database size={13}/>Source information</h4><dl className={styles.profileFields}><div><dt>Source</dt><dd>{connection?.name||'Zoho Recruit'}</dd></div><div><dt>Zoho record ID</dt><dd>{detail.external_id}</dd></div><div><dt>Reviewed revision</dt><dd>v{detail.revision}</dd></div></dl></div><div role="tabpanel" id="zoho-profile-panel-activity" aria-labelledby="zoho-profile-tab-activity" hidden={profileTab!=='activity'} className={styles.profileTabContent}><h4>Record activity</h4><dl>{[['Staged',detail.created_at],['Last updated',detail.updated_at],['Source modified',detail.source_modified_at]].filter(([,value])=>value&&Number.isFinite(Date.parse(value))).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{new Date(value).toLocaleString()}</dd></div>)}<div><dt>Review state</dt><dd>{detail.payload_redacted_at||detail.suppressed?'Erased / suppressed':captions[detail.decision]||detail.decision}</dd></div><div><dt>Revision</dt><dd>v{detail.revision}</dd></div></dl></div>{detail.module === 'Candidates' && <CandidateReview record={detail} review={candidateReviews[detail.id]} loading={Boolean(reviewing[detail.id])}
                unavailableReason={candidateReviewUnavailable(detail,connection)} error={reviewErrors[detail.id]}
                acknowledged={candidateApprovalReady(detail, candidateReviews[detail.id], candidateAcknowledgements[detail.id])}
                onReview={() => reviewCandidate(detail)} onAcknowledge={() => acknowledgeCandidate(detail, candidateReviews[detail.id])} />}{compact&&detail.module==='Candidates'&&<Button className="mt-4" variant="outline" onClick={()=>{activateSection('advanced');requestAnimationFrame(()=>document.querySelector('#zoho-source-operations textarea')?.focus({preventScroll:true}));}}>Go to candidate administration</Button>}
              {detail.validation_errors.length > 0 && <ul className="mt-5 list-inside list-disc space-y-2 text-xs text-destructive">{detail.validation_errors.map(message => <li key={message}>{message}</li>)}</ul>}</> : <div className={styles.reviewEmptyContent}><div className={styles.reviewEmptyHeading}><FileCheck2 aria-hidden="true" size={20}/><h4>No record selected</h4></div><p>Choose a record to inspect its source details and validation findings. Approval applies only to selected records and revisions.</p></div>}
              <p className={`${styles.reviewPolicy} text-muted-foreground`}>{module === 'Candidates' ? 'New learners receive Discover. Existing access is preserved. No invitation, password, verification or job email is sent.' : 'Only approved job revisions are applied. Publication status, organization capacity and destination ownership are checked before creation or updates. No emails are sent.'}</p>
            </aside>
          </div>
        </div>
        </section>
        <dialog id="zoho-connection-settings" ref={settingsDialog} className={`${styles.integrationSetup} ${styles.settingsDialog}`} aria-labelledby="zoho-settings-title" aria-describedby="zoho-settings-description"
          onCancel={event=>{if(event.target!==event.currentTarget)return;event.preventDefault();if(!busy)setSettingsOpen(false);}}
          onClose={event=>{if(event.target!==event.currentTarget)return;setSettingsOpen(false);settingsTrigger.current?.focus();}}>
          <div className={styles.settingsHeading}><Settings2 size={19} aria-hidden="true"/><div><h2 id="zoho-settings-title">Integration setup</h2><p id="zoho-settings-description" className="mt-1 text-xs text-muted-foreground">Connection, publication policy and privacy · {connection?.name || 'No source selected'}</p></div><Button type="button" variant="outline" size="sm" disabled={busy || settingsRefreshing} onClick={refreshSettings}><RefreshCw aria-hidden="true" size={14} className={settingsRefreshing?'mr-2 animate-spin motion-reduce:animate-none':'mr-2'} />{settingsRefreshing?'Refreshing settings…':'Refresh settings'}</Button><button type="button" autoFocus aria-label="Close integration settings" disabled={busy} onClick={()=>setSettingsOpen(false)} className="ml-auto rounded-lg p-2 hover:bg-muted disabled:opacity-50"><X aria-hidden="true" size={18}/></button></div>
          {settingsRefreshError && <p role="alert" className="mx-4 mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{settingsRefreshError}</p>}
          {error && <p role="alert" className="mx-4 mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="mx-4 mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">{notice}</p>}
          <div className={styles.settingsContent}>
        <section className={`${styles.sourceCard} rounded-2xl border border-border bg-background p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><Database size={19} className="text-muted-foreground" /><div><h2 className="text-sm font-semibold">Source connection</h2><p className="text-xs text-muted-foreground">Credential values are never displayed.</p></div></div>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || !connectionId || !snapshot.capabilities?.oauth} onClick={connect}>{connection?.status === 'connected' ? 'Reconnect Zoho' : 'Connect Zoho'}</Button><Button variant="outline" size="sm" onClick={() => setShowSetup(value => !value)}>{showSetup ? 'Close setup' : 'Register source'}</Button></div>
          </div>
          {!snapshot.capabilities?.oauth && <p className="mt-4 text-xs text-muted-foreground">OAuth requires the server-side Zoho client, callback URL and encryption key. Connection remains disabled until configured.</p>}
          {snapshot.connections.length > 0 ? <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div><p className="text-xs font-medium">Selected source</p><p className="mt-3 text-sm">{connection?.name||'Choose a source'}</p></div>
            <div><p className="text-xs font-medium">Connection state</p><p className="mt-3 text-sm">{connection?.status?.replaceAll('_', ' ') || 'Unknown'}</p></div>
            <div><p className="text-xs font-medium">Last discovery</p><p className="mt-3 text-sm">{connection?.lastDiscoveredAt ? new Date(connection.lastDiscoveredAt).toLocaleString() : 'No completed discovery'}</p></div>
          </div> : <p className="mt-5 text-sm text-muted-foreground">No source registered. Add your organization details to begin setup.</p>}
          {showSetup && <form onSubmit={configure} className="mt-5 grid gap-4 border-t border-border pt-5 md:grid-cols-2">
            {[['name', 'Connection name'], ['sourceOrgId', 'Zoho organization ID'], ['publisherOrganizationId', 'Platform publishing organization UUID']].map(([key, label]) => <label key={key} className="text-xs font-medium">{label}<input required value={configuration[key]} onChange={e => setConfiguration(value => ({ ...value, [key]: e.target.value }))} className="mt-2 block w-full rounded-lg border border-border bg-background p-2.5 text-sm" /></label>)}
            <label className="text-xs font-medium">Data center<ZohoSelect aria-label="Data center" value={configuration.region} onValueChange={region => setConfiguration(value => ({ ...value, region }))} options={ZOHO_REGIONS.map(region => ({value:region,label:region.toUpperCase()}))}/></label>
            <div className="md:col-span-2"><Button disabled={busy} type="submit">Register disconnected source</Button><p className="mt-2 text-xs text-muted-foreground">Registration does not authorize access, import data, or create accounts.</p></div>
          </form>}
        </section>
        {settingsOpen && connectionId && <SyncSettings key={`sync-${connectionId}`} connectionId={connectionId} refreshVersion={settingsRefreshVersion} captures={captures} />}
        {settingsOpen && connectionId && <JobPolicyPanel connectionId={connectionId} refreshVersion={settingsRefreshVersion} onSaved={async () => {
          setNotice('Job publication policy saved. Previous reviews are stale. Run fresh job discovery, inspect the mapped proposal, then approve it.');
          await loadSummary(); await loadRecords(); await loadRuns();
        }} />}
        {settingsOpen && connectionId && <details key={connectionId} open={connection?.status === 'paused' || undefined} className="rounded-2xl border border-border bg-background">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Connection and privacy controls <span className="ml-2 text-xs font-normal text-muted-foreground">{connection?.status === 'paused' ? 'Paused — resume here' : 'Pause, disconnect, retention and suppression'}</span></summary>
          <SourcePrivacyPanel connectionId={connectionId} connectionStatus={connection?.status} configRevision={connection?.configRevision} onChanged={refresh} onNavigateToDiscovery={goToDiscovery} refreshVersion={settingsRefreshVersion} />
        </details>}
          </div>
        </dialog>

        <section id="zoho-panel-history" role="tabpanel" aria-labelledby="zoho-tab-history" tabIndex={0} hidden={activeSection!=='history'} className={styles.sectionPanel}>
      <section id="zoho-discovery-history" tabIndex={-1} className={styles.historyCard}><header className={styles.sectionHeading}><History size={15}/><h2>Discovery history</h2><span>View past discovery runs, results and errors.</span><em>{runs.length} loaded runs</em></header><div className={styles.historyContent}><p className="mt-1 text-xs text-muted-foreground">Discovery covers saved records only; drafts are excluded. Destination creation requires a separate reviewed approval.</p>{!runs.length ? <p className="mt-5 text-sm text-muted-foreground">No discovery runs recorded.</p> : <div className="mt-4 space-y-3">{runs.map(run => <details key={run.id} className="border-t border-border py-3 text-sm">
              <summary className="cursor-pointer"><span className="font-medium">{run.module === 'Candidates' ? 'Candidates' : 'Job openings'} · {run.state.replaceAll('_', ' ')}</span><span className="ml-3 text-xs text-muted-foreground">{run.staged_count} staged · {new Date(run.created_at).toLocaleString()}{run.last_error ? ' · View error details' : ' · View details'}</span></summary>
              <div className="mt-3 flex flex-wrap justify-between gap-3"><p className="break-all font-mono text-xs text-muted-foreground">{run.id}</p><div className="text-right text-xs text-muted-foreground"><p>{run.received_count} received · {run.staged_count} staged · {run.deferred_count ?? 0} deferred at discovery</p><p className="mt-1">{run.failure_count ?? 0}/8 discovery failures · saved records</p><p className="mt-1">{run.modified_since ? 'Incremental scan' : 'Full reconciliation'} · next page {run.next_page}{run.scan_had_exceptions ? ' · earlier exceptions retained' : ''}</p><p className="mt-1">{new Date(run.created_at).toLocaleString()}</p>{run.last_error && <p className="mt-1 text-destructive">{discoveryErrorText(run.last_error)}{run.state === 'failed' && ' Run stopped.'}</p>}</div></div></details>)}</div>}{historyErrors.runs&&<p role="alert" className="mt-3 text-xs text-destructive">{historyErrors.runs}</p>}{historyMore.runs&&<Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={()=>moreHistory('runs')}>Load older discovery runs</Button>}</div></section>
        </section>
        <section id="zoho-panel-approvals" role="tabpanel" aria-labelledby="zoho-tab-approvals" tabIndex={0} hidden={activeSection!=='approvals'} className={styles.sectionPanel}>
          <section className={styles.overviewCard} aria-label="Review queue"><h2 className="text-lg font-semibold">Approvals</h2><p className="mt-2 text-sm text-muted-foreground">{pending.toLocaleString()} source records await approval across candidates and jobs. Review identity, access and the exact source revision in the record tabs before approving.</p><p className="mt-2 text-sm">{selection.length} {module==='Candidates'?'candidate':'job opening'} record(s) currently selected.</p><div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={()=>activateSection(module,true)}>Review selected records</Button>{tabs.filter(tab=>tab.id!==module).map(tab=><Button key={tab.id} type="button" variant="outline" onClick={()=>activateSection(tab.id,true)}>Review {tab.label.toLowerCase()}</Button>)}</div></section>
          {activeSection==='approvals' && selectionControls}
        <section className={styles.historyCard} aria-label="Approved execution history"><header className={styles.sectionHeading}><CheckCircle2 size={15}/><h2>Approved execution history</h2><span>Approved operations for this source.</span><em>{executions.length} loaded items</em></header><div className={styles.historyContent}>
          <p className="mt-1 text-xs text-muted-foreground">Approved operations for this source, newest first. Load older operations below. Completion requires a confirmed destination receipt.</p>
          <ExecutionRecovery key={connectionId} active={activeSection==='approvals'} connectionId={connectionId} api={api} onChanged={()=>refreshViews(true)} />
          {!executions.length ? <p className="mt-5 text-sm text-muted-foreground">No approved execution recorded.</p> : <div className="mt-4 space-y-3">{executions.map(item => {
            const recoveryStatus = executionRecoveryStatus(item);
            const unresolved = item.state === 'processing' && item.destination_phase !== 'projection_pending' && (item.last_error === 'OUTCOME_UNKNOWN' || new Date(item.lease_expires_at).getTime() <= Date.now());
            return <div key={item.id} className="flex flex-wrap justify-between gap-3 border-t border-border pt-3 text-sm">
              <div><p className="font-medium">{item.zoho_staged_records.module === 'Candidates' ? 'Candidate' : 'Job opening'} · {item.zoho_staged_records.external_id}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.id}</p></div>
              <div className="text-right text-xs text-muted-foreground"><p>{recoveryStatus.label}</p><p className="mt-1">Attempt {item.execution_attempts} of 8 · reviewed revision {item.record_revision}</p>
                <p className="mt-1 max-w-md">{recoveryStatus.detail}</p>
                {item.state === 'failed' && Date.parse(item.expires_at)>Date.now() && item.execution_attempts<8 && <p className="mt-1 text-destructive">{`Retry eligible after ${new Date(item.next_attempt_at).toLocaleString()}.`}</p>}
                {unresolved && <p className="mt-1 text-destructive">Outcome is unconfirmed. No automatic repeat write.</p>}
                {item.state === 'approval_stale' && item.last_error === 'JOB_REVIEW_REQUIRED' && <p className="mt-1 text-muted-foreground">No job change was applied. Refresh records, resolve the job policy, ownership or quota issue, then review and approve again.</p>}
              </div>
            </div>;
          })}</div>}
          {historyErrors.executions&&<p role="alert" className="mt-3 text-xs text-destructive">{historyErrors.executions}</p>}{historyMore.executions&&<Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={()=>moreHistory('executions')}>Load older executions</Button>}
        </div></section>
        </section>
        <section id="zoho-panel-advanced" role="tabpanel" aria-labelledby="zoho-tab-advanced" tabIndex={0} hidden={activeSection!=='advanced'} className={styles.sectionPanel}>
          <section id="zoho-source-operations" aria-label="Advanced source operations">
            {operationsVisited && <OperationsPanel active={activeSection==='advanced'} connectionId={connectionId} module={module} record={detail} onChanged={()=>refreshViews(true)} />}
          </section>
        <section className={styles.historyCard} aria-label="Deferred source changes"><header className={styles.sectionHeading}><Layers size={15}/><h2>Deferred source changes</h2><span>Unresolved source changes, newest first.</span><em>{deferred.length} loaded items</em></header><div className={styles.historyContent}>
          <p className="mt-1 text-xs text-muted-foreground">Unresolved source changes, newest first. Load older changes below. Recovered changes still require approval.</p>
          {!deferred.length ? <p className="mt-5 text-sm text-muted-foreground">No deferred source changes.</p> : <div className="mt-4 space-y-3">{deferred.map(item => <div key={item.id} className="border-t border-border pt-3 text-sm">
            <p className="font-medium">{item.module === 'Candidates' ? 'Candidate' : 'Job opening'} · {item.external_id}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.state === 'waiting_execution' ? 'Waiting for the current execution to be reconciled. Retained changes can then return to review.' : item.reason === 'REFETCH_REQUIRED' ? 'A fresh source read is required before review.' : 'Source validation needs correction and a fresh discovery.'}</p>
          </div>)}</div>}
          {historyErrors.deferred&&<p role="alert" className="mt-3 text-xs text-destructive">{historyErrors.deferred}</p>}{historyMore.deferred&&<Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={()=>moreHistory('deferred')}>Load older deferred changes</Button>}
        </div></section>
        </section>
      </>}
      <dialog ref={dialog} aria-labelledby="decision-title" aria-describedby="decision-description" aria-busy={busy}
        onCancel={event=>{event.preventDefault();if(!busy)closeDecision();}} className={styles.decisionDialog}>
        <form className={styles.decisionForm} onSubmit={event=>{event.preventDefault();submitDecision();}}>
          <header className={styles.decisionHeading}>
            <span className={styles.decisionIcon}>{decision==='approve'?<ShieldCheck aria-hidden="true" size={24}/>:<FileCheck2 aria-hidden="true" size={24}/>}</span>
            <div><p className={styles.decisionEyebrow}>Review confirmation</p><h2 id="decision-title">{decision === 'approve' ? 'Approve reviewed records' : decision === 'hold' ? 'Hold selection' : 'Reject selection'}</h2></div>
            <button type="button" aria-label="Close confirmation" disabled={busy} onClick={closeDecision}><X aria-hidden="true" size={20}/></button>
          </header>
          <div className={styles.decisionBody}>
            <p id="decision-description">{decision==='approve'?'Authorize the selected records for queued processing. Completion is confirmed separately.':decision==='hold'?'Keep these records on hold for a later review.':'Reject this selection. No account or job changes will be queued.'}</p>
            <div className={styles.decisionSummary}><div><span>Selected source</span><strong>{decisionContext?.sourceName}</strong></div><div><span>Records to {decision==='approve'?'approve':decision==='hold'?'hold':'reject'}</span><strong>{decisionCount} {decisionContext?.module==='Candidates'?(decisionCount===1?'candidate':'candidates'):(decisionCount===1?'job':'jobs')}</strong></div></div>
            <section aria-label="Records in this decision" className={styles.decisionRecords}><h3>Selected records <span>{decisionCount}</span></h3><ul>{decisionContext?.items.map(item=><li key={item.id}><div><strong>{item.name}</strong>{item.email&&<span>{item.email}</span>}<span>Zoho ID: {item.externalId||'Unavailable'} · Revision {item.revision}</span></div>{decision==='approve'&&<span className={styles.decisionOutcome}>{item.outcome}</span>}</li>)}</ul></section>
            <div className={styles.decisionSafety}><LockKeyhole aria-hidden="true" size={18}/><div><strong>No emails will be sent</strong><p>{decision==='approve'&&decisionContext?.module==='Candidates'?'New learners receive Discover and remain activation pending. Existing sign-in and paid or organization access are preserved.':'This decision does not send invitations, verification emails or notifications.'}</p></div></div>
            {selectionChanged&&<p role="alert" className={styles.decisionAlert}>The reviewed selection changed while this dialog was open. Close and review the current records before confirming.</p>}
            {decisionError&&<p role="alert" className={styles.decisionAlert}>{decisionError}</p>}
        {decision==='approve'&&!canApproveDecision&&<div role="alert" className="mt-3 space-y-2 text-sm text-destructive">
          <p>Approval is no longer ready. Close this dialog and resolve the following before confirming.</p>
          {!executionReady&&<p>Account/job execution is unavailable. Refresh status after restoring the required services.</p>}
          {connection?.status!=='connected'&&<p>Connect or resume this source, then run fresh discovery and review.</p>}
          {!decisionItems.length&&<p>The selection changed. Select current records again.</p>}
          {decisionIssues.length>0&&<ul className="list-inside list-disc">{decisionIssues.slice(0,5).map(item=><li key={item.id}>{item.record?.proposed_data?.name||item.record?.proposed_data?.title||'Selected record'}: {item.message}</li>)}</ul>}
          {nextCandidateReview&&<Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>{closeDecision();openRecord(nextCandidateReview.record,document.querySelector(`[data-review-record="${nextCandidateReview.id}"]`));}}>Close and review selection</Button>}
        </div>}
            <label htmlFor="zoho-decision-reason" className={styles.decisionReason}>Decision reason <span>Required</span></label>
            <textarea id="zoho-decision-reason" autoFocus required minLength={3} maxLength={500} disabled={busy} value={reason}
              aria-describedby="zoho-decision-reason-help" placeholder="Explain why these records should be approved, held or rejected…" onChange={e=>setReason(e.target.value)} className={styles.decisionTextarea}/>
            <div id="zoho-decision-reason-help" className={styles.decisionReasonHelp}><span>{reason.trim().length<3?'Enter at least 3 characters to confirm.':'This reason will be saved in the decision history.'}</span><span>{reason.length}/500</span></div>
          </div>
          <footer className={styles.decisionFooter}><p>Only the listed records and reviewed revisions are included.</p><div><Button type="button" variant="outline" disabled={busy} onClick={closeDecision}>Cancel</Button><Button data-confirm-decision type="submit" className={styles.primaryAction} disabled={busy || !decisionContext || selectionChanged || !decisionItems.length || reason.trim().length < 3 || (decision === 'approve' && !canApproveDecision)}>{busy ? <><RefreshCw aria-hidden="true" size={16} className="animate-spin"/> Recording…</> : <><Check aria-hidden="true" size={16}/>{decisionLabel}</>}</Button></div></footer>
        </form>
      </dialog>
    </div>
  );
}
