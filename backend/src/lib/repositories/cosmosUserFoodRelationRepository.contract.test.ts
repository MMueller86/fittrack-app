// Contract tests for CosmosUserFoodRelationRepository.
// Runs against the local Azure Cosmos DB Linux Emulator (Docker).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MealType, UserFoodRelation } from '@fittrack/shared';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosUserFoodRelationRepository } from './cosmosUserFoodRelationRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosUserFoodRelationRepository;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosUserFoodRelationRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

async function clearRelations(userIds: string[]): Promise<void> {
  const container = ctx!.database.container('userFoodRelations');
  for (const userId of userIds) {
    const { resources } = await container.items
      .query<{ id: string }>(
        { query: 'SELECT c.id FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: userId }] },
        { partitionKey: userId },
      )
      .fetchAll();
    for (const relation of resources) {
      await container.item(relation.id, userId).delete();
    }
  }
}

const USER_A = 'contract-user-food-relation-a';
const USER_B = 'contract-user-food-relation-b';

beforeEach(async () => {
  await clearRelations([USER_A, USER_B]);
});

function makeInput(overrides: Partial<{
  foodRef: string;
  foodRefType: 'catalog' | 'personal' | 'recipe';
  displayName: string;
  mealType: MealType;
  usageDate: string;
}> = {}) {
  return {
    foodRef: overrides.foodRef ?? 'openFoodFacts:contract-food',
    foodRefType: overrides.foodRefType ?? 'catalog',
    displayName: overrides.displayName ?? 'Contract Food',
    ...overrides,
    usageDate: overrides.usageDate ?? '2026-05-08',
  };
}

describe('CosmosUserFoodRelationRepository (contract)', () => {
  it('does not create a relation when usageDate is missing', async () => {
    const input = { ...makeInput({ mealType: 'lunch' }), usageDate: undefined } as unknown as Parameters<typeof repo.recordUsage>[1];

    await repo.recordUsage(USER_A, input);

    expect(await repo.getByFoodRef(USER_A, 'openFoodFacts:contract-food')).toBeNull();
  });

  it('stores the explicit usage date and keeps timestamps as UTC instants', async () => {
    await repo.recordUsage(USER_A, makeInput({ mealType: 'lunch', usageDate: '2026-05-08' }));

    const relation = await repo.getByFoodRef(USER_A, 'openFoodFacts:contract-food');
    expect(relation?.usageDates).toEqual([{ date: '2026-05-08', mealType: 'lunch' }]);
    expect(relation?.lastUsedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(relation?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(relation?.createdAt).toBe(relation?.lastUsedAt);
  });

  it('trims usage dates relative to the explicit usage date', async () => {
    await repo.recordUsage(USER_A, makeInput({ mealType: 'lunch', usageDate: '2026-02-06' }));
    await repo.recordUsage(USER_A, makeInput({ mealType: 'lunch', usageDate: '2026-05-08' }));

    const relation = await repo.getByFoodRef(USER_A, 'openFoodFacts:contract-food');
    expect(relation?.usageDates).toEqual([{ date: '2026-05-08', mealType: 'lunch' }]);
  });

  it('isolates relations by userId', async () => {
    await repo.recordUsage(USER_A, makeInput());

    expect(await repo.getByFoodRef(USER_B, 'openFoodFacts:contract-food')).toBeNull();

    const raw = await ctx!.database
      .container('userFoodRelations')
      .item(`${USER_A}:openFoodFacts:contract-food`, USER_A)
      .read<UserFoodRelation>();
    expect(raw.resource?.userId).toBe(USER_A);
  });
});
