// Cosmos DB client and container references.
//
// Activated when COSMOS_ENDPOINT and COSMOS_KEY are set in local.settings.json
// (or as App Settings in Azure). When unset, repository factories fall back
// to in-memory implementations so the app still runs locally without Azure.
//
// Database + container names follow docs/data_model.md.
// User-data containers use /userId; users, foodProducts and communityRecipes use /id.

import { CosmosClient, Container, Database } from '@azure/cosmos';

function getDatabaseId(): string {
  return process.env.COSMOS_DATABASE_ID ?? 'fittrack-db';
}

const CONTAINER_DEFS = [
  { id: 'users', partitionKey: '/id' },
  { id: 'nutritionProfiles', partitionKey: '/userId' },
  { id: 'profiles', partitionKey: '/userId' },
  { id: 'weights', partitionKey: '/userId' },
  { id: 'nutritionDiaryMeals', partitionKey: '/userId' },
  { id: 'reusableMealItems', partitionKey: '/userId' },
  { id: 'recipes', partitionKey: '/userId' },
  { id: 'communityRecipes', partitionKey: '/id' },
  // Internal food product catalog — partition key is /id (product id = barcode-based)
  { id: 'foodProducts', partitionKey: '/id' },
  // AI usage counters — one document per user/feature/period
  { id: 'aiUsage', partitionKey: '/userId' },
  // Daily AI-generated insights — one document per user per calendar day
  { id: 'aiInsights', partitionKey: '/userId', defaultTtl: -1 },
  // User-food relations — favorites, usage history (lastUsedAt, usageCount) per user
  { id: 'userFoodRelations', partitionKey: '/userId' },
] as const;

export type ContainerName = (typeof CONTAINER_DEFS)[number]['id'];

export interface CosmosContext {
  client: CosmosClient;
  database: Database;
  containers: Record<ContainerName, Container>;
}

let cached: CosmosContext | undefined;
let initPromise: Promise<CosmosContext> | undefined;
let initDiagnostics: CosmosInitDiagnostics | undefined;

export interface CosmosInitDiagnostics {
  /** Wall-clock time of the one-time client and container setup. */
  durationMs: number;
  /** `performance.now()` reading at which the setup finished (monotonic, sub-millisecond). */
  completedAtMonotonicMs: number;
  /** True when database and containers were created/checked over the network. */
  schemaProvisioned: boolean;
}

export function isCosmosConfigured(): boolean {
  return Boolean(process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY);
}

/**
 * Whether `getCosmos()` creates the database and containers when missing.
 * A local emulator always needs it; remote accounts (Dev, Alpha) get their
 * containers from Bicep, so the 13 network round trips are skipped when the
 * process runs in Azure (`WEBSITE_SITE_NAME` set). `COSMOS_PROVISION_SCHEMA`
 * (`true`/`false`) overrides both rules.
 */
export function shouldProvisionSchema(): boolean {
  const override = process.env.COSMOS_PROVISION_SCHEMA;
  if (override === 'true') return true;
  if (override === 'false') return false;
  if (isLocalEmulatorEndpoint(process.env.COSMOS_ENDPOINT)) return true;
  return !process.env.WEBSITE_SITE_NAME;
}

function isLocalEmulatorEndpoint(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  try {
    const { hostname } = new URL(endpoint);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' ||
      hostname === 'host.docker.internal';
  } catch {
    return false;
  }
}

/** Diagnostics of the one-time Cosmos setup in this worker, once it has finished. */
export function getCosmosInitDiagnostics(): CosmosInitDiagnostics | undefined {
  return initDiagnostics;
}

/**
 * Get a fully-initialized Cosmos context (creates DB and containers if missing).
 * Throws if COSMOS_ENDPOINT / COSMOS_KEY are not configured.
 */
export async function getCosmos(): Promise<CosmosContext> {
  if (cached) return cached;
  if (initPromise) return initPromise;

  if (!isCosmosConfigured()) {
    throw new Error(
      'Cosmos DB is not configured. Set COSMOS_ENDPOINT and COSMOS_KEY environment variables.',
    );
  }

  initPromise = (async () => {
    const startedAt = Date.now();
    const schemaProvisioned = shouldProvisionSchema();
    const client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT!,
      key: process.env.COSMOS_KEY!,
    });

    const containers = {} as Record<ContainerName, Container>;
    let database: Database;
    if (schemaProvisioned) {
      ({ database } = await client.databases.createIfNotExists({ id: getDatabaseId() }));
      const created = await Promise.all(
        CONTAINER_DEFS.map(async (def) => {
          const { container } = await database.containers.createIfNotExists({
            id: def.id,
            partitionKey: { paths: [def.partitionKey] },
            ...('defaultTtl' in def ? { defaultTtl: def.defaultTtl } : {}),
          });
          return [def.id, container] as const;
        }),
      );
      for (const [id, container] of created) containers[id] = container;
    } else {
      database = client.database(getDatabaseId());
      for (const def of CONTAINER_DEFS) containers[def.id] = database.container(def.id);
    }

    cached = { client, database, containers };
    initDiagnostics = {
      durationMs: Date.now() - startedAt,
      completedAtMonotonicMs: performance.now(),
      schemaProvisioned,
    };
    return cached;
  })();

  // A failed setup must not be cached, otherwise the worker never recovers.
  initPromise.catch(() => {
    initPromise = undefined;
  });

  return initPromise;
}

/**
 * Test-only: drop the cached Cosmos context so the next `getCosmos()` call
 * reads the current env vars again. Used by contract tests that point the
 * client at a fresh isolated database per run.
 */
export function __resetCosmosForTests(): void {
  cached = undefined;
  initPromise = undefined;
  initDiagnostics = undefined;
}
