import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(resolve(root,'package.json'));
const {build}=require('esbuild');
const {JSDOM}=createRequire(resolve(root,'package.json'))('jsdom');
test('new sources prefill exact defaults without authorizing writes or overwriting saved mappings',async()=>{
 const built=await build({stdin:{contents:`import React,{act} from 'react';import{createRoot}from'react-dom/client';import Panel from './components/zoho/JobPolicyPanel.jsx';window.act=act;window.root=createRoot(document.getElementById('root'));window.mount=(refreshVersion=0)=>window.root.render(React.createElement(Panel,{refreshVersion,connectionId:'10000000-0000-4000-8000-000000000001',onSaved:async()=>{}}));`,resolveDir:resolve(root),loader:'jsx'},bundle:true,write:false,outdir:resolve(root,'.wrangler/ui-test-build'),format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve(root)},define:{'process.env.NODE_ENV':'"development"'}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.IS_REACT_ACT_ENVIRONMENT=true;w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLElement.prototype.scrollIntoView=function(){};
 w.MessageChannel=class{constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};}};
 let policy=null,posts=0;
 w.fetch=async(url,options={})=>{if(options.method){posts++;return Response.json({});}return Response.json({policy:{policy,configRevision:1,triggerFingerprint:'a'.repeat(64)}});};
 const act=async(fn)=>w.act(async()=>{await fn();await new Promise(r=>setTimeout(r,10));});
 try{
  w.eval(built.outputFiles.find(file=>file.path.endsWith('.js')).text);await act(()=>w.mount());
  assert.equal(w.document.querySelector('[aria-label="Job status source 1"]').value,'In-progress');
  assert.equal(w.document.querySelector('[aria-label="Job status destination 1"]').textContent,'open');
  assert.equal(w.document.querySelector('[aria-label="Employment type source 1"]').value,'Full time');
  assert.equal(w.document.querySelector('[aria-label="Employment type destination 1"]').textContent,'job');
  assert.ok([...w.document.querySelectorAll('input[type="checkbox"]')].every(input=>!input.checked));
  assert.equal(w.document.querySelector('textarea').value,'');
  assert.equal(w.document.querySelector('button[type="submit"]').disabled,true);
  assert.equal(posts,0,'Loading defaults must not persist or authorize a policy');
  policy={statusMap:{Custom:'draft'},employmentMap:{CustomType:'contract'},enabled:false};
  await act(()=>w.mount(1));
  assert.equal(w.document.querySelector('[aria-label="Job status source 1"]').value,'Custom');
  assert.equal(w.document.querySelector('[aria-label="Employment type source 1"]').value,'CustomType');
  assert.equal(w.document.querySelectorAll('[aria-label^="Job status source"]').length,1);
  assert.equal(posts,0);
 }finally{await act(()=>w.root.unmount());w.close();}
});
test('a saved policy reloads and retains its refresh warning when related records fail',async()=>{
 const built=await build({stdin:{contents:`import React,{act} from 'react';import{createRoot}from'react-dom/client';import Panel from './components/zoho/JobPolicyPanel.jsx';window.act=act;window.root=createRoot(document.getElementById('root'));window.mount=(refreshVersion=0)=>window.root.render(React.createElement(Panel,{refreshVersion,connectionId:'10000000-0000-4000-8000-000000000001',onSaved:async()=>{throw new Error('Related records unavailable')}}));`,resolveDir:resolve(root),loader:'jsx'},bundle:true,write:false,outdir:resolve(root,'.wrangler/ui-test-build'),format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve(root)},define:{'process.env.NODE_ENV':'"development"'}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.IS_REACT_ACT_ENVIRONMENT=true;w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLElement.prototype.scrollIntoView=function(){};
 w.MessageChannel=class{constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};}};
 let gets=0,posts=0;
 w.fetch=async(url,options={})=>{if(options.method){posts++;return Response.json({result:{}});}gets++;return Response.json({policy:{policy:{statusMap:{Open:'open'},employmentMap:{Full:'job'},enabled:false},configRevision:gets,triggerFingerprint:'a'.repeat(64),triggerSurface:[]}});};
 const act=async(fn)=>w.act(async()=>{await fn();await new Promise(r=>setTimeout(r,10));});
 try{
  w.eval(built.outputFiles.find(file=>file.path.endsWith('.js')).text);await act(()=>w.mount());
  await act(()=>{const field=w.document.querySelector('textarea');Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(field,'Reviewed local policy for test purposes');field.dispatchEvent(new w.Event('input',{bubbles:true}));});
  await act(()=>w.document.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(posts,1);assert.equal(gets,2);
  assert.match(w.document.querySelector('[role="status"]').textContent,/Publication policy saved/);
  assert.match(w.document.querySelector('[role="alert"]').textContent,/Policy saved.*Related records unavailable/);
  assert.ok(w.document.querySelector('form'),'Current policy must reload after the successful mutation');
  assert.equal(w.document.querySelector('textarea').value,'');
  await act(()=>w.mount(1));
  assert.equal(gets,3,'Settings refresh must reload policy even with an unchanged connection');
  assert.equal(posts,1,'Settings refresh must never submit a policy');
 }finally{await act(()=>w.root.unmount());w.close();}
});
