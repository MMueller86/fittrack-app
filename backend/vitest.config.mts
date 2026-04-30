import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Vitest configuration for the FitTrack backend.
//
// What this runs:
//   - Fast unit tests under `src/**/*.test.ts`.
//   - Pure functions, validators, HTTP handlers (with mocked repositories).
//
// What this does NOT run:
//   - Cosmos contract tests (*.contract.test.ts) — see vitest.contract.config.ts
//     and the Cosmos Linux Emulator. Those are intentionally excluded here so
//     `npm test` stays fast and offline.
//   - No real Azure services. No Docker. No `local.settings.json` secrets.

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig path aliases. Kept in sync with backend/tsconfig.json.
      '@fittrack/shared': resolve(here, '../shared/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.contract.test.ts', 'node_modules', 'dist'],
    clearMocks: true,
    restoreMocks: true,
  },
});
