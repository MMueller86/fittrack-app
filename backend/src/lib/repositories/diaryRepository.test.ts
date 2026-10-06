import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub the Cosmos repositories so unit tests run without a DB connection.
vi.mock('./cosmosDiaryRepository', () => ({
  CosmosDiaryRepository: class {
    async getDay() { return { meals: [], summary: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } }; }
    async createMeal(i: { userId: string; date: string; type: string; name: string }) {
      return { id: 'mock-id', items: [], createdAt: new Date().toISOString(), ...i };
    }
    async addItem() { return { id: 'mock-id', items: [] }; }
    async deleteItem() { return null; }
    async deleteMeal() { return false; }
    async bulkDeleteItems() { return { deletedCount: 0, deletedItemIds: [] }; }
    async bulkMoveItems() {
      return { movedCount: 0, removedItemIds: [], targetMeal: { id: 'mock-id', items: [] } };
    }
  },
}));

import {
  assertDiaryBulkBatchLimits,
  DiaryBulkMutationError,
  getDiaryRepository,
  computeSummary,
  __resetDiaryRepositoryForTests,
} from './diaryRepository';
import type { Meal } from '@fittrack/shared';

const originalEnv = { ...process.env };

beforeEach(() => {
  __resetDiaryRepositoryForTests();
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
  __resetDiaryRepositoryForTests();
});

// --- Factory selection ---

describe('getDiaryRepository (factory)', () => {
  it('returns in-memory repo when Cosmos is not configured', () => {
    expect(getDiaryRepository().constructor.name).toBe('InMemoryDiaryRepository');
  });

  it('returns Cosmos repo when both env vars are set', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';
    process.env.COSMOS_KEY = 'fake-key';
    expect(getDiaryRepository().constructor.name).toBe('CosmosDiaryRepository');
  });

  it('caches the instance', () => {
    const a = getDiaryRepository();
    const b = getDiaryRepository();
    expect(a).toBe(b);
  });
});

// --- computeSummary ---

describe('computeSummary', () => {
  it('returns zero summary for empty meals array', () => {
    const s = computeSummary([]);
    expect(s).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it('sums macros across all meals and items', () => {
    const meals: Meal[] = [
      {
        id: 'm1', userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast',
        createdAt: '', items: [
          { id: 'i1', name: 'Oats', sourceType: 'manual', quantity: 1, unit: 'serving',
            macros: { calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4 } },
        ],
      },
      {
        id: 'm2', userId: 'u', date: '2026-05-04', type: 'lunch', name: 'Lunch',
        createdAt: '', items: [
          { id: 'i2', name: 'Chicken', sourceType: 'manual', quantity: 1, unit: 'serving',
            macros: { calories: 250, protein: 40, carbs: 0, fat: 6, fiber: 0 } },
          { id: 'i3', name: 'Rice', sourceType: 'manual', quantity: 1, unit: 'serving',
            macros: { calories: 200, protein: 4, carbs: 45, fat: 0.5, fiber: 1 } },
        ],
      },
    ];
    const s = computeSummary(meals);
    expect(s.calories).toBe(750);
    expect(s.protein).toBe(54);
    expect(s.carbs).toBe(95);
    expect(s.fat).toBe(11.5);
    expect(s.fiber).toBe(5);
  });

  it('rounds to 1 decimal to avoid floating-point noise', () => {
    const meals: Meal[] = [
      {
        id: 'm1', userId: 'u', date: '2026-05-04', type: 'snack', name: 'Snack',
        createdAt: '', items: [
          { id: 'i1', name: 'A', sourceType: 'manual', quantity: 1, unit: 'serving',
            macros: { calories: 100.123, protein: 10.456, carbs: 20.789, fat: 5.111, fiber: 2.999 } },
        ],
      },
    ];
    const s = computeSummary(meals);
    expect(s.calories).toBe(100.1);
    expect(s.protein).toBe(10.5);
    expect(s.carbs).toBe(20.8);
    expect(s.fat).toBe(5.1);
    expect(s.fiber).toBe(3);
  });
});

// --- InMemoryDiaryRepository ---

describe('InMemoryDiaryRepository (via factory)', () => {
  it('returns empty day for new user', async () => {
    const repo = getDiaryRepository();
    const result = await repo.getDay('user-1', '2026-05-04');
    expect(result.meals).toEqual([]);
    expect(result.summary.calories).toBe(0);
  });

  it('createMeal returns meal with correct fields', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({
      userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast',
    });
    expect(meal.id).toBeTruthy();
    expect(meal.type).toBe('breakfast');
    expect(meal.items).toEqual([]);
  });

  it('getDay returns created meals for that date only', async () => {
    const repo = getDiaryRepository();
    await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    await repo.createMeal({ userId: 'u', date: '2026-05-05', type: 'lunch', name: 'Lunch' });
    const day = await repo.getDay('u', '2026-05-04');
    expect(day.meals).toHaveLength(1);
    expect(day.meals[0].date).toBe('2026-05-04');
  });

  it('addItem appends item and updates summary', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'B' });
    const updated = await repo.addItem('u', meal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].name).toBe('Egg');
    const day = await repo.getDay('u', '2026-05-04');
    expect(day.summary.calories).toBe(90);
  });

  it('deleteItem removes item from meal', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'lunch', name: 'L' });
    const withItem = await repo.addItem('u', meal.id, {
      name: 'Bread', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const itemId = withItem.items[0].id;
    const after = await repo.deleteItem('u', meal.id, itemId);
    expect(after?.items).toHaveLength(0);
  });

  it('deleteItem returns null for unknown item', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'dinner', name: 'D' });
    const result = await repo.deleteItem('u', meal.id, 'nonexistent');
    expect(result).toBeNull();
  });

  it('deleteMeal removes the meal', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'snack', name: 'S' });
    const deleted = await repo.deleteMeal('u', meal.id);
    expect(deleted).toBe(true);
    const day = await repo.getDay('u', '2026-05-04');
    expect(day.meals).toHaveLength(0);
  });

  it('deleteMeal returns false for unknown id', async () => {
    const repo = getDiaryRepository();
    expect(await repo.deleteMeal('u', 'missing')).toBe(false);
  });

  it('bulkDeleteItems removes the complete selection and keeps emptied meals', async () => {
    const repo = getDiaryRepository();
    const firstMeal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    const secondMeal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'lunch', name: 'Lunch' });
    const first = await repo.addItem('u', firstMeal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const keep = await repo.addItem('u', firstMeal.id, {
      name: 'Toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const second = await repo.addItem('u', secondMeal.id, {
      name: 'Apple', calories: 50, protein: 0, carbs: 14, fat: 0, fiber: 2,
    });

    const result = await repo.bulkDeleteItems('u', {
      sourceDate: '2026-05-04',
      items: [
        { mealId: firstMeal.id, itemId: first.items[0].id },
        { mealId: secondMeal.id, itemId: second.items[0].id },
      ],
    });

    expect(result).toEqual({
      deletedCount: 2,
      deletedItemIds: [first.items[0].id, second.items[0].id],
    });
    expect((await repo.getMealById('u', firstMeal.id))?.items.map((item) => item.id)).toEqual([keep.items[1].id]);
    expect((await repo.getMealById('u', secondMeal.id))?.items).toEqual([]);
  });

  it('bulkDeleteItems validates every reference before changing any meal', async () => {
    const repo = getDiaryRepository();
    const firstMeal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    const secondMeal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'lunch', name: 'Lunch' });
    const first = await repo.addItem('u', firstMeal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });

    await expect(repo.bulkDeleteItems('u', {
      sourceDate: '2026-05-04',
      items: [
        { mealId: firstMeal.id, itemId: first.items[0].id },
        { mealId: secondMeal.id, itemId: 'missing-item' },
      ],
    })).rejects.toMatchObject({ code: 'diary_bulk_reference_not_found' });
    expect((await repo.getMealById('u', firstMeal.id))?.items).toHaveLength(1);
  });

  it('bulkDeleteItems treats a foreign meal like an unknown reference and prevalidates mixed selections', async () => {
    const repo = getDiaryRepository();
    const date = '2026-05-04';
    const userAMeal = await repo.createMeal({ userId: 'user-A', date, type: 'breakfast', name: 'Breakfast' });
    const userAWithItem = await repo.addItem('user-A', userAMeal.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
    });
    const userBMeal = await repo.createMeal({ userId: 'user-B', date, type: 'breakfast', name: 'Breakfast' });
    const userBWithItem = await repo.addItem('user-B', userBMeal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const mealsBeforeA = structuredClone((await repo.getDay('user-A', date)).meals);
    const mealsBeforeB = structuredClone((await repo.getDay('user-B', date)).meals);
    const unknownReference = { mealId: 'unknown-meal', itemId: 'unknown-item' };
    const foreignReference = { mealId: userBMeal.id, itemId: userBWithItem.items[0]!.id };
    const deleteErrorCode = async (items: { mealId: string; itemId: string }[]) => {
      try {
        await repo.bulkDeleteItems('user-A', { sourceDate: date, items });
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
    expect((await repo.getDay('user-A', date)).meals).toEqual(mealsBeforeA);
    expect((await repo.getDay('user-B', date)).meals).toEqual(mealsBeforeB);
  });

  it('bulkMoveItems moves snapshots directly and assigns new item ids', async () => {
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    const target = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'lunch', name: 'Lunch' });
    const created = await repo.addItem('u', source.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
      sourceId: 'food-source', sourceType: 'ai-meal-estimate', isAiEstimate: true,
    });
    const original = (await repo.getMealById('u', source.id))!.items[0]!;
    original.aiMealEstimateComponents = ['Oats', 'Milk'];
    original.aiMealEstimateContext = 'Breakfast';
    original.aiMealEstimateConfidence = 'high';
    original.aiMealEstimateAssumptions = ['Unsweetened'];
    original.aiMealEstimatePhotoUsed = true;
    original.recipeId = 'recipe-source';
    original.recipePortions = 0.5;

    const result = await repo.bulkMoveItems('u', {
      sourceDate: '2026-05-04',
      items: [{ mealId: source.id, itemId: created.items[0].id }],
      target: { mealId: target.id },
    });

    expect((await repo.getMealById('u', source.id))?.items).toEqual([]);
    expect(result.movedCount).toBe(1);
    expect(result.removedItemIds).toEqual([created.items[0].id]);
    expect(result.targetMeal.id).toBe(target.id);
    expect(result.targetMeal.items).toHaveLength(1);
    expect(result.targetMeal.items[0]!.id).not.toBe(created.items[0].id);
    expect(result.targetMeal.items[0]).toMatchObject({
      name: 'Oats',
      sourceId: 'food-source',
      sourceType: 'ai-meal-estimate',
      isAiEstimate: true,
      macros: { calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4 },
      aiMealEstimateComponents: ['Oats', 'Milk'],
      aiMealEstimateContext: 'Breakfast',
      aiMealEstimateConfidence: 'high',
      aiMealEstimateAssumptions: ['Unsweetened'],
      aiMealEstimatePhotoUsed: true,
      recipeId: 'recipe-source',
      recipePortions: 0.5,
    });
  });

  it('bulkMoveItems rejects a target in a multi-meal source set without changing any meal', async () => {
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    const targetSource = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'lunch', name: 'Lunch' });
    const sourceItem = await repo.addItem('u', source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const targetItem = await repo.addItem('u', targetSource.id, {
      name: 'Apple', calories: 50, protein: 0, carbs: 14, fat: 0, fiber: 2,
    });
    await repo.addItem('u', targetSource.id, {
      name: 'Toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const mealsBefore = structuredClone((await repo.getDay('u', '2026-05-04')).meals);

    await expect(repo.bulkMoveItems('u', {
      sourceDate: '2026-05-04',
      items: [
        { mealId: source.id, itemId: sourceItem.items[0]!.id },
        { mealId: targetSource.id, itemId: targetItem.items[0]!.id },
      ],
      target: { mealId: targetSource.id },
    })).rejects.toMatchObject({ code: 'invalid_diary_bulk_request' });

    expect((await repo.getDay('u', '2026-05-04')).meals).toEqual(mealsBefore);
  });

  it('bulkMoveItems creates its target meal as part of the mutation', async () => {
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    const item = await repo.addItem('u', source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });

    const result = await repo.bulkMoveItems('u', {
      sourceDate: '2026-05-04',
      items: [{ mealId: source.id, itemId: item.items[0].id }],
      target: { newMealType: 'dinner' },
    });

    expect(result.targetMeal).toMatchObject({ type: 'dinner', name: 'Dinner', date: '2026-05-04' });
    expect((await repo.getDay('u', '2026-05-04')).meals).toHaveLength(2);
    expect((await repo.getMealById('u', source.id))?.items).toEqual([]);
  });

  it('bulkCopyItems clones every snapshot field with a new id and preserves the source', async () => {
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    const target = await repo.createMeal({ userId: 'u', date: '2026-05-05', type: 'lunch', name: 'Lunch' });
    const created = await repo.addItem('u', source.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
    });
    const sourceItem = (await repo.getMealById('u', source.id))!.items[0]!;
    Object.assign(sourceItem, {
      sourceId: 'openFoodFacts:copy-test',
      sourceType: 'ai-meal-estimate',
      isAiEstimate: true,
      aiMealEstimateComponents: ['Oats', 'Milk'],
      aiMealEstimateContext: 'Breakfast',
      aiMealEstimateConfidence: 'high',
      aiMealEstimateAssumptions: ['Unsweetened'],
      aiMealEstimatePhotoUsed: true,
      recipeId: 'recipe-source',
      recipePortions: 0.5,
      recipeAccess: 'unavailable',
      category: 'Cereals',
    });
    const originalSnapshot = structuredClone(sourceItem);
    const existingTargetItem = await repo.addItem('u', target.id, {
      name: 'Apple', calories: 50, protein: 0, carbs: 14, fat: 0, fiber: 2,
    });

    const result = await repo.bulkCopyItems('u', {
      sourceDate: '2026-05-04',
      targetDate: '2026-05-05',
      items: [{ mealId: source.id, itemId: created.items[0]!.id }],
      target: { mealId: target.id },
    });

    const copiedItem = result.targetMeal.items[1]!;
    const { id: copiedId, ...copiedSnapshot } = copiedItem;
    const { id: originalId, ...expectedSnapshot } = originalSnapshot;
    expect(copiedId).not.toBe(originalId);
    expect(copiedSnapshot).toEqual(expectedSnapshot);
    expect(result.copiedCount).toBe(1);
    expect(result.targetMeal.items[0]!.id).toBe(existingTargetItem.items[0]!.id);
    expect((await repo.getMealById('u', source.id))?.items[0]).toEqual(originalSnapshot);
  });

  it('bulkCopyItems copies into the source meal on the same day and permits repeated requests', async () => {
    const repo = getDiaryRepository();
    const date = '2026-05-04';
    const sourceMeal = await repo.createMeal({ userId: 'u', date, type: 'breakfast', name: 'Breakfast' });
    const created = await repo.addItem('u', sourceMeal.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
      sourceId: 'food-source', sourceType: 'ai-meal-estimate', isAiEstimate: true,
    });
    const originalSnapshot = structuredClone(created.items[0]!);
    const request = {
      sourceDate: date,
      targetDate: date,
      items: [{ mealId: sourceMeal.id, itemId: originalSnapshot.id }],
      target: { mealId: sourceMeal.id },
    };

    const first = await repo.bulkCopyItems('u', request);
    const second = await repo.bulkCopyItems('u', request);
    const finalMeal = await repo.getMealById('u', sourceMeal.id);

    expect(first.copiedCount).toBe(1);
    expect(first.targetMeal.items).toHaveLength(2);
    expect(first.targetMeal.items[1]).toEqual({ ...originalSnapshot, id: expect.any(String) });
    expect(first.targetMeal.items[1]!.id).not.toBe(originalSnapshot.id);
    expect(second.copiedCount).toBe(1);
    expect(second.targetMeal.items).toHaveLength(3);
    expect(finalMeal?.items[0]).toEqual(originalSnapshot);
    expect(new Set(finalMeal?.items.map((item) => item.id)).size).toBe(3);
    expect(finalMeal?.items.slice(1).every((item) => item.id !== originalSnapshot.id)).toBe(true);

    await expect(repo.bulkCopyItems('u', {
      ...request,
      items: [request.items[0], request.items[0]],
    })).rejects.toMatchObject({ code: 'invalid_diary_bulk_request' });
    expect((await repo.getMealById('u', sourceMeal.id))?.items).toEqual(finalMeal?.items);
  });

  it('bulkCopyItems accepts a different target meal on the same day and leaves source snapshots unchanged', async () => {
    const repo = getDiaryRepository();
    const date = '2026-05-04';
    const sourceMeal = await repo.createMeal({ userId: 'u', date, type: 'breakfast', name: 'Breakfast' });
    const targetMeal = await repo.createMeal({ userId: 'u', date, type: 'lunch', name: 'Lunch' });
    const sourceWithItem = await repo.addItem('u', sourceMeal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const targetWithItem = await repo.addItem('u', targetMeal.id, {
      name: 'Toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const originalSource = structuredClone(sourceWithItem.items[0]!);
    const originalTarget = structuredClone(targetWithItem.items[0]!);

    const result = await repo.bulkCopyItems('u', {
      sourceDate: date,
      targetDate: date,
      items: [{ mealId: sourceMeal.id, itemId: originalSource.id }],
      target: { mealId: targetMeal.id },
    });

    expect(result.copiedCount).toBe(1);
    expect(result.targetMeal.items[0]).toEqual(originalTarget);
    expect(result.targetMeal.items[1]).toEqual({ ...originalSource, id: expect.any(String) });
    expect(result.targetMeal.items[1]!.id).not.toBe(originalSource.id);
    expect((await repo.getMealById('u', sourceMeal.id))?.items).toEqual([originalSource]);
    expect((await repo.getMealById('u', targetMeal.id))?.items).toEqual(result.targetMeal.items);
  });

  it('bulkCopyItems creates its explicit target meal as part of the mutation', async () => {
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    await repo.addItem('u', source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const sourceWithAllItems = await repo.addItem('u', source.id, {
      name: 'Toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const originalSnapshots = structuredClone(sourceWithAllItems.items);
    const sourceIds = new Set(originalSnapshots.map((item) => item.id));

    const result = await repo.bulkCopyItems('u', {
      sourceDate: '2026-05-04',
      targetDate: '2026-05-05',
      items: originalSnapshots.map((item) => ({ mealId: source.id, itemId: item.id })),
      target: { newMealType: 'dinner' },
    });

    expect(result.copiedCount).toBe(originalSnapshots.length);
    expect(result.targetMeal).toMatchObject({ date: '2026-05-05', type: 'dinner', name: 'Dinner' });
    expect(result.targetMeal.items).toEqual(
      originalSnapshots.map((item) => ({ ...item, id: expect.any(String) })),
    );
    const copiedIds = result.targetMeal.items.map((item) => item.id);
    expect(new Set(copiedIds).size).toBe(copiedIds.length);
    expect(copiedIds.every((id) => !sourceIds.has(id))).toBe(true);
    expect((await repo.getMealById('u', source.id))?.items).toEqual(originalSnapshots);
    expect((await repo.getDay('u', '2026-05-05')).meals).toEqual([result.targetMeal]);
  });

  it('bulkCopyItems rejects invalid dates, duplicate or missing references, and mismatched targets without writes', async () => {
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    const target = await repo.createMeal({ userId: 'u', date: '2026-05-05', type: 'lunch', name: 'Lunch' });
    const item = await repo.addItem('u', source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const reference = { mealId: source.id, itemId: item.items[0]!.id };

    await expect(repo.bulkCopyItems('u', {
      sourceDate: '2026-05-04',
      targetDate: '2026-05-06',
      items: [reference, reference],
      target: { newMealType: 'dinner' },
    })).rejects.toMatchObject({ code: 'invalid_diary_bulk_request' });
    await expect(repo.bulkCopyItems('u', {
      sourceDate: '2026-05-04',
      targetDate: '2026-05-06',
      items: [reference, { mealId: source.id, itemId: 'missing-item' }],
      target: { newMealType: 'dinner' },
    })).rejects.toMatchObject({ code: 'diary_bulk_reference_not_found' });
    await expect(repo.bulkCopyItems('u', {
      sourceDate: '2026-05-04',
      targetDate: '2026-05-06',
      items: [reference],
      target: { mealId: target.id },
    })).rejects.toMatchObject({ code: 'diary_bulk_reference_not_found' });

    expect((await repo.getMealById('u', source.id))?.items).toEqual(item.items);
    expect((await repo.getMealById('u', target.id))?.items).toEqual([]);
    expect((await repo.getDay('u', '2026-05-06')).meals).toEqual([]);
  });

  it('bulk mutations reject duplicate references and transaction limits', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    const item = await repo.addItem('u', meal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const reference = { mealId: meal.id, itemId: item.items[0].id };

    await expect(repo.bulkDeleteItems('u', {
      sourceDate: '2026-05-04',
      items: [reference, reference],
    })).rejects.toMatchObject({ code: 'invalid_diary_bulk_request' });
    expect((await repo.getMealById('u', meal.id))?.items).toHaveLength(1);

    expect(() => assertDiaryBulkBatchLimits(Array.from({ length: 101 }, () => ({}))))
      .toThrowError(new DiaryBulkMutationError('diary_bulk_operation_limit_exceeded'));
    expect(() => assertDiaryBulkBatchLimits([{ payload: 'x'.repeat(2 * 1024 * 1024) }]))
      .toThrowError(new DiaryBulkMutationError('diary_bulk_operation_limit_exceeded'));
  });

  it('isolates data per user', async () => {
    const repo = getDiaryRepository();
    await repo.createMeal({ userId: 'user-A', date: '2026-05-04', type: 'breakfast', name: 'B' });
    const dayB = await repo.getDay('user-B', '2026-05-04');
    expect(dayB.meals).toHaveLength(0);
  });
});
