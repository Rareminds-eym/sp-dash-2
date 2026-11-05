'use client';
import { browserResponse } from '@/lib/zoho/browser-response';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import { sourceOperationPollDelay } from '@/lib/zoho/operation-polling';
import { discoveryErrorText } from '@/lib/zoho/discovery-progress';
const API='/api/integrations/zoho-recruit';
async function command(action,input){const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,input})});const body=await browserResponse(response);if(!response.ok)throw new Error(body.error||'Operator action unavailable');return body.result;}
export default function OperationsPanel({connectionId,module,record,onChanged,active=true}){
 const [state,setState]=useState(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [budget,setBudget]=useState(1000),[concurrency,setConcurrency]=useState(2),[loser,setLoser]=useState(''),[winner,setWinner]=useState(''),[evidence,setEvidence]=useState('');
 const [allocationPercent,setAllocationPercent]=useState(20);
 const [pollFailures,setPollFailures]=useState(0);
 const [administration,setAdministration]=useState('establish_learner_context'),[ack,setAck]=useState(false),[review,setReview]=useState(null),[pending,setPending]=useState(null);
 const [history,setHistory]=useState({});
 const request=useRef(null),generation=useRef(0),quotaDirty=useRef(false);
 const historyRequests=useRef({}),historyViews=useRef({lifecycle:'pending',administration:'pending',canonical:'pending'});
 const scope=useRef({connectionId});
 // Each connection visit owns its asynchronous UI results, including A -> B -> A.
 if(scope.current.connectionId!==connectionId)scope.current={connectionId};
 const loadHistory=useCallback(async(kind,view='pending',append=false,cursor=null)=>{
  const started=scope.current;if(!connectionId||started.connectionId!==connectionId)return;
  const token={};historyRequests.current[kind]=token;historyViews.current[kind]=view;
  setHistory(previous=>({...previous,[kind]:{...(append?previous[kind]:{items:[],nextCursor:null}),view,loading:true,error:''}}));
  try{
   const query=new URLSearchParams({view:'operator_history',connectionId,kind,historyView:view});if(cursor)query.set('cursor',JSON.stringify(cursor));
   const response=await fetch(`${API}?${query}`,{cache:'no-store'});const result=await browserResponse(response);
   if(scope.current!==started||historyRequests.current[kind]!==token)return;
   if(!response.ok)throw new Error(result.error||'Operator history unavailable');
   const page=result.page;if(page?.version!==1||page.kind!==kind||page.view!==view||!Array.isArray(page.items)||page.items.length>(kind==='canonical'?50:25))throw new Error('Operator history unavailable');
   setHistory(previous=>{const items=append?[...(previous[kind]?.items||[]),...page.items]:page.items;
    return {...previous,[kind]:{view,items:[...new Map(items.map(item=>[item.id||item.request_id,item])).values()],nextCursor:page.nextCursor,loading:false,error:''}};});
  }catch(e){if(scope.current===started&&historyRequests.current[kind]===token)setHistory(previous=>({...previous,[kind]:{...previous[kind],loading:false,error:e.message}}));}
 },[connectionId]);
 const refresh=useCallback(async(poll=false)=>{
  const started=scope.current;
  if(started.connectionId!==connectionId)return;
  const current=++generation.current;
  if(!connectionId){setState(null);return;}
  try{
   const response=await fetch(`${API}?view=operations&connectionId=${encodeURIComponent(connectionId)}`,{cache:'no-store'});
   const result=await browserResponse(response);
   if(scope.current!==started)return;
   if(!response.ok)throw new Error(result.error||'Operations unavailable');
   if(current===generation.current){setState(result.operations);if(!quotaDirty.current){setBudget(result.operations?.quota?.rolling_budget??1000);setConcurrency(result.operations?.quota?.concurrent_limit??2);setAllocationPercent(result.operations?.quota?.allocation_percent??20);}if(!poll)await Promise.all(['lifecycle','administration','canonical'].map(kind=>loadHistory(kind,historyViews.current[kind])));}
  }catch(e){if(scope.current===started)throw e;}
 },[connectionId,loadHistory]);
 useEffect(()=>{if(!active)return;const handler=()=>{if(!busy)refresh().catch(error=>setError(error.message));};window.addEventListener('refreshPage',handler);return()=>window.removeEventListener('refreshPage',handler);},[active,refresh,busy]);
 const pollDelay=sourceOperationPollDelay(state,pollFailures);
 const operationActive=pollDelay>0;
 useEffect(()=>{
  if(!active||!pollDelay||busy)return;
  let inFlight=false,cancelled=false;const started=scope.current;
  const timer=setInterval(async()=>{
   if(document.hidden||inFlight)return;inFlight=true;
   try{await refresh(true);if(!cancelled&&scope.current===started)setPollFailures(0);}
   catch(error){if(!cancelled&&scope.current===started){setError(error.message);setPollFailures(value=>value+1);}}
   finally{inFlight=false;}
  },pollDelay);
  return()=>{cancelled=true;clearInterval(timer);};
 },[active,pollDelay,refresh,busy]);
 // Preserve form drafts on tab changes; a source change starts a fresh review scope.
 useEffect(()=>{quotaDirty.current=false;setPollFailures(0);setState(null);setHistory({});historyViews.current={lifecycle:'pending',administration:'pending',canonical:'pending'};setReason('');setBudget(1000);setConcurrency(2);setAllocationPercent(20);setLoser('');setWinner('');setEvidence('');setAdministration('establish_learner_context');setAck(false);setReview(null);setPending(null);setError('');setNotice('');setBusy(false);request.current=null;return()=>{generation.current++;};},[refresh]);
 useEffect(()=>{if(!active)return;const started=scope.current;refresh().catch(e=>{if(scope.current===started)setError(e.message);});},[active,refresh]);
 useEffect(()=>{setReview(null);request.current=null;},[record?.id,record?.revision,administration,reason,ack]);
 useEffect(()=>{setAck(false);},[record?.id,record?.revision,administration]);
 const validReason=reason.trim().length>=3;
 const sourceReady=state?.sourceEnabled&&state?.connection?.status==='connected';
 async function run(action,input){
  const started=scope.current;
  setBusy(true);setError('');
  try{const result=await command(action,input);if(scope.current!==started)return null;setNotice(action==='refresh_source_license'?(result.refreshed?'Zoho plan refreshed.':'Plan refresh already in progress or cached; refresh operations shortly.'):action==='configure_auto_allocation'?'Automatic allocation saved.':action==='configure_source_quota'?'Manual budget override saved.':result.state==='application_pending'?'Canonical action recorded. Application cleanup is still pending; use Resume cleanup.':result.requiresFreshCandidateReview?'Learner context established. Run a fresh canonical account check before approving this candidate.':'Action recorded. Destination changes still require their normal reviewed approval.');
   if(action==='start_bulk')request.current=null;
   if(['configure_source_quota','configure_auto_allocation','refresh_source_license'].includes(action))quotaDirty.current=false;
   try{await refresh();if(scope.current!==started)return null;await onChanged?.();}catch(error){if(scope.current===started)setError(`Action recorded. Refreshing the view failed: ${error.message}`);}return scope.current===started?result:null;
  }catch(e){if(scope.current===started)setError(e.message);return null;}finally{if(scope.current===started)setBusy(false);}
 }
 function requestId(fingerprint){if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID()};return request.current.id;}
 function context(){return {connectionId,recordId:record.id,action:administration,reason:reason.trim(),acknowledgeIndependentDiscover:administration==='establish_learner_context'&&ack};}
 async function preview(){setReview(null);const result=await run('preview_candidate_administration',context());if(result)setReview(result);}
 async function execute(){const value=context(),id=requestId(JSON.stringify({value,hash:review.reviewHash}));setPending(id);
  const result=await run('execute_candidate_administration',{context:value,reviewHash:review.reviewHash,requestId:id});
  if(result?.state==='completed'){setPending(null);setReview(null);request.current=null;}
 }
 function historyControls(kind,label,allowHistory=true){const page=history[kind]||{};return <div className="mt-3 space-y-2">
  {allowHistory&&<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy||page.loading||page.view==='pending'} onClick={()=>loadHistory(kind,'pending')}>Pending {label}</Button><Button size="sm" variant="outline" disabled={busy||page.loading||page.view==='history'} onClick={()=>loadHistory(kind,'history')}>Completed {label}</Button></div>}
  {page.loading&&<p className="text-xs text-muted-foreground">Loading {label}…</p>}
  {page.error&&<div><p role="alert" className="text-xs text-destructive">{page.error}</p><Button size="sm" variant="outline" onClick={()=>loadHistory(kind,page.view||'pending')}>Retry {label}</Button></div>}
  {!page.loading&&!page.error&&page.items?.length===0&&<p className="text-xs text-muted-foreground">No {page.view==='history'?'completed':'pending'} {label}.</p>}
 </div>;}
 function moreHistory(kind,label){const page=history[kind];return page?.nextCursor&&<Button className="mt-3" size="sm" variant="outline" disabled={busy||page.loading} onClick={()=>loadHistory(kind,page.view,true,page.nextCursor)}>Load more {label}</Button>;}
 return <section aria-label="Source operations" className="min-w-0 break-words rounded-2xl border border-border bg-background p-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Operator desk</p><h2 className="mt-1 text-sm font-semibold">Source operations</h2></div><Button variant="outline" size="sm" disabled={busy} onClick={()=>{const started=scope.current;refresh().catch(e=>{if(scope.current===started)setError(e.message);});}}>Refresh operations</Button></div>
  <p className="mt-3 max-w-3xl text-xs leading-5 text-muted-foreground">Bulk exports stage records for review. Source removal never deletes an independently established account. Every destination job closure still needs its normal approval. No email is sent.</p>
  {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="mt-4 text-sm">{notice}</p>}
  <label className="mt-5 block text-xs">Reason for operator action<textarea aria-label="Reason for operator action" aria-describedby="operator-reason-help" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={2} className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm"/></label><p id="operator-reason-help" className="mt-1 text-xs text-muted-foreground">At least 3 characters are required for reviewed changes. {operationActive?`Active operation statuses check about every ${Math.round(pollDelay/1000)} seconds while visible.`:''}</p>
  <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
   <div className="space-y-3"><h3 className="text-sm font-semibold">Inventory and source changes</h3>
    <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy||!sourceReady} onClick={()=>run('start_bulk',{connectionId,module,requestId:requestId(`bulk:${connectionId}:${module}`)})}>Stage bulk export</Button><Button size="sm" variant="outline" disabled={busy||!sourceReady} onClick={()=>run('start_deleted_scan',{connectionId,module})}>Scan source deletions</Button></div>
    {!sourceReady&&<p className="text-xs text-muted-foreground">Source processing needs a connected source, configured OAuth, its runtime flag and the existing private export store.</p>}
    <ul className="space-y-2 text-xs">{(state?.bulk||[]).map(item=><li key={item.id} className="border-t border-border pt-2">{item.module} · {item.state} · {item.staged_count} staged · {item.issue_count} exceptions{item.last_error&&` · ${discoveryErrorText(item.last_error)}`}</li>)}</ul>
    <ul className="space-y-2 text-xs">{(state?.deletedScans||[]).map(item=><li key={item.id} className="border-t border-border pt-2">Deletion scan · {item.module} · {item.state} · next page {item.next_page}{item.last_error&&` · ${discoveryErrorText(item.last_error)}`}</li>)}</ul>
    <details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs font-medium">Record a verified source merge</summary><p className="mt-2 text-xs text-muted-foreground">Enter the source IDs and evidence reference. The server verifies the surviving record and the removed source. It never merges platform identities. Close an existing losing job through normal approval first.</p>
     <label className="mt-3 block text-xs">Removed source ID<input aria-label="Removed source ID" value={loser} onChange={e=>setLoser(e.target.value)} className="mt-1 w-full rounded border p-2 bg-background"/></label>
     <label className="mt-3 block text-xs">Surviving source ID<input aria-label="Surviving source ID" value={winner} onChange={e=>setWinner(e.target.value)} className="mt-1 w-full rounded border p-2 bg-background"/></label>
     <label className="mt-3 block text-xs">Evidence reference<input aria-label="Merge evidence reference" value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={500} className="mt-1 w-full rounded border p-2 bg-background"/></label>
     <Button className="mt-3" size="sm" variant="outline" disabled={busy||!sourceReady||!/^\d{1,40}$/.test(loser)||!/^\d{1,40}$/.test(winner)||loser===winner||evidence.trim().length<10} onClick={()=>run('stage_source_merge',{connectionId,module,externalId:loser,survivorExternalId:winner,observedAt:new Date().toISOString(),evidenceReference:evidence.trim()})}>Verify and stage linkage</Button>
    </details>
    {historyControls('lifecycle','source decisions')}
    {(history.lifecycle?.items||[]).map(item=><article key={item.id} className="rounded-lg border border-border p-3 text-xs"><p className="font-medium">{item.module} · {item.external_id} · {item.kind}</p><p className="mt-1 text-muted-foreground">Revision {item.revision} · {item.decision} · {item.effect||'No effect approved'}{item.survivor_external_id&&` · survivor ${item.survivor_external_id}`}</p>{history.lifecycle?.view==='pending'&&<div className="mt-3 flex flex-wrap gap-2">{['approve','hold','reject'].map(decision=><Button key={decision} size="sm" variant="outline" disabled={busy||!validReason} onClick={()=>run('decide_source_lifecycle',{connectionId,proposalId:item.id,expectedRevision:item.revision,decision,reason:reason.trim(),requestId:requestId(JSON.stringify({proposal:item.id,revision:item.revision,decision,reason}))})}>{decision==='approve'?'Approve source effect':decision==='hold'?'Hold':'Reject'}</Button>)}</div>}</article>)}
    {moreHistory('lifecycle','source decisions')}
   </div>
   <div className="space-y-5"><div><h3 className="text-sm font-semibold">Shared API budget</h3><p className="mt-2 text-xs text-muted-foreground">Connector allocation across this source organization, shared by all its connections. Estimated base allowance excludes add-ons and is not Zoho’s remaining credits.</p>
     <dl className="mt-3 space-y-1 text-xs"><div>Mode: <strong>{state?.quota?.allocation_mode==='automatic'?'Automatic':'Manual override'}</strong></div>
      <div>Detected plan: <strong className="capitalize">{state?.quota?.license_plan_type||'Not detected'}</strong> · Licensed users: {state?.quota?.license_users??'Unknown'}</div>
      <div>Estimated base credits / rolling 24h: {state?.quota?.estimated_base_allowance??'Unknown'} · Connector usage: {state?.quota?.used_units??'Unknown'} units</div>
      <div>Last checked: {state?.quota?.license_checked_at?new Date(state.quota.license_checked_at).toLocaleString():'Never'} · {state?.quota?.license_fresh?'Fresh':'Unknown or stale'}</div>
     </dl>
     <p className="mt-3 text-xs leading-5 text-muted-foreground">This connector uses a rolling 24-hour window. Usage replenishes as each charged request ages past 24 hours; midnight, restarting discovery and pausing do not reset it. Empty source responses also use request units. The detected plan does not replace a manual override.</p>
     {state?.quota?.next_replenishment_at&&<p className="mt-2 text-xs">Next used units age out: {new Date(state.quota.next_replenishment_at).toLocaleString()}.</p>}
     {state?.quota?.read_request_possible===false&&<p role="status" className="mt-2 text-xs text-amber-800 dark:text-amber-200">The allocation is smaller than one {state.quota.read_cost}-unit source read. Review the manual budget.</p>}
     {state?.quota?.read_available_at&&state.quota.used_units+state.quota.read_cost>state.quota.rolling_budget&&<p role="status" className="mt-2 text-xs text-amber-800 dark:text-amber-200">Local budget exhausted ({state.quota.used_units} / {state.quota.rolling_budget} units). Earliest {state.quota.read_cost}-unit read: {new Date(state.quota.read_available_at).toLocaleString()}. Scheduled work may resume later.</p>}
     {state?.quota?.fallback&&<p role="status" className="mt-2 text-xs text-amber-800 dark:text-amber-200">Conservative fallback is active until a supported plan and licensed-user count are verified.</p>}
     <Button className="mt-3" size="sm" variant="outline" disabled={busy||!state?.licenseEnabled||state?.connection?.status!=='connected'} onClick={()=>run('refresh_source_license',{connectionId})}>Refresh plan from Zoho</Button>
     <label className="mt-3 block text-xs">Automatic allocation (%)<input aria-label="Automatic allocation percentage" type="number" min={1} max={100} value={allocationPercent} onChange={e=>{quotaDirty.current=true;setAllocationPercent(Number(e.target.value));}} className="mt-1 w-full rounded border p-2 bg-background"/></label>
     <Button className="mt-3" size="sm" variant="outline" disabled={busy||!state||!validReason||!Number.isInteger(allocationPercent)||allocationPercent<1||allocationPercent>100} onClick={()=>run('configure_auto_allocation',{connectionId,percent:allocationPercent,reason:reason.trim()})}>Use automatic allocation</Button>
     <p className="mt-3 text-xs text-muted-foreground">Automatic mode uses the selected share of the detected base allowance and at most five concurrent requests. Saving the fields below switches to a manual override, preserved on plan refresh.</p>
     <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs">Rolling budget<input aria-label="Source rolling budget" type="number" min={1} max={1000000} value={budget} onChange={e=>{quotaDirty.current=true;setBudget(Number(e.target.value));}} className="mt-1 w-full rounded border p-2 bg-background"/></label><label className="text-xs">Concurrent requests<input aria-label="Source concurrency" type="number" min={1} max={5} value={concurrency} onChange={e=>{quotaDirty.current=true;setConcurrency(Number(e.target.value));}} className="mt-1 w-full rounded border p-2 bg-background"/></label></div><p className="mt-2 text-xs text-muted-foreground">Current: {state?.quota?.rolling_budget??'default 1000'} credits · {state?.quota?.concurrent_limit??2} concurrent</p><Button className="mt-3" size="sm" variant="outline" disabled={busy||!state||!validReason||!Number.isInteger(budget)||!Number.isInteger(concurrency)||budget<1||budget>1000000||concurrency<1||concurrency>5} onClick={()=>run('configure_source_quota',{connectionId,budget,concurrency,reason:reason.trim()})}>Save shared budget</Button>{!validReason&&<p className="mt-2 text-xs text-muted-foreground">Enter a reason of at least 3 characters above to save allocation changes.</p>}</div>
    <div className="border-t border-border pt-4"><h3 className="text-sm font-semibold">Stored credential rotation</h3><p className="mt-2 text-xs text-muted-foreground">Pause the source first. The active server key re-encrypts stored credentials; no key or token is shown. Old read keys must remain available until dependent data is migrated.</p><Button className="mt-3" size="sm" variant="outline" disabled={busy||!validReason||state?.connection?.status!=='paused'} onClick={()=>run('rotate_connection_tokens',{connectionId,expectedGeneration:state.connection.credential_generation,reason:reason.trim()})}>Rotate paused credentials</Button></div>
    <div className="border-t border-border pt-4"><h3 className="text-sm font-semibold">Connector cleanup</h3><p className="mt-2 text-xs text-muted-foreground">Pending cleanup is separate from completed history and remains recoverable after closing this page.</p>{historyControls('administration','connector cleanup')}{(history.administration?.items||[]).map(item=><div key={item.request_id} className="mt-3 text-xs"><p>{item.action} · source {item.external_id}</p>{history.administration?.view==='pending'&&<Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={()=>run('recover_candidate_administration',{connectionId,requestId:item.request_id})}>Resume source {item.external_id}</Button>}</div>)}{moreHistory('administration','connector cleanup')}</div>
    <div className="border-t border-border pt-4"><h3 className="text-sm font-semibold">Canonical recovery</h3><p className="mt-2 text-xs text-muted-foreground">Recover approved canonical actions even when their application acknowledgement was lost.</p>{historyControls('canonical','canonical recovery',false)}{(history.canonical?.items||[]).map(item=><div key={item.request_id} className="mt-3 text-xs"><p>{item.action} · source {item.external_id}</p><Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={()=>run('recover_candidate_administration',{connectionId,requestId:item.request_id})}>Recover canonical source {item.external_id}</Button></div>)}{moreHistory('canonical','canonical recovery')}</div>
    {record?.module==='Candidates'&&<div className="border-t border-border pt-4"><h3 className="text-sm font-semibold">Candidate context and connector privacy</h3><p className="mt-2 text-xs text-muted-foreground">Selected source: {record.external_id}. Connector erasure removes source-owned copies and blocks replay. It preserves the platform account, credentials, access and learner activity. Release never restores erased data.</p><label className="mt-3 block text-xs">Candidate action<select aria-label="Candidate administration action" value={administration} onChange={e=>setAdministration(e.target.value)} className="mt-1 w-full rounded border p-2 bg-background"><option value="establish_learner_context">Establish reviewed learner context</option><option value="erase_connector">Erase connector data and suppress source</option><option value="release_suppression">Release source suppression</option></select></label>
     {administration==='establish_learner_context'&&<label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I explicitly approve an additional learner context and a free Discover baseline only if needed; existing role and paid or sponsored access stay unchanged.</label>}
     <Button className="mt-3" size="sm" variant="outline" disabled={busy||!validReason||(administration==='establish_learner_context'&&!ack)} onClick={preview}>Review candidate administration</Button>
     {review&&<div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs"><p>{review.allowed?'Ready for explicit approval':'Blocked for review'} · {review.scope}</p><dl className="mt-2 space-y-1">{Object.entries(review.changes||{}).map(([key,value])=><div key={key}><dt className="inline font-medium">{key}: </dt><dd className="inline">{typeof value==='object'?JSON.stringify(value):String(value)}</dd></div>)}</dl><p className="mt-2">Expires {new Date(review.expiresAt).toLocaleString()}</p><Button className="mt-3" size="sm" disabled={busy||!review.allowed||Date.parse(review.expiresAt)<=Date.now()} onClick={execute}>Approve reviewed candidate action</Button></div>}
     {pending&&<Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={async()=>{const result=await run('recover_candidate_administration',{connectionId,requestId:pending});if(result?.state==='completed')setPending(null);}}>Resume cleanup</Button>}
    </div>}
   </div>
  </div>
 </section>;
}
