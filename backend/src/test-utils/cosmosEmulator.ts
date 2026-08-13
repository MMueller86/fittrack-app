// Shared bootstrap for Cosmos contract tests.
//
// Responsibilities:
//   1. Configure env vars to point at the LOCAL Cosmos Emulator (never Azure).
//   2. Allow self-signed cert from the emulator.
//   3. Hand each test file an isolated database name so parallel/sequential
//      runs cannot collide with each other or with `fittrack-db` from the
//      app-level Cosmos client.
//
// Usage in a *.contract.test.ts file:
//
//   import { setupEmulatorEnv, createTestDatabase, destroyTestDatabase } from
//     '../../test-utils/cosmosEmulator';
//
//   beforeAll(async () => { await setupEmulatorEnv(); ... })
//
// Tests must NOT import `getCosmos()` from `lib/cosmos.ts` — that singleton
// uses the production `fittrack-db` name. Construct a CosmosClient and the
// containers directly via the helpers below.

import { CosmosClient, type Container, type Database } from '@azure/cosmos';
import { randomUUID } from 'node:crypto';

// Well-known Cosmos Emulator master key. Public on Microsoft Docs.
// Never works against real Azure Cosmos DB.
export const EMULATOR_KEY =
  'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
// The vnext-preview Linux emulator listens on plain HTTP (the rust_gateway
// boot log says: "server up with protocol http on 0.0.0.0:8081"). The
// legacy Windows emulator used HTTPS with a self-signed cert; do NOT copy
// `https://` from older docs or you'll get ERR_SSL_WRONG_VERSION_NUMBER.
//
// Use 127.0.0.1 (not `localhost`) so Node's fetch / undici doesn't resolve
// to ::1 and miss the IPv4-only port binding.
export const EMULATOR_ENDPOINT =
  process.env.COSMOS_ENDPOINT ?? 'http://127.0.0.1:18081';

export interface EmulatorContext {
  client: CosmosClient;
  database: Database;
  databaseId: string;
}

/**
 * Set process.env so the production code paths (`isCosmosConfigured()`,
 * `getCosmos()`) believe Cosmos is configured. Each call generates a
 * fresh database id so tests are isolated.
 */
export function setupEmulatorEnv(): { databaseId: string } {
  const databaseId = `fittrack-test-${randomUUID().slice(0, 8)}`;
  process.env.COSMOS_ENDPOINT = EMULATOR_ENDPOINT;
  process.env.COSMOS_KEY = EMULATOR_KEY;
  process.env.COSMOS_DATABASE_ID = databaseId;
  // The emulator uses a self-signed certificate. The Cosmos SDK will refuse
  // by default; relax that for tests only.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  return { databaseId };
}

/**
 * Create a fresh database with all containers from the production schema.
 * Mirrors `backend/src/lib/cosmos.ts` and `infra/modules/cosmos.bicep`.
 */
export async function createTestDatabase(databaseId: string): Promise<EmulatorContext> {
  await ensureEmulatorReachable();

  const client = new CosmosClient({
    endpoint: EMULATOR_ENDPOINT,
    key: EMULATOR_KEY,
  });

  const { database } = await client.databases.createIfNotExists({ id: databaseId });

  // Same partition keys as production; keeps contract tests honest.
  const containerDefs: Array<{ id: string; partitionKey: string; compositeIndexes?: object[][] }> = [
    { id: 'users', partitionKey: '/id' },
    { id: 'nutritionProfiles', partitionKey: '/userId' },
    { id: 'weights', partitionKey: '/userId' },
    { id: 'nutritionDiaryMeals', partitionKey: '/userId' },
    { id: 'reusableMealItems', partitionKey: '/userId' },
    {
      id: 'recipes',
      partitionKey: '/userId',
      compositeIndexes: [
        [
          { path: '/lastUsedAt', order: 'descending' },
          { path: '/updatedAt', order: 'descending' },
        ],
      ],
    },
    { id: 'foodProducts', partitionKey: '/id' },
    { id: 'aiUsage', partitionKey: '/userId' },
  ];

  for (const def of containerDefs) {
    await database.containers.createIfNotExists({
      id: def.id,
      partitionKey: { paths: [def.partitionKey], kind: 'Hash' },
      indexingPolicy: def.compositeIndexes
        ? {
            indexingMode: 'consistent',
            automatic: true,
            includedPaths: [{ path: '/*' }],
            excludedPaths: [{ path: '/"_etag"/?' }],
            compositeIndexes: def.compositeIndexes,
          }
        : undefined,
    });
  }

  return { client, database, databaseId };
}

export async function destroyTestDatabase(ctx: EmulatorContext | undefined): Promise<void> {
  if (!ctx) return;
  try {
    await ctx.database.delete();
  } catch {
    // Best-effort cleanup; emulator may already be gone.
  }
  ctx.client.dispose();
}

export function getContainer(ctx: EmulatorContext, name: string): Container {
  return ctx.database.container(name);
}

/**
 * TCP/HTTP probe before we hand the CosmosClient a request. Without this the
 * SDK retries internally and emits a noisy `ECONNREFUSED` stack trace; the
 * developer-friendly hint here makes the cause obvious.
 */
async function ensureEmulatorReachable(): Promise<void> {
  const url = `${EMULATOR_ENDPOINT}/_explorer/emulator.pem`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    await fetch(url, { signal: controller.signal });
  } catch (err) {
    const hint = [
      '',
      `Cosmos DB Emulator is not reachable at ${EMULATOR_ENDPOINT}.`,
      '',
      'Contract tests need a running emulator. Pick one:',
      '  • Local Docker:    npm run emulator:start  (in backend/)',
      '  • Local Podman:    podman run -d -p 18081:8081 \\',
      '                       mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview',
      '  • CI:              GitHub Actions runs the emulator as a service container',
      '',
      'See backend/README.md → "Tier 2 — Cosmos contract tests" for details.',
      '',
      `Underlying error: ${(err as Error).message}`,
    ].join('\n');
    throw new Error(hint);
  } finally {
    clearTimeout(timer);
  }
}
