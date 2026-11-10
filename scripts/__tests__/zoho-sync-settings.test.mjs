import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(resolve(root, 'package.json'));
const { build } = require('esbuild'), { JSDOM } = require('jsdom');
let bundle;
before(async () => {
  const result = await build({ stdin: { contents: `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import Panel from './components/zoho/SyncSettings.jsx';window.auditAct=act;window.auditRoot=createRoot(document.getElementById('root'));window.auditMount=props=>window.auditRoot.render(React.createElement(Panel,props));`, resolveDir: root, loader: 'jsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, alias: { '@': root },
    plugins: [{ name: 'button-stub', setup(build) {
      build.onResolve({ filter: /^@\/components\/ui\/button$/ }, args => ({ path: args.path, namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `import React from ${JSON.stringify(require.resolve('react'))};export function Button({variant,size,...props}){return React.createElement('button',props);}`, resolveDir: root }));
    } }] });
  bundle = result.outputFiles[0].text;
});
const id = '10000000-0000-4000-8000-000000000001';
const sync = { configRevision: 3, webhookConfigured: false, policies: [
  { module: 'Candidates', enabled: true, intervalMinutes: 15, reconciliationDays: 7, preferBulk: true, capturedThrough: null },
  { module: 'Job_Openings', enabled: false, intervalMinutes: 30, reconciliationDays: 14, preferBulk: false, capturedThrough: null },
] };
async function fixture(fail = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3010', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, posts = [];
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.MessageChannel = class { constructor() { this.port1 = { onmessage: null }; this.port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; } };
  w.fetch = async (_url, init) => {
    if (fail) return Response.json({ error: 'Storage unavailable' }, { status: 503 });
    if (init?.method === 'POST') { const value = JSON.parse(init.body); posts.push(value); return Response.json({ result: value.action === 'rotate_webhook' ? { secret: 's'.repeat(43) } : sync }); }
    return Response.json({ sync });
  };
  w.eval(bundle);
  const act = async fn => { await w.auditAct(async () => { fn?.(); await new Promise(resolve => setTimeout(resolve, 0)); }); };
  await act(() => w.auditMount({ connectionId: id }));
  return { w, posts, act, async close() { await act(() => w.auditRoot.unmount()); dom.window.close(); } };
}
test('saves independently configured candidate and job policies with source/config fencing', async () => {
  const f = await fixture(); try {
    const forms = f.w.document.querySelectorAll('form'); assert.equal(forms.length, 2);
    assert.equal(forms[0].querySelector('[name=enabled]').checked, true);
    assert.equal(forms[1].querySelector('[name=enabled]').checked, false);
    await f.act(() => forms[1].dispatchEvent(new f.w.Event('submit', { bubbles: true, cancelable: true })));
    assert.deepEqual(f.posts[0], { action: 'configure_sync', input: { connectionId: id, expectedConfigRevision: 3, module: 'Job_Openings', enabled: false, intervalMinutes: 30, reconciliationDays: 14, preferBulk: false } });
  } finally { await f.close(); }
});
test('shows the webhook secret once and supports explicitly hiding it', async () => {
  const f = await fixture(); try {
    const button = text => [...f.w.document.querySelectorAll('button')].find(button => button.textContent === text);
    await f.act(() => button('Create webhook secret').click());
    assert.equal(f.w.document.querySelector('input[readonly]').value, 's'.repeat(43));
    await f.act(() => button('Hide secret').click());
    assert.equal(f.w.document.querySelector('input[readonly]'), null);
  } finally { await f.close(); }
});
test('shows an outage without inventing a baseline or writable policy', async () => {
  const f = await fixture(true); try {
    assert.equal(f.w.document.querySelector('[role=alert]').textContent, 'Storage unavailable');
    assert.equal(f.w.document.querySelectorAll('form').length, 0);
  } finally { await f.close(); }
});

test('live checkpoints refresh without discarding unsaved policy edits', async () => {
  const f=await fixture();try{
    const interval=f.w.document.querySelector('[name=interval]');interval.value='45';
    await f.act(()=>f.w.auditMount({connectionId:id,captures:[{module:'Candidates',config_revision:3,scan_started_at:'2026-11-06T09:00:00Z'}]}));
    assert.equal(f.w.document.querySelector('[name=interval]').value,'45');
    const forms=f.w.document.querySelectorAll('form');
    assert.doesNotMatch(forms[0].textContent,/Baseline not established/);
    assert.match(forms[1].textContent,/Baseline not established/);
    await f.act(()=>f.w.auditMount({connectionId:id,captures:[{module:'Candidates',config_revision:2,scan_started_at:'2026-11-06T09:00:00Z'}]}));
    assert.match(f.w.document.querySelector('form').textContent,/Baseline not established/);
  }finally{await f.close();}
});
