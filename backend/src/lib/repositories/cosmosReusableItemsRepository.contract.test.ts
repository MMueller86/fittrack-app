// Contract tests for CosmosReusableItemsRepository.
// Runs against the local Azure Cosmos DB Linux Emulator (Docker).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosReusableItemsRepository } from './cosmosReusableItemsRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosReusableItemsRepository;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosReusableItemsRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

async function clearItems(userIds: string[]): Promise<void> {
  const container = ctx!.database.container('reusableMealItems');
  for (const userId of userIds) {
    const { resources } = await container.items
      .query<{ id: string }>(
        { query: 'SELECT c.id FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: userId }] },
        { partitionKey: userId },
      )
      .fetchAll();
    for (const r of resources) {
      await container.item(r.id, userId).delete();
    }
  }
}

const USER_A = 'contract-reusable-a';
const USER_B = 'contract-reusable-b';

beforeEach(async () => {
  await clearItems([USER_A, USER_B]);
});

describe('CosmosReusableItemsRepository (contract)', () => {
  it('search returns empty for new user', async () => {
    expect(await repo.search(USER_A, '')).toEqual([]);
  });

  it('create stores and returns the item', async () => {
    const item = await repo.create({
      userId: USER_A, name: 'Oats', calories: 300, proteinG: 10, carbsG: 55, fatG: 5, fiberG: 4,
    });
    expect(item.id).toBeTruthy();
    expect(item.name).toBe('Oats');
    expect(item.usageCount).toBe(0);
  });

  it('search with empty query returns created items', async () => {
    await repo.create({ userId: USER_A, name: 'Apple', calories: 80, proteinG: 0, carbsG: 21, fatG: 0, fiberG: 3 });
    await repo.create({ userId: USER_A, name: 'Banana', calories: 90, proteinG: 1, carbsG: 23, fatG: 0, fiberG: 3 });
    const results = await repo.search(USER_A, '');
    expect(results).toHaveLength(2);
  });

  it('search filters by startsWith query (case-insensitive)', async () => {
    await repo.create({ userId: USER_A, name: 'Oats', calories: 300, proteinG: 10, carbsG: 55, fatG: 5, fiberG: 4 });
    await repo.create({ userId: USER_A, name: 'Orange Juice', calories: 110, proteinG: 1, carbsG: 26, fatG: 0, fiberG: 0 });
    await repo.create({ userId: USER_A, name: 'Apple', calories: 80, proteinG: 0, carbsG: 21, fatG: 0, fiberG: 3 });

    const results = await repo.search(USER_A, 'o');
    const names = results.map((r) => r.name);
    expect(names).toContain('Oats');
    expect(names).toContain('Orange Juice');
    expect(names).not.toContain('Apple');
  });

  it('isolates items per userId', async () => {
    await repo.create({ userId: USER_A, name: 'Bread', calories: 80, proteinG: 3, carbsG: 15, fatG: 1, fiberG: 1 });
    expect(await repo.search(USER_B, '')).toHaveLength(0);
  });
});
