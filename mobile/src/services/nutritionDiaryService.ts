// nutritionDiaryService — thin wrapper around diaryApi that triggers HC nutrition sync on mutations.

import { diaryApi } from '../shared/api/diaryApi';
import { nutritionSyncService } from './health/nutritionSyncService';
import type { Meal, MealType } from '@fittrack/shared';
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
