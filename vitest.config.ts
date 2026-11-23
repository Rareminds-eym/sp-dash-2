import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Next preserves JSX for its compiler; Vitest must transform it for execution.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    globals: true,
    environment: 'node',
    exclude: [...configDefaults.exclude, '**/.wrangler/**', '**/.next*/**', '**/.open-next/**', '**/scripts/__tests__/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
