import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';

import {
  addItemHandler,
  bulkCopyItemsHandler,
  bulkDeleteItemsHandler,
  bulkMoveItemsHandler,
  createMealHandler,
  updateItemHandler,
  setDayTypeHandler,
  getDiaryHandler,
  listMealsHandler,
} from './diary';
import { getDiaryRepository, __resetDiaryRepositoryForTests, computeSummary } from '../lib/repositories/diaryRepository';
import { DiaryBulkMutationError } from '../lib/repositories/diaryRepository';
import { getDayMetaRepository, __resetDayMetaRepositoryForTests } from '../lib/repositories/dayMetaRepository';
import { getHintStateRepository, __resetHintStateRepositoryForTests } from '../lib/repositories/hintStateRepository';
import { makeContext, makeAuthRequest, makeRequest, setupTestAuth, signTestToken, teardownTestAuth, TEST_USER_ID } from '../test-utils/http';
import { getUserFoodRelationRepository, __resetUserFoodRelationRepositoryForTests } from '../lib/repositories/userFoodRelationRepository';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import { getRecipesRepository, __resetRecipesRepositoryForTests } from '../lib/repositories/recipesRepository';
import type { SpecialActivity } from '@fittrack/shared';

// Unit tests for POST /api/diary/meals/:id/items
//
// Uses the real in-memory diary repository (no Cosmos env vars set).
// Each test creates a fresh meal first, then exercises addItemHandler.

const originalEnv = { ...process.env };

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  __resetDiaryRepositoryForTests();
  __resetRecipesRepositoryForTests();
  __resetUserFoodRelationRepositoryForTests();
});

afterEach(() => {
  Object.assign(process.env, originalEnv);
  __resetDiaryRepositoryForTests();
  __resetRecipesRepositoryForTests();
  __resetUserFoodRelationRepositoryForTests();
});

/** Create a meal and return its id. */
async function createMeal(): Promise<string> {
  const res = await createMealHandler(
    await makeAuthRequest({ body: { date: '2026-05-08', type: 'breakfast' } }),
    makeContext(),
  );
  const body = res.jsonBody as { meal: { id: string } };
  return body.meal.id;
}

async function createRecipeForDiary(userId = 'test-user-abc-123') {
  return getRecipesRepository().create(userId, {
    name: 'Server-Rezept',
    portions: 4,
    ingredients: [{
      id: '00000000-0000-4000-8000-000000000021',
      displayName: 'Tomaten',
      inputMode: 'grams',
      inputAmount: 200,
      amountGrams: 200,
      unit: 'g',
      linkedProductId: null,
      linkedReusableItemId: null,
      isAiEstimate: false,
      nutritionPer100g: { calories: 20, protein: 1, carbs: 4, fat: 0.2, fiber: 1 },
      nutritionContribution: { calories: 40, protein: 2, carbs: 8, fat: 0.4, fiber: 2 },
    }],
    steps: [],
    tags: [],
    nutritionTotal: { calories: 400, protein: 40, carbs: 80, fat: 8, fiber: 20 },
    nutritionPerPortion: { calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5 },
  });
}

describe('POST /api/diary/items/bulk-delete and bulk-move', () => {
  it('requires authentication and validates strict request bodies', async () => {
    const unauthorized = await bulkDeleteItemsHandler(
      await makeRequest({ body: { sourceDate: '2026-05-08', items: [{ mealId: 'meal', itemId: 'item' }] } }),
      makeContext(),
    );
    expect(unauthorized.status).toBe(401);

    const invalidDate = await bulkDeleteItemsHandler(
      await makeAuthRequest({ body: { sourceDate: '2026-02-30', items: [{ mealId: 'meal', itemId: 'item' }] } }),
      makeContext(),
    );
    expect(invalidDate.status).toBe(400);

    const unknownField = await bulkMoveItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          items: [{ mealId: 'meal', itemId: 'item' }],
          target: { mealId: 'target' },
          userId: 'forged-user',
        },
      }),
      makeContext(),
    );
    expect(unknownField.status).toBe(400);
  });

  it('returns stable not-found errors without applying a partial delete', async () => {
    const repo = getDiaryRepository();
    const first = await repo.createMeal({
      userId: 'test-user-abc-123', date: '2026-05-08', type: 'breakfast', name: 'Breakfast',
    });
    const item = await repo.addItem('test-user-abc-123', first.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
    });
    const response = await bulkDeleteItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          items: [
            { mealId: first.id, itemId: item.items[0].id },
            { mealId: 'missing-meal', itemId: 'missing-item' },
          ],
        },
      }),
      makeContext(),
    );

    expect(response.status).toBe(404);
    expect(response.jsonBody).toEqual({ error: 'diary_bulk_reference_not_found' });
    expect((await repo.getMealById('test-user-abc-123', first.id))?.items).toHaveLength(1);
  });

  it('treats foreign meal references like unknown references without mutating either diary', async () => {
    const userA = TEST_USER_ID;
    const userB = 'test-user-foreign-456';
    const date = '2026-05-08';
    const repo = getDiaryRepository();
    const userAMeal = await repo.createMeal({ userId: userA, date, type: 'breakfast', name: 'Breakfast' });
    const userAWithItem = await repo.addItem(userA, userAMeal.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
    });
    const userBMeal = await repo.createMeal({ userId: userB, date, type: 'breakfast', name: 'Breakfast' });
    const userBWithItem = await repo.addItem(userB, userBMeal.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const mealsBeforeA = structuredClone((await repo.getDay(userA, date)).meals);
    const mealsBeforeB = structuredClone((await repo.getDay(userB, date)).meals);
    const deleteItems = async (items: { mealId: string; itemId: string }[]) =>
      bulkDeleteItemsHandler(
        await makeAuthRequest({ body: { sourceDate: date, items } }),
        makeContext(),
      );

    const unknown = await deleteItems([{ mealId: 'unknown-meal', itemId: 'unknown-item' }]);
    const foreign = await deleteItems([{
      mealId: userBMeal.id,
      itemId: userBWithItem.items[0]!.id,
    }]);
    const mixed = await deleteItems([
      { mealId: userAMeal.id, itemId: userAWithItem.items[0]!.id },
      { mealId: userBMeal.id, itemId: userBWithItem.items[0]!.id },
    ]);

    expect({ status: unknown.status, jsonBody: unknown.jsonBody }).toEqual({
      status: 404,
      jsonBody: { error: 'diary_bulk_reference_not_found' },
    });
    expect({ status: foreign.status, jsonBody: foreign.jsonBody }).toEqual({
      status: unknown.status,
      jsonBody: unknown.jsonBody,
    });
    expect({ status: mixed.status, jsonBody: mixed.jsonBody }).toEqual({
      status: unknown.status,
      jsonBody: unknown.jsonBody,
    });
    expect((await repo.getDay(userA, date)).meals).toEqual(mealsBeforeA);
    expect((await repo.getDay(userB, date)).meals).toEqual(mealsBeforeB);
  });

  it('leaves usage history and source counters unchanged for every delete and move source class', async () => {
    const userId = 'test-user-abc-123';
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId, date: '2026-05-08', type: 'breakfast', name: 'Breakfast' });
    const target = await repo.createMeal({ userId, date: '2026-05-08', type: 'lunch', name: 'Lunch' });
    const reusableItems = getReusableItemsRepository();
    const reusable = await reusableItems.create({
      userId,
      name: 'Oats',
      nutritionBasis: 'per100g',
      nutritionPer100g: { calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 },
      isComplete: true,
      sourceType: 'manual',
    });
    await reusableItems.incrementUsageCount(userId, reusable.id);
    const recipes = getRecipesRepository();
    const recipe = await createRecipeForDiary(userId);
    await recipes.incrementUsage(userId, recipe.id);
    const addSourceItem = async (input: Parameters<typeof repo.addItem>[2]): Promise<string> => {
      const meal = await repo.addItem(userId, source.id, input);
      return meal.items[meal.items.length - 1]!.id;
    };
    const catalogSourceId = 'openFoodFacts:bulk-mutation-test';
    const toMovePersonalId = await addSourceItem({
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
      sourceId: reusable.id, sourceType: 'reusableItem',
    });
    const toMoveCatalogId = await addSourceItem({
      name: 'Catalog food', calories: 100, protein: 4, carbs: 12, fat: 3, fiber: 2,
      sourceId: catalogSourceId, sourceType: 'openFoodFacts',
    });
    const toMoveRecipeId = await addSourceItem({
      name: recipe.name, calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5,
      sourceType: 'recipe', recipeId: recipe.id, recipePortions: 1,
    });
    const toMoveManualId = await addSourceItem({
      name: 'Manual food', calories: 100, protein: 4, carbs: 12, fat: 3, fiber: 2,
      sourceType: 'manual',
    });
    const toMoveAiId = await addSourceItem({
      name: 'AI food', calories: 100, protein: 4, carbs: 12, fat: 3, fiber: 2,
      sourceType: 'ai', isAiEstimate: true,
    });
    const toMoveAiMealEstimateId = await addSourceItem({
      name: 'AI meal estimate', calories: 100, protein: 4, carbs: 12, fat: 3, fiber: 2,
      sourceType: 'ai-meal-estimate',
    });
    const toDeletePersonalId = await addSourceItem({
      name: 'Oats to delete', calories: 150, protein: 5, carbs: 25, fat: 2.5, fiber: 2,
      sourceId: reusable.id, sourceType: 'reusableItem',
    });
    const toDeleteCatalogId = await addSourceItem({
      name: 'Catalog food to delete', calories: 80, protein: 3, carbs: 10, fat: 2, fiber: 1,
      sourceId: catalogSourceId, sourceType: 'openFoodFacts',
    });
    const toDeleteRecipeId = await addSourceItem({
      name: recipe.name, calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5,
      sourceType: 'recipe', recipeId: recipe.id, recipePortions: 1,
    });
    const toDeleteManualId = await addSourceItem({
      name: 'Manual food to delete', calories: 80, protein: 3, carbs: 10, fat: 2, fiber: 1,
      sourceType: 'manual',
    });
    const toDeleteAiId = await addSourceItem({
      name: 'AI food to delete', calories: 80, protein: 3, carbs: 10, fat: 2, fiber: 1,
      sourceType: 'ai', isAiEstimate: true,
    });
    const toDeleteAiMealEstimateId = await addSourceItem({
      name: 'AI meal estimate to delete', calories: 80, protein: 3, carbs: 10, fat: 2, fiber: 1,
      sourceType: 'ai-meal-estimate',
    });
    const relations = getUserFoodRelationRepository();
    await relations.recordUsage(userId, {
      foodRef: reusable.id,
      foodRefType: 'personal',
      displayName: 'Oats',
      mealType: 'breakfast',
      usageDate: '2026-05-08',
    });
    await relations.recordUsage(userId, {
      foodRef: catalogSourceId,
      foodRefType: 'catalog',
      displayName: 'Catalog food',
      mealType: 'breakfast',
      usageDate: '2026-05-08',
    });
    await relations.recordUsage(userId, {
      foodRef: recipe.id,
      foodRefType: 'recipe',
      displayName: recipe.name,
      mealType: 'breakfast',
      usageDate: '2026-05-08',
    });
    const priorPersonalUsage = structuredClone(await relations.getByFoodRef(userId, reusable.id));
    const priorCatalogUsage = structuredClone(await relations.getByFoodRef(userId, catalogSourceId));
    const priorRecipeUsage = structuredClone(await relations.getByFoodRef(userId, recipe.id));
    const priorReusableItem = structuredClone(await reusableItems.getById(userId, reusable.id));
    const priorRecipe = structuredClone(await recipes.get(userId, recipe.id));
    const recordUsageSpy = vi.spyOn(relations, 'recordUsage');
    const reusableUsageSpy = vi.spyOn(reusableItems, 'incrementUsageCount');
    const recipeUsageSpy = vi.spyOn(recipes, 'incrementUsage');

    const moved = await bulkMoveItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          items: [
            toMovePersonalId,
            toMoveCatalogId,
            toMoveRecipeId,
            toMoveManualId,
            toMoveAiId,
            toMoveAiMealEstimateId,
          ].map((itemId) => ({ mealId: source.id, itemId })),
          target: { mealId: target.id },
        },
      }),
      makeContext(),
    );
    const deleted = await bulkDeleteItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          items: [
            toDeletePersonalId,
            toDeleteCatalogId,
            toDeleteRecipeId,
            toDeleteManualId,
            toDeleteAiId,
            toDeleteAiMealEstimateId,
          ].map((itemId) => ({ mealId: source.id, itemId })),
        },
      }),
      makeContext(),
    );

    expect(moved.status).toBe(200);
    const movedMeal = (moved.jsonBody as { targetMeal: { items: { id: string; sourceId?: string }[] } }).targetMeal;
    expect(movedMeal.items).toHaveLength(6);
    expect(movedMeal.items[0]).toMatchObject({ sourceId: reusable.id });
    expect(deleted.status).toBe(200);
    expect(recordUsageSpy).not.toHaveBeenCalled();
    expect(reusableUsageSpy).not.toHaveBeenCalled();
    expect(recipeUsageSpy).not.toHaveBeenCalled();
    expect(await relations.getByFoodRef(userId, reusable.id)).toEqual(priorPersonalUsage);
    expect(await relations.getByFoodRef(userId, catalogSourceId)).toEqual(priorCatalogUsage);
    expect(await relations.getByFoodRef(userId, recipe.id)).toEqual(priorRecipeUsage);
    expect(await reusableItems.getById(userId, reusable.id)).toEqual(priorReusableItem);
    expect(await recipes.get(userId, recipe.id)).toEqual(priorRecipe);
  });

  it('maps duplicate references and a same-source target to the invalid-request contract', async () => {
    const userId = 'test-user-abc-123';
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId, date: '2026-05-08', type: 'breakfast', name: 'Breakfast' });
    const item = await repo.addItem(userId, source.id, {
      name: 'Egg', calories: 90, protein: 6, carbs: 0, fat: 6, fiber: 0,
    });
    const reference = { mealId: source.id, itemId: item.items[0].id };

    const duplicate = await bulkDeleteItemsHandler(
      await makeAuthRequest({ body: { sourceDate: '2026-05-08', items: [reference, reference] } }),
      makeContext(),
    );
    expect(duplicate.status).toBe(400);
    expect(duplicate.jsonBody).toEqual({ error: 'invalid_diary_bulk_request' });

    const empty = await bulkDeleteItemsHandler(
      await makeAuthRequest({ body: { sourceDate: '2026-05-08', items: [] } }),
      makeContext(),
    );
    expect(empty.status).toBe(400);
    expect(empty.jsonBody).toEqual({ error: 'invalid_diary_bulk_request' });

    const sameSourceTarget = await bulkMoveItemsHandler(
      await makeAuthRequest({
        body: { sourceDate: '2026-05-08', items: [reference], target: { mealId: source.id } },
      }),
      makeContext(),
    );
    expect(sameSourceTarget.status).toBe(400);
    expect(sameSourceTarget.jsonBody).toEqual({ error: 'invalid_diary_bulk_request' });
    expect((await repo.getMealById(userId, source.id))?.items).toHaveLength(1);

    const secondSource = await repo.createMeal({
      userId, date: '2026-05-08', type: 'lunch', name: 'Lunch',
    });
    const secondSourceItem = await repo.addItem(userId, secondSource.id, {
      name: 'Apple', calories: 50, protein: 0, carbs: 14, fat: 0, fiber: 2,
    });
    await repo.addItem(userId, secondSource.id, {
      name: 'Toast', calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 1,
    });
    const mealsBefore = structuredClone((await repo.getDay(userId, '2026-05-08')).meals);
    const multiSourceTarget = await bulkMoveItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          items: [
            { mealId: source.id, itemId: item.items[0].id },
            { mealId: secondSource.id, itemId: secondSourceItem.items[0].id },
          ],
          target: { mealId: secondSource.id },
        },
      }),
      makeContext(),
    );

    expect(multiSourceTarget.status).toBe(400);
    expect(multiSourceTarget.jsonBody).toEqual({ error: 'invalid_diary_bulk_request' });
    expect((await repo.getDay(userId, '2026-05-08')).meals).toEqual(mealsBefore);
  });

  it('maps transactional conflicts and batch limits to stable HTTP errors', async () => {
    const repository = getDiaryRepository();
    const bulkDeleteSpy = vi.spyOn(repository, 'bulkDeleteItems');
    bulkDeleteSpy
      .mockRejectedValueOnce(new DiaryBulkMutationError('diary_bulk_conflict'))
      .mockRejectedValueOnce(new DiaryBulkMutationError('diary_bulk_operation_limit_exceeded'));
    const body = {
      sourceDate: '2026-05-08',
      items: [{ mealId: 'meal', itemId: 'item' }],
    };

    const conflict = await bulkDeleteItemsHandler(await makeAuthRequest({ body }), makeContext());
    const limit = await bulkDeleteItemsHandler(await makeAuthRequest({ body }), makeContext());

    expect(conflict.status).toBe(409);
    expect(conflict.jsonBody).toEqual({ error: 'diary_bulk_conflict' });
    expect(limit.status).toBe(413);
    expect(limit.jsonBody).toEqual({ error: 'diary_bulk_operation_limit_exceeded' });
  });
});

describe('POST /api/diary/items/bulk-copy', () => {
  it('requires authentication, rejects unknown fields, and accepts same-day copies to the source meal', async () => {
    const body = {
      sourceDate: '2026-05-08',
      targetDate: '2026-05-09',
      items: [{ mealId: 'meal', itemId: 'item' }],
      target: { newMealType: 'dinner' },
    };
    const unauthorized = await bulkCopyItemsHandler(await makeRequest({ body }), makeContext());
    expect(unauthorized.status).toBe(401);

    const unknownField = await bulkCopyItemsHandler(
      await makeAuthRequest({ body: { ...body, extra: true } }),
      makeContext(),
    );
    expect(unknownField.status).toBe(400);

    const userId = TEST_USER_ID;
    const repository = getDiaryRepository();
    const sourceMeal = await repository.createMeal({
      userId,
      date: body.sourceDate,
      type: 'breakfast',
      name: 'Breakfast',
    });
    const withItem = await repository.addItem(userId, sourceMeal.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
    });
    const originalItem = structuredClone(withItem.items[0]!);
    const sameDay = await bulkCopyItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: body.sourceDate,
          targetDate: body.sourceDate,
          items: [{ mealId: sourceMeal.id, itemId: originalItem.id }],
          target: { mealId: sourceMeal.id },
        },
      }),
      makeContext(),
    );
    expect(sameDay.status).toBe(200);
    const result = sameDay.jsonBody as {
      copiedCount: number;
      targetMeal: { id: string; items: typeof withItem.items };
    };
    expect(result.copiedCount).toBe(1);
    expect(result.targetMeal.id).toBe(sourceMeal.id);
    expect(result.targetMeal.items).toEqual([
      originalItem,
      { ...originalItem, id: expect.any(String) },
    ]);
    expect(result.targetMeal.items[1]!.id).not.toBe(originalItem.id);
    expect((await repository.getMealById(userId, sourceMeal.id))?.items[0]).toEqual(originalItem);

    const duplicate = await bulkCopyItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: body.sourceDate,
          targetDate: body.sourceDate,
          items: [
            { mealId: sourceMeal.id, itemId: originalItem.id },
            { mealId: sourceMeal.id, itemId: originalItem.id },
          ],
          target: { mealId: sourceMeal.id },
        },
      }),
      makeContext(),
    );
    expect(duplicate.status).toBe(400);
    expect(duplicate.jsonBody).toEqual({ error: 'invalid_diary_bulk_request' });
    expect((await repository.getMealById(userId, sourceMeal.id))?.items).toEqual(result.targetMeal.items);
  });

  it('reuses the same snapshot-copy contract for one selected item and an existing target', async () => {
    const userId = 'test-user-abc-123';
    const repo = getDiaryRepository();
    const source = await repo.createMeal({ userId, date: '2026-05-08', type: 'breakfast', name: 'Breakfast' });
    const target = await repo.createMeal({ userId, date: '2026-05-09', type: 'lunch', name: 'Lunch' });
    const created = await repo.addItem(userId, source.id, {
      name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 4,
      sourceId: 'openFoodFacts:copy-test', sourceType: 'openFoodFacts',
    });
    const originalSnapshot = structuredClone(created.items[0]!);

    const response = await bulkCopyItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          targetDate: '2026-05-09',
          items: [{ mealId: source.id, itemId: created.items[0]!.id }],
          target: { mealId: target.id },
        },
      }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    const result = response.jsonBody as { copiedCount: number; targetMeal: { id: string; items: typeof created.items } };
    expect(result.copiedCount).toBe(1);
    expect(result.targetMeal.id).toBe(target.id);
    expect(result.targetMeal.items[0]).toMatchObject({ ...originalSnapshot, id: expect.any(String) });
    expect(result.targetMeal.items[0]!.id).not.toBe(originalSnapshot.id);
    expect((await repo.getMealById(userId, source.id))?.items).toEqual([originalSnapshot]);
  });

  it('records copy usage by stored references only after the copy commit', async () => {
    const userId = 'test-user-abc-123';
    const repository = getDiaryRepository();
    const source = await repository.createMeal({ userId, date: '2026-05-08', type: 'breakfast', name: 'Breakfast' });
    const target = await repository.createMeal({ userId, date: '2026-05-09', type: 'dinner', name: 'Dinner' });
    const reusableRepository = getReusableItemsRepository();
    const reusable = await reusableRepository.create({
      userId,
      name: 'Oats',
      nutritionBasis: 'per100g',
      nutritionPer100g: { calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 },
      isComplete: true,
      sourceType: 'manual',
    });
    const portionOnlyReusable = await reusableRepository.create({
      userId,
      name: 'Yogurt',
      nutritionBasis: 'perPortion',
      portion: { label: '1 cup', weightGrams: 150 },
      isComplete: false,
      sourceType: 'manual',
    });
    const recipeRepository = getRecipesRepository();
    const recipe = await createRecipeForDiary(userId);
    const references: Array<{ mealId: string; itemId: string }> = [];
    const addSourceItem = async (input: Parameters<typeof repository.addItem>[2]) => {
      const meal = await repository.addItem(userId, source.id, input);
      references.push({ mealId: source.id, itemId: meal.items[meal.items.length - 1]!.id });
    };

    await addSourceItem({
      name: 'Oats', calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10,
      sourceId: reusable.id, sourceType: 'manual', quantity: 100, unit: 'g',
    });
    await addSourceItem({
      name: 'Oats, second serving', calories: 185, protein: 6.5, carbs: 30, fat: 3.5, fiber: 5,
      sourceId: reusable.id, sourceType: 'manual', quantity: 50, unit: 'g',
    });
    await addSourceItem({
      name: 'Yogurt', calories: 150, protein: 8, carbs: 12, fat: 6, fiber: 0,
      sourceId: portionOnlyReusable.id, sourceType: 'openFoodFacts', quantity: 1, unit: 'portion',
    });
    await addSourceItem({
      name: 'Catalog food', calories: 100, protein: 4, carbs: 12, fat: 3, fiber: 2,
      sourceId: 'openFoodFacts:copy-test', sourceType: 'reusableItem', quantity: 100, unit: 'g',
    });
    await addSourceItem({
      name: recipe.name, calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5,
      recipeId: recipe.id, sourceType: 'manual', quantity: 1, unit: 'Portion',
    });
    await addSourceItem({
      name: recipe.name, calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5,
      recipeId: recipe.id, sourceType: 'manual', quantity: 1, unit: 'Portion',
    });
    await addSourceItem({
      name: 'Unreferenced manual food', calories: 120, protein: 5, carbs: 14, fat: 4, fiber: 2,
      sourceType: 'manual',
    });
    await addSourceItem({
      name: 'Unreferenced AI food', calories: 180, protein: 8, carbs: 18, fat: 7, fiber: 2,
      sourceType: 'ai', isAiEstimate: true,
    });
    await addSourceItem({
      name: 'Unreferenced estimate', calories: 250, protein: 12, carbs: 24, fat: 10, fiber: 3,
      sourceType: 'ai-meal-estimate',
    });

    const relations = getUserFoodRelationRepository();
    const originalRecordUsage = relations.recordUsage.bind(relations);
    const recordUsageSpy = vi.spyOn(relations, 'recordUsage').mockImplementation(async (trackedUserId, input) => {
      expect((await repository.getMealById(trackedUserId, target.id))?.items).toHaveLength(references.length);
      await originalRecordUsage(trackedUserId, input);
    });
    const reusableUsageSpy = vi.spyOn(reusableRepository, 'incrementUsageCount');
    const recipeUsageSpy = vi.spyOn(recipeRepository, 'incrementUsage');

    const response = await bulkCopyItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          targetDate: '2026-05-09',
          items: references,
          target: { mealId: target.id },
        },
      }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(recordUsageSpy).toHaveBeenCalledTimes(6);
      expect(reusableUsageSpy).toHaveBeenCalledTimes(2);
      expect(recipeUsageSpy).toHaveBeenCalledTimes(2);
    });

    expect(await relations.getByFoodRef(userId, reusable.id)).toMatchObject({
      foodRefType: 'personal',
      usageCount: 2,
      usageDates: [
        { date: '2026-05-09', mealType: 'dinner' },
        { date: '2026-05-09', mealType: 'dinner' },
      ],
    });
    expect(await relations.getByFoodRef(userId, 'openFoodFacts:copy-test')).toMatchObject({
      foodRefType: 'catalog',
      usageCount: 1,
      usageDates: [{ date: '2026-05-09', mealType: 'dinner' }],
    });
    expect(await relations.getByFoodRef(userId, portionOnlyReusable.id)).toMatchObject({
      foodRefType: 'personal',
      usageCount: 1,
      usageDates: [{ date: '2026-05-09', mealType: 'dinner' }],
    });
    expect(await relations.getByFoodRef(userId, recipe.id)).toMatchObject({
      foodRefType: 'recipe',
      usageCount: 2,
      usageDates: [
        { date: '2026-05-09', mealType: 'dinner' },
        { date: '2026-05-09', mealType: 'dinner' },
      ],
    });
    expect((await reusableRepository.getById(userId, reusable.id))?.usageCount).toBe(2);
    expect((await reusableRepository.getById(userId, portionOnlyReusable.id))?.usageCount).toBe(0);
    expect((await recipeRepository.get(userId, recipe.id))?.usageCount).toBe(2);
    expect(await relations.getByFoodRef(userId, 'Unreferenced manual food')).toBeNull();
    expect(await relations.getByFoodRef(userId, 'Unreferenced AI food')).toBeNull();
    expect(await relations.getByFoodRef(userId, 'Unreferenced estimate')).toBeNull();
  });

  it('tracks each repeated same-day copy against the target meal date after commit', async () => {
    const userId = TEST_USER_ID;
    const repository = getDiaryRepository();
    const sourceMeal = await repository.createMeal({
      userId, date: '2026-05-08', type: 'breakfast', name: 'Breakfast',
    });
    const targetMeal = await repository.createMeal({
      userId, date: '2026-05-08', type: 'dinner', name: 'Dinner',
    });
    const reusableRepository = getReusableItemsRepository();
    const reusable = await reusableRepository.create({
      userId,
      name: 'Oats',
      nutritionBasis: 'per100g',
      nutritionPer100g: { calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 },
      isComplete: true,
      sourceType: 'manual',
    });
    const source = await repository.addItem(userId, sourceMeal.id, {
      name: 'Oats', calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10,
      sourceId: reusable.id, sourceType: 'manual',
    });
    const originalSnapshot = structuredClone(source.items[0]!);
    const relations = getUserFoodRelationRepository();
    const recordUsageSpy = vi.spyOn(relations, 'recordUsage');
    const reusableUsageSpy = vi.spyOn(reusableRepository, 'incrementUsageCount');
    const copy = async () => bulkCopyItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          targetDate: '2026-05-08',
          items: [{ mealId: sourceMeal.id, itemId: originalSnapshot.id }],
          target: { mealId: targetMeal.id },
        },
      }),
      makeContext(),
    );

    const first = await copy();
    const second = await copy();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await vi.waitFor(() => {
      expect(recordUsageSpy).toHaveBeenCalledTimes(2);
      expect(reusableUsageSpy).toHaveBeenCalledTimes(2);
    });

    const result = second.jsonBody as {
      targetMeal: { items: Array<{ id: string }> };
    };
    expect(result.targetMeal.items).toHaveLength(2);
    expect(new Set(result.targetMeal.items.map((item) => item.id)).size).toBe(2);
    expect((await repository.getMealById(userId, sourceMeal.id))?.items[0]).toEqual(originalSnapshot);
    expect(await relations.getByFoodRef(userId, reusable.id)).toMatchObject({
      foodRefType: 'personal',
      usageCount: 2,
      usageDates: [
        { date: '2026-05-08', mealType: 'dinner' },
        { date: '2026-05-08', mealType: 'dinner' },
      ],
    });
  });

  it('does not record copy usage when the diary commit fails', async () => {
    const userId = 'test-user-abc-123';
    const repository = getDiaryRepository();
    const source = await repository.createMeal({ userId, date: '2026-05-08', type: 'breakfast', name: 'Breakfast' });
    const reusableRepository = getReusableItemsRepository();
    const reusable = await reusableRepository.create({
      userId,
      name: 'Oats',
      nutritionBasis: 'per100g',
      nutritionPer100g: { calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 },
      isComplete: true,
      sourceType: 'manual',
    });
    const recipeRepository = getRecipesRepository();
    const recipe = await createRecipeForDiary(userId);
    const personal = await repository.addItem(userId, source.id, {
      name: 'Oats', calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10,
      sourceId: reusable.id, sourceType: 'reusableItem',
    });
    const catalog = await repository.addItem(userId, source.id, {
      name: 'Catalog food', calories: 100, protein: 4, carbs: 12, fat: 3, fiber: 2,
      sourceId: 'openFoodFacts:failed-copy', sourceType: 'openFoodFacts',
    });
    const recipeItem = await repository.addItem(userId, source.id, {
      name: recipe.name, calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5,
      recipeId: recipe.id, sourceType: 'recipe',
    });
    const originalSourceItems = structuredClone((await repository.getMealById(userId, source.id))!.items);
    const relations = getUserFoodRelationRepository();
    const recordUsageSpy = vi.spyOn(relations, 'recordUsage');
    const reusableUsageSpy = vi.spyOn(reusableRepository, 'incrementUsageCount');
    const recipeUsageSpy = vi.spyOn(recipeRepository, 'incrementUsage');
    vi.spyOn(repository, 'bulkCopyItems')
      .mockRejectedValueOnce(new DiaryBulkMutationError('diary_bulk_conflict'));

    const response = await bulkCopyItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          targetDate: '2026-05-08',
          items: [personal, catalog, recipeItem].map((meal) => ({
            mealId: source.id,
            itemId: meal.items[meal.items.length - 1]!.id,
          })),
          target: { mealId: source.id },
        },
      }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect(recordUsageSpy).not.toHaveBeenCalled();
    expect(reusableUsageSpy).not.toHaveBeenCalled();
    expect(recipeUsageSpy).not.toHaveBeenCalled();
    expect((await repository.getMealById(userId, source.id))?.items).toEqual(originalSourceItems);
  });

  it('copies and tracks a recipe snapshot after its source recipe is deleted', async () => {
    const userId = 'test-user-abc-123';
    const ownerId = 'deleted-recipe-owner';
    const recipeRepository = getRecipesRepository();
    const recipe = await createRecipeForDiary(ownerId);
    await recipeRepository.delete(ownerId, recipe.id);
    const repository = getDiaryRepository();
    const source = await repository.createMeal({ userId, date: '2026-05-08', type: 'breakfast', name: 'Breakfast' });
    const target = await repository.createMeal({ userId, date: '2026-05-09', type: 'dinner', name: 'Dinner' });
    const sourceItem = await repository.addItem(userId, source.id, {
      name: recipe.name, calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5,
      recipeId: recipe.id, sourceType: 'recipe', recipePortions: 1,
    });
    const relationRepository = getUserFoodRelationRepository();
    const recipeUsageSpy = vi.spyOn(recipeRepository, 'incrementUsage');

    const response = await bulkCopyItemsHandler(
      await makeAuthRequest({
        body: {
          sourceDate: '2026-05-08',
          targetDate: '2026-05-09',
          items: [{ mealId: source.id, itemId: sourceItem.items[0]!.id }],
          target: { mealId: target.id },
        },
      }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    await vi.waitFor(async () => {
      expect(await relationRepository.getByFoodRef(userId, recipe.id)).toMatchObject({
        foodRefType: 'recipe',
        displayName: recipe.name,
        usageCount: 1,
        usageDates: [{ date: '2026-05-09', mealType: 'dinner' }],
      });
    });
    expect((response.jsonBody as { targetMeal: { items: { name: string; recipeId?: string }[] } })
      .targetMeal.items[0]).toMatchObject({ name: recipe.name, recipeId: recipe.id });
    expect(recipeUsageSpy).not.toHaveBeenCalled();
  });

  it('increments the owner counter for an available community recipe copied by another user', async () => {
    const ownerId = 'community-recipe-owner';
    const userId = 'community-recipe-copier';
    const recipeRepository = getRecipesRepository();
    const recipe = await createRecipeForDiary(ownerId);
    const versioned = await recipeRepository.getVersioned(ownerId, recipe.id);
    await recipeRepository.setVisibility(ownerId, recipe.id, versioned!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });
    const repository = getDiaryRepository();
    const source = await repository.createMeal({ userId, date: '2026-05-08', type: 'breakfast', name: 'Breakfast' });
    const target = await repository.createMeal({ userId, date: '2026-05-09', type: 'dinner', name: 'Dinner' });
    const sourceItem = await repository.addItem(userId, source.id, {
      name: recipe.name, calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5,
      recipeId: recipe.id, sourceType: 'manual', recipePortions: 1,
    });
    const token = await signTestToken(userId);
    const response = await bulkCopyItemsHandler(
      await makeRequest({
        headers: { authorization: `Bearer ${token}` },
        body: {
          sourceDate: '2026-05-08',
          targetDate: '2026-05-09',
          items: [{ mealId: source.id, itemId: sourceItem.items[0]!.id }],
          target: { mealId: target.id },
        },
      }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    await vi.waitFor(async () => {
      expect(await getUserFoodRelationRepository().getByFoodRef(userId, recipe.id)).toMatchObject({
        foodRefType: 'recipe',
        usageCount: 1,
        usageDates: [{ date: '2026-05-09', mealType: 'dinner' }],
      });
      expect((await recipeRepository.get(ownerId, recipe.id))?.usageCount).toBe(1);
    });
    expect(await recipeRepository.get(userId, recipe.id)).toBeNull();
  });

  it('maps copy conflicts and operation limits to the shared bulk error contract', async () => {
    const repository = getDiaryRepository();
    const copySpy = vi.spyOn(repository, 'bulkCopyItems');
    copySpy
      .mockRejectedValueOnce(new DiaryBulkMutationError('diary_bulk_conflict'))
      .mockRejectedValueOnce(new DiaryBulkMutationError('diary_bulk_operation_limit_exceeded'));
    const body = {
      sourceDate: '2026-05-08',
      targetDate: '2026-05-09',
      items: [{ mealId: 'meal', itemId: 'item' }],
      target: { newMealType: 'dinner' },
    };

    const conflict = await bulkCopyItemsHandler(await makeAuthRequest({ body }), makeContext());
    const limit = await bulkCopyItemsHandler(await makeAuthRequest({ body }), makeContext());

    expect(conflict.status).toBe(409);
    expect(conflict.jsonBody).toEqual({ error: 'diary_bulk_conflict' });
    expect(limit.status).toBe(413);
    expect(limit.jsonBody).toEqual({ error: 'diary_bulk_operation_limit_exceeded' });
  });
});

// ---------------------------------------------------------------------------
// Product input (productId + productName + pre-calculated nutrition)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items â€” product input', () => {
  it('accepts productName + productId + calculatedNutrition and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:abc123',
          productName: 'Lebkuchen',
          inputMode: 'portion',
          inputAmount: 2,
          amountGrams: 60,
          calculatedNutrition: { calories: 220, protein: 3, carbs: 42, fat: 6, fiber: 1.5 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { name: string }[] } };
    expect(body.meal.items[0]!.name).toBe('Lebkuchen');
  });

  it('returns 400 when neither name nor productName is provided', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:abc123',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 400, protein: 10, carbs: 50, fat: 8 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('stores inputAmount as quantity (not amountGrams) when inputMode is portion', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:abc123',
          productName: 'Lebkuchen',
          inputMode: 'portion',
          inputAmount: 2,
          amountGrams: 66,
          calculatedNutrition: { calories: 242, protein: 3, carbs: 44, fat: 6, fiber: 1.6 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { quantity: number; unit: string }[] } };
    expect(body.meal.items[0]!.quantity).toBe(2);   // inputAmount, NOT amountGrams (66)
    expect(body.meal.items[0]!.unit).toBe('portion');
  });

  it('stores amountGrams as quantity when inputMode is grams', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:abc123',
          productName: 'Lebkuchen',
          inputMode: 'grams',
          inputAmount: 50,
          amountGrams: 50,
          calculatedNutrition: { calories: 183, protein: 2.3, carbs: 33, fat: 4.5 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { quantity: number; unit: string }[] } };
    expect(body.meal.items[0]!.quantity).toBe(50);
    expect(body.meal.items[0]!.unit).toBe('g');
  });

  // --- Fiber regression tests ---
  // These tests guard against the bug where fiber was missing from calculatedNutrition
  // on the client side, causing the backend to store fiber=0 and the summary to show 0.

  it('speichert fiber aus calculatedNutrition korrekt in macros', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'lib:vollkornbrot',
          productName: 'Vollkornbrot',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 240, protein: 8, carbs: 44, fat: 3, fiber: 6 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { macros: { fiber: number } }[] } };
    expect(body.meal.items[0]!.macros.fiber).toBe(6);
  });

  it('speichert fiber=0 wenn calculatedNutrition kein fiber enthält (kein Absturz)', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'lib:butter',
          productName: 'Butter',
          inputMode: 'grams',
          inputAmount: 10,
          amountGrams: 10,
          calculatedNutrition: { calories: 74, protein: 0.1, carbs: 0, fat: 8.2 }, // kein fiber
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { macros: { fiber: number } }[] } };
    expect(body.meal.items[0]!.macros.fiber).toBe(0); // ?? 0 Fallback
  });

  it('rechnet fiber korrekt in die Tagessummary ein (End-to-End über addItem→computeSummary)', async () => {
    const mealId = await createMeal();

    // Eintrag 1: fiber=6 via calculatedNutrition (Produkt-Pfad)
    await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productName: 'Vollkornbrot',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 240, protein: 8, carbs: 44, fat: 3, fiber: 6 },
        },
      }),
      makeContext(),
    );

    // Eintrag 2: fiber=2.5 via Flat-Macros (manueller Pfad) — Rückgabe enthält beide Items
    const res2 = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: { name: 'Apfel', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.5 },
      }),
      makeContext(),
    );
    expect(res2.status).toBe(201);

    // addItem gibt die vollständige Mahlzeit zurück — daraus Summary direkt berechnen
    const meal = (res2.jsonBody as { meal: import('@fittrack/shared').Meal }).meal;
    const summary = computeSummary([meal]);
    expect(summary.fiber).toBeCloseTo(8.5, 1); // 6 (Vollkornbrot) + 2.5 (Apfel)
  });
});

// ---------------------------------------------------------------------------
// Flat macros input (manual mode — existing behaviour)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items â€” flat macros input', () => {
  it('accepts flat macros and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: { name: 'Rührei', calories: 180, protein: 14, carbs: 2, fat: 12, fiber: 0 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { name: string }[] } };
    expect(body.meal.items[0]!.name).toBe('Rührei');
  });

  it('returns 400 when calories is missing', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: { name: 'Rührei', protein: 14, carbs: 2, fat: 12 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Calculated input (quantityMode â€” existing behaviour)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items â€” quantityMode input', () => {
  it('accepts quantityMode=grams + nutritionPer100g and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          name: 'Haferflocken',
          quantityMode: 'grams',
          quantity: 80,
          nutritionPer100g: { calories: 370, protein: 13, carbs: 58, fat: 7, fiber: 10 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
  });

  it('returns 400 when mealId is missing', async () => {
    const res = await addItemHandler(
      await makeAuthRequest({
        params: {},
        body: { name: 'x', calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 0 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// computeSummary — Robustheit
// ---------------------------------------------------------------------------

describe('computeSummary', () => {
  it('gibt Nullwerte zurück wenn keine Meals vorhanden', () => {
    const result = computeSummary([]);
    expect(result).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it('wirft nicht wenn meal.items undefined ist (Altdaten aus Cosmos)', () => {
    const malformed = [{ id: '1', items: undefined }] as unknown as import('@fittrack/shared').Meal[];
    expect(() => computeSummary(malformed)).not.toThrow();
    expect(computeSummary(malformed)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it('wirft nicht wenn meal.items null ist', () => {
    const malformed = [{ id: '1', items: null }] as unknown as import('@fittrack/shared').Meal[];
    expect(() => computeSummary(malformed)).not.toThrow();
  });

  it('summiert Makros korrekt über mehrere Meals', () => {
    const meals = [
      {
        id: '1',
        items: [
          { macros: { calories: 300, protein: 20, carbs: 40, fat: 8, fiber: 3 } },
          { macros: { calories: 100, protein: 5, carbs: 15, fat: 2, fiber: 1 } },
        ],
      },
      {
        id: '2',
        items: [
          { macros: { calories: 200, protein: 10, carbs: 25, fat: 5, fiber: 2 } },
        ],
      },
    ] as unknown as import('@fittrack/shared').Meal[];
    const result = computeSummary(meals);
    expect(result.calories).toBe(600);
    expect(result.protein).toBe(35);
    expect(result.carbs).toBe(80);
    expect(result.fat).toBe(15);
    expect(result.fiber).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/diary/meals/:id/items/:itemId — updateItemHandler
// ---------------------------------------------------------------------------

describe('PUT /api/diary/meals/:id/items/:itemId — updateItemHandler', () => {
  beforeEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  afterEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  it('scales macros proportionally for a manual item (grams mode)', async () => {
    const mealId = await createMeal();
    // Add a manual item: 100g → 200 kcal
    const addRes = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          name: 'Banane',
          calories: 200,
          protein: 2,
          carbs: 40,
          fat: 1,
          fiber: 2,
        },
      }),
      makeContext(),
    );
    expect(addRes.status).toBe(201);
    const item = (addRes.jsonBody as { meal: { items: Array<{ id: string; quantity: number }> } }).meal.items[0];
    expect(item.quantity).toBe(1); // default quantity for flat-macro items

    // Update to 200g (ratio 200/1 = 200x)
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: mealId, itemId: item.id },
        body: { inputMode: 'grams', amountGrams: 200 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const updatedMeal = (res.jsonBody as { meal: { items: Array<{ quantity: number; unit: string; macros: { calories: number } }> } }).meal;
    const updatedItem = updatedMeal.items[0];
    expect(updatedItem.quantity).toBe(200);
    expect(updatedItem.unit).toBe('g');
    expect(updatedItem.macros.calories).toBe(40000); // 200 × 200 kcal
  });

  it('returns 404 when meal does not exist', async () => {
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: 'nonexistent-meal', itemId: 'nonexistent-item' },
        body: { inputMode: 'grams', amountGrams: 100 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when item does not exist in meal', async () => {
    const mealId = await createMeal();
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: mealId, itemId: 'ghost-item' },
        body: { inputMode: 'grams', amountGrams: 100 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing required field (no amountGrams in grams mode)', async () => {
    const mealId = await createMeal();
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: mealId, itemId: 'any-id' },
        body: { inputMode: 'grams' }, // amountGrams missing
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('scales macros proportionally for an OFf item (sourceId starts with openFoodFacts:)', async () => {
    const mealId = await createMeal();
    // Add an OFf item via the product input path with calculatedNutrition
    const addRes = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:3017620422003',
          productName: 'Nutella',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fiber: 0 },
        },
      }),
      makeContext(),
    );
    expect(addRes.status).toBe(201);
    const item = (addRes.jsonBody as { meal: { items: Array<{ id: string; quantity: number; macros: { calories: number } }> } }).meal.items[0];
    expect(item.quantity).toBe(100);
    expect(item.macros.calories).toBe(539);

    // Update to 50g — should scale proportionally (ratio = 50/100 = 0.5)
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: mealId, itemId: item.id },
        body: { inputMode: 'grams', amountGrams: 50 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const updatedItem = (res.jsonBody as { meal: { items: Array<{ quantity: number; macros: { calories: number; protein: number } }> } }).meal.items[0];
    expect(updatedItem.quantity).toBe(50);
    expect(updatedItem.macros.calories).toBe(269.5);
    expect(updatedItem.macros.protein).toBe(3.2);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/diary/:date/day-type — workoutType support
// ---------------------------------------------------------------------------

describe('PUT /api/diary/:date/day-type with workoutType', () => {
  beforeEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  afterEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  it('stores workoutType and returns it in GET response', async () => {
    // Set training day + gym workout
    const putRes = await setDayTypeHandler(
      await makeAuthRequest({
        params: { date: '2026-05-08' },
        body: { dayType: 'training', workoutType: 'gym' },
      }),
      makeContext(),
    );
    expect(putRes.status).toBe(200);
    const meta = (putRes.jsonBody as { dayMeta: { dayType: string; workoutType: string } }).dayMeta;
    expect(meta.dayType).toBe('training');
    expect(meta.workoutType).toBe('gym');

    // Verify directly via repository
    const repo = getDayMetaRepository();
    const stored = await repo.get('test-user-abc-123', '2026-05-08');
    expect(stored?.workoutType).toBe('gym');
  });

  it('clears workoutType when switching to rest day', async () => {
    // First set training + bouldering
    await setDayTypeHandler(
      await makeAuthRequest({
        params: { date: '2026-05-08' },
        body: { dayType: 'training', workoutType: 'bouldering' },
      }),
      makeContext(),
    );
    // Then switch to rest
    const restRes = await setDayTypeHandler(
      await makeAuthRequest({
        params: { date: '2026-05-08' },
        body: { dayType: 'rest' },
      }),
      makeContext(),
    );
    expect(restRes.status).toBe(200);
    const meta = (restRes.jsonBody as { dayMeta: { dayType: string; workoutType?: string } }).dayMeta;
    expect(meta.dayType).toBe('rest');
    expect(meta.workoutType).toBeUndefined();

    // Verify directly via repository
    const repo = getDayMetaRepository();
    const stored = await repo.get('test-user-abc-123', '2026-05-08');
    expect(stored?.workoutType).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// recordUsage — foodRefType mapping per sourceType
// ---------------------------------------------------------------------------

describe('addItemHandler — recordUsage foodRefType mapping', () => {
  beforeEach(() => {
    __resetUserFoodRelationRepositoryForTests();
  });

  afterEach(() => {
    __resetUserFoodRelationRepositoryForTests();
  });

  it('uses the current recipe snapshot and records usage for its owner and the target meal date', async () => {
    const recipe = await createRecipeForDiary();
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: recipe.id,
          sourceType: 'recipe',
          inputMode: 'portion',
          inputAmount: 2,
          productName: 'Forged name',
          amountGrams: 1,
          calculatedNutrition: { calories: 9999, protein: 9999, carbs: 9999, fat: 9999, fiber: 9999 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);

    // Flush fire-and-forget recipe and relation usage updates.
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    const body = res.jsonBody as { meal: { items: Array<{ name: string; recipeId?: string; recipePortions?: number; macros: { calories: number } }> } };
    expect(body.meal.items[0]).toMatchObject({
      name: 'Server-Rezept',
      recipeId: recipe.id,
      recipePortions: 2,
      macros: { calories: 200 },
    });
    const relationRepo = getUserFoodRelationRepository();
    const rel = await relationRepo.getByFoodRef('test-user-abc-123', recipe.id);
    expect(rel?.foodRefType).toBe('recipe');
    expect(rel?.usageDates).toEqual([{ date: '2026-05-08', mealType: 'breakfast' }]);
    expect((await getRecipesRepository().get('test-user-abc-123', recipe.id))?.usageCount).toBe(1);
  });

  it('denies new quick-entry writes after revocation without changing the prior snapshot or usage', async () => {
    const ownerId = 'recipe-publisher';
    const readerId = 'recipe-reader';
    const recipe = await createRecipeForDiary(ownerId);
    const recipes = getRecipesRepository();
    const current = await recipes.getVersioned(ownerId, recipe.id);
    await recipes.setVisibility(ownerId, recipe.id, current!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });
    const meal = await getDiaryRepository().createMeal({
      userId: readerId,
      date: '2026-10-02',
      type: 'dinner',
      name: 'Abendessen',
    });
    const token = await signTestToken(readerId);
    const request = () => makeRequest({
      params: { id: meal.id },
      headers: { authorization: `Bearer ${token}` },
      body: {
        productId: recipe.id,
        sourceType: 'recipe',
        inputMode: 'portion',
        inputAmount: 2,
        productName: 'Forged name',
        amountGrams: 1,
        calculatedNutrition: { calories: 9999, protein: 9999, carbs: 9999, fat: 9999, fiber: 9999 },
      },
    });

    const logged = await addItemHandler(await request(), makeContext());
    expect(logged.status).toBe(201);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const priorSnapshot = structuredClone((await getDiaryRepository().getMealById(readerId, meal.id))!.items);

    const publishedVersion = await recipes.getVersioned(ownerId, recipe.id);
    await recipes.setVisibility(ownerId, recipe.id, publishedVersion!.etag, { visibility: 'private' });
    const denied = await addItemHandler(await request(), makeContext());

    expect(denied.status).toBe(404);
    expect((await getDiaryRepository().getMealById(readerId, meal.id))?.items).toEqual(priorSnapshot);
    expect((await recipes.get(ownerId, recipe.id))?.usageCount).toBe(1);
    expect(await getUserFoodRelationRepository().getByFoodRef(readerId, recipe.id)).toMatchObject({
      usageCount: 1,
      usageDates: [{ date: '2026-10-02', mealType: 'dinner' }],
    });
  });

  it('converts grams with the recipe quick-entry portion weight and ignores client nutrition', async () => {
    const recipe = await createRecipeForDiary();
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: recipe.id,
          sourceType: 'recipe',
          inputMode: 'grams',
          inputAmount: 100,
          calculatedNutrition: { calories: 1, protein: 0, carbs: 0, fat: 0 },
        },
      }),
      makeContext(),
    );

    expect(res.status).toBe(201);
    const meal = (res.jsonBody as { meal: { items: Array<{ recipePortions?: number; macros: { calories: number } }> } }).meal;
    expect(meal.items[0]).toMatchObject({ recipePortions: 2, macros: { calories: 200 } });
  });

  it('rejects recipe refs without a recipe id and does not fall back from a stored recipe relation', async () => {
    const recipe = await createRecipeForDiary();
    const mealId = await createMeal();
    const missingId = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          sourceType: 'recipe',
          productName: 'Forged recipe',
          inputMode: 'portion',
          inputAmount: 1,
          amountGrams: 300,
          calculatedNutrition: { calories: 500, protein: 10, carbs: 50, fat: 20 },
        },
      }),
      makeContext(),
    );
    expect(missingId.status).toBe(400);

    await getUserFoodRelationRepository().setFavorite(
      'test-user-abc-123', recipe.id, 'recipe', recipe.name, undefined, true,
    );
    const unmarked = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: recipe.id,
          productName: 'Forged recipe',
          sourceType: 'manual',
          inputMode: 'portion',
          inputAmount: 1,
          amountGrams: 300,
          calculatedNutrition: { calories: 500, protein: 10, carbs: 50, fat: 20 },
        },
      }),
      makeContext(),
    );
    expect(unmarked.status).toBe(404);
    expect((await getDiaryRepository().getMealById('test-user-abc-123', mealId))?.items).toHaveLength(0);
  });

  it('rejects a recipe log targeting a meal owned by another user', async () => {
    const recipe = await createRecipeForDiary();
    const foreignMeal = await getDiaryRepository().createMeal({
      userId: 'another-user',
      date: '2026-05-08',
      type: 'dinner',
      name: 'Foreign meal',
    });
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: foreignMeal.id },
        body: { productId: recipe.id, sourceType: 'recipe', inputMode: 'portion', inputAmount: 1 },
      }),
      makeContext(),
    );

    expect(res.status).toBe(404);
    expect((await getDiaryRepository().getMealById('another-user', foreignMeal.id))?.items).toHaveLength(0);
  });

  it('rejects recipe quick-entry amounts exceeding the recipe-log portion bound', async () => {
    const recipe = await createRecipeForDiary();
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: { productId: recipe.id, sourceType: 'recipe', inputMode: 'portion', inputAmount: 51 },
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'invalid_recipe_portions' });
  });
});

// ---------------------------------------------------------------------------
// GET /api/diary — specialActivity fields
// ---------------------------------------------------------------------------

describe('GET /api/diary — specialActivity response fields', () => {
  const GET_DATE = '2026-07-21';

  // Helper to build a fake GET request with query params
  async function makeGetRequest(
    date: string,
    localDate: string | null = date,
    localHour = '12',
  ) {
    const token = await (async () => {
      // Re-use makeAuthRequest pattern with query support
      const { signTestToken } = await import('../test-utils/http');
      return signTestToken();
    })();
    // Build a fake request manually with query support
    const { makeRequest } = await import('../test-utils/http');
    const query: Record<string, string> = { date, localHour };
    if (localDate !== null) query.localDate = localDate;
    return makeRequest({
      query,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  beforeEach(() => {
    __resetDayMetaRepositoryForTests();
    __resetHintStateRepositoryForTests();
  });

  it('returns specialActivity: null and activityBonus: 0 when no activity is set', async () => {
    const req = await makeGetRequest(GET_DATE);
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { specialActivity: null; activityBonus: number; previousDayHasActivity: boolean };
    expect(body.specialActivity).toBeNull();
    expect(body.activityBonus).toBe(0);
    expect(body.previousDayHasActivity).toBe(false);
  });

  it('returns correct activityBonus when specialActivity is set for the requested day', async () => {
    const mockActivity: SpecialActivity = {
      type: 'hiking',
      movementTimeMinutes: 240,
      distanceKm: 16,
      elevationGainM: 800,
      hasBackpack: false,
      bodyWeightKg: 70,
      dailyCalorieTarget: 2000,
      calculatedAt: '2026-07-21T08:00:00Z',
      estimatedMet: 4.5,
      activityCalories: 1260,
      alreadyAccountedCalories: 333.33,
      activityBonus: 926.67,
    };
    await getDayMetaRepository().setSpecialActivity('test-user-abc-123', GET_DATE, mockActivity);

    const req = await makeGetRequest(GET_DATE);
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { specialActivity: SpecialActivity; activityBonus: number };
    expect(body.activityBonus).toBeCloseTo(926.67, 1);
    expect(body.specialActivity?.type).toBe('hiking');
  });

  it('returns previousDayHasActivity: true when yesterday has a special activity', async () => {
    // Yesterday = 2026-07-20
    const mockActivity: SpecialActivity = {
      type: 'hiking',
      movementTimeMinutes: 120,
      distanceKm: 8,
      elevationGainM: 400,
      hasBackpack: false,
      bodyWeightKg: 70,
      dailyCalorieTarget: 2000,
      calculatedAt: '2026-07-20T10:00:00Z',
      estimatedMet: 4.5,
      activityCalories: 630,
      alreadyAccountedCalories: 166.67,
      activityBonus: 463.33,
    };
    await getDayMetaRepository().setSpecialActivity('test-user-abc-123', '2026-07-20', mockActivity);

    const req = await makeGetRequest(GET_DATE);
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { previousDayHasActivity: boolean };
    expect(body.previousDayHasActivity).toBe(true);
  });

  it('does not rewrite hint state when reading a historical day for the current local date', async () => {
    const hintStateRepository = getHintStateRepository();
    await hintStateRepository.upsert('test-user-abc-123', {
      id: 'hintState',
      userId: 'test-user-abc-123',
      _docType: 'hintState',
      lastHintId: 'H1',
      lastHintDate: '2026-08-20',
      lastHintGeneratedAt: '2026-08-20T08:00:00.000Z',
      cooldownHistory: {},
      motivationIndex: 0,
    });
    const upsertSpy = vi.spyOn(hintStateRepository, 'upsert');

    const req = await makeGetRequest(GET_DATE, '2026-08-20');
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(200);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['wrong format', '2026-7-21'],
    ['impossible day', '2026-02-30'],
  ] as const)('returns 400 for %s localDate', async (_label, localDate) => {
    const req = await makeGetRequest(GET_DATE, localDate);
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: expect.stringContaining('localDate') });
  });

  it.each([
    ['missing', ''],
    ['wrong format', '2026-7-21'],
    ['impossible day', '2026-02-30'],
  ])('returns 400 for %s diary date', async (_label, date) => {
    const req = await makeGetRequest(date);
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: expect.stringContaining('date') });
  });
});

// ---------------------------------------------------------------------------
// GET /api/diary/meals — listMealsHandler
// ---------------------------------------------------------------------------

describe('GET /api/diary/meals — listMealsHandler', () => {
  it('returns empty meals array for a new user', async () => {
    const req = await makeAuthRequest({ query: {} });
    const res = await listMealsHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { meals: unknown[]; cursor?: string };
    expect(body.meals).toEqual([]);
    expect(body.cursor).toBeUndefined();
  });

  it('returns meals in ascending date order', async () => {
    // Create meals on different dates
    await createMealHandler(
      await makeAuthRequest({ body: { date: '2026-05-10', type: 'lunch' } }),
      makeContext(),
    );
    await createMealHandler(
      await makeAuthRequest({ body: { date: '2026-05-08', type: 'breakfast' } }),
      makeContext(),
    );
    await createMealHandler(
      await makeAuthRequest({ body: { date: '2026-05-09', type: 'dinner' } }),
      makeContext(),
    );

    const req = await makeAuthRequest({ query: {} });
    const res = await listMealsHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { meals: { date: string }[] };
    expect(body.meals.map((m) => m.date)).toEqual(['2026-05-08', '2026-05-09', '2026-05-10']);
  });

  it('respects the limit query parameter', async () => {
    for (let i = 1; i <= 5; i++) {
      await createMealHandler(
        await makeAuthRequest({ body: { date: `2026-05-${String(i).padStart(2, '0')}`, type: 'lunch' } }),
        makeContext(),
      );
    }

    const req = await makeAuthRequest({ query: { limit: '2' } });
    const res = await listMealsHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { meals: unknown[]; cursor?: string };
    expect(body.meals).toHaveLength(2);
    expect(body.cursor).toBeDefined();
  });

  it('defaults to limit 50 when no limit is provided', async () => {
    // Create 55 meals
    for (let i = 1; i <= 55; i++) {
      const month = i <= 28 ? '01' : '02';
      const day = i <= 28 ? String(i).padStart(2, '0') : String(i - 28).padStart(2, '0');
      await createMealHandler(
        await makeAuthRequest({ body: { date: `2026-${month}-${day}`, type: 'breakfast' } }),
        makeContext(),
      );
    }

    const req = await makeAuthRequest({ query: {} });
    const res = await listMealsHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { meals: unknown[]; cursor?: string };
    expect(body.meals).toHaveLength(50);
    expect(body.cursor).toBeDefined();
  });

  it('caps limit at 100', async () => {
    for (let i = 1; i <= 5; i++) {
      await createMealHandler(
        await makeAuthRequest({ body: { date: `2026-05-${String(i).padStart(2, '0')}`, type: 'snack' } }),
        makeContext(),
      );
    }

    const req = await makeAuthRequest({ query: { limit: '200' } });
    const res = await listMealsHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { meals: unknown[] };
    // All 5 returned (capped at 100 but only 5 exist)
    expect(body.meals).toHaveLength(5);
  });

  it('cursor from page N returns the correct next page', async () => {
    for (let i = 1; i <= 4; i++) {
      await createMealHandler(
        await makeAuthRequest({ body: { date: `2026-06-${String(i).padStart(2, '0')}`, type: 'breakfast' } }),
        makeContext(),
      );
    }

    // Fetch page 1 (limit=2)
    const req1 = await makeAuthRequest({ query: { limit: '2' } });
    const res1 = await listMealsHandler(req1, makeContext());
    const body1 = res1.jsonBody as { meals: { date: string }[]; cursor: string };
    expect(body1.meals).toHaveLength(2);
    expect(body1.cursor).toBeDefined();

    // Fetch page 2 using cursor
    const req2 = await makeAuthRequest({ query: { limit: '2', cursor: body1.cursor } });
    const res2 = await listMealsHandler(req2, makeContext());
    const body2 = res2.jsonBody as { meals: { date: string }[]; cursor?: string };
    expect(body2.meals).toHaveLength(2);
    // Pages should not overlap
    const allDates = [...body1.meals.map((m) => m.date), ...body2.meals.map((m) => m.date)];
    expect(new Set(allDates).size).toBe(4);
  });

  it('does not include cursor in response for the last page', async () => {
    await createMealHandler(
      await makeAuthRequest({ body: { date: '2026-07-01', type: 'dinner' } }),
      makeContext(),
    );

    const req = await makeAuthRequest({ query: {} });
    const res = await listMealsHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { meals: unknown[]; cursor?: string };
    expect(body.meals).toHaveLength(1);
    expect(body.cursor).toBeUndefined();
  });

  it('returns 401 when no auth token is provided', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest({ query: {} });
    const res = await listMealsHandler(req, makeContext());
    expect(res.status).toBe(401);
  });
});