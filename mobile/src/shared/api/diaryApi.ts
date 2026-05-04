// Diary API — wraps all /api/diary endpoints.
// Uses the shared apiClient (auth interceptors, base URL).

import { apiClient } from './client';
import type { DiaryDayResponse, MealType, Meal } from '@fittrack/shared';

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

  /** POST /api/diary/meals/:id/items */
  addItem(
    mealId: string,
    item: {
      name: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      fiberG: number;
      quantity?: number;
      unit?: string;
    },
  ): Promise<{ meal: Meal }> {
    return apiClient.post<{ meal: Meal }>(`/diary/meals/${mealId}/items`, item).then((r) => r.data);
  },

  /** DELETE /api/diary/meals/:id/items/:itemId */
  deleteItem(mealId: string, itemId: string): Promise<{ meal: Meal }> {
    return apiClient
      .delete<{ meal: Meal }>(`/diary/meals/${mealId}/items/${itemId}`)
      .then((r) => r.data);
  },
};
