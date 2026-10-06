// Contract tests for CosmosDiaryRepository.
// Runs against the local Azure Cosmos DB Linux Emulator (Docker).
// Never points at real Azure Cosmos DB.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealType } from '@fittrack/shared';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { DiaryBulkMutationError } from './diaryRepository';
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

  it('bulkDelete commits selected item removals across meals in one user partition', async () => {
    const breakfast = await repo.createMeal(makeMealInput());
    const lunch = await repo.createMeal(makeMealInput({ type: 'lunch', name: 'Lunch' }));
    const selected = await repo.addItem(USER_A, breakfast.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const retained = await repo.addItem(USER_A, breakfast.id, {
      name: 'Toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const second = await repo.addItem(USER_A, lunch.id, {
      name: 'Apple', calories: 50, protein: 0, carbs: 14, fat: 0, fiber: 2,
    });

    const result = await repo.bulkDeleteItems(USER_A, {
      sourceDate: '2026-05-04',
      items: [
        { mealId: breakfast.id, itemId: selected.items[0].id },
        { mealId: lunch.id, itemId: second.items[0].id },
      ],
    });

    expect(result.deletedCount).toBe(2);
    expect((await repo.getMealById(USER_A, breakfast.id))?.items.map((item) => item.id))
      .toEqual([retained.items[1].id]);
    expect((await repo.getMealById(USER_A, lunch.id))?.items).toEqual([]);
  });

  it('bulkDelete treats another user partition like an unknown reference and leaves mixed selections unchanged', async () => {
    const date = '2026-05-04';
    const userAMeal = await repo.createMeal(makeMealInput({ userId: USER_A, date }));
    const userAWithItem = await repo.addItem(USER_A, userAMeal.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
    });
    const userBMeal = await repo.createMeal(makeMealInput({ userId: USER_B, date }));
    const userBWithItem = await repo.addItem(USER_B, userBMeal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const mealsBeforeA = structuredClone((await repo.getDay(USER_A, date)).meals
      .sort((left, right) => left.id.localeCompare(right.id)));
    const mealsBeforeB = structuredClone((await repo.getDay(USER_B, date)).meals
      .sort((left, right) => left.id.localeCompare(right.id)));
    const unknownReference = { mealId: 'unknown-meal', itemId: 'unknown-item' };
    const foreignReference = { mealId: userBMeal.id, itemId: userBWithItem.items[0]!.id };
    const deleteErrorCode = async (items: { mealId: string; itemId: string }[]) => {
      try {
        await repo.bulkDeleteItems(USER_A, { sourceDate: date, items });
        return null;
      } catch (error) {
        return error instanceof DiaryBulkMutationError ? error.code : 'unexpected_error';
      }
    };

    await expect(deleteErrorCode([unknownReference])).resolves.toBe('diary_bulk_reference_not_found');
    await expect(deleteErrorCode([foreignReference])).resolves.toBe('diary_bulk_reference_not_found');
    await expect(deleteErrorCode([
      { mealId: userAMeal.id, itemId: userAWithItem.items[0]!.id },
      foreignReference,
    ])).resolves.toBe('diary_bulk_reference_not_found');
    expect((await repo.getDay(USER_A, date)).meals
      .sort((left, right) => left.id.localeCompare(right.id))).toEqual(mealsBeforeA);
    expect((await repo.getDay(USER_B, date)).meals
      .sort((left, right) => left.id.localeCompare(right.id))).toEqual(mealsBeforeB);
  });

  it('bulkMove creates the target meal and moves snapshots with new item ids atomically', async () => {
    const breakfast = await repo.createMeal(makeMealInput());
    const second = await repo.createMeal(makeMealInput({ type: 'lunch', name: 'Lunch' }));
    const selected = await repo.addItem(USER_A, breakfast.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
      sourceId: 'openFoodFacts:123', sourceType: 'openFoodFacts',
    });
    const another = await repo.addItem(USER_A, second.id, {
      name: 'Apple', calories: 50, protein: 0, carbs: 14, fat: 0, fiber: 2,
    });

    const result = await repo.bulkMoveItems(USER_A, {
      sourceDate: '2026-05-04',
      items: [
        { mealId: breakfast.id, itemId: selected.items[0].id },
        { mealId: second.id, itemId: another.items[0].id },
      ],
      target: { newMealType: 'dinner' },
    });

    expect(result.movedCount).toBe(2);
    expect(result.targetMeal).toMatchObject({ type: 'dinner', date: '2026-05-04' });
    expect(result.targetMeal.items.map((item) => item.id)).not.toContain(selected.items[0].id);
    expect(result.targetMeal.items[0]).toMatchObject({
      name: 'Oats',
      sourceId: 'openFoodFacts:123',
      sourceType: 'openFoodFacts',
      macros: { calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4 },
    });
    expect((await repo.getMealById(USER_A, breakfast.id))?.items).toEqual([]);
    expect((await repo.getMealById(USER_A, second.id))?.items).toEqual([]);
  });

  it('bulkMove rejects a target in a multi-meal source set without partially committing', async () => {
    const breakfast = await repo.createMeal(makeMealInput());
    const lunch = await repo.createMeal(makeMealInput({ type: 'lunch', name: 'Lunch' }));
    const breakfastItem = await repo.addItem(USER_A, breakfast.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const lunchItem = await repo.addItem(USER_A, lunch.id, {
      name: 'Apple', calories: 50, protein: 0, carbs: 14, fat: 0, fiber: 2,
    });
    await repo.addItem(USER_A, lunch.id, {
      name: 'Toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const mealsBefore = (await repo.getDay(USER_A, '2026-05-04')).meals
      .sort((left, right) => left.id.localeCompare(right.id));

    await expect(repo.bulkMoveItems(USER_A, {
      sourceDate: '2026-05-04',
      items: [
        { mealId: breakfast.id, itemId: breakfastItem.items[0]!.id },
        { mealId: lunch.id, itemId: lunchItem.items[0]!.id },
      ],
      target: { mealId: lunch.id },
    })).rejects.toMatchObject({ code: 'invalid_diary_bulk_request' });

    const mealsAfter = (await repo.getDay(USER_A, '2026-05-04')).meals
      .sort((left, right) => left.id.localeCompare(right.id));
    expect(mealsAfter).toEqual(mealsBefore);
  });

  it('bulkCopy appends a complete snapshot clone to an existing target and preserves the source', async () => {
    const source = await repo.createMeal(makeMealInput());
    const target = await repo.createMeal(makeMealInput({ date: '2026-05-05', type: 'lunch', name: 'Lunch' }));
    const created = await repo.addItem(USER_A, source.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
      sourceId: 'openFoodFacts:copy-test', sourceType: 'ai-meal-estimate', isAiEstimate: true,
    });
    const sourceMeal = (await repo.getMealById(USER_A, source.id))!;
    const sourceItem = {
      ...sourceMeal.items[0]!,
      aiMealEstimateComponents: ['Oats', 'Milk'],
      aiMealEstimateContext: 'Breakfast',
      aiMealEstimateConfidence: 'high' as const,
      aiMealEstimateAssumptions: ['Unsweetened'],
      aiMealEstimatePhotoUsed: true,
      recipeId: 'recipe-source',
      recipePortions: 0.5,
      recipeAccess: 'community' as const,
      category: 'Cereals' as const,
    };
    const originalSnapshot = structuredClone(sourceItem);
    await ctx!.database.container('nutritionDiaryMeals').item(source.id, USER_A).replace({
      ...sourceMeal,
      items: [sourceItem],
    });
    const existingTargetItem = await repo.addItem(USER_A, target.id, {
      name: 'Apple', calories: 50, protein: 0, carbs: 14, fat: 0, fiber: 2,
    });

    const result = await repo.bulkCopyItems(USER_A, {
      sourceDate: '2026-05-04',
      targetDate: '2026-05-05',
      items: [{ mealId: source.id, itemId: created.items[0]!.id }],
      target: { mealId: target.id },
    });

    const copiedItem = result.targetMeal.items[1]!;
    const { id: copiedId, ...copiedSnapshot } = copiedItem;
    const { id: originalId, ...expectedSnapshot } = originalSnapshot;
    expect(result.copiedCount).toBe(1);
    expect(copiedId).not.toBe(originalId);
    expect(copiedSnapshot).toEqual(expectedSnapshot);
    expect(result.targetMeal.items[0]!.id).toBe(existingTargetItem.items[0]!.id);
    expect((await repo.getMealById(USER_A, source.id))?.items).toEqual([originalSnapshot]);
    expect((await repo.getMealById(USER_A, target.id))?.items).toEqual(result.targetMeal.items);
  });

  it('bulkCopy into its source meal reads once and performs one ETag-guarded Replace', async () => {
    const date = '2026-05-04';
    const source = await repo.createMeal(makeMealInput({ date }));
    const selected = await repo.addItem(USER_A, source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const container = ctx!.database.container('nutritionDiaryMeals');
    const itemSpy = vi.spyOn(container, 'item');
    const originalBatch = container.items.batch.bind(container.items);
    let operationsSeen: unknown[] = [];
    const batchSpy = vi.spyOn(container.items, 'batch').mockImplementationOnce(async (operations, partitionKey, options) => {
      operationsSeen = operations;
      return originalBatch(operations, partitionKey, options);
    });
    let result: Awaited<ReturnType<CosmosDiaryRepository['bulkCopyItems']>> | undefined;
    let sourceReadCount = 0;

    try {
      result = await repo.bulkCopyItems(USER_A, {
        sourceDate: date,
        targetDate: date,
        items: [{ mealId: source.id, itemId: selected.items[0]!.id }],
        target: { mealId: source.id },
      });
      sourceReadCount = itemSpy.mock.calls.filter(([mealId]) => mealId === source.id).length;
    } finally {
      batchSpy.mockRestore();
      itemSpy.mockRestore();
    }

    expect(sourceReadCount).toBe(1);
    expect(result?.copiedCount).toBe(1);
    expect(result?.targetMeal.items).toHaveLength(2);
    expect(result?.targetMeal.items[1]!.id).not.toBe(selected.items[0]!.id);
    expect(operationsSeen).toHaveLength(1);
    expect(operationsSeen[0]).toMatchObject({
      operationType: 'Replace',
      id: source.id,
      ifMatch: expect.any(String),
    });
    expect((await repo.getMealById(USER_A, source.id))?.items).toEqual(result?.targetMeal.items);
  });

  it('bulkCopy into its source meal detects an ETag conflict without adding a copy', async () => {
    const date = '2026-05-04';
    const source = await repo.createMeal(makeMealInput({ date }));
    const selected = await repo.addItem(USER_A, source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const container = ctx!.database.container('nutritionDiaryMeals');
    const originalBatch = container.items.batch.bind(container.items);
    const batchSpy = vi.spyOn(container.items, 'batch').mockImplementationOnce(async (operations, partitionKey, options) => {
      await repo.addItem(USER_A, source.id, {
        name: 'Concurrent toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
      });
      return originalBatch(operations, partitionKey, options);
    });

    try {
      await expect(repo.bulkCopyItems(USER_A, {
        sourceDate: date,
        targetDate: date,
        items: [{ mealId: source.id, itemId: selected.items[0]!.id }],
        target: { mealId: source.id },
      })).rejects.toMatchObject({ code: 'diary_bulk_conflict' });
    } finally {
      batchSpy.mockRestore();
    }

    expect((await repo.getMealById(USER_A, source.id))?.items.map((item) => item.name))
      .toEqual(['Egg', 'Concurrent toast']);
  });

  it('bulkCopy rejects duplicate same-day references without writing the target', async () => {
    const date = '2026-05-04';
    const source = await repo.createMeal(makeMealInput({ date }));
    const selected = await repo.addItem(USER_A, source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const originalItems = structuredClone(selected.items);

    await expect(repo.bulkCopyItems(USER_A, {
      sourceDate: date,
      targetDate: date,
      items: [
        { mealId: source.id, itemId: originalItems[0]!.id },
        { mealId: source.id, itemId: originalItems[0]!.id },
      ],
      target: { mealId: source.id },
    })).rejects.toMatchObject({ code: 'invalid_diary_bulk_request' });

    expect((await repo.getMealById(USER_A, source.id))?.items).toEqual(originalItems);
  });

  it('bulkCopy treats repeated same-day requests as new copies with fresh ids', async () => {
    const date = '2026-05-04';
    const source = await repo.createMeal(makeMealInput({ date }));
    const selected = await repo.addItem(USER_A, source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const originalItem = structuredClone(selected.items[0]!);
    const request = {
      sourceDate: date,
      targetDate: date,
      items: [{ mealId: source.id, itemId: originalItem.id }],
      target: { mealId: source.id },
    };

    const first = await repo.bulkCopyItems(USER_A, request);
    const second = await repo.bulkCopyItems(USER_A, request);

    expect(first.targetMeal.items).toHaveLength(2);
    expect(second.targetMeal.items).toHaveLength(3);
    expect(second.targetMeal.items[0]).toEqual(originalItem);
    const copiedIds = second.targetMeal.items.slice(1).map((item) => item.id);
    expect(new Set(copiedIds).size).toBe(2);
    expect(copiedIds).not.toContain(originalItem.id);
    expect((await repo.getMealById(USER_A, source.id))?.items).toEqual(second.targetMeal.items);
  });

  it('bulkCopy atomically creates a target and does not create one for an invalid selection', async () => {
    const source = await repo.createMeal(makeMealInput());
    await repo.addItem(USER_A, source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const sourceWithAllItems = await repo.addItem(USER_A, source.id, {
      name: 'Toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const originalItems = structuredClone(sourceWithAllItems.items);
    const sourceIds = new Set(originalItems.map((item) => item.id));

    const result = await repo.bulkCopyItems(USER_A, {
      sourceDate: '2026-05-04',
      targetDate: '2026-05-05',
      items: originalItems.map((item) => ({ mealId: source.id, itemId: item.id })),
      target: { newMealType: 'dinner' },
    });

    expect(result.copiedCount).toBe(originalItems.length);
    expect(result.targetMeal).toMatchObject({ date: '2026-05-05', type: 'dinner', name: 'Dinner' });
    expect(result.targetMeal.items).toEqual(
      originalItems.map((item) => ({ ...item, id: expect.any(String) })),
    );
    const copiedIds = result.targetMeal.items.map((item) => item.id);
    expect(new Set(copiedIds).size).toBe(copiedIds.length);
    expect(copiedIds.every((id) => !sourceIds.has(id))).toBe(true);
    expect((await repo.getMealById(USER_A, source.id))?.items).toEqual(originalItems);
    expect((await repo.getMealById(USER_A, result.targetMeal.id))?.items).toEqual(result.targetMeal.items);
    expect((await repo.getDay(USER_A, '2026-05-05')).meals).toEqual([result.targetMeal]);

    await expect(repo.bulkCopyItems(USER_A, {
      sourceDate: '2026-05-04',
      targetDate: '2026-05-06',
      items: [
        { mealId: source.id, itemId: originalItems[0]!.id },
        { mealId: source.id, itemId: 'missing-item' },
      ],
      target: { newMealType: 'lunch' },
    })).rejects.toMatchObject({ code: 'diary_bulk_reference_not_found' });
    expect((await repo.getDay(USER_A, '2026-05-06')).meals).toEqual([]);
  });

  it('bulkCopy returns a conflict when the existing target changes before batch commit', async () => {
    const source = await repo.createMeal(makeMealInput());
    const target = await repo.createMeal(makeMealInput({ date: '2026-05-05', type: 'lunch', name: 'Lunch' }));
    const selected = await repo.addItem(USER_A, source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const container = ctx!.database.container('nutritionDiaryMeals');
    const originalBatch = container.items.batch.bind(container.items);
    const batchSpy = vi.spyOn(container.items, 'batch').mockImplementationOnce(async (operations, partitionKey, options) => {
      await repo.addItem(USER_A, target.id, {
        name: 'Concurrent toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
      });
      return originalBatch(operations, partitionKey, options);
    });

    try {
      await expect(repo.bulkCopyItems(USER_A, {
        sourceDate: '2026-05-04',
        targetDate: '2026-05-05',
        items: [{ mealId: source.id, itemId: selected.items[0]!.id }],
        target: { mealId: target.id },
      })).rejects.toMatchObject({ code: 'diary_bulk_conflict' });
    } finally {
      batchSpy.mockRestore();
    }

    expect((await repo.getMealById(USER_A, source.id))?.items).toEqual(selected.items);
    expect((await repo.getMealById(USER_A, target.id))?.items.map((item) => item.name))
      .toEqual(['Concurrent toast']);
  });

  it('bulk mutations reject missing references without partially committing', async () => {
    const breakfast = await repo.createMeal(makeMealInput());
    const lunch = await repo.createMeal(makeMealInput({ type: 'lunch', name: 'Lunch' }));
    const selected = await repo.addItem(USER_A, breakfast.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });

    await expect(repo.bulkDeleteItems(USER_A, {
      sourceDate: '2026-05-04',
      items: [
        { mealId: breakfast.id, itemId: selected.items[0].id },
        { mealId: lunch.id, itemId: 'missing-item' },
      ],
    })).rejects.toBeInstanceOf(DiaryBulkMutationError);
    await expect(repo.bulkDeleteItems(USER_A, {
      sourceDate: '2026-05-04',
      items: [
        { mealId: breakfast.id, itemId: selected.items[0].id },
        { mealId: lunch.id, itemId: 'missing-item' },
      ],
    })).rejects.toMatchObject({ code: 'diary_bulk_reference_not_found' });
    expect((await repo.getMealById(USER_A, breakfast.id))?.items).toHaveLength(1);
  });

  it('bulk mutations return a conflict when an ETag changes before batch commit', async () => {
    const breakfast = await repo.createMeal(makeMealInput());
    const selected = await repo.addItem(USER_A, breakfast.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const container = ctx!.database.container('nutritionDiaryMeals');
    const originalBatch = container.items.batch.bind(container.items);
    const batchSpy = vi.spyOn(container.items, 'batch').mockImplementationOnce(async (operations, partitionKey, options) => {
      await repo.addItem(USER_A, breakfast.id, {
        name: 'Concurrent toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
      });
      return originalBatch(operations, partitionKey, options);
    });

    try {
      await expect(repo.bulkDeleteItems(USER_A, {
        sourceDate: '2026-05-04',
        items: [{ mealId: breakfast.id, itemId: selected.items[0].id }],
      })).rejects.toMatchObject({ code: 'diary_bulk_conflict' });
    } finally {
      batchSpy.mockRestore();
    }

    expect((await repo.getMealById(USER_A, breakfast.id))?.items.map((item) => item.name))
      .toEqual(['Egg', 'Concurrent toast']);
  });

  it('isolates data per userId', async () => {
    await repo.createMeal(makeMealInput({ userId: USER_A }));
    const dayB = await repo.getDay(USER_B, '2026-05-04');
    expect(dayB.meals).toHaveLength(0);
  });
});
