import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../backend');

export default defineConfig({
  root,
  resolve: { alias: { '@fittrack/shared': resolve(root, '../shared/index.ts') } },
  test: { environment: 'node', include: ['../docs/qa/reports/RECIPE-REVERIFY-2026-10-11-probe.test.ts'], testTimeout: 30_000 },
});
