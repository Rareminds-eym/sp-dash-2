import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
function config(env) {
 const calls = [], module = { exports: {} };
 vm.runInNewContext(readFileSync(path.join(root,'next.config.js'),'utf8'), {
  module, __dirname: root, process: { env },
  require: name => name === 'path' ? path : name === '@opennextjs/cloudflare'
   ? { initOpenNextCloudflareForDev: options => calls.push(options) } : (() => { throw new Error(name); })(),
 });
 return { calls, value: module.exports };
}
test('production build does not start a stub runtime with unresolved named self-bindings', () => {
 const result = config({ NODE_ENV: 'production' });
 assert.equal(result.calls.length,0);
 assert.equal(result.value.outputFileTracingRoot,root);
});
test('normal Next development still initializes local Cloudflare bindings', () => {
 const result = config({ NODE_ENV: 'development' });
 assert.equal(result.calls.length,1); assert.equal(result.calls[0],undefined);
});
test('isolated dashboard development still uses its proxy config and separate build directory', () => {
 const result = config({ NODE_ENV:'development', CLOUDFLARE_LOCAL_CONFIG_PATH:'/fixture/proxy.json' });
 assert.equal(result.calls.length,1); assert.equal(result.calls[0].configPath,'/fixture/proxy.json');
 assert.equal(result.value.distDir,'.next.zoho-local');
});
