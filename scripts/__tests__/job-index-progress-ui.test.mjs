import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(resolve(root, 'package.json'));
const { build } = require('esbuild'), { JSDOM } = require('jsdom');
let bundle;
before(async () => {
  const result = await build({ stdin: { contents: `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import Panel from './components/zoho/JobIndexProgress.jsx';window.auditAct=act;window.auditRoot=createRoot(document.getElementById('root'));window.auditMount=props=>window.auditRoot.render(React.createElement(Panel,props));`, resolveDir: root, loader: 'jsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, alias: { '@': root },
    plugins: [{ name: 'button-stub', setup(build) {
      build.onResolve({ filter: /^@\/components\/ui\/button$/ }, args => ({ path: args.path, namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `import React from ${JSON.stringify(require.resolve('react'))};export function Button({variant,size,...props}){return React.createElement('button',props);}`, resolveDir: root }));
    } }] });
  bundle = result.outputFiles[0].text;
});
const progress = { total: 3, verified: 1, queued: 1, processing: 0, retry: 0, failed: 1 };
async function fixture({ post, processor } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3010', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, calls = [], timeouts = [];
  const originalSetTimeout = w.setTimeout.bind(w);
  w.setTimeout = (callback, delay, ...args) => {
    if (delay === 15000) { const item = { callback, id: originalSetTimeout(() => {}, 60000) }; timeouts.push(item); return item.id; }
    return originalSetTimeout(callback, delay, ...args);
  };
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.MessageChannel = class { constructor() { this.port1 = { onmessage: null }; this.port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; } };
  w.eval(bundle);
  const api = async (path, init) => { calls.push({ path, init }); return init?.method === 'POST' ? post?.(init) ?? {} : { progress, processor }; };
  const act = async fn => { await w.auditAct(async () => { fn?.(); await new Promise(resolve => setTimeout(resolve, 0)); }); };
  let props = { connectionId: 'source-a', active: true, api };
  await act(() => w.auditMount(props));
  const button = text => [...w.document.querySelectorAll('button')].find(button => button.textContent === text);
  return { w, calls, timeouts, act, button, async mount(next) { props = { ...props, ...next }; await act(() => w.auditMount(props)); }, async close() { await act(() => w.auditRoot.unmount()); w.close(); } };
}
test('successful retry submits selected source and refreshes progress', async () => {
  const f = await fixture(); try {
    await f.act(() => f.button('Retry failed indexing').click());
    const posts = f.calls.filter(call => call.init?.method === 'POST');
    assert.equal(posts.length, 1);
    assert.deepEqual(JSON.parse(posts[0].init.body), { action: 'retry_job_index', input: { connectionId: 'source-a' } });
    assert.ok(posts[0].init.signal);
    assert.equal(f.calls.filter(call => !call.init?.method).length, 2);
    assert.equal(f.button('Retry failed indexing').disabled, false);
  } finally { await f.close(); }
});
test('stalled retry times out even if transport ignores abort and ignores late completion', async () => {
  let finish;
  const f = await fixture({ post: () => new Promise(resolve => { finish = resolve; }) }); try {
    await f.act(() => { f.button('Retry failed indexing').click(); f.button('Retry failed indexing').click(); });
    assert.equal(f.calls.filter(call => call.init?.method === 'POST').length, 1);
    assert.equal(f.button('Refresh progress').disabled, true);
    await f.act(() => f.timeouts.at(-1).callback());
    assert.equal(f.calls.find(call => call.init?.method === 'POST').init.signal.aborted, true);
    assert.match(f.w.document.querySelector('[role=alert]').textContent, /outcome is not confirmed/);
    assert.equal(f.button('Refresh progress').disabled, false);
    await f.act(() => finish({ retried: 1 }));
    assert.equal(f.calls.filter(call => !call.init?.method).length, 1);
  } finally { await f.close(); }
});
test('source changes cancel retries and ignore their late responses', async () => {
  let finish;
  const f = await fixture({ post: () => new Promise(resolve => { finish = resolve; }) }); try {
    await f.act(() => f.button('Retry failed indexing').click());
    await f.mount({ connectionId: 'source-b' });
    assert.equal(f.calls.find(call => call.init?.method === 'POST').init.signal.aborted, true);
    await f.act(() => finish({ retried: 1 }));
    assert.equal(f.calls.filter(call => !call.init?.method).length, 2);
    assert.equal(f.w.document.querySelector('[role=alert]'), null);
    assert.equal(f.button('Retry failed indexing').disabled, false);
  } finally { await f.close(); }
});
test('deactivation cancels pending retries without false errors on return', async () => {
  const f = await fixture({ post: () => new Promise(() => {}) }); try {
    await f.act(() => f.button('Retry failed indexing').click());
    await f.mount({ active: false });
    assert.equal(f.calls.find(call => call.init?.method === 'POST').init.signal.aborted, true);
    await f.mount({ active: true });
    assert.equal(f.w.document.querySelector('[role=alert]'), null);
    assert.equal(f.button('Retry failed indexing').disabled, false);
  } finally { await f.close(); }
});
test('unmount aborts pending retry', async () => {
  const f = await fixture({ post: () => new Promise(() => {}) });
  await f.act(() => f.button('Retry failed indexing').click());
  const signal = f.calls.find(call => call.init?.method === 'POST').init.signal;
  await f.close(); assert.equal(signal.aborted, true);
});
test('blocked processor uses safe explanations, never unknown error details', async () => {
  const known = await fixture({ processor: { state: 'blocked', errorCode: 'JOB_INDEX_MODEL_MISMATCH' } }); try {
    assert.match(known.w.document.querySelector('[role=alert]').textContent, /stored search model do not match/);
  } finally { await known.close(); }
  const unknown = await fixture({ processor: { state: 'blocked', errorCode: 'sensitive-provider-response' } }); try {
    assert.match(unknown.w.document.querySelector('[role=alert]').textContent, /administrator attention/);
    assert.doesNotMatch(unknown.w.document.body.textContent, /sensitive-provider-response/);
  } finally { await unknown.close(); }
});
test('stale processor reports interruption and retains actual counts', async () => {
  const f = await fixture({ processor: { state: 'stale', errorCode: null } }); try {
    assert.match(f.w.document.querySelector('[role=alert]').textContent, /may be interrupted/);
    assert.match(f.w.document.body.textContent, /1 of 3 published, eligible jobs indexed/);
  } finally { await f.close(); }
});

test('unknown processor status does not imply that queued jobs are actively processing', async () => {
  const f = await fixture({ processor: { state: 'unknown', errorCode: null } }); try {
    assert.match(f.w.document.querySelector('[role=alert]').textContent, /do not confirm that indexing is running/);
    assert.match(f.w.document.body.textContent, /Queued: 1/);
  } finally { await f.close(); }
});
