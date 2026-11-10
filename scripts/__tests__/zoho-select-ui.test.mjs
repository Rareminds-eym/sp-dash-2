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
  const built = await build({ stdin: { contents: `
    import React,{act,useState} from 'react';import{createRoot}from'react-dom/client';
    import ZohoSelect from './components/zoho/ZohoSelect.jsx';
    function Demo({modal=false,disabled=false}){const [value,setValue]=useState('');const Container=modal?'dialog':'section';
      return <Container open={modal||undefined}><form onSubmit={e=>{e.preventDefault();window.submitted=true;}}>
        <label>Review state<ZohoSelect aria-label="Review state" value={value} disabled={disabled} onValueChange={setValue}
          options={[{value:'',label:'All states'},{value:'pending',label:'Awaiting review'},{value:'blocked',label:'Unavailable',disabled:true}]}/></label>
        <output>{value||'(empty)'}</output></form></Container>}
    window.act=act;window.root=createRoot(document.getElementById('root'));window.mount=props=>window.root.render(<Demo {...props}/>);`,
    resolveDir: root, loader: 'jsx' }, bundle: true, write: false, outdir: resolve(root, '.wrangler/ui-test-build'),
    format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } });
  bundle = built.outputFiles.find(file => file.path.endsWith('.js')).text;
});

async function fixture(props = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.MessageChannel = class { constructor() { this.port1 = { onmessage: null }; this.port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; } };
  w.eval(bundle);
  const act = async fn => w.act(async () => { await fn?.(); await new Promise(resolve => setTimeout(resolve, 5)); });
  await act(() => w.mount(props));
  const trigger = () => w.document.querySelector('[role=combobox]');
  const open = () => act(() => trigger().dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  const choose = label => act(() => [...w.document.querySelectorAll('[role=option]')].find(item => item.textContent === label)
    .dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  return { w, act, trigger, open, choose, async close() { await act(() => w.root.unmount()); w.close(); } };
}

test('filters and mappings can select and reset an empty value without submitting their form', async () => {
  const f = await fixture(); try {
    assert.equal(f.trigger().textContent, 'All states');
    await f.open(); await f.choose('Awaiting review');
    assert.equal(f.w.document.querySelector('output').textContent, 'pending');
    await f.open(); await f.choose('All states');
    assert.equal(f.w.document.querySelector('output').textContent, '(empty)');
    assert.equal(f.w.submitted, undefined);
  } finally { await f.close(); }
});

test('settings menus remain inside the native dialog and Escape restores focus without closing settings', async () => {
  const f = await fixture({ modal: true }); try {
    await f.open();
    const dialog = f.w.document.querySelector('dialog');
    assert.ok(dialog.querySelector('[role=listbox]'));
    await f.act(() => f.w.document.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(f.w.document.querySelector('[role=listbox]'), null);
    assert.equal(dialog.open, true);
    assert.equal(f.w.document.activeElement, f.trigger());
  } finally { await f.close(); }
});

test('disabled controls and destinations cannot change the selected action', async () => {
  const f = await fixture(); try {
    await f.open(); await f.choose('Unavailable');
    assert.equal(f.w.document.querySelector('output').textContent, '(empty)');
  } finally { await f.close(); }
  const disabled = await fixture({ disabled: true }); try {
    assert.equal(disabled.trigger().disabled, true);
  } finally { await disabled.close(); }
});
