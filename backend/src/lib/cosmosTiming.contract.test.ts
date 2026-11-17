// Contract test: the timing HTTP client must run for real Cosmos SDK requests.
// Fails if a future @azure/cosmos version stops honouring `CosmosClientOptions.httpClient`.
// Runs against the local emulator only (see vitest.contract.config.mts).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../test-utils/cosmosEmulator';
import { __resetCosmosForTests, getCosmos } from './cosmos';
import { cosmosTimingLogFields, runWithCosmosTiming } from './cosmosTiming';

let ctx: EmulatorContext | undefined;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

describe('Cosmos timing HTTP client', () => {
  it('records a real SDK request made through getCosmos()', async () => {
    const cosmos = await getCosmos();
    const { counters, result } = runWithCosmosTiming(() =>
      cosmos.containers.weights.items
        .query({ query: 'SELECT VALUE COUNT(1) FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: 'timing-probe' }] }, { partitionKey: 'timing-probe' })
        .fetchAll(),
    );
    await result;

    const fields = cosmosTimingLogFields(counters);
    expect(fields.cosmos_calls).toBeGreaterThanOrEqual(1);
    expect(fields.cosmos_ms).toBeGreaterThan(0);
    expect(fields.cosmos_ru).toBeGreaterThan(0);
  });
});
