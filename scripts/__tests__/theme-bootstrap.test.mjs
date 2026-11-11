import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const { buildSync } = require('esbuild');
const { unstable_readConfig: readConfig } = require('wrangler');
const configs = [undefined, 'dev', 'qa'].map(env => readConfig({
  config: `${root}wrangler.toml`, ...(env ? { env } : {}),
}));

// Exercise the real provider through the same name-preserving transform that
// Wrangler applies, then execute only the emitted browser script. The Worker
// module's helpers deliberately cannot leak into the browser's scope.
function bootstrap(keepNames, minify, props = {}) {
  const result = buildSync({
    stdin: {
      contents: `const React = require('react');
        const { renderToStaticMarkup } = require('react-dom/server');
        const { ThemeProvider } = require('./components/providers/ThemeProvider.js');
        module.exports = props => renderToStaticMarkup(React.createElement(ThemeProvider, props));`,
      resolveDir: root,
    },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['react', 'react-dom/server'], loader: { '.js': 'jsx' },
    jsx: 'automatic', keepNames, minify,
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require });
  const html = module.exports(props);
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'the provider must emit its pre-hydration initializer');
  return script;
}

function execute(script, { stored = null, systemDark = false, storageError = false } = {}) {
  const classes = new Set(['unrelated']);
  const element = {
    classList: { remove: (...names) => names.forEach(n => classes.delete(n)), add: n => classes.add(n) },
    style: {},
  };
  vm.runInNewContext(script, {
    document: { documentElement: element },
    window: { matchMedia: () => ({ matches: systemDark }) },
    localStorage: { getItem: () => { if (storageError) throw new Error('Storage denied'); return stored; } },
  });
  return { classes, colorScheme: element.style.colorScheme };
}

test('the old name-preserving build reproduces the isolated browser failure', () => {
  assert.throws(() => execute(bootstrap(true, false)), /__name is not defined/);
});

test('every deployment environment disables injected name helpers', () => {
  for (const config of configs) assert.equal(config.keep_names, false);
});

for (const minify of [false, true]) {
  for (const [name, options, expected, props] of [
    ['default light', {}, 'light'],
    ['saved dark', { stored: 'dark' }, 'dark'],
    ['saved light overrides system dark', { stored: 'light', systemDark: true }, 'light'],
    ['system dark', { stored: 'system', systemDark: true }, 'dark'],
    ['system light', { stored: 'system' }, 'light'],
    ['forced theme overrides storage', { stored: 'dark' }, 'light', { forcedTheme: 'light' }],
  ]) {
    test(`${name}, minify=${minify}: bundled initializer applies theme before hydration`, () => {
      const result = execute(bootstrap(configs[0].keep_names, minify, props), options);
      assert.ok(result.classes.has(expected));
      assert.ok(!result.classes.has(expected === 'dark' ? 'light' : 'dark'));
      assert.ok(result.classes.has('unrelated'));
      assert.equal(result.colorScheme, expected);
    });
  }
}

test('unavailable browser storage does not crash initialization', () => {
  assert.doesNotThrow(() => execute(bootstrap(configs[0].keep_names, false), { storageError: true }));
});
