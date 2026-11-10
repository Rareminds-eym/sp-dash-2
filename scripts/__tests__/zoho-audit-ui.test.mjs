import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(resolve(root,'package.json'));
const {build}=require('esbuild'),{JSDOM}=require('jsdom');
const id='10000000-0000-4000-8000-000000000001';
async function fixture(component,fetcher){
 const built=await build({stdin:{contents:`import React,{act}from'react';import{createRoot}from'react-dom/client';import Panel from './components/zoho/${component}.jsx';window.act=act;window.root=createRoot(document.getElementById('root'));window.mount=()=>window.root.render(React.createElement(Panel,{connectionId:'${id}',onSaved:async()=>{},onChanged:async()=>{}}));`,resolveDir:root,loader:'jsx'},bundle:true,write:false,outdir:resolve(root,'.wrangler/ui-test-build'),platform:'browser',format:'iife',jsx:'automatic',alias:{'@':root},define:{'process.env.NODE_ENV':'"development"'}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.IS_REACT_ACT_ENVIRONMENT=true;w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLElement.prototype.scrollIntoView=function(){};w.MessageChannel=class{constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const requests=[];w.fetch=async(url,options={})=>{requests.push({url,options});return fetcher(url,options);};
 const act=async fn=>w.act(async()=>{await fn();await new Promise(r=>setTimeout(r,10));});
 w.eval(built.outputFiles.find(file=>file.path.endsWith('.js')).text);await act(()=>w.mount());
 const button=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 return {w,act,requests,button,async close(){await act(()=>w.root.unmount());w.close();}};
}
test('catalog definitions are fetched only on expansion and paging replaces the bounded list',async()=>{
 const f=await fixture('JobPolicyPanel',(url)=>{
  const query=new URL(url,'http://localhost').searchParams;
  if(query.get('view')==='job_surface'){const offset=Number(query.get('offset'));return Response.json({surface:{offset,total:15000,nextOffset:offset+10,items:Array.from({length:10},(_,i)=>({kind:'routine',name:'fixture_'+(offset+i),definition:'CREATE FUNCTION fixture_'+(offset+i)}))}});}
  return Response.json({policy:{configRevision:1,triggerFingerprint:'a'.repeat(64),surfaceCount:15000,surfaceKinds:{routine:1000},policy:null}});
 });try{
  assert.equal(f.requests.length,1);assert.equal(f.w.document.querySelectorAll('pre').length,0);
  await f.act(()=>{f.w.document.querySelector('details').open=true;});
  assert.equal(f.requests.length,2);assert.equal(f.w.document.querySelectorAll('pre').length,10);
  await f.act(()=>f.button('Next catalog page').click());
  assert.equal(f.w.document.querySelectorAll('pre').length,10);
  assert.equal(f.w.document.querySelector('pre').textContent,'CREATE FUNCTION fixture_10');
  assert.equal(new URL(f.requests.at(-1).url,'http://localhost').searchParams.get('offset'),'10');
 }finally{await f.close();}
});
test('global cleanup needs its own reason and confirmation before an audited command',async()=>{
 const posts=[];const f=await fixture('SourcePrivacyPanel',(_url,options)=>{
  if(options.method){posts.push(JSON.parse(options.body));return Response.json({result:{redacted:0}});}
  return Response.json({privacy:{status:'connected',configRevision:1,retentionDays:30,suppressionCount:0,redactedCount:0,suppressed:[]}});
 });try{
  await f.act(()=>f.button('Clean expired payloads across all sources').click());
  assert.equal(posts.length,0);assert.equal(f.button('Confirm global cleanup').disabled,true);
  const dialog=f.w.document.querySelector('[aria-labelledby="cleanup-title"]');assert.equal(dialog.open,true);
  await f.act(()=>{const field=dialog.querySelector('textarea');Object.getOwnPropertyDescriptor(f.w.HTMLTextAreaElement.prototype,'value').set.call(field,'Reviewed expired retention data');field.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
  await f.act(()=>dialog.querySelector('form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true})));
  assert.deepEqual(posts,[{action:'cleanup_payloads',input:{reason:'Reviewed expired retention data',confirmed:true}}]);
  assert.equal(dialog.open,false);
 }finally{await f.close();}
});
