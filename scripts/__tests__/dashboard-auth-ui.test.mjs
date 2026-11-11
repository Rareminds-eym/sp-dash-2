import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(resolve(root, 'sp-dash/package.json'));
const { build } = require('esbuild');
// Use the shared workspace's existing jsdom installation for this mounted UI harness.
const { JSDOM } = require('jsdom');
let bundle;
before(async () => {
  const react = JSON.stringify(require.resolve('react'));
  const pass = `import React from ${react}; const Pass=({children})=>React.createElement('div',null,children);`;
  const mocks = {
    '@/components/approvals/ApprovalViewContext': pass + 'export const ApprovalViewProvider=Pass;',
    '@/components/ui/button': `import React from ${react};export const Button=({children,onClick})=>React.createElement('button',{onClick},children);`,
    '@/components/ui/dropdown-menu': pass + ['DropdownMenu','DropdownMenuContent','DropdownMenuItem','DropdownMenuLabel','DropdownMenuSeparator','DropdownMenuTrigger'].map(name => `export const ${name}=Pass;`).join(''),
    '@/components/ui/tooltip': pass + ['Tooltip','TooltipContent','TooltipProvider','TooltipTrigger'].map(name => `export const ${name}=Pass;`).join(''),
    '@/components/ui/theme-toggle': 'export const ThemeToggle=()=>null;',
    '@/hooks/use-toast': 'export const useToast=()=>window.toastMock;',
    '@/lib/auth-client': 'export const authClient=window.authClient;',
    '@/lib/logger': 'export default class Logger{debug(){}error(){}};export const getErrorMessage=String;',
    '@/lib/utils': 'export const cn=(...args)=>args.filter(Boolean).join(" ");',
    'next/link': `import React from ${react};export default ({href,children})=>React.createElement('a',{href},children);`,
    'next/navigation': 'export const useRouter=()=>window.router;export const usePathname=()=>window.location.pathname;const params=new URLSearchParams();export const useSearchParams=()=>params;',
    'framer-motion': pass + 'export const AnimatePresence=Pass;export const motion=new Proxy({}, {get:()=>Pass});',
  };
  const icons = readFileSync(resolve(root, 'sp-dash/app/(dashboard)/layout.js'), 'utf8').match(/import\s*{([^}]+)}\s*from 'lucide-react'/)[1].split(',').map(name => name.trim()).filter(Boolean);
  mocks['lucide-react'] = pass + icons.map(name => `export const ${name}=()=>null;`).join('');
  const result = await build({
    stdin: { contents: `import React,{act} from 'react';import{createRoot}from'react-dom/client';import Layout from './app/(dashboard)/layout.js';window.act=act;window.root=createRoot(document.getElementById('root'));window.mount=()=>window.root.render(React.createElement(Layout,null,React.createElement('div',{'data-protected':true},'Protected reports')));`, resolveDir: resolve(root,'sp-dash'), loader:'jsx' },
    bundle:true, write:false, outdir:resolve(root,'sp-dash/.wrangler/shell-test-build'), format:'iife', platform:'browser', jsx:'automatic', loader:{'.js':'jsx'}, alias:{'@':resolve(root,'sp-dash')}, define:{'process.env.NODE_ENV':'"development"'},
    plugins:[{name:'auth-fixture',setup(b){
      b.onResolve({filter:/.*/},args => mocks[args.path] ? {path:args.path,namespace:'fixture'} : undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],resolveDir:resolve(root,'sp-dash')}));
    }}],
  });
  bundle=result.outputFiles.find(file=>file.path.endsWith('.js')).text;
});
async function fixture(results, destination='/reports?tab=placements') {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3010'+destination,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, navigations=[];
  w.IS_REACT_ACT_ENVIRONMENT=true;
  w.MessageChannel=class{constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};}};
  w.router={replace:url=>navigations.push(url)};
  w.toastMock={toast:()=>{}};
  let checks=0;
  w.authClient={checkAuth:async()=>{const next=results[Math.min(checks++,results.length-1)];if(next instanceof Error)throw next;return next;}};
  w.fetch=async()=>({ok:true,json:async()=>({})});
  w.eval(bundle);
  const act=fn=>w.act(async()=>{await fn?.();await new Promise(r=>setTimeout(r,5));});
  try { await act(()=>w.mount()); } catch(error) { w.close(); throw error; }
  return {w,navigations,get checks(){return checks;},act,async close(){await act(()=>w.root.unmount());w.close();}};
}
test('successful session renders protected content without a fallback login redirect', async()=>{
  const f=await fixture([{authenticated:true,user:{id:'admin',email:'admin@example.test',role:'super_admin'}}]);
  try {
    assert.ok(f.w.document.querySelector('[data-protected]'));
    assert.deepEqual(f.navigations,[]);
    assert.equal(f.checks,1);
  } finally {await f.close();}
});
test('temporary session failure stays put, hides protected content and supports explicit retry',async()=>{
  const f=await fixture([{authenticated:false,retryable:true,error:'SSO temporarily unavailable'},{authenticated:true,user:{id:'admin',email:'admin@example.test'}}]);
  try {
    assert.deepEqual(f.navigations,[]);
    assert.equal(f.w.document.querySelector('[data-protected]'),null);
    assert.match(f.w.document.querySelector('[role="alert"]').textContent,/temporarily unavailable/);
    await f.act(()=>f.w.document.querySelector('button').click());
    assert.ok(f.w.document.querySelector('[data-protected]'));
    assert.deepEqual(f.navigations,[]);
    assert.equal(f.checks,2);
  } finally {await f.close();}
});
test('definitively unauthenticated session preserves the original destination through login',async()=>{
  const f=await fixture([{authenticated:false,user:null}]);
  try {
    assert.equal(f.w.document.querySelector('[data-protected]'),null);
    assert.equal(f.navigations.length,1);
    const target=new URL(f.navigations[0],f.w.location.href);
    assert.equal(target.pathname,'/login');
    assert.equal(target.searchParams.get('next'),'/reports?tab=placements');
  } finally {await f.close();}
});
test('transport exceptions show retry instead of redirecting',async()=>{
  const f=await fixture([new Error('Failed Server Action')]);
  try {
    assert.deepEqual(f.navigations,[]);
    assert.ok(f.w.document.querySelector('[role="alert"]'));
    assert.equal(f.w.document.querySelector('[data-protected]'),null);
  } finally {await f.close();}
});

test('Zoho route retains the original page header and navigation',async()=>{
 const f=await fixture([{authenticated:true,user:{id:'admin',email:'admin@example.test',role:'super_admin'}}],'/integrations/zoho-recruit');
 try{
  assert.ok(f.w.document.querySelector('[data-protected]'));
  const header=f.w.document.querySelector('header');
  assert.equal(header.querySelector('[data-page-title]').textContent.trim(),'Zoho Recruit');
  assert.ok(header.className.includes('backdrop-blur-xl'));
  assert.equal(Boolean(header.querySelector('[aria-label="Breadcrumb"]')),false);
  assert.equal(Boolean(header.querySelector('[aria-label="Your account"]')),false);
  assert.ok(f.w.document.querySelector('a[href="/integrations"]'));
  assert.equal(f.w.document.querySelector('a[href="/integrations/zoho-recruit"]'),null,'Drawer must retain its original navigation entries');
  assert.deepEqual(f.navigations,[]);
 }finally{await f.close();}
});
