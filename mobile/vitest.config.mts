import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@fittrack/shared': resolve(here, '../shared/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules'],
  },
});
