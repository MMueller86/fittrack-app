import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Vitest configuration for Cosmos DB Emulator CONTRACT tests.
//
// Runs files matching `src/**/*.contract.test.ts` against the local Cosmos
// DB Linux Emulator (Docker). NEVER points at real Azure Cosmos DB.
//
// Why a separate config:
//   - These tests need a running emulator and are slower than unit tests,
//     so they must NOT block `npm test` / CI default runs.
//   - Sequential execution and a longer timeout fit Cosmos Emulator startup
//     and the `createIfNotExists` calls that happen on first connect.
//
// Required env (set automatically by `npm run test:contract`):
//   COSMOS_ENDPOINT      https://localhost:8081
//   COSMOS_KEY           well-known emulator master key
//   COSMOS_DATABASE_ID   fittrack-test-<random>  (per-run, isolated)
//   NODE_TLS_REJECT_UNAUTHORIZED=0   the emulator uses a self-signed cert.

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
    include: ['src/**/*.contract.test.ts'],
    exclude: ['node_modules', 'dist'],
    // Cosmos createIfNotExists + first connection can be slow on cold start.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // One emulator instance — run sequentially to avoid container churn
    // and to keep failure output readable.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
