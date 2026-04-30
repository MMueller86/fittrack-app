// Cosmos DB client and container references.
//
// Activated when COSMOS_ENDPOINT and COSMOS_KEY are set in local.settings.json
// (or as App Settings in Azure). When unset, repository factories fall back
// to in-memory implementations so the app still runs locally without Azure.
//
// Database + container names follow docs/data_model.md.
// Containers are partitioned by /userId (except `users` which uses /id).

import { CosmosClient, Container, Database } from '@azure/cosmos';

const DATABASE_ID = process.env.COSMOS_DATABASE_ID ?? 'fittrack-db';

const CONTAINER_DEFS = [
  { id: 'users', partitionKey: '/id' },
  { id: 'nutritionProfiles', partitionKey: '/userId' },
  { id: 'weights', partitionKey: '/userId' },
  { id: 'nutritionDiaryMeals', partitionKey: '/userId' },
  { id: 'reusableMealItems', partitionKey: '/userId' },
  { id: 'recipes', partitionKey: '/userId' },
] as const;

export type ContainerName = (typeof CONTAINER_DEFS)[number]['id'];

export interface CosmosContext {
  client: CosmosClient;
  database: Database;
  containers: Record<ContainerName, Container>;
}

let cached: CosmosContext | undefined;
let initPromise: Promise<CosmosContext> | undefined;

export function isCosmosConfigured(): boolean {
  return Boolean(process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY);
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
    const client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT!,
      key: process.env.COSMOS_KEY!,
    });

    const { database } = await client.databases.createIfNotExists({ id: DATABASE_ID });

    const containers = {} as Record<ContainerName, Container>;
    for (const def of CONTAINER_DEFS) {
      const { container } = await database.containers.createIfNotExists({
        id: def.id,
        partitionKey: { paths: [def.partitionKey] },
      });
      containers[def.id] = container;
    }

    cached = { client, database, containers };
    return cached;
  })();

  return initPromise;
}
