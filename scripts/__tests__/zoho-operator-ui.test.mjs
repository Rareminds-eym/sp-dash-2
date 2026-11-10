import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(resolve(root,'package.json'));
const {build}=require('esbuild'),{JSDOM}=createRequire(resolve(root,'package.json'))('jsdom');
let bundle;
before(async()=>{const built=await build({stdin:{contents:`import React,{act} from 'react';import{createRoot}from'react-dom/client';import Panel from './components/zoho/OperationsPanel.jsx';window.act=act;window.root=createRoot(document.getElementById('root'));window.mount=()=>window.root.render(React.createElement(Panel,window.props));`,resolveDir:resolve(root),loader:'jsx'},bundle:true,write:false,outdir:resolve(root,'.wrangler/ui-test-build'),format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve(root)},define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'buttons',setup(b){b.onResolve({filter:/^@\/components\/ui\/button$/},()=>({path:'button',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`import React from ${JSON.stringify(require.resolve('react'))};export const Button=({variant,size,...props})=>React.createElement('button',props);`,resolveDir:resolve(root)}));}}]});bundle=built.outputFiles.find(file=>file.path.endsWith('.js')).text;});
async function fixture({operationsFor,historyFor,active=true}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.IS_REACT_ACT_ENVIRONMENT=true;w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLElement.prototype.scrollIntoView=function(){};w.MessageChannel=class{constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};}};
 const timers=new Map();let timerId=0;w.setInterval=(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;};w.clearInterval=id=>timers.delete(id);
 const id='10000000-0000-4000-8000-000000000001',posts=[],gets=[];let pausedAction=null,releaseCommand;
 w.props={connectionId:id,module:'Candidates',record:{id,module:'Candidates',external_id:'123',revision:1},active};
 w.fetch=async(url,options={})=>{if(!options.method){const query=new URL(url,w.location.href).searchParams,selected=query.get('connectionId');gets.push(selected);
  if(query.get('view')==='operator_history'){const request={connectionId:selected,kind:query.get('kind'),view:query.get('historyView'),cursor:query.has('cursor')?JSON.parse(query.get('cursor')):null};
   return Response.json({page:historyFor?.(request)||{version:1,kind:request.kind,view:request.view,items:[],nextCursor:null}});}
  return Response.json({operations:operationsFor?.(selected)||{bulk:[],lifecycle:[],sourceEnabled:false,administration:[],deletedScans:[],connection:{status:'connected',credential_generation:1}}});}
  const command=JSON.parse(options.body);posts.push(command);
  if(command.action===pausedAction){pausedAction=null;return new Promise(resolve=>{releaseCommand=(result,status=200)=>resolve(Response.json(status===200?{result}:{error:result},{status}));});}
  return Response.json({result:command.action==='preview_candidate_administration'?{allowed:true,scope:'connector_only',changes:{preservePrimaryRole:true,grantDiscover:true},reviewHash:'a'.repeat(64),expiresAt:new Date(Date.now()+600000).toISOString()}:{state:'completed',requiresFreshCandidateReview:true}});
 };
 w.eval(bundle);const act=async(fn)=>w.act(async()=>{await fn?.();await new Promise(r=>setTimeout(r,5));});await act(()=>w.mount());
 const button=name=>[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
 async function reason(value){await act(()=>{const field=w.document.querySelector('textarea');Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(field,value);field.dispatchEvent(new w.Event('input',{bubbles:true}));});}
 return {w,posts,gets,id,timers,act,button,reason,pause(action){pausedAction=action;},async release(result,status){assert.ok(releaseCommand,'Expected paused command');await act(()=>releaseCommand(result,status));},
  async connection(value){w.props={...w.props,connectionId:value,record:{...w.props.record,id:value}};await act(()=>w.mount());},async active(value){w.props={...w.props,active:value};await act(()=>w.mount());},async close(){await act(()=>w.root.unmount());w.close();}};
}

test('inactive Advanced retains drafts, stops polling and refreshes on return without replacing edits',async()=>{
 const f=await fixture({operationsFor:()=>({connection:{status:'connected'},quota:{rolling_budget:1500,concurrent_limit:3},bulk:[{id:'bulk',state:'polling',module:'Candidates'}],deletedScans:[]})});try{
  await f.reason('Synthetic unsaved operator reason');
  await f.act(()=>{const input=f.w.document.querySelector('[aria-label="Source rolling budget"]');Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype,'value').set.call(input,'2222');input.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
  assert.ok(f.timers.size>0);
  await f.active(false);assert.equal(f.timers.size,0);
  const reads=f.gets.length;
  await f.act(()=>f.w.dispatchEvent(new f.w.Event('refreshPage')));
  assert.equal(f.gets.length,reads);
  await f.active(true);
  assert.ok(f.gets.length>reads);
  assert.equal(f.w.document.querySelector('textarea').value,'Synthetic unsaved operator reason');
  assert.equal(f.w.document.querySelector('[aria-label="Source rolling budget"]').value,'2222');
  assert.ok(f.timers.size>0);assert.equal(f.posts.length,0);
 }finally{await f.close();}
});

test('a source change clears retained drafts and does not fetch operations while inactive',async()=>{
 const first='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002';
 const f=await fixture({operationsFor:id=>({connection:{status:'connected'},quota:{rolling_budget:id===first?1500:777,concurrent_limit:2},bulk:[],deletedScans:[]})});try{
  await f.reason('Draft belonging to the first source');
  await f.active(false);const reads=f.gets.length;
  await f.connection(second);
  assert.equal(f.gets.length,reads);
  assert.equal(f.w.document.querySelector('textarea').value,'');
  await f.active(true);
  assert.equal(f.w.document.querySelector('[aria-label="Source rolling budget"]').value,'777');
  assert.equal(f.w.document.querySelector('textarea').value,'');assert.equal(f.posts.length,0);
 }finally{await f.close();}
});

test('an in-flight manual review survives tab changes without clearing busy state or repeating the command',async()=>{
 const f=await fixture();try{
  await f.reason('Explicit context review');await f.act(()=>f.w.document.querySelector('input[type="checkbox"]').click());
  f.pause('preview_candidate_administration');await f.act(()=>f.button('Review candidate administration').click());
  await f.active(false);await f.active(true);
  assert.equal(f.button('Review candidate administration').disabled,true);
  assert.equal(f.posts.length,1);
  await f.release({allowed:true,scope:'connector_only',changes:{grantDiscover:true},reviewHash:'a'.repeat(64),expiresAt:new Date(Date.now()+600000).toISOString()});
  assert.ok(f.button('Approve reviewed candidate action'));
  assert.equal(f.posts.length,1);
 }finally{await f.close();}
});
test('operator panel does not start disabled source processing or mutate on mount',async()=>{const f=await fixture();try{
 assert.equal(f.posts.length,0);assert.equal(f.button('Stage bulk export').disabled,true);assert.equal(f.button('Scan source deletions').disabled,true);assert.equal(f.button('Rotate paused credentials').disabled,true);
}finally{await f.close();}});
test('additional learner context requires reason, explicit acknowledgement, review and separate approval',async()=>{const f=await fixture();try{
 const review='Review candidate administration';assert.equal(f.button(review).disabled,true);await f.reason('Explicit additional learner context');assert.equal(f.button(review).disabled,true);
 await f.act(()=>f.w.document.querySelector('input[type="checkbox"]').click());assert.equal(f.button(review).disabled,false);
 await f.act(()=>f.button(review).click());assert.equal(f.posts.length,1);assert.equal(f.posts[0].input.acknowledgeIndependentDiscover,true);assert.equal('targetId'in f.posts[0].input,false);
 assert.ok(f.button('Approve reviewed candidate action'));await f.act(()=>f.button('Approve reviewed candidate action').click());
 assert.equal(f.posts[1].action,'execute_candidate_administration');assert.equal(f.posts[1].input.reviewHash,'a'.repeat(64));assert.match(f.posts[1].input.requestId,/^[a-f0-9-]{36}$/);
}finally{await f.close();}});
test('editing administration reason invalidates the prior review',async()=>{const f=await fixture();try{
 await f.reason('Reviewed purpose');await f.act(()=>f.w.document.querySelector('input[type="checkbox"]').click());await f.act(()=>f.button('Review candidate administration').click());
 assert.ok(f.button('Approve reviewed candidate action'));await f.reason('A materially different reviewed purpose');assert.equal(f.button('Approve reviewed candidate action'),undefined);assert.equal(f.posts.length,1);
}finally{await f.close();}});
test('a pending action cannot refresh the prior connection or show its review after switching sources',async()=>{
 const first='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002';
 const f=await fixture({operationsFor:id=>({bulk:[],lifecycle:[],administration:[],deletedScans:[],sourceEnabled:true,
  quota:{rolling_budget:id===first?111:222,concurrent_limit:2},connection:{status:id===first?'connected':'paused',credential_generation:1}})});try{
  await f.reason('Explicit context review');await f.act(()=>f.w.document.querySelector('input[type="checkbox"]').click());
  f.pause('preview_candidate_administration');await f.act(()=>f.button('Review candidate administration').click());assert.equal(f.posts.length,1);
  await f.connection(second);const readsAfterSwitch=f.gets.length;
  assert.match(f.w.document.body.textContent,/Current: 222 credits/);assert.equal(f.button('Stage bulk export').disabled,true);
  assert.equal(f.w.document.querySelector('[aria-label="Source rolling budget"]').value,'222');
  await f.release({allowed:true,scope:'connector_only',changes:{grantDiscover:true},reviewHash:'a'.repeat(64),expiresAt:new Date(Date.now()+600000).toISOString()});
  assert.equal(f.gets.length,readsAfterSwitch,'Old action must not start an old-source refresh');
  assert.match(f.w.document.body.textContent,/Current: 222 credits/);assert.equal(f.button('Approve reviewed candidate action'),undefined);
  assert.equal(Boolean(f.w.document.querySelector('[role="status"]')),false);assert.equal(f.button('Refresh operations').disabled,false);
 }finally{await f.close();}
});
test('a failed old-source action does not put its error on the newly selected connection',async()=>{const f=await fixture();try{
 await f.reason('Explicit context review');await f.act(()=>f.w.document.querySelector('input[type="checkbox"]').click());
 f.pause('preview_candidate_administration');await f.act(()=>f.button('Review candidate administration').click());
 await f.connection('10000000-0000-4000-8000-000000000002');await f.release('Failure from old source',503);
 assert.equal(Boolean(f.w.document.querySelector('[role="alert"]')),false);assert.equal(f.button('Refresh operations').disabled,false);
}finally{await f.close();}});
test('returning to the same connection cannot accept a result from its previous visit',async()=>{const f=await fixture();try{
 await f.reason('Explicit context review');await f.act(()=>f.w.document.querySelector('input[type="checkbox"]').click());
 f.pause('preview_candidate_administration');await f.act(()=>f.button('Review candidate administration').click());
 await f.connection('10000000-0000-4000-8000-000000000002');await f.connection(f.id);const reads=f.gets.length;
 await f.release({allowed:true,scope:'connector_only',reviewHash:'a'.repeat(64),expiresAt:new Date(Date.now()+600000).toISOString()});
 assert.equal(f.gets.length,reads);assert.equal(f.button('Approve reviewed candidate action'),undefined);assert.equal(Boolean(f.w.document.querySelector('[role="status"]')),false);
}finally{await f.close();}});
test('pending lifecycle and artifact cleanup pages remain independent from completed history',async()=>{
 const id=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`,cursor={timestamp:'2026-11-01T00:00:00Z',id:id(25)},reads=[];
 const f=await fixture({historyFor:request=>{
  reads.push(request);const page={version:1,kind:request.kind,view:request.view,items:[],nextCursor:null};
  if(request.kind==='canonical')return page;
  if(request.view==='history')return {...page,items:request.kind==='lifecycle'?[{id:id(90),module:'Candidates',external_id:'completed-history-only',kind:'permanent',revision:1,decision:'approved'}]:[]};
  const row=n=>request.kind==='lifecycle'?{id:id(n),module:'Candidates',external_id:String(n),kind:'permanent',revision:1,decision:'pending_approval'}:
   {request_id:id(n),action:'erase_connector',external_id:String(n),completed:true,artifacts_confirmed:false};
  return request.cursor?{...page,items:[{...row(26),external_id:request.kind==='lifecycle'?'older-pending-source':'older-artifact-pending'}]}:
   {...page,items:Array.from({length:25},(_,n)=>row(n+1)),nextCursor:cursor};
 }});try{
  await f.act(()=>f.button('Load more source decisions').click());assert.match(f.w.document.body.textContent,/older-pending-source/);
  await f.act(()=>f.button('Load more connector cleanup').click());assert.ok(f.button('Resume source older-artifact-pending'));
  assert.equal(reads.find(r=>r.kind==='administration'&&r.cursor)?.cursor.id,cursor.id);
  await f.act(()=>f.button('Completed source decisions').click());assert.match(f.w.document.body.textContent,/completed-history-only/);
  assert.doesNotMatch(f.w.document.body.textContent,/older-pending-source/);assert.equal(f.button('Approve source effect'),undefined);
  assert.ok(f.button('Resume source older-artifact-pending'));
 }finally{await f.close();}
});
test('canonical-only actions are discoverable on a fresh mount and older pages recover the exact request',async()=>{
 const first='50000000-0000-4000-8000-000000000001',older='50000000-0000-4000-8000-000000000002';
 const historyFor=request=>({version:1,kind:request.kind,view:request.view,
  items:request.kind==='canonical'?[{request_id:request.cursor?older:first,action:'erase_connector',external_id:request.cursor?'canonical-older':'canonical-latest',completed:false}]:[],
  nextCursor:request.kind==='canonical'&&!request.cursor?{timestamp:'2026-11-01T00:00:00Z',id:first}:null});
 const f=await fixture({historyFor});try{
  assert.equal(f.posts.length,0);assert.ok(f.button('Recover canonical source canonical-latest'));
  await f.act(()=>f.button('Load more canonical recovery').click());await f.act(()=>f.button('Recover canonical source canonical-older').click());
  assert.equal(f.posts[0].action,'recover_candidate_administration');assert.equal(f.posts[0].input.requestId,older);
 }finally{await f.close();}
 const reloaded=await fixture({historyFor});try{assert.equal(reloaded.posts.length,0);assert.ok(reloaded.button('Recover canonical source canonical-latest'));}
 finally{await reloaded.close();}
});

test('automatic allocation shows detected plan and usage without claiming remaining provider credits',async()=>{
 const f=await fixture({operationsFor:()=>({bulk:[],lifecycle:[],administration:[],deletedScans:[],licenseEnabled:true,sourceEnabled:false,connection:{status:'connected'},quota:{allocation_mode:'automatic',allocation_percent:20,license_plan_type:'enterprise',license_users:5,estimated_base_allowance:20000,used_units:999,rolling_budget:4000,concurrent_limit:5,license_fresh:true,license_checked_at:'2026-11-05T07:00:00Z'}})});try{
  assert.match(f.w.document.body.textContent,/enterprise/);assert.match(f.w.document.body.textContent,/20000/);assert.match(f.w.document.body.textContent,/999/);
  assert.equal(f.button('Use automatic allocation').disabled,true);
  assert.equal(f.button('Refresh plan from Zoho').disabled,false,'Plan metadata must not require the bulk artifact store');
  assert.equal(f.posts.length,0);
  await f.reason('Allocate reviewed connector share');
  assert.equal(f.button('Use automatic allocation').disabled,false);
  await f.act(()=>f.button('Use automatic allocation').click());
  assert.equal(f.posts[0].action,'configure_auto_allocation');assert.equal(f.posts[0].input.percent,20);
  await f.act(()=>f.button('Refresh plan from Zoho').click());
  assert.equal(f.posts[1].action,'refresh_source_license');
 }finally{await f.close();}
});
test('unknown plan uses an explicit fallback and invalid shares cannot be saved',async()=>{
 const f=await fixture({operationsFor:()=>({bulk:[],lifecycle:[],administration:[],deletedScans:[],connection:{status:'connected'},quota:{allocation_mode:'automatic',allocation_percent:20,license_fresh:false,fallback:true,rolling_budget:1000,concurrent_limit:2}})});try{
  assert.match(f.w.document.body.textContent,/Conservative fallback is active/);assert.match(f.w.document.body.textContent,/Not detected/);
  await f.reason('Reviewed automatic budget');
  const input=f.w.document.querySelector('[aria-label="Automatic allocation percentage"]');
  await f.act(()=>{Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype,'value').set.call(input,'101');input.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
  assert.equal(f.button('Use automatic allocation').disabled,true);
  assert.equal(f.posts.length,0);
 }finally{await f.close();}
});

test('advanced source polling respects far-future retries, remains stable and backs off outages',async()=>{
 const f=await fixture({operationsFor:()=>({connection:{status:'connected'},bulk:[{id:'fixture',module:'Candidates',state:'queued',next_attempt_at:new Date(Date.now()+86400000).toISOString(),last_error:'SOURCE_RETRY_DEFERRED',staged_count:0,issue_count:0}],deletedScans:[]})});try{
  assert.equal([...f.timers.values()][0].delay,60000);
  const first=[...f.timers.keys()][0];await f.act(()=>f.timers.get(first).fn());
  assert.equal(f.timers.has(first),true,'Successful snapshot refresh must not reset the timer');
  const original=f.w.fetch;f.w.fetch=(url,options)=>new URL(url,'http://localhost').searchParams.get('view')==='operations'?Promise.resolve(Response.json({error:'Temporary outage'},{status:503})):original(url,options);
  await f.act(()=>f.timers.get(first).fn());assert.equal([...f.timers.values()][0].delay,120000);
  await f.act(()=>[...f.timers.values()][0].fn());assert.equal([...f.timers.values()][0].delay,120000);
  assert.match(f.w.document.body.textContent,/check about every 120 seconds/);
 }finally{await f.close();}
});
test('budget exhaustion explains rolling replenishment and preserves the saved manual allocation',async()=>{
 const f=await fixture({operationsFor:()=>({connection:{status:'connected'},bulk:[],deletedScans:[],quota:{allocation_mode:'manual',rolling_budget:1500,concurrent_limit:3,used_units:1500,read_cost:3,read_request_possible:true,next_replenishment_at:'2026-11-06T06:09:08Z',read_available_at:'2026-11-06T06:09:10Z'}})});try{
  assert.match(f.w.document.body.textContent,/rolling 24-hour window/);
  assert.match(f.w.document.body.textContent,/midnight, restarting discovery and pausing do not reset/);
  assert.match(f.w.document.body.textContent,/Local budget exhausted \(1500 \/ 1500 units\)/);
  assert.equal(f.w.document.querySelector('[aria-label="Source rolling budget"]').value,'1500');
  assert.equal(f.posts.length,0);
 }finally{await f.close();}
});
