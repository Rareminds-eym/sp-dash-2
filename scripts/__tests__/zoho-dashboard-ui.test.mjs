import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dashRequire=createRequire(resolve(root,'package.json'));
const appRequire=createRequire(resolve(root,'package.json'));
const {build}=dashRequire('esbuild'), {JSDOM}=appRequire('jsdom');
let bundle;
before(async()=>{
  const result=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import Page from './components/pages/ZohoRecruitPage.jsx';window.auditAct=act;window.auditRoot=createRoot(document.getElementById('root'));window.auditMount=()=>window.auditRoot.render(React.createElement(Page));`,resolveDir:resolve(root),loader:'jsx'},bundle:true,write:false,outdir:resolve(root,'.wrangler/ui-test-build'),platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},alias:{'@':resolve(root)},plugins:[{name:'test-only-panels',setup(build){
    build.onResolve({filter:/^(next\/link|@\/components\/(ui\/button|zoho\/(JobPolicyPanel|SourcePrivacyPanel|OperationsPanel)))$/},args=>({path:args.path,namespace:'audit-stub'}));
    build.onLoad({filter:/.*/,namespace:'audit-stub'},args=>({contents:`import React from ${JSON.stringify(dashRequire.resolve('react'))};export const Button=React.forwardRef(({variant,size,...props},ref)=>React.createElement('button',{...props,ref}));export default function Stub({active}){return ${JSON.stringify(args.path.includes('/zoho/'))}?React.createElement('span',{'data-audit-panel':${JSON.stringify(args.path)},'data-audit-active':active}):null;}`,loader:'js',resolveDir:resolve(root)}));
  }}]});bundle=result.outputFiles.find(file=>file.path.endsWith('.js')).text;
});

const id='a5700000-0000-4000-8000-000000000001';
async function fixture({ candidate = false, recordCount = 2, sources = null, compact = false, reviewTtl = 600000, discoveryAvailable = false, summaryError = false } = {}) {
  const state={reads:[],approved:false,complete:false,changed:false,historyGets:0, failures:{}, posts:[], decisionError:null, run:null, moduleCounts:null, moduleCountsAvailable:true};
  const timers=new Map(),timerDelays=new Map();let sequence=0;
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.IS_REACT_ACT_ENVIRONMENT=true;
  const mediaListeners=new Set(),media={matches:compact,addEventListener(_,listener){mediaListeners.add(listener);},removeEventListener(_,listener){mediaListeners.delete(listener);}};
  w.matchMedia=()=>media;
  w.MessageChannel=class { constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};} };
  w.setInterval=(fn,delay)=>{timers.set(++sequence,fn);timerDelays.set(sequence,delay);return sequence;};w.clearInterval=key=>{timers.delete(key);timerDelays.delete(key);};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const row=(external)=>({id:external==='999'?id:'a5700000-0000-4000-8000-000000000002',external_id:external,module:candidate?'Candidates':'Job_Openings',revision:external==='888'&&state.changed?2:1,source_hash:'a'.repeat(64),config_revision:1,target_id:null,proposed_data:candidate?{name:'Audit candidate '+external}:{title:'Audit job '+external},validation_errors:[],decision:external==='999'&&state.approved?(state.complete?'completed':'approved'):'pending_approval',created_at:new Date().toISOString()});
  w.fetch=async(input,init={})=>{
    const url=new URL(input,'http://localhost');let data;
    state.reads.push(url.searchParams.get('view')||'summary');
    const rawView=url.searchParams.get('view')||'summary';const view=rawView==='record_window'?'records':rawView;
    if(view==='summary'&&summaryError)return Response.json({error:'Administrator authority is unavailable'},{status:503});
    if(state.approved && state.failures[view]>0){state.failures[view]--;return Response.json({error:'Injected '+view+' outage'},{status:503});}
    if(init.method==='POST'){
      const command=JSON.parse(init.body);state.posts.push(command);
      if(command.action==='decide'&&state.decisionError)return Response.json({error:state.decisionError},{status:503});
      if(command.action==='discover') {state.run={id,connection_id:id,module:command.input.module,state:'queued',control_state:'active',config_revision:1,next_page:1,created_at:new Date().toISOString()};data={result:{runId:id,delivery:'queued'}};}
      else if(command.action==='control_discovery') {
        if(state.controlError)return Response.json({error:state.controlError},{status:409});
        assert.equal(command.input.runId,state.run.id);
        state.run={...state.run,control_state:command.input.command==='pause'?'paused':command.input.command==='cancel'?'cancelled':'active',...(command.input.command==='cancel'?{state:'failed',last_error:'CANCELLED_BY_OPERATOR'}:{})};data={result:{runId:id,nextPage:state.run.next_page}};
      }
      else if(command.action==='review_candidate') data={review:{recordId:id,revision:1,sourceHash:'a'.repeat(64),configRevision:1,targetId:null,
        reviewHash:'b'.repeat(64),decision:'create',blockers:[],expiresAt:new Date(Date.now()+reviewTtl).toISOString(),
        identity:{email:'candidate@example.invalid',outcome:'new_identity',profileAction:'create',name:'Audit candidate 999',activationState:'activation_pending'},
        entitlements:{action:'grant_discover',planCodes:['freemium'],paidAccessPreserved:false,organizationAccessPreserved:false}}};
      else {state.approved=true;data={result:{count:1,decision:'approve',delivery:'queued'}};}
    }
    else if(['records','record_window'].includes(url.searchParams.get('view'))){
      const all=recordCount===2?[row('999'),row('888')]:Array.from({length:recordCount},(_,i)=>({...row(String(1000+i)),id:`b5700000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));
      data={records:url.searchParams.get('module')===(candidate?'Candidates':'Job_Openings')?all.slice(url.searchParams.has('before')?50:0,url.searchParams.get('view')==='record_window'?Number(url.searchParams.get('limit')||50):url.searchParams.has('before')?100:50):[],total:all.length};
    }
    else if(url.searchParams.get('view')==='executions'){state.historyGets++;data={executions:state.approved?[{id,state:state.complete?'completed':'queued',execution_attempts:1,record_revision:1,zoho_staged_records:{module:candidate?'Candidates':'Job_Openings',external_id:'999'}}]:[]};}
    else if(url.searchParams.get('view')==='runs')data={runs:state.runs||(state.run?[state.run]:[])};
    else if(url.searchParams.get('view')==='deferred')data={deferred:[]};
    else data={connections:sources||[{id,name:'Audit fixture',region:'in',status:'connected'}],counts:{},countsByConnection:{[id]:{completed:state.complete?1:0}},countsByConnectionAndModule:state.moduleCountsAvailable?(state.moduleCounts||{[id]:{[candidate?'Candidates':'Job_Openings']:{completed:state.complete?1:0}}}):undefined,capabilities:{oauth:false,discovery:discoveryAvailable,execution:{ready:true,modules:['Candidates','Job_Openings']}}};
    return Response.json(data);
  };
  w.eval(bundle);
  const act=async fn=>{await w.auditAct(async()=>{await fn?.();await new Promise(resolve=>setTimeout(resolve,5));});};
  await act(()=>w.auditMount());
  const button=text=>text==='Confirm decision'?w.document.querySelector('[data-confirm-decision]'):[...w.document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
  if(!candidate) await act(()=>button('Job openings').click());
  async function approve(){
    if(!candidate) await act(()=>w.document.querySelector('[aria-label="Select source 999"]').click());
    await act(()=>button('Approve selection').click());
    await act(()=>{const field=w.document.querySelector('dialog textarea');Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(field,'Synthetic reviewed approval');field.dispatchEvent(new w.Event('input',{bubbles:true}));});
    assert.equal(button('Confirm decision').disabled,false);
    await act(()=>button('Confirm decision').click());
  }
  return {w,state,timers,timerDelays,act,approve,button,async resize(compact){await act(()=>{media.matches=compact;for(const listener of mediaListeners)listener();});},async close(){await act(()=>w.auditRoot.unmount());w.close();}};
}

test('a new approval refreshes history and starts polling from idle',async()=>{
  const f=await fixture();try{assert.equal(f.state.historyGets,1);await f.approve();assert.ok(f.state.historyGets>=2);assert.equal(f.timers.size,1);assert.ok(!f.w.document.body.textContent.includes('No approved execution recorded.'));}finally{await f.close();}
});
test('completion refreshes records and summary without losing another unchanged selection',async()=>{
  const f=await fixture();try{
    await f.approve();await f.act(()=>f.w.document.querySelector('[aria-label="Select source 888"]').click());
    f.state.complete=true;await f.act(async()=>{await [...f.timers.values()][0]();});
    assert.equal(f.w.document.querySelector('[aria-label="Select source 888"]').checked,true);
    assert.match(f.w.document.querySelector('tbody').textContent,/Completed/);
    assert.equal(f.timers.size,0);
  }finally{await f.close();}
});
test('background refresh removes a selection when its reviewed revision changes',async()=>{
  const f=await fixture();try{
    await f.approve();await f.act(()=>f.w.document.querySelector('[aria-label="Select source 888"]').click());
    f.state.changed=true;await f.act(async()=>{await [...f.timers.values()][0]();});
    assert.equal(f.w.document.querySelector('[aria-label="Select source 888"]').checked,false);
    assert.match(f.w.document.querySelector('tbody').textContent,/v2/);
  }finally{await f.close();}
});

for(const view of ['summary','records']) test(`approval refresh survives a ${view} outage`,async()=>{
  const f=await fixture();try{
    f.state.failures[view]=1;await f.approve();
    assert.equal(f.state.approved,true);assert.ok(f.state.historyGets>=(view==='summary'?1:2));assert.equal(f.timers.size,1);
    assert.match(f.w.document.body.textContent,new RegExp('Injected '+view+' outage'));
    f.state.complete=true;await f.act(async()=>{await [...f.timers.values()][0]();});
    assert.equal(f.timers.size,0);assert.match(f.w.document.querySelector('tbody').textContent,/Completed/);
  }finally{await f.close();}
});
test('failed execution refresh starts a retry loop even before history is available',async()=>{
  const f=await fixture();try{
    f.state.failures.executions=1;await f.approve();assert.equal(f.state.historyGets,1);assert.equal(f.timers.size,1);
    await f.act(async()=>{await [...f.timers.values()][0]();});assert.ok(f.state.historyGets>=2);assert.equal(f.timers.size,1);
    f.state.complete=true;await f.act(async()=>{await [...f.timers.values()][0]();});assert.equal(f.timers.size,0);
  }finally{await f.close();}
});
test('candidate check requires human acknowledgement before a version-bound approval',async()=>{
  const f=await fixture({candidate:true});try{
    assert.equal(f.button('Approve selection').disabled,true);
    await f.act(()=>f.button('Audit candidate 999').click());
    await f.act(()=>f.button('Check canonical account').click());
    assert.equal(f.state.approved,false);assert.equal(f.button('Approve selection').disabled,true);
    assert.match(f.w.document.body.textContent,/Grant Discover/);
    assert.match(f.w.document.body.textContent,/Activation pending/);
    await f.act(()=>f.button('Acknowledge and select').click());
    assert.equal(f.button('Approve selection').disabled,false);
    await f.approve();
    const command=f.state.posts.find(item=>item.action==='decide');
    assert.equal(command.input.items[0].candidateReviewHash,'b'.repeat(64));
    assert.equal(command.input.items[0].revision,1);assert.equal(f.state.approved,true);assert.equal(f.timers.size,1);
    f.state.complete=true;await f.act(async()=>{await [...f.timers.values()][0]();});
    assert.match(f.w.document.querySelector('tbody').textContent,/Completed/);assert.equal(f.timers.size,0);
  }finally{await f.close();}
});


test('decision failure remains visible inside its named modal',async()=>{
 const f=await fixture();try{
  f.state.decisionError='Synthetic decision outage';await f.approve();
  const dialog=f.w.document.querySelector('[aria-labelledby="decision-title"]');assert.equal(dialog.open,true);
  assert.match(dialog.querySelector('[role="alert"]').textContent,/Synthetic decision outage/);
  assert.ok(f.w.document.getElementById(dialog.getAttribute('aria-labelledby')));
  assert.equal(f.state.approved,false);
 }finally{await f.close();}
});
test('selection is capped at fifty across loaded pages',async()=>{
 const f=await fixture({recordCount:51});try{
  await f.act(()=>f.button('Load more records').click());
  await f.act(()=>{for(const input of f.w.document.querySelectorAll('tbody input[type="checkbox"]'))input.click();});
  assert.equal(f.w.document.querySelectorAll('tbody input:checked').length,50);
  assert.equal(f.w.document.querySelectorAll('tbody input:not(:checked):disabled').length,1);
  assert.match(f.w.document.body.textContent,/maximum 50 per decision/);
 }finally{await f.close();}
});
test('keyboard tabs have associated panels and switch on arrow keys',async()=>{
 const f=await fixture({candidate:true});try{
  const tab=f.w.document.querySelector('[role="tab"][aria-selected="true"]');
  await f.act(()=>tab.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  const selected=f.w.document.querySelector('[role="tab"][aria-selected="true"]');
  assert.equal(selected.textContent,'Job openings');assert.equal(selected.tabIndex,0);
  assert.equal(f.w.document.getElementById(selected.getAttribute('aria-controls')).getAttribute('role'),'tabpanel');
 }finally{await f.close();}
});

test('overview separates complete source totals by candidate and job type and refreshes each independently',async()=>{
 const f=await fixture({candidate:true});try{
  f.state.moduleCounts={[id]:{Candidates:{pending_approval:125,approved:4,completed:7,held:2,failed:3,reconciliation_required:1},Job_Openings:{pending_approval:45,approved:6,completed:9,held:1,failed:3,reconciliation_required:4}}};
  await f.act(()=>f.button('Refresh status').click());await f.act(()=>f.button('Overview').click());
  const totals=label=>[...f.w.document.querySelector(`[aria-label="${label} totals for selected source"]`).querySelectorAll('article')].map(el=>[el.querySelector('p').textContent,el.querySelector('strong').textContent]);
  assert.deepEqual(totals('Candidates'),[['Awaiting approval','125'],['Approved','4'],['Completed','7'],['Staged exceptions','6']]);
  assert.deepEqual(totals('Job openings'),[['Awaiting approval','45'],['Approved','6'],['Completed','9'],['Staged exceptions','8']]);
  assert.equal(f.w.document.querySelectorAll('tbody tr').length,2);
  f.state.moduleCounts[id].Job_Openings.completed=10;await f.act(()=>f.button('Refresh status').click());
  assert.equal(totals('Job openings')[2][1],'10');assert.equal(totals('Candidates')[2][1],'7');
  assert.equal(f.state.posts.length,0);
 }finally{await f.close();}
});
test('overview isolates selected sources and shows zero for a type with no staged records',async()=>{
 const other='a5700000-0000-4000-8000-000000000002';
 const f=await fixture({candidate:true,sources:[{id,name:'First source',region:'in',status:'connected'},{id:other,name:'Second source',region:'in',status:'connected'}]});try{
  f.state.moduleCounts={[id]:{Candidates:{completed:7},Job_Openings:{completed:9}},[other]:{Candidates:{pending_approval:3,completed:2}}};
  await f.act(()=>f.button('Refresh status').click());await f.act(()=>f.button('Overview').click());
  await f.act(()=>{const select=f.w.document.querySelector('#zoho-source-selector');select.value=other;select.dispatchEvent(new f.w.Event('change',{bubbles:true}));});
  const values=label=>[...f.w.document.querySelector(`[aria-label="${label} totals for selected source"]`).querySelectorAll('strong')].map(el=>el.textContent);
  assert.deepEqual(values('Candidates'),['3','0','2','0']);assert.deepEqual(values('Job openings'),['0','0','0','0']);
 }finally{await f.close();}
});
test('overview distinguishes missing module totals from a confirmed empty source without borrowing combined totals',async()=>{
 const f=await fixture({candidate:true});try{
  f.state.moduleCountsAvailable=false;f.state.complete=true;
  await f.act(()=>f.button('Refresh status').click());await f.act(()=>f.button('Overview').click());
  const overview=f.w.document.querySelector('#zoho-panel-overview');
  assert.match(overview.textContent,/Separate record totals are currently unavailable/);
  assert.deepEqual([...overview.querySelectorAll('article strong')].map(el=>el.textContent),Array(8).fill('—'));
  f.state.moduleCountsAvailable=true;f.state.moduleCounts={};await f.act(()=>f.button('Refresh status').click());
  assert.doesNotMatch(overview.textContent,/Separate record totals are currently unavailable/);
  assert.deepEqual([...overview.querySelectorAll('article strong')].map(el=>el.textContent),Array(8).fill('0'));
 }finally{await f.close();}
});

test('all six sections are exclusive tab panels and navigation never scrolls to page sections',async()=>{
 const f=await fixture({candidate:true});try{
  let scrolls=0;f.w.HTMLElement.prototype.scrollIntoView=()=>scrolls++;
  const nav=f.w.document.querySelector('[role="tablist"][aria-label="Zoho Recruit sections"]');
  assert.equal(nav.querySelectorAll('[role="tab"]').length,6);
  for(const tab of nav.querySelectorAll('[role="tab"]')){
   await f.act(()=>tab.click());
   const panel=f.w.document.getElementById(tab.getAttribute('aria-controls'));
   assert.equal(panel.getAttribute('role'),'tabpanel');
   assert.equal(panel.getAttribute('aria-labelledby'),tab.id);
   assert.equal(panel.hidden,false);
   assert.equal(nav.querySelectorAll('[aria-selected="true"]').length,1);
   assert.equal([...f.w.document.querySelectorAll('[role="tabpanel"][id^="zoho-panel-"]')].filter(p=>!p.hidden).length,1);
   assert.equal(tab.tabIndex,0);
  }
  assert.equal(f.w.document.querySelector('[aria-label="Approved execution history"]').closest('[role="tabpanel"]').id,'zoho-panel-approvals');
  assert.equal(f.w.document.querySelector('[aria-label="Deferred source changes"]').closest('[role="tabpanel"]').id,'zoho-panel-advanced');
  assert.equal(f.w.document.querySelector('#zoho-discovery-history').closest('[role="tabpanel"]').id,'zoho-panel-history');
  assert.equal(scrolls,0);
  assert.equal(f.state.posts.length,0);
 }finally{await f.close();}
});

test('section keyboard navigation includes overview, approvals, history and advanced with wraparound',async()=>{
 const f=await fixture({candidate:true});try{
  const nav=f.w.document.querySelector('[role="tablist"][aria-label="Zoho Recruit sections"]');
  const press=async(key,id)=>{
   await f.act(()=>nav.querySelector('[aria-selected="true"]').dispatchEvent(new f.w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})));
   const tab=nav.querySelector('[aria-selected="true"]');
   assert.equal(tab.id,`zoho-tab-${id}`);
   assert.equal(f.w.document.activeElement===tab,true);
  };
  await press('Home','overview');await press('ArrowLeft','advanced');
  await press('ArrowRight','overview');await press('End','advanced');
  await press('ArrowLeft','history');await press('ArrowLeft','approvals');
 }finally{await f.close();}
});

test('a reviewed selection survives non-record tabs and can be approved from Approvals',async()=>{
 const f=await fixture({candidate:true});try{
  await f.act(()=>f.button('Audit candidate 999').click());
  await f.act(()=>f.button('Check canonical account').click());
  await f.act(()=>f.button('Acknowledge and select').click());
  const initialReads=f.state.reads.filter(view=>view==='records').length;
  for(const id of ['overview','history','advanced','approvals'])await f.act(()=>f.w.document.querySelector(`#zoho-tab-${id}`).click());
  assert.equal(f.button('Approve selection').disabled,false);
  assert.equal(f.w.document.querySelectorAll('#zoho-selection-actions').length,1);
  assert.match(f.w.document.querySelector('#zoho-panel-approvals').textContent,/1 candidate record\(s\) currently selected/);
  assert.equal(f.state.reads.filter(view=>view==='records').length,initialReads);
  await f.approve();
  const command=f.state.posts.find(p=>p.action==='decide');
  assert.equal(command.input.items[0].candidateReviewHash,'b'.repeat(64));
  assert.equal(f.state.approved,true);
 }finally{await f.close();}
});

test('review requirements in Approvals open the candidate tab and its review panel',async()=>{
 const f=await fixture({candidate:true});try{
  await f.act(()=>f.w.document.querySelector('[aria-label="Select source 999"]').click());
  await f.act(()=>f.w.document.querySelector('#zoho-tab-approvals').click());
  assert.equal(f.button('Approve selection').disabled,true);
  await f.act(()=>f.button('Review next candidate').click());
  assert.equal(f.w.document.querySelector('#zoho-tab-Candidates').getAttribute('aria-selected'),'true');
  assert.equal(f.w.document.activeElement===f.w.document.querySelector('[aria-label="Record review"]'),true);
  assert.match(f.w.document.querySelector('[aria-label="Record review"]').textContent,/Audit candidate 999/);
 }finally{await f.close();}
});

test('mobile candidate administration switches to Advanced and releases the review modal',async()=>{
 const f=await fixture({candidate:true,compact:true});try{
  await f.act(()=>f.button('Audit candidate 999').click());
  await f.act(()=>f.button('Go to candidate administration').click());
  assert.equal(f.w.document.querySelector('#zoho-tab-advanced').getAttribute('aria-selected'),'true');
  assert.equal(f.w.document.querySelector('[aria-label="Record review"]').hidden,true);
  assert.equal(f.w.document.body.style.overflow,'');
  assert.equal(f.w.document.querySelectorAll('[inert]').length,0);
  assert.equal(f.w.document.querySelector('#zoho-source-selector').value,id);
 }finally{await f.close();}
});

test('header discovery opens the current module tab when invoked from history',async()=>{
 const f=await fixture({discoveryAvailable:true});try{
  await f.act(()=>f.w.document.querySelector('#zoho-tab-history').click());
  await f.act(()=>f.button('Run discovery').click());
  assert.equal(f.w.document.querySelector('#zoho-tab-Job_Openings').getAttribute('aria-selected'),'true');
  assert.equal(f.state.posts.filter(p=>p.action==='discover').length,1);
  assert.equal(f.state.posts.find(p=>p.action==='discover').input.module,'Job_Openings');
 }finally{await f.close();}
});

test('review shortcuts focus the destination panel without moving keyboard tab activation into it',async()=>{
 const f=await fixture({candidate:true});try{
  await f.act(()=>f.w.document.querySelector('#zoho-tab-overview').click());
  const shortcut=f.w.document.querySelector('#zoho-panel-overview button');
  await f.act(()=>{shortcut.focus();shortcut.click();});
  assert.equal(f.w.document.activeElement===f.w.document.querySelector('#zoho-panel-Candidates'),true);
  await f.act(()=>f.w.document.querySelector('#zoho-tab-approvals').click());
  const back=f.button('Review selected records');
  await f.act(()=>{back.focus();back.click();});
  assert.equal(f.w.document.activeElement===f.w.document.querySelector('#zoho-panel-Candidates'),true);
  const tab=f.w.document.querySelector('#zoho-tab-Candidates');
  await f.act(()=>{tab.focus();tab.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));});
  assert.equal(f.w.document.activeElement===f.w.document.querySelector('#zoho-tab-Job_Openings'),true);
 }finally{await f.close();}
});

test('source activity follows active candidate work after visiting jobs and Overview',async()=>{
 const f=await fixture({candidate:true});try{
  f.state.run={id,connection_id:id,module:'Candidates',state:'queued',control_state:'active',next_page:2,created_at:new Date().toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  await f.act(()=>f.w.document.querySelector('#zoho-tab-Job_Openings').click());
  await f.act(()=>f.w.document.querySelector('#zoho-tab-overview').click());
  assert.match(f.w.document.querySelector('[aria-label="Integration overview"]').textContent,/Candidates: Discovery in progress/);
  assert.doesNotMatch(f.w.document.querySelector('[aria-label="Integration overview"]').textContent,/Awaiting operator action/);
  assert.ok([...f.timerDelays.values()].includes(3000));
  f.state.run={...f.state.run,last_error:'RATE_LIMITED',next_attempt_at:new Date(Date.now()+3600000).toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  assert.match(f.w.document.querySelector('[aria-label="Integration overview"]').textContent,/Candidates: Waiting to retry/);
  assert.ok([...f.timerDelays.values()].includes(60000));
 }finally{await f.close();}
});

test('source activity shows paused job work and ignores another source',async()=>{
 const f=await fixture({candidate:true});try{
  f.state.run={id,connection_id:id,module:'Job_Openings',state:'queued',control_state:'paused',created_at:new Date().toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  assert.match(f.w.document.querySelector('[aria-label="Integration overview"]').textContent,/Job openings: Discovery paused/);
  f.state.run={...f.state.run,connection_id:'another-source',control_state:'active'};
  await f.act(()=>f.button('Refresh status').click());
  assert.match(f.w.document.querySelector('[aria-label="Integration overview"]').textContent,/Awaiting operator action/);
  assert.doesNotMatch(f.w.document.querySelector('[aria-label="Integration overview"]').textContent,/Job openings: Discovery/);
 }finally{await f.close();}
});

test('both record types report their own activity and running work keeps fast polling',async()=>{
 const f=await fixture({candidate:true});try{
  f.state.runs=[{id,connection_id:id,module:'Candidates',state:'queued',control_state:'active',last_error:'RATE_LIMITED',next_attempt_at:new Date(Date.now()+3600000).toISOString(),created_at:new Date().toISOString()},
   {id:'job-run',connection_id:id,module:'Job_Openings',state:'running',control_state:'active',next_page:2,created_at:new Date().toISOString()}];
  await f.act(()=>f.button('Refresh status').click());
  const overview=f.w.document.querySelector('[aria-label="Integration overview"]');
  assert.match(overview.textContent,/Candidates: Waiting to retry/);
  assert.match(overview.textContent,/Job openings: Discovery in progress/);
  assert.ok([...f.timerDelays.values()].includes(3000));
  f.state.runs[1]={...f.state.runs[1],state:'completed'};
  await f.act(()=>f.button('Refresh status').click());
  assert.doesNotMatch(overview.textContent,/Job openings: Discovery in progress/);
  assert.ok([...f.timerDelays.values()].includes(60000));
 }finally{await f.close();}
});
test('source selection survives leaving and remounting the page',async()=>{
 const second='a5700000-0000-4000-8000-000000000002';
 const f=await fixture({sources:[{id,name:'First',region:'in',status:'connected'},{id:second,name:'Second',region:'in',status:'connected'}]});try{
  await f.act(()=>{const select=f.w.document.querySelector('#zoho-source-selector');select.value=second;select.dispatchEvent(new f.w.Event('change',{bubbles:true}));});
  await f.act(()=>f.w.auditRoot.render(null));await f.act(()=>f.w.auditMount());
  assert.equal(f.w.document.querySelector('#zoho-source-selector').value,second);
  assert.equal(new URL(f.w.location.href).searchParams.get('source'),second);
 }finally{await f.close();}
});
test('discovery progress updates when execution history fails',async()=>{
 const f=await fixture({candidate:true});try{
  f.state.approved=true;f.state.failures.executions=1;
  f.state.run={id,connection_id:id,module:'Candidates',state:'running',next_page:5,received_count:40,staged_count:40,created_at:new Date().toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  assert.match(f.w.document.querySelector('[aria-label="Discovery progress"]').textContent,/Reading batch 5/);
  assert.match(f.w.document.body.textContent,/Injected executions outage/);
 }finally{await f.close();}
});

test('background refresh removes records that stopped matching across loaded pages',async()=>{
 const f=await fixture({recordCount:51});try{
  await f.act(()=>{const select=f.w.document.querySelector('[aria-label="Review state"]');select.value='pending_approval';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));});
  await f.act(()=>f.button('Load more records').click());
  assert.equal(f.w.document.querySelectorAll('tbody tr').length,51);
  const original=f.w.fetch;
  f.w.fetch=async(url,options)=>{
   const u=new URL(url,'http://localhost');
   if(!options?.method&&['records','record_window'].includes(u.searchParams.get('view'))){
    const first=await (await original(url,options)).json();
    const older=await (await original(url+'&before=2026-01-01',options)).json();
    return Response.json({records:[...first.records.slice(1),...older.records],total:50});
   }
   return original(url,options);
  };
  await f.act(()=>f.button('Refresh status').click());
  assert.equal(f.w.document.querySelectorAll('tbody tr').length,50);
  assert.equal(Boolean(f.w.document.querySelector('[aria-label="Select source 1000"]')),false);
  assert.match(f.w.document.body.textContent,/50 displayed of 50 matching records/);
 }finally{await f.close();}
});
test('hold confirmation is disabled after refresh removes its selection',async()=>{
 const f=await fixture();try{
  await f.approve();
  await f.act(()=>f.w.document.querySelector('[aria-label="Select source 888"]').click());
  await f.act(()=>f.button('Hold').click());
  await f.act(()=>{const field=f.w.document.querySelector('dialog textarea');Object.getOwnPropertyDescriptor(f.w.HTMLTextAreaElement.prototype,'value').set.call(field,'Reviewed hold reason');field.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
  f.state.changed=true;await f.act(()=>[...f.timers.values()][0]());
  assert.match(f.w.document.querySelector('[aria-labelledby="decision-title"]').textContent,/reviewed selection changed/);
  assert.equal(f.button('Confirm decision').disabled,true);
 }finally{await f.close();}
});
test('filter changes show loading instead of an empty result and stale total',async()=>{
 const f=await fixture();let release;try{
  const original=f.w.fetch;
  f.w.fetch=async(url,options)=>['records','record_window'].includes(new URL(url,'http://localhost').searchParams.get('view'))?new Promise(resolve=>{release=async()=>resolve(await original(url,options));}):original(url,options);
  await f.act(()=>{const select=f.w.document.querySelector('[aria-label="Review state"]');select.value='held';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));});
  assert.match(f.w.document.body.textContent,/Loading records…/);
  assert.doesNotMatch(f.w.document.body.textContent,/No matching records|0 displayed of/);
  assert.equal(f.w.document.querySelector('[role="tabpanel"]:not([hidden])').getAttribute('aria-busy'),'true');
  await f.act(()=>release());
  assert.equal(f.w.document.querySelector('[role="tabpanel"]:not([hidden])').getAttribute('aria-busy'),'false');
 }finally{await f.close();}
});
test('empty review preserves native page scrolling without changing record-list position',async()=>{
 const f=await fixture({candidate:true});try{
  const panel=f.w.document.querySelector('[aria-label="Record review"]'),table=f.w.document.querySelector('[aria-label="Source records"]');
  Object.defineProperties(table,{clientHeight:{value:200},scrollHeight:{value:1000}});
  for(const position of [0,300,800]){
   table.scrollTop=position;
   for(const options of [{deltaY:150},{deltaY:-150},{deltaY:1,deltaMode:1},{deltaY:1,deltaMode:2},{deltaX:150,deltaY:0},{deltaY:150,ctrlKey:true}]){
    const event=new f.w.WheelEvent('wheel',{bubbles:true,cancelable:true,...options});panel.dispatchEvent(event);
    assert.equal(event.defaultPrevented,false);assert.equal(table.scrollTop,position);
   }
  }
  assert.equal(f.state.posts.length,0);
 }finally{await f.close();}
});
test('empty review retains native page scrolling after an initial integration outage recovers',async()=>{
 const f=await fixture({candidate:true,summaryError:true});try{
  assert.equal(Boolean(f.w.document.querySelector('[aria-label="Record review"]')),false);
  const original=f.w.fetch;
  f.w.fetch=async(url,options)=>new URL(url,'http://localhost').searchParams.has('view')?original(url,options):Response.json({
   connections:[{id,name:'Recovered source',region:'in',status:'connected'}],countsByConnection:{},
   capabilities:{oauth:false,discovery:true,execution:{ready:true,modules:['Candidates','Job_Openings']}}
  });
  await f.act(()=>f.button('Refresh status').click());
  const panel=f.w.document.querySelector('[aria-label="Record review"]'),table=f.w.document.querySelector('[aria-label="Source records"]');
  assert.ok(panel);assert.ok(table);
  Object.defineProperties(table,{clientHeight:{value:200},scrollHeight:{value:1000}});table.scrollTop=300;
  const event=new f.w.WheelEvent('wheel',{deltaY:150,bubbles:true,cancelable:true});panel.dispatchEvent(event);
  assert.equal(event.defaultPrevented,false);assert.equal(table.scrollTop,300);
 }finally{await f.close();}
});

test('closing a mobile review keeps its selected candidate available',async()=>{
 const f=await fixture({candidate:true,compact:true});try{
  await f.act(()=>f.button('Audit candidate 999').click());
  assert.equal(f.w.document.querySelector('aside').getAttribute('role'),'dialog');
  await f.act(()=>f.w.document.querySelector('[aria-label="Close record review"]').click());
  assert.equal(f.w.document.querySelector('aside').getAttribute('role'),null);
  assert.equal(f.w.document.querySelector('aside').hidden,true);
  assert.ok(f.button('Go to candidate administration'),'Selected candidate context must survive drawer dismissal');
 }finally{await f.close();}
});

test('mobile review isolates the background, traps focus and restores it on dismissal',async()=>{
 const f=await fixture({candidate:true,compact:true});try{
  const opener=f.button('Audit candidate 999');
  await f.act(()=>opener.click());
  const panel=f.w.document.querySelector('[aria-label="Record review"]');
  const backdrop=f.w.document.querySelector('[data-review-backdrop]');
  assert.equal(panel.getAttribute('aria-modal'),'true');
  assert.equal(Boolean(opener.closest('[inert]')),true);
  assert.equal(Boolean(backdrop.closest('[inert]')),false);
  assert.equal(f.w.document.body.style.overflow,'hidden');
  assert.equal(f.w.document.activeElement===panel,true);
  await f.act(()=>panel.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})));
  assert.equal(f.w.document.activeElement===f.button('Go to candidate administration'),true);
  await f.act(()=>panel.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));
  assert.equal(f.w.document.activeElement===f.w.document.querySelector('[aria-label="Close record review"]'),true);
  await f.act(()=>panel.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  assert.equal(panel.hidden,true);
  assert.equal(f.w.document.querySelectorAll('[inert]').length,0);
  assert.equal(f.w.document.body.style.overflow,'');
  assert.equal(f.w.document.activeElement===opener,true);
  await f.act(()=>opener.click());
  await f.act(()=>f.w.document.querySelector('[data-review-backdrop]').click());
  assert.equal(panel.hidden,true);
  assert.equal(f.w.document.activeElement===opener,true);
 }finally{await f.close();}
});

test('review switches between desktop panel and mobile drawer without losing its record',async()=>{
 const f=await fixture({candidate:true});try{
  await f.act(()=>f.button('Audit candidate 999').click());
  const panel=f.w.document.querySelector('[aria-label="Record review"]');
  assert.equal(panel.getAttribute('aria-modal'),null);
  await f.resize(true);
  assert.equal(panel.getAttribute('aria-modal'),'true');
  assert.equal(f.w.document.body.style.overflow,'hidden');
  await f.resize(false);
  assert.equal(panel.getAttribute('role'),null);
  assert.equal(panel.hidden,false);
  assert.equal(f.w.document.body.style.overflow,'');
  assert.equal(f.w.document.querySelectorAll('[inert]').length,0);
  assert.match(panel.textContent,/Audit candidate 999/);
 }finally{await f.close();}
});

test('refresh revalidates later-page revisions and preserves other unchanged selections',async()=>{
 const f=await fixture({recordCount:51});try{
  await f.act(()=>f.button('Load more records').click());
  await f.act(()=>f.w.document.querySelector('[aria-label="Select source 1000"]').click());
  await f.act(()=>f.w.document.querySelector('[aria-label="Select source 1050"]').click());
  const original=f.w.fetch;
  f.w.fetch=async(url,options)=>{
   const response=await original(url,options);
   if(!options?.method&&['records','record_window'].includes(new URL(url,'http://localhost').searchParams.get('view'))){
    const result=await response.json();return Response.json({...result,records:result.records.map(row=>row.external_id==='1050'?{...row,revision:2}:row)});
   }
   return response;
  };
  await f.act(()=>f.button('Refresh status').click());
  assert.equal(f.w.document.querySelectorAll('tbody tr').length,51);
  assert.equal(f.w.document.querySelector('[aria-label="Select source 1000"]').checked,true);
  assert.equal(f.w.document.querySelector('[aria-label="Select source 1050"]').checked,false);
 }finally{await f.close();}
});

test('selected candidates show their missing review and a direct review action',async()=>{
 const f=await fixture({candidate:true});try{
  await f.act(()=>f.w.document.querySelector('[aria-label="Select source 999"]').click());
  const requirements=f.w.document.querySelector('[aria-label="Approval requirements"]');
  assert.match(requirements.textContent,/Audit candidate 999: Check canonical account/);
  assert.equal(f.button('Approve selection').disabled,true);
  await f.act(()=>f.button('Review next candidate').click());
  assert.ok(f.button('Check canonical account'));
  await f.act(()=>f.button('Check canonical account').click());
  assert.match(f.w.document.querySelector('[aria-label="Approval requirements"]').textContent,/Acknowledge and select/);
  await f.act(()=>f.button('Acknowledge and select').click());
  assert.equal(Boolean(f.w.document.querySelector('[aria-label="Approval requirements"]')),false);
  assert.equal(f.button('Approve selection').disabled,false);
  assert.equal(f.state.approved,false);
 }finally{await f.close();}
});

test('idle review expiry disables approval without polling and requires a fresh acknowledgement',async()=>{
 const f=await fixture({candidate:true,reviewTtl:200});try{
  await f.act(()=>f.button('Audit candidate 999').click());
  await f.act(()=>f.button('Check canonical account').click());
  await f.act(()=>f.button('Acknowledge and select').click());
  assert.equal(f.button('Approve selection').disabled,false);
  assert.equal(f.timers.size,0);
  await f.act(()=>new Promise(resolve=>setTimeout(resolve,250)));
  assert.equal(f.button('Approve selection').disabled,true);
  assert.match(f.w.document.querySelector('[aria-label="Approval requirements"]').textContent,/expired/);
  await f.act(()=>f.button('Refresh check').click());
  assert.equal(f.button('Approve selection').disabled,true);
  await f.act(()=>f.button('Acknowledge and select').click());
  assert.equal(f.button('Approve selection').disabled,false);
  assert.equal(f.state.approved,false);
 }finally{await f.close();}
});

test('expiry inside confirmation explains the blocker and opens a focused review',async()=>{
 const f=await fixture({candidate:true,reviewTtl:300});try{
  await f.act(()=>f.button('Audit candidate 999').click());
  await f.act(()=>f.button('Check canonical account').click());
  await f.act(()=>f.button('Acknowledge and select').click());
  await f.act(()=>f.button('Approve selection').click());
  await f.act(()=>{const field=f.w.document.querySelector('dialog textarea');Object.getOwnPropertyDescriptor(f.w.HTMLTextAreaElement.prototype,'value').set.call(field,'Reviewed candidate');field.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
  assert.equal(f.button('Confirm decision').disabled,false);
  await f.act(()=>new Promise(resolve=>setTimeout(resolve,350)));
  assert.equal(f.button('Confirm decision').disabled,true);
  assert.match(f.w.document.querySelector('dialog [role="alert"]').textContent,/expired/);
  await f.act(()=>f.button('Close and review selection').click());
  assert.equal(f.w.document.querySelector('[aria-labelledby="decision-title"]').open,false);
  assert.equal(f.w.document.activeElement===f.w.document.querySelector('aside'),true);
  assert.equal(f.state.approved,false);
 }finally{await f.close();}
});

test('desktop next-review action moves focus into the panel and restores it on close',async()=>{
 const f=await fixture({candidate:true});try{
  await f.act(()=>f.w.document.querySelector('[aria-label="Select source 999"]').click());
  const action=f.button('Review next candidate');action.focus();
  await f.act(()=>action.click());
  assert.equal(f.w.document.activeElement===f.w.document.querySelector('aside'),true);
  await f.act(()=>f.w.document.querySelector('[aria-label="Close record review"]').click());
  assert.equal(f.w.document.activeElement===action,true);
 }finally{await f.close();}
});

for(const status of ['paused','connected'])test(`known ${status==='paused'?'paused source':'stale source revision'} blocks canonical checks before POST`,async()=>{
 const f=await fixture({candidate:true,sources:[{id,name:'Audit fixture',region:'in',status,configRevision:5}]});try{
  await f.act(()=>f.button('Audit candidate 999').click());
  assert.equal(f.button('Check canonical account').disabled,true);
  assert.match(f.w.document.querySelector('aside').textContent,status==='paused'?/Resume connection.*fresh discovery/:/Source configuration changed.*fresh discovery/);
  assert.match(f.w.document.querySelector('tbody').textContent,/Fresh discovery required/);
  assert.equal(f.state.posts.length,0);
 }finally{await f.close();}
});

test('a review conflict is shown beside the record and refreshes source state once',async()=>{
 const sources=[{id,name:'Audit fixture',region:'in',status:'connected',configRevision:1}];
 const f=await fixture({candidate:true,sources});try{
  const original=f.w.fetch;let attempts=0;
  f.w.fetch=async(url,options)=>{
   if(options?.method==='POST'&&JSON.parse(options.body).action==='review_candidate'){
    attempts++;sources[0].status='paused';sources[0].configRevision=2;
    return Response.json({code:'SOURCE_PAUSED',error:'Source is paused. Resume connection, then run fresh discovery.'},{status:409});
   }
   return original(url,options);
  };
  await f.act(()=>f.button('Audit candidate 999').click());
  await f.act(()=>f.button('Check canonical account').click());
  assert.match(f.w.document.querySelector('aside').textContent,/Source is paused/);
  assert.equal(f.button('Check canonical account').disabled,true);
  assert.equal(attempts,1);
  assert.equal(f.state.approved,false);
 }finally{await f.close();}
});

test('review workspace keeps actions above a bounded table and advanced controls in an inactive tab',async()=>{
 const f=await fixture({candidate:true,recordCount:50});try{
  const actions=f.w.document.querySelector('[aria-label="Selection actions"]');
  const table=f.w.document.querySelector('[aria-label="Source records"]');
  assert.ok(actions.compareDocumentPosition(table)&f.w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(table.className.includes('tableScroller'));
  assert.equal(table.tabIndex,0);
  assert.equal(f.w.document.querySelector('#zoho-panel-advanced').hidden,true);
  assert.equal(Boolean([...f.w.document.querySelectorAll('details')].find(n=>n.querySelector('summary')?.textContent.includes('Connection and privacy'))),false);
  const review=f.w.document.querySelector('[aria-label="Record review"]');
  assert.ok(review.closest('div')&&!table.contains(review),'Review must be independent of the table scroller');
  for(let node=review.parentElement;node;node=node.parentElement)assert.doesNotMatch(node.className||'',/overflow-hidden/);
 }finally{await f.close();}
});
test('resumed source distinguishes an old failed scan and preserves expandable error history',async()=>{
 const f=await fixture({candidate:true,sources:[{id,name:'Current source',region:'in',status:'connected',configRevision:8}]});try{
  f.state.run={id,connection_id:id,module:'Candidates',state:'failed',config_revision:4,last_error:'CONNECTION_CHANGED',next_page:10,received_count:90,staged_count:90,created_at:new Date().toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  const progress=f.w.document.querySelector('[aria-label="Discovery progress"]');
  assert.match(progress.textContent,/Fresh discovery required/);
  assert.doesNotMatch(progress.textContent,/Discovery stopped/);
  const history=[...f.w.document.querySelectorAll('details')].find(n=>n.querySelector('summary')?.textContent.includes('View error details'));
  assert.ok(history);assert.equal(history.open,false);
  assert.match(history.textContent,/Source configuration changed/);
 }finally{await f.close();}
});
test('fresh-discovery card retains real metric values and opens the history tab with focus',async()=>{
 const f=await fixture({candidate:true,sources:[{id,name:'Current source',region:'in',status:'connected',configRevision:2}]});try{
  f.state.run={id,connection_id:id,module:'Candidates',state:'failed',config_revision:1,last_error:'CONNECTION_CHANGED',next_page:8,received_count:70,staged_count:70,deferred_count:0,created_at:'2026-11-04T10:57:32Z'};
  await f.act(()=>f.button('Refresh status').click());
  const card=f.w.document.querySelector('[aria-label="Discovery progress"]');
  assert.match(card.textContent,/Fresh discovery required/);
  assert.deepEqual([...card.querySelectorAll('dt')].map(el=>el.textContent),['Received','Staged','Deferred','Not staged','Batches saved']);
  assert.deepEqual([...card.querySelectorAll('dd')].map(el=>el.textContent),['70','70','0','0','7']);
  assert.match(card.querySelector('footer').textContent,/Previous scan:/);
  assert.equal(card.querySelector('time').dateTime,'2026-11-04T10:57:32.000Z');
  assert.equal(Boolean(card.querySelector('[role="progressbar"]')),false);
  const link=f.button('View discovery history');await f.act(()=>{link.focus();link.click();});
  assert.equal(f.w.document.querySelector('#zoho-panel-history').hidden,false);
  assert.equal(f.w.document.activeElement===f.w.document.querySelector('#zoho-panel-history'),true);
  assert.equal(f.state.posts.length,0);
 }finally{await f.close();}
});
test('a failure from current settings stays visible as a current failure',async()=>{
 const f=await fixture({candidate:true,sources:[{id,name:'Current source',region:'in',status:'connected',configRevision:8}]});try{
  f.state.run={id,connection_id:id,module:'Candidates',state:'failed',config_revision:8,last_error:'SOURCE_INVALID',next_page:1,created_at:new Date().toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  const progress=f.w.document.querySelector('[aria-label="Discovery progress"]');
  assert.match(progress.textContent,/Discovery stopped/);
  assert.doesNotMatch(progress.textContent,/Fresh discovery required/);
 }finally{await f.close();}
});
test('paused sources expose resume controls when settings open',async()=>{
 const f=await fixture({candidate:true,sources:[{id,name:'Paused source',region:'in',status:'paused',configRevision:8}]});try{
  await f.act(()=>f.button('Integration settings').click());
  const controls=[...f.w.document.querySelectorAll('details')].find(n=>n.querySelector('summary')?.textContent.includes('Connection and privacy'));
  assert.equal(controls.open,true);
  assert.match(controls.querySelector('summary').textContent,/Paused — resume here/);
 }finally{await f.close();}
});

test('settings open as a named modal while source switching stays near the overview',async()=>{
 const f=await fixture({candidate:true});try{
  const overview=f.w.document.querySelector('[aria-label="Integration overview"]');
  const health=f.w.document.querySelector('[aria-label="Integration health"]');
  const workflow=f.w.document.querySelector('[aria-label="Approval workflow"]');
  assert.ok(overview&&health&&workflow);
  assert.equal(f.w.document.querySelectorAll('#zoho-source-selector').length,1);
  assert.ok(overview.querySelector('#zoho-source-selector'));
  assert.equal(workflow.querySelectorAll('li').length,4);
  assert.match(overview.textContent,/Manual discovery/);
  assert.match(health.textContent,/Ready/);
  const settings=f.w.document.querySelector('#zoho-connection-settings');
  const records=f.w.document.querySelector('[role="tabpanel"]');
  assert.ok(records.compareDocumentPosition(settings)&f.w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(settings.tagName,'DIALOG');assert.equal(settings.open,false);
  await f.act(()=>f.button('Integration settings').click());
  assert.equal(settings.open,true);assert.equal(f.w.document.body.style.overflow,'hidden');
  assert.equal(settings.getAttribute('aria-labelledby'),'zoho-settings-title');
  await f.act(()=>f.w.document.querySelector('[aria-label="Close integration settings"]').click());
  assert.equal(settings.open,false);assert.equal(f.w.document.body.style.overflow,'');
  assert.equal(f.state.posts.length,0);
 }finally{await f.close();}
});

test('discovery actions follow start, queued pause, resume, running stop and restart without approving records',async()=>{
 const f=await fixture({candidate:true,discoveryAvailable:true});try{
  const explain=()=>f.act(()=>{const field=f.w.document.querySelector('[aria-label="Discovery control reason"]');Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype,'value').set.call(field,'Operator testing control');field.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
  assert.equal(f.button('Start discovery').disabled,false);
  await f.act(()=>f.button('Start discovery').click());
  assert.equal(f.button('Pause discovery').disabled,false);assert.ok(f.button('Stop discovery'));
  await f.act(()=>f.button('Pause discovery').click());
  assert.equal(f.button('Confirm pause').disabled,true);assert.equal(f.state.posts.length,1);
  await explain();await f.act(()=>f.button('Confirm pause').click());
  assert.equal(f.button('Resume discovery').disabled,false);assert.ok(f.button('Stop discovery'));
  assert.match(f.w.document.querySelector('[aria-label="Discovery progress"]').textContent,/Discovery paused/);
  await f.act(()=>f.button('Resume discovery').click());await explain();await f.act(()=>f.button('Confirm resume').click());
  assert.equal(f.button('Pause discovery').disabled,false);
  f.state.run={...f.state.run,state:'running',next_page:9,received_count:80,staged_count:80};
  await f.act(()=>f.button('Refresh status').click());
  await f.act(()=>f.button('Stop discovery').click());
  assert.match(f.w.document.querySelector('[aria-labelledby="discovery-action-title"]').textContent,/later start begins a fresh scan/);
  assert.equal(f.button('Confirm stop').disabled,true);
  await explain();await f.act(()=>f.button('Confirm stop').click());
  assert.ok(f.button('Start discovery'));assert.equal(f.button('Stop discovery'),undefined);
  assert.match(f.w.document.querySelector('[aria-label="Discovery progress"]').textContent,/Discovery cancelled/);
  assert.deepEqual(f.state.posts.map(p=>p.action),['discover','control_discovery','control_discovery','control_discovery']);
  assert.deepEqual(f.state.posts.slice(1).map(p=>p.input.command),['pause','resume','cancel']);
  assert.equal(f.state.approved,false);
 }finally{await f.close();}
});
test('stopping a paused scan can be dismissed and failed controls do not imply a state change',async()=>{
 const f=await fixture({candidate:true,discoveryAvailable:true});try{
  f.state.run={id,connection_id:id,module:'Candidates',state:'running',control_state:'paused',next_page:4,created_at:new Date().toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  await f.act(()=>f.button('Stop discovery').click());await f.act(()=>f.button('Keep current state').click());
  assert.equal(f.state.posts.length,0);assert.equal(f.w.document.activeElement.id,'zoho-discovery-action');
  await f.act(()=>f.button('Resume discovery').click());
  await f.act(()=>{const field=f.w.document.querySelector('[aria-label="Discovery control reason"]');Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype,'value').set.call(field,'Retry source');field.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
  f.state.controlError='Discovery state changed. Refresh status.';
  await f.act(()=>f.button('Confirm resume').click());
  assert.equal(f.state.run.control_state,'paused');assert.ok(f.button('Resume discovery'));
  assert.match(f.w.document.querySelector('[role="alert"]').textContent,/Discovery state changed/);
 }finally{await f.close();}
});

test('opening, refreshing and reopening settings reload summary without changing records or approving anything',async()=>{
 const f=await fixture({candidate:true});try{
  const original=f.w.fetch;let summaries=0;
  f.w.fetch=(input,options)=>{const u=new URL(input,'http://localhost');if(!u.searchParams.get('view')&&!options?.method)summaries++;return original(input,options);};
  await f.act(()=>f.button('Integration settings').click());assert.equal(summaries,1);
  await f.act(()=>f.button('Refresh settings').click());assert.equal(summaries,2);
  await f.act(()=>f.w.document.querySelector('[aria-label="Close integration settings"]').click());
  await f.act(()=>f.button('Integration settings').click());assert.equal(summaries,3);
  assert.equal(f.w.document.querySelector('[role="tab"][aria-selected="true"]').textContent,'Candidates');
  assert.equal(f.state.posts.length,0);
 }finally{await f.close();}
});

test('profile tabs are keyboard accessible and single-record approval retains canonical review requirements',async()=>{
 const f=await fixture({candidate:true});try{
  await f.act(()=>f.button('Audit candidate 999').click());
  assert.equal(f.button('Approve').disabled,true);
  const tabs=f.w.document.querySelector('[aria-label="Candidate detail views"]');
  await f.act(()=>tabs.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  assert.equal(f.w.document.getElementById('zoho-profile-tab-activity').getAttribute('aria-selected'),'true');
  assert.equal(f.w.document.getElementById('zoho-profile-panel-activity').hidden,false);
  assert.match(f.w.document.getElementById('zoho-profile-panel-activity').textContent,/Record activity/);
  await f.act(()=>f.button('Profile').click());
  await f.act(()=>f.button('Check canonical account').click());assert.equal(f.button('Approve').disabled,true);
  await f.act(()=>f.button('Acknowledge and select').click());assert.equal(f.button('Approve').disabled,false);
  await f.act(()=>f.w.document.querySelector('[aria-label="Select source 888"]').click());
  assert.equal(f.button('Approve').disabled,true);
  assert.ok(f.state.posts.every(p=>p.action==='review_candidate'));
 }finally{await f.close();}
});
test('header Run discovery starts one scan and switches to its existing controls',async()=>{
 const f=await fixture({candidate:true,discoveryAvailable:true});try{
  await f.act(()=>f.button('Run discovery').click());
  assert.equal(f.state.posts.length,1);assert.equal(f.state.posts[0].action,'discover');
  assert.ok(f.button('Discovery controls'));assert.ok(f.button('Pause discovery'));
 }finally{await f.close();}
});

test('cooldown shows saved counts, readable durations and no processing animation',async()=>{
 const f=await fixture({candidate:true,discoveryAvailable:true});try{
  const now=Date.now();f.w.Date.now=()=>now;
  f.state.run={id,connection_id:id,module:'Candidates',state:'queued',control_state:'active',last_error:'RATE_LIMITED',next_attempt_at:new Date(now+2400000).toISOString(),created_at:new Date(now-5360000).toISOString(),received_count:1300,staged_count:1300,next_page:131};
  await f.act(()=>f.button('Refresh status').click());
  let panel=f.w.document.querySelector('[aria-label="Discovery progress"]');
  assert.match(panel.textContent,/Retry eligible in 40m/);
  assert.match(panel.textContent,/1h 29m 20s elapsed/);
  assert.match(panel.textContent,/1[,\s]?300/);
  assert.match(panel.textContent,/Connector request budget or source throttling/);
  assert.equal(Boolean(panel.querySelector('[role="progressbar"]')),false);
  assert.equal(Boolean(panel.querySelector('[class*=spinning]')),false);
  assert.equal(f.button('Pause discovery').disabled,false);
  f.w.Date.now=()=>now+2400001;
  await f.act(()=>{for(const fn of [...f.timers.values()])fn();});
  panel=f.w.document.querySelector('[aria-label="Discovery progress"]');
  assert.match(panel.textContent,/Retry eligible now/);
  assert.match(panel.textContent,/waiting for the background processor/);
  f.state.run={...f.state.run,state:'running'};
  await f.act(()=>f.button('Refresh status').click());
  panel=f.w.document.querySelector('[aria-label="Discovery progress"]');
  assert.ok(panel.querySelector('[role="progressbar"]'));
  assert.doesNotMatch(panel.textContent,/Retry eligible in/);
 }finally{await f.close();}
});
test('retry without a valid timestamp does not claim eligibility',async()=>{
 const f=await fixture({candidate:true});try{
  f.state.run={id,connection_id:id,module:'Candidates',state:'queued',last_error:'RATE_LIMITED',next_attempt_at:'invalid',created_at:new Date().toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  await f.act(()=>f.button('Integration settings').click());
 const panel=f.w.document.querySelector('[aria-label="Discovery progress"]');
  assert.match(panel.textContent,/Waiting for retry scheduling/);
  assert.doesNotMatch(panel.textContent,/Invalid Date|Retry eligible now/);
 }finally{await f.close();}
});

test('confirmation lists the exact frozen records and prevents a refreshed subset from being confirmed',async()=>{
 const f=await fixture();try{
  await f.act(()=>{f.w.document.querySelector('[aria-label="Select source 999"]').click();f.w.document.querySelector('[aria-label="Select source 888"]').click();});
  const trigger=f.button('Hold');await f.act(()=>{trigger.focus();trigger.click();});
  const dialog=f.w.document.querySelector('[aria-labelledby="decision-title"]');
  assert.match(dialog.querySelector('[aria-label="Records in this decision"]').textContent,/Audit job 999/);
  assert.match(dialog.querySelector('[aria-label="Records in this decision"]').textContent,/Audit job 888/);
  assert.equal(dialog.querySelector('label').htmlFor,'zoho-decision-reason');
  assert.match(dialog.textContent,/Enter at least 3 characters/);
  await f.act(()=>{const field=dialog.querySelector('textarea');Object.getOwnPropertyDescriptor(f.w.HTMLTextAreaElement.prototype,'value').set.call(field,'Reviewed both jobs');field.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
  assert.equal(f.button('Confirm decision').disabled,false);
  f.state.changed=true;await f.act(()=>f.button('Refresh status').click());
  assert.equal(f.button('Confirm decision').disabled,true);
  assert.match(dialog.textContent,/reviewed selection changed/);
  assert.match(dialog.querySelector('[aria-label="Records in this decision"]').textContent,/Audit job 888/,'Original confirmation list must not silently shrink');
  await f.act(()=>dialog.querySelector('form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(f.state.posts.filter(post=>post.action==='decide').length,0);
  await f.act(()=>dialog.querySelector('[aria-label="Close confirmation"]').click());
  assert.equal(f.w.document.activeElement===trigger,true);
 }finally{await f.close();}
});
test('unavailable summary is not displayed as a disconnected Zoho account',async()=>{
 const f=await fixture({candidate:true,summaryError:true});try{
  assert.match(f.w.document.body.textContent,/Status unavailable/);
  assert.doesNotMatch(f.w.document.querySelector('header').textContent,/Not connected/i);
 }finally{await f.close();}
});

test('settings mount on demand and Advanced retains its inactive instance after its first visit',async()=>{
 const f=await fixture({candidate:true});try{
  assert.equal(f.w.document.querySelectorAll('[data-audit-panel]').length,0);
  await f.act(()=>f.button('Integration settings').click());
  assert.equal(f.w.document.querySelectorAll('[data-audit-panel]').length,2);
  await f.act(()=>f.w.document.querySelector('[aria-label="Close integration settings"]').click());
  assert.equal(f.w.document.querySelectorAll('[data-audit-panel]').length,0);
  await f.act(()=>f.w.document.querySelector('#zoho-tab-advanced').click());
  assert.equal(f.w.document.querySelectorAll('[data-audit-panel]').length,1);
  const advanced=f.w.document.querySelector('[data-audit-panel]');
  assert.equal(advanced.getAttribute('data-audit-active'),'true');
  await f.act(()=>f.w.document.querySelector('#zoho-tab-Candidates').click());
  assert.equal(f.w.document.querySelector('[data-audit-panel]')===advanced,true);
  assert.equal(advanced.closest('[role="tabpanel"]').hidden,true);
  assert.equal(advanced.getAttribute('data-audit-active'),'false');
  await f.act(()=>f.w.document.querySelector('#zoho-tab-advanced').click());
  assert.equal(f.w.document.querySelector('[data-audit-panel]')===advanced,true);
  assert.equal(advanced.getAttribute('data-audit-active'),'true');
 }finally{await f.close();}
});
test('a long discovery retry uses a slow stable timer and names its waiting activity',async()=>{
 const f=await fixture({candidate:true});try{
  f.state.run={id,connection_id:id,module:'Candidates',state:'queued',control_state:'active',next_page:4,last_error:'RATE_LIMITED',next_attempt_at:new Date(Date.now()+3600000).toISOString(),created_at:new Date().toISOString()};
  await f.act(()=>f.button('Refresh status').click());
  assert.match(f.w.document.querySelector('[aria-label="Integration overview"]').textContent,/Waiting to retry/);
  assert.ok([...f.timerDelays.values()].includes(60000));
  const poll=[...f.timerDelays].find(([,delay])=>delay===60000)[0];
  await f.act(()=>f.timers.get(poll)());
  assert.equal(f.timers.has(poll),true,'Snapshot updates must not reset the polling timer');
 }finally{await f.close();}
});
test('polling backs off after an authority failure without sending the remaining request fan-out',async()=>{
 const f=await fixture();try{
  await f.approve();f.state.failures.summary=2;
  const before=f.state.reads.length;
  await f.act(()=>[...f.timers.values()][0]());
  assert.equal(f.state.reads.length-before,1);
  assert.ok([...f.timerDelays.values()].includes(30000));
 }finally{await f.close();}
});
test('erased candidates cannot be selected or checked and have a nonempty review heading',async()=>{
 const f=await fixture({candidate:true});try{
  const original=f.w.fetch;
  f.w.fetch=async(url,options)=>{const response=await original(url,options);if(new URL(url,'http://localhost').searchParams.get('view')!=='record_window')return response;
   const result=await response.json();return Response.json({...result,records:result.records.map(row=>row.external_id==='999'?{...row,proposed_data:{},decision:'rejected',payload_redacted_at:new Date().toISOString()}:row)});};
  await f.act(()=>f.button('Refresh status').click());
  assert.equal(f.w.document.querySelector('[aria-label="Select source 999"]').disabled,true);
  await f.act(()=>f.button('999').click());
  assert.equal(f.button('Check canonical account').disabled,true);
  assert.match(f.w.document.querySelector('aside').textContent,/Erased \/ suppressed/);
  assert.ok([...f.w.document.querySelectorAll('aside h3')].every(h=>h.textContent.trim().length>0));
 }finally{await f.close();}
});
