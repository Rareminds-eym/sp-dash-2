import { defineConfig, mergeConfig } from 'vitest/config';
import { transform } from 'next/dist/build/swc';
import base from '../../../vitest.config';

// Match the existing attendance UI test approach for Next's preserved JSX.
export default mergeConfig(base, defineConfig({ plugins: [{
  name: 'subscription-ui-jsx', enforce: 'pre',
  async transform(code, id) {
    if (!id.includes('node_modules') && /\.[jt]sx$/.test(id)) {
      const result = await transform(code, { filename: id,
        jsc: { parser: id.endsWith('.tsx') ? { syntax: 'typescript', tsx: true } : { syntax: 'ecmascript', jsx: true },
          transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' } });
      return { code: result.code, map: null };
    }
  },
}] }));
