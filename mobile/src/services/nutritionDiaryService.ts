// nutritionDiaryService — thin wrapper around diaryApi that triggers HC nutrition sync on mutations.

import { diaryApi } from '../shared/api/diaryApi';
import { nutritionSyncService } from './health/nutritionSyncService';
import type {
  DiaryBulkCopyRequest,
  DiaryBulkCopyResponse,
  DiaryBulkDeleteRequest,
  DiaryBulkDeleteResponse,
  DiaryBulkMoveRequest,
  DiaryBulkMoveResponse,
  Meal,
  MealType,
} from '@fittrack/shared';
import type { AddItemInput } from '../shared/api/diaryApi';

export const nutritionDiaryService = {
  // Read-throughs
  getDay: diaryApi.getDay.bind(diaryApi),
  setSpecialActivity: diaryApi.setSpecialActivity.bind(diaryApi),
  removeSpecialActivity: diaryApi.removeSpecialActivity.bind(diaryApi),
  listAllMeals: diaryApi.listAllMeals.bind(diaryApi),

  async createMeal(date: string, type: MealType, name?: string): Promise<{ meal: Meal }> {
    const result = await diaryApi.createMeal(date, type, name);
    void nutritionSyncService.syncNutritionUpsert(result.meal);
    return result;
  },

  createMealForRecipeSetup(date: string, type: MealType): Promise<{ meal: Meal }> {
    return diaryApi.createMeal(date, type);
  },

  async deleteMeal(meal: Meal): Promise<void> {
    await diaryApi.deleteMeal(meal.id);
    void nutritionSyncService.syncNutritionDeleteMeal(meal);
  },

  async addItem(mealId: string, item: AddItemInput): Promise<{ meal: Meal }> {
    const result = await diaryApi.addItem(mealId, item);
    void nutritionSyncService.syncNutritionUpsert(result.meal);
    return result;
  },

  async deleteItem(mealId: string, itemId: string): Promise<{ meal: Meal }> {
    const result = await diaryApi.deleteItem(mealId, itemId);
    void nutritionSyncService.syncNutritionDelete(itemId);
    return result;
  },

  async bulkDeleteItems(input: DiaryBulkDeleteRequest): Promise<DiaryBulkDeleteResponse> {
    const result = await diaryApi.bulkDeleteItems(input);
    void nutritionSyncService.syncNutritionDeletes(result.deletedItemIds);
    return result;
  },

  async bulkMoveItems(input: DiaryBulkMoveRequest): Promise<DiaryBulkMoveResponse> {
    const result = await diaryApi.bulkMoveItems(input);
    void nutritionSyncService.syncNutritionDeletes(result.removedItemIds);
    const movedItemIds = result.movedCount > 0
      ? result.targetMeal.items.slice(-result.movedCount).map((item) => item.id)
      : [];
    if (movedItemIds.length > 0) {
      void nutritionSyncService.syncNutritionUpsert(result.targetMeal, movedItemIds);
    }
    return result;
  },

  async bulkCopyItems(input: DiaryBulkCopyRequest): Promise<DiaryBulkCopyResponse> {
    const result = await diaryApi.bulkCopyItems(input);
    const copiedItemIds = result.copiedCount > 0
      ? result.targetMeal.items.slice(-result.copiedCount).map((item) => item.id)
      : [];
    if (copiedItemIds.length > 0) {
      void nutritionSyncService.syncNutritionUpsert(result.targetMeal, copiedItemIds);
    }
    return result;
  },

  async updateItem(
    mealId: string,
    itemId: string,
    input: Parameters<typeof diaryApi.updateItem>[2],
  ): Promise<{ meal: Meal }> {
    const result = await diaryApi.updateItem(mealId, itemId, input);
    void nutritionSyncService.syncNutritionUpsert(result.meal);
    return result;
  },
};
