import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Vitest config for prompt eval tests (*.eval.test.ts).
//
// What this runs:
//   - Prompt behaviour evals that make real Azure OpenAI API calls.
//   - Layer 1 (schema), Layer 2 (semantic constraints), Layer 3 (edge-case behaviour).
//
// What this does NOT run:
//   - Unit tests (*.test.ts) — see vitest.config.mts
//   - Cosmos contract tests (*.contract.test.ts) — see vitest.contract.config.mts
//
// Run explicitly: npm run test:eval
// Never include in default `npm test`.
//
// Required env:
//   AZURE_OPENAI_ENDPOINT
//   AZURE_OPENAI_API_KEY
//   AZURE_OPENAI_DEPLOYMENT_NAME   (optional, defaults to 'gpt4o-mini')
//
// Tests without credentials are skipped automatically (describe.skipIf).
// Tests run sequentially (singleFork) to avoid rate-limit pressure.

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
    include: ['src/**/*.eval.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30_000,
    hookTimeout: 10_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
