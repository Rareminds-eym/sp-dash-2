import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(resolve(repo,'package.json'));
const {build}=require('esbuild');
const {JSDOM}=createRequire(resolve(repo,'../skillpassport/package.json'))('jsdom');
let bundle;
before(async()=>{
 const result=await build({stdin:{contents:`import React,{act}from'react';import{createRoot}from'react-dom/client';import Panel from './components/zoho/SourcePrivacyPanel.jsx';window.act=act;window.root=createRoot(document.getElementById('root'));window.mount=props=>window.root.render(React.createElement(Panel,props));`,resolveDir:repo,loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},alias:{'@':repo},plugins:[{name:'button',setup(b){
  b.onResolve({filter:/^@\/components\/ui\/button$/},()=>({path:'button',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from ${JSON.stringify(require.resolve('react'))};export const Button=React.forwardRef(({variant,size,...props},ref)=>React.createElement('button',{...props,ref}));`,resolveDir:repo}));
 }}]});bundle=result.outputFiles[0].text;
});
async function fixture(){
 const dom=new JSDOM('<div id="root"></div><button id="zoho-discovery-action">Discover candidates</button>',{url:'http://localhost:3010',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.IS_REACT_ACT_ENVIRONMENT=true;
 w.MessageChannel=class{constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const state={status:'paused',configRevision:7,posts:[],conflict:false,gets:0};
 w.fetch=async(_url,options={})=>{
  if(options.method==='POST'){
   const command=JSON.parse(options.body);state.posts.push(command);
   if(state.conflict){state.status='connected';state.configRevision=8;return Response.json({error:'The reviewed selection changed.'},{status:409});}
   assert.equal(command.action,'control_connection');
   assert.equal(command.input.expectedConfigRevision,state.configRevision);
   state.status=command.input.command==='resume'?'connected':'paused';state.configRevision++;
   return Response.json({result:{status:state.status,configRevision:state.configRevision}});
  }
  state.gets++;
  return Response.json({privacy:{status:state.status,configRevision:state.configRevision,retentionDays:30,suppressionCount:0,redactedCount:0,suppressed:[]}});
 };
 w.eval(bundle);
 const act=fn=>w.act(async()=>{await fn?.();await new Promise(r=>setTimeout(r,5));});
 const render=props=>act(()=>w.mount({connectionId:'10000000-0000-4000-8000-000000000001',connectionStatus:'paused',configRevision:7,onChanged:async()=>{},...props}));
 await render();
 const button=text=>[...w.document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
 const reason=()=>act(()=>{const field=w.document.querySelector('input[aria-describedby="source-control-help"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(field,'Continue local review');field.dispatchEvent(new w.Event('input',{bubbles:true}));});
 return {w,state,act,render,button,reason,async close(){await act(()=>w.root.unmount());w.close();}};
}
test('resume remains an explicitly disabled resume action after success; it never becomes pause',async()=>{
 const f=await fixture();try{
  await f.reason();assert.equal(f.button('Resume connection').disabled,false);assert.equal(f.button('Pause connection').disabled,true);
  await f.act(()=>f.button('Resume connection').click());
  assert.equal(f.state.posts.length,1);assert.equal(f.state.posts[0].input.command,'resume');
  assert.equal(f.state.status,'connected');assert.equal(f.button('Resume connection').disabled,true);
  assert.match(f.w.document.body.textContent,/Connection resumed\. Discovery has not restarted/);
  await f.reason();
  assert.equal(f.button('Resume connection').disabled,true);assert.equal(f.button('Pause connection').disabled,false);
  await f.act(()=>f.button('Resume connection').click());assert.equal(f.state.posts.length,1);
 }finally{await f.close();}
});
test('parent source changes refresh the privacy controls without a remount or mutation',async()=>{
 const f=await fixture();try{
  f.state.status='connected';f.state.configRevision=8;
  await f.render({connectionStatus:'connected',configRevision:8});
  assert.match(f.w.document.body.textContent,/Connection active/);
  await f.reason();assert.equal(f.button('Pause connection').disabled,false);assert.equal(f.button('Resume connection').disabled,true);
  assert.equal(f.state.posts.length,0);
 }finally{await f.close();}
});
test('a concurrent source change refreshes controls without retrying the rejected command',async()=>{
 const f=await fixture();try{
  f.state.conflict=true;await f.reason();await f.act(()=>f.button('Resume connection').click());
  assert.equal(f.state.posts.length,1);assert.equal(f.button('Resume connection').disabled,true);
  assert.match(f.w.document.body.textContent,/Source settings changed/);
  assert.match(f.w.document.body.textContent,/Connection active/);
 }finally{await f.close();}
});
test('after resume, Go to discovery focuses the explicit discovery action without starting it',async()=>{
 const f=await fixture();try{
  await f.reason();await f.act(()=>f.button('Resume connection').click());
  await f.act(()=>f.button('Go to discovery').click());
  assert.equal(f.w.document.activeElement.id,'zoho-discovery-action');
  assert.equal(f.state.posts.length,1);
 }finally{await f.close();}
});

test('a settings refresh reads current privacy state without a write or a remount',async()=>{
 const f=await fixture();try{
  const previous=f.state.gets;
  f.state.status='connected';f.state.configRevision=8;
  await f.render({refreshVersion:1});
  assert.ok(f.state.gets>previous);
  assert.match(f.w.document.body.textContent,/Connection active/);
  assert.equal(f.state.posts.length,0);
  const after=f.state.gets;
  await f.render({refreshVersion:1});assert.equal(f.state.gets,after);
 }finally{await f.close();}
});
