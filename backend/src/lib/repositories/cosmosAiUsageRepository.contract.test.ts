// Contract tests for CosmosAiUsageRepository.
//
// These tests run against the local Azure Cosmos DB Linux Emulator (Docker)
// and exercise the real Cosmos upsert/read path for AI usage tracking.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosAiUsageRepository } from './cosmosAiUsageRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosAiUsageRepository;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosAiUsageRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

async function clearUsage(userId: string): Promise<void> {
  const container = ctx!.database.container('aiUsage');
  const { resources } = await container.items
    .query<{ id: string }>(
      { query: 'SELECT c.id FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: userId }] },
      { partitionKey: userId },
    )
    .fetchAll();
  for (const doc of resources) {
    await container.item(doc.id, userId).delete();
  }
}

const TEST_USER = 'contract-test-user-aiUsage';

beforeEach(async () => {
  await clearUsage(TEST_USER);
});

describe('CosmosAiUsageRepository', () => {
  it('getCounter returns null when no usage exists', async () => {
    const result = await repo.getCounter(TEST_USER, 'meal-parser', '2026-05');
    expect(result).toBeNull();
  });

  it('incrementUsage creates a new counter', async () => {
    const counter = await repo.incrementUsage(TEST_USER, 'meal-parser', 'free');
    expect(counter.userId).toBe(TEST_USER);
    expect(counter.feature).toBe('meal-parser');
    expect(counter.used).toBe(1);
    expect(counter.limit).toBe(50);
    expect(counter.tier).toBe('free');
    expect(counter.firstUsedAt).toBeTruthy();
    expect(counter.lastUsedAt).toBeTruthy();
  });

  it('incrementUsage increments existing counter', async () => {
    await repo.incrementUsage(TEST_USER, 'meal-parser', 'free');
    const second = await repo.incrementUsage(TEST_USER, 'meal-parser', 'free');
    expect(second.used).toBe(2);
  });

  it('getCounter reads back after increment', async () => {
    await repo.incrementUsage(TEST_USER, 'food-estimate', 'free');
    const period = new Date().toISOString().slice(0, 7);
    const counter = await repo.getCounter(TEST_USER, 'food-estimate', period);
    expect(counter).not.toBeNull();
    expect(counter!.used).toBe(1);
    expect(counter!.feature).toBe('food-estimate');
  });

  it('checkQuota returns allowed when under limit', async () => {
    const result = await repo.checkQuota(TEST_USER, 'meal-parser', 'free');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(50);
  });

  it('different features are isolated', async () => {
    await repo.incrementUsage(TEST_USER, 'meal-parser', 'free');
    await repo.incrementUsage(TEST_USER, 'food-estimate', 'free');

    const mpQuota = await repo.checkQuota(TEST_USER, 'meal-parser', 'free');
    const feQuota = await repo.checkQuota(TEST_USER, 'food-estimate', 'free');
    expect(mpQuota.used).toBe(1);
    expect(feQuota.used).toBe(1);
  });

  it('different users are isolated by partition key', async () => {
    const otherUser = 'contract-test-user-other';
    await clearUsage(otherUser);

    await repo.incrementUsage(TEST_USER, 'meal-parser', 'free');
    await repo.incrementUsage(otherUser, 'meal-parser', 'free');
    await repo.incrementUsage(otherUser, 'meal-parser', 'free');

    const q1 = await repo.checkQuota(TEST_USER, 'meal-parser', 'free');
    const q2 = await repo.checkQuota(otherUser, 'meal-parser', 'free');
    expect(q1.used).toBe(1);
    expect(q2.used).toBe(2);

    await clearUsage(otherUser);
  });
});
