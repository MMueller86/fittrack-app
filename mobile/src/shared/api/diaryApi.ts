// Diary API — wraps all /api/diary endpoints.
// Uses the shared apiClient (auth interceptors, base URL).

import { apiClient } from './client';
import type { DiaryDayResponse, MealType, Meal, NutritionValues } from '@fittrack/shared';

export type QuantityMode = 'grams' | 'portions';

export interface AddItemFlatInput {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  quantity?: number;
  unit?: string;
}

export interface AddItemCalculatedInput {
  name: string;
  quantityMode: QuantityMode;
  quantity: number;
  unit?: string;
  nutritionPer100g?: NutritionValues;
  portionNutrition?: NutritionValues;
}

/** New product-based input — client pre-computes amountGrams and nutrition. */
export interface AddItemProductInput {
  productId: string;
  productName: string;
  inputMode: 'grams' | 'portion';
  inputAmount: number;
  amountGrams: number;
  calculatedNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
}

export type AddItemInput = AddItemFlatInput | AddItemCalculatedInput | AddItemProductInput;

export const diaryApi = {
  /** GET /api/diary?date=YYYY-MM-DD */
  getDay(date: string): Promise<DiaryDayResponse> {
    return apiClient.get<DiaryDayResponse>('/diary', { params: { date } }).then((r) => r.data);
  },

  /** POST /api/diary/meals */
  createMeal(date: string, type: MealType, name?: string): Promise<{ meal: Meal }> {
    return apiClient.post<{ meal: Meal }>('/diary/meals', { date, type, name }).then((r) => r.data);
  },

  /** DELETE /api/diary/meals/:id */
  deleteMeal(mealId: string): Promise<void> {
    return apiClient.delete(`/diary/meals/${mealId}`).then(() => undefined);
  },

  /** POST /api/diary/meals/:id/items — accepts flat macros or quantityMode+source */
  addItem(mealId: string, item: AddItemInput): Promise<{ meal: Meal }> {
    return apiClient.post<{ meal: Meal }>(`/diary/meals/${mealId}/items`, item).then((r) => r.data);
  },

  /** DELETE /api/diary/meals/:id/items/:itemId */
  deleteItem(mealId: string, itemId: string): Promise<{ meal: Meal }> {
    return apiClient
      .delete<{ meal: Meal }>(`/diary/meals/${mealId}/items/${itemId}`)
      .then((r) => r.data);
  },
};
