import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DiaryBulkCopyRequest,
  DiaryBulkDeleteRequest,
  DiaryBulkMoveRequest,
  Meal,
  MealItem,
} from '@fittrack/shared';

const {
  mockGetDay,
  mockSetSpecialActivity,
  mockRemoveSpecialActivity,
  mockListAllMeals,
  mockCreateMeal,
  mockDeleteMeal,
  mockAddItem,
  mockDeleteItem,
  mockUpdateItem,
  mockBulkDeleteItems,
  mockBulkMoveItems,
  mockBulkCopyItems,
  mockSyncNutritionUpsert,
  mockSyncNutritionDelete,
  mockSyncNutritionDeleteMeal,
  mockSyncNutritionDeletes,
} = vi.hoisted(() => ({
  mockGetDay: vi.fn(),
  mockSetSpecialActivity: vi.fn(),
  mockRemoveSpecialActivity: vi.fn(),
  mockListAllMeals: vi.fn(),
  mockCreateMeal: vi.fn(),
  mockDeleteMeal: vi.fn(),
  mockAddItem: vi.fn(),
  mockDeleteItem: vi.fn(),
  mockUpdateItem: vi.fn(),
  mockBulkDeleteItems: vi.fn(),
  mockBulkMoveItems: vi.fn(),
  mockBulkCopyItems: vi.fn(),
  mockSyncNutritionUpsert: vi.fn(),
  mockSyncNutritionDelete: vi.fn(),
  mockSyncNutritionDeleteMeal: vi.fn(),
  mockSyncNutritionDeletes: vi.fn(),
}));

vi.mock('../shared/api/diaryApi', () => ({
  diaryApi: {
    getDay: mockGetDay,
    setSpecialActivity: mockSetSpecialActivity,
    removeSpecialActivity: mockRemoveSpecialActivity,
    listAllMeals: mockListAllMeals,
    createMeal: mockCreateMeal,
    deleteMeal: mockDeleteMeal,
    addItem: mockAddItem,
    deleteItem: mockDeleteItem,
    updateItem: mockUpdateItem,
    bulkDeleteItems: mockBulkDeleteItems,
    bulkMoveItems: mockBulkMoveItems,
    bulkCopyItems: mockBulkCopyItems,
  },
}));

vi.mock('./health/nutritionSyncService', () => ({
  nutritionSyncService: {
    syncNutritionUpsert: mockSyncNutritionUpsert,
    syncNutritionDelete: mockSyncNutritionDelete,
    syncNutritionDeleteMeal: mockSyncNutritionDeleteMeal,
    syncNutritionDeletes: mockSyncNutritionDeletes,
  },
}));

import { nutritionDiaryService } from './nutritionDiaryService';

function makeItem(id: string): MealItem {
  return {
    id,
    name: `Item ${id}`,
    sourceType: 'manual',
    quantity: 100,
    unit: 'g',
    macros: { calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 },
  };
}

function makeMeal(items: MealItem[], date = '2026-08-13'): Meal {
  return {
    id: 'target-meal',
    userId: 'user-1',
    date,
    type: 'dinner',
    name: 'Abendessen',
    items,
    createdAt: '2026-08-13T18:00:00.000Z',
  };
}

describe('nutritionDiaryService bulk mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncNutritionDelete.mockResolvedValue(undefined);
    mockSyncNutritionDeleteMeal.mockResolvedValue(undefined);
    mockSyncNutritionDeletes.mockResolvedValue(undefined);
    mockSyncNutritionUpsert.mockResolvedValue(undefined);
  });

  it('creates a recipe setup meal through the facade without syncing its empty contents', async () => {
    const meal = makeMeal([]);
    mockCreateMeal.mockResolvedValue({ meal });

    await expect(nutritionDiaryService.createMealForRecipeSetup(meal.date, meal.type))
      .resolves.toEqual({ meal });

    expect(mockCreateMeal).toHaveBeenCalledWith(meal.date, meal.type);
    expect(mockSyncNutritionUpsert).not.toHaveBeenCalled();
    expect(mockSyncNutritionDelete).not.toHaveBeenCalled();
    expect(mockSyncNutritionDeleteMeal).not.toHaveBeenCalled();
    expect(mockSyncNutritionDeletes).not.toHaveBeenCalled();
  });

  it('triggers create, add, update, item delete, and meal delete only after each API succeeds', async () => {
    const meal = makeMeal([makeItem('item-1')]);
    mockCreateMeal.mockResolvedValue({ meal });
    mockAddItem.mockResolvedValue({ meal });
    mockUpdateItem.mockResolvedValue({ meal });
    mockDeleteItem.mockResolvedValue({ meal });
    mockDeleteMeal.mockResolvedValue(undefined);

    await nutritionDiaryService.createMeal(meal.date, meal.type);
    await nutritionDiaryService.addItem(meal.id, { name: 'Haferflocken', calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 });
    await nutritionDiaryService.updateItem(meal.id, 'item-1', { inputMode: 'grams', amountGrams: 120 });
    await nutritionDiaryService.deleteItem(meal.id, 'item-1');
    await nutritionDiaryService.deleteMeal(meal);

    expect(mockSyncNutritionUpsert).toHaveBeenNthCalledWith(1, meal);
    expect(mockSyncNutritionUpsert).toHaveBeenNthCalledWith(2, meal);
    expect(mockSyncNutritionUpsert).toHaveBeenNthCalledWith(3, meal);
    expect(mockSyncNutritionDelete).toHaveBeenCalledWith('item-1');
    expect(mockSyncNutritionDeleteMeal).toHaveBeenCalledWith(meal);
  });

  it('does not trigger Health Connect after any single diary mutation fails', async () => {
    const error = new Error('FitTrack unavailable');
    const meal = makeMeal([makeItem('item-1')]);
    mockCreateMeal.mockRejectedValue(error);
    mockAddItem.mockRejectedValue(error);
    mockUpdateItem.mockRejectedValue(error);
    mockDeleteItem.mockRejectedValue(error);
    mockDeleteMeal.mockRejectedValue(error);

    await expect(nutritionDiaryService.createMeal(meal.date, meal.type)).rejects.toBe(error);
    await expect(nutritionDiaryService.addItem(meal.id, { name: 'Haferflocken', calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 })).rejects.toBe(error);
    await expect(nutritionDiaryService.updateItem(meal.id, 'item-1', { inputMode: 'grams', amountGrams: 120 })).rejects.toBe(error);
    await expect(nutritionDiaryService.deleteItem(meal.id, 'item-1')).rejects.toBe(error);
    await expect(nutritionDiaryService.deleteMeal(meal)).rejects.toBe(error);

    expect(mockSyncNutritionUpsert).not.toHaveBeenCalled();
    expect(mockSyncNutritionDelete).not.toHaveBeenCalled();
    expect(mockSyncNutritionDeleteMeal).not.toHaveBeenCalled();
    expect(mockSyncNutritionDeletes).not.toHaveBeenCalled();
  });

  it('does not wait for the Health Connect trigger after a successful FitTrack write', async () => {
    const meal = makeMeal([makeItem('item-1')]);
    let finishSync!: () => void;
    mockAddItem.mockResolvedValue({ meal });
    mockSyncNutritionUpsert.mockReturnValue(new Promise<void>((resolve) => { finishSync = resolve; }));

    await expect(nutritionDiaryService.addItem(meal.id, { name: 'Haferflocken', calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 }))
      .resolves.toEqual({ meal });

    expect(mockSyncNutritionUpsert).toHaveBeenCalledWith(meal);
    finishSync();
  });

  it('syncs each deleted item only after the bulk-delete request succeeds', async () => {
    const request: DiaryBulkDeleteRequest = {
      sourceDate: '2026-08-13',
      items: [
        { mealId: 'meal-1', itemId: 'item-1' },
        { mealId: 'meal-2', itemId: 'item-2' },
      ],
    };
    mockBulkDeleteItems.mockResolvedValue({
      deletedCount: 2,
      deletedItemIds: ['item-1', 'item-2'],
    });

    await nutritionDiaryService.bulkDeleteItems(request);

    expect(mockBulkDeleteItems).toHaveBeenCalledTimes(1);
    expect(mockBulkDeleteItems).toHaveBeenCalledWith(request);
    expect(mockSyncNutritionDeletes).toHaveBeenCalledWith(['item-1', 'item-2']);
    expect(mockSyncNutritionUpsert).not.toHaveBeenCalled();
  });

  it('does not sync Health Connect when bulk delete fails', async () => {
    const request: DiaryBulkDeleteRequest = {
      sourceDate: '2026-08-13',
      items: [{ mealId: 'meal-1', itemId: 'item-1' }],
    };
    const error = new Error('delete failed');
    mockBulkDeleteItems.mockRejectedValue(error);

    await expect(nutritionDiaryService.bulkDeleteItems(request)).rejects.toBe(error);

    expect(mockSyncNutritionDelete).not.toHaveBeenCalled();
    expect(mockSyncNutritionUpsert).not.toHaveBeenCalled();
  });

  it('deletes old Health Connect ids and upserts only the moved target items', async () => {
    const request: DiaryBulkMoveRequest = {
      sourceDate: '2026-08-13',
      items: [
        { mealId: 'source-meal-1', itemId: 'old-item-1' },
        { mealId: 'source-meal-2', itemId: 'old-item-2' },
      ],
      target: { newMealType: 'dinner' },
    };
    const targetMeal = makeMeal([
      makeItem('existing-target-item'),
      makeItem('moved-item-1'),
      makeItem('moved-item-2'),
    ]);
    mockBulkMoveItems.mockResolvedValue({
      movedCount: 2,
      removedItemIds: ['old-item-1', 'old-item-2'],
      targetMeal,
    });

    await nutritionDiaryService.bulkMoveItems(request);

    expect(mockBulkMoveItems).toHaveBeenCalledTimes(1);
    expect(mockBulkMoveItems).toHaveBeenCalledWith(request);
    expect(mockSyncNutritionDeletes).toHaveBeenCalledWith(['old-item-1', 'old-item-2']);
    expect(mockSyncNutritionUpsert).toHaveBeenCalledWith(targetMeal, ['moved-item-1', 'moved-item-2']);
  });

  it('does not sync Health Connect when bulk move fails', async () => {
    const request: DiaryBulkMoveRequest = {
      sourceDate: '2026-08-13',
      items: [{ mealId: 'source-meal', itemId: 'old-item' }],
      target: { mealId: 'target-meal' },
    };
    const error = new Error('move failed');
    mockBulkMoveItems.mockRejectedValue(error);

    await expect(nutritionDiaryService.bulkMoveItems(request)).rejects.toBe(error);

    expect(mockSyncNutritionDelete).not.toHaveBeenCalled();
    expect(mockSyncNutritionUpsert).not.toHaveBeenCalled();
  });

  it('upserts only copied target IDs after the bulk-copy request succeeds', async () => {
    const request: DiaryBulkCopyRequest = {
      sourceDate: '2026-08-13',
      targetDate: '2026-08-14',
      items: [
        { mealId: 'source-meal-1', itemId: 'source-item-1' },
        { mealId: 'source-meal-2', itemId: 'source-item-2' },
      ],
      target: { newMealType: 'dinner' },
    };
    const targetMeal = makeMeal([
      makeItem('existing-target-item'),
      makeItem('copied-item-1'),
      makeItem('copied-item-2'),
    ], request.targetDate);
    mockBulkCopyItems.mockResolvedValue({ copiedCount: 2, targetMeal });

    await nutritionDiaryService.bulkCopyItems(request);

    expect(mockBulkCopyItems).toHaveBeenCalledTimes(1);
    expect(mockBulkCopyItems).toHaveBeenCalledWith(request);
    expect(mockSyncNutritionUpsert).toHaveBeenCalledTimes(1);
    expect(mockSyncNutritionUpsert).toHaveBeenCalledWith(targetMeal, ['copied-item-1', 'copied-item-2']);
    expect(mockSyncNutritionDelete).not.toHaveBeenCalled();
  });

  it('does not sync Health Connect when bulk copy fails', async () => {
    const request: DiaryBulkCopyRequest = {
      sourceDate: '2026-08-13',
      targetDate: '2026-08-14',
      items: [{ mealId: 'source-meal', itemId: 'source-item' }],
      target: { mealId: 'target-meal' },
    };
    const error = new Error('copy failed');
    mockBulkCopyItems.mockRejectedValue(error);

    await expect(nutritionDiaryService.bulkCopyItems(request)).rejects.toBe(error);

    expect(mockSyncNutritionUpsert).not.toHaveBeenCalled();
    expect(mockSyncNutritionDelete).not.toHaveBeenCalled();
  });
});