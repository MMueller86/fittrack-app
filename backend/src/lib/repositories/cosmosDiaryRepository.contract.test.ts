// Contract tests for CosmosDiaryRepository.
// Runs against the local Azure Cosmos DB Linux Emulator (Docker).
// Never points at real Azure Cosmos DB.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MealType } from '@fittrack/shared';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosDiaryRepository } from './cosmosDiaryRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosDiaryRepository;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosDiaryRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

async function clearDiary(userIds: string[]): Promise<void> {
  const container = ctx!.database.container('nutritionDiaryMeals');
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

const USER_A = 'contract-diary-a';
const USER_B = 'contract-diary-b';

beforeEach(async () => {
  await clearDiary([USER_A, USER_B]);
});

function makeMealInput(overrides: Partial<{ userId: string; date: string; type: MealType; name: string }> = {}) {
  return {
    userId: overrides.userId ?? USER_A,
    date: overrides.date ?? '2026-05-04',
    type: (overrides.type ?? 'breakfast') as MealType,
    name: overrides.name ?? 'Breakfast',
  };
}

describe('CosmosDiaryRepository (contract)', () => {
  it('getDay returns empty result for new user', async () => {
    const result = await repo.getDay(USER_A, '2026-05-04');
    expect(result.meals).toEqual([]);
    expect(result.summary.calories).toBe(0);
  });

  it('createMeal stores and returns the meal', async () => {
    const meal = await repo.createMeal(makeMealInput({ type: 'lunch', name: 'Lunch' }));
    expect(meal.id).toBeTruthy();
    expect(meal.type).toBe('lunch');
    expect(meal.items).toEqual([]);

    const day = await repo.getDay(USER_A, '2026-05-04');
    expect(day.meals).toHaveLength(1);
    expect(day.meals[0].id).toBe(meal.id);
  });

  it('getDay filters by date — other dates are not returned', async () => {
    await repo.createMeal(makeMealInput({ date: '2026-05-04' }));
    await repo.createMeal(makeMealInput({ date: '2026-05-05' }));
    const day = await repo.getDay(USER_A, '2026-05-04');
    expect(day.meals).toHaveLength(1);
    expect(day.meals[0].date).toBe('2026-05-04');
  });

  it('addItem appends item and persists it', async () => {
    const meal = await repo.createMeal(makeMealInput());
    const updated = await repo.addItem(USER_A, meal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].name).toBe('Egg');

    const day = await repo.getDay(USER_A, '2026-05-04');
    expect(day.meals[0].items).toHaveLength(1);
    expect(day.summary.calories).toBe(90);
  });

  it('deleteItem removes item and persists the change', async () => {
    const meal = await repo.createMeal(makeMealInput());
    const withItem = await repo.addItem(USER_A, meal.id, {
      name: 'Bread', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const itemId = withItem.items[0].id;
    const after = await repo.deleteItem(USER_A, meal.id, itemId);
    expect(after?.items).toHaveLength(0);

    const day = await repo.getDay(USER_A, '2026-05-04');
    expect(day.meals[0].items).toHaveLength(0);
    expect(day.summary.calories).toBe(0);
  });

  it('deleteMeal removes the meal from Cosmos', async () => {
    const meal = await repo.createMeal(makeMealInput());
    expect(await repo.deleteMeal(USER_A, meal.id)).toBe(true);
    const day = await repo.getDay(USER_A, '2026-05-04');
    expect(day.meals).toHaveLength(0);
  });

  it('deleteMeal returns false for unknown id', async () => {
    expect(await repo.deleteMeal(USER_A, crypto.randomUUID())).toBe(false);
  });

  it('isolates data per userId', async () => {
    await repo.createMeal(makeMealInput({ userId: USER_A }));
    const dayB = await repo.getDay(USER_B, '2026-05-04');
    expect(dayB.meals).toHaveLength(0);
  });
});
