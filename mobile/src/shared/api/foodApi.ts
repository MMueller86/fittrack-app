// Food search API — calls /api/food-search (unified user library + Open Food Facts)
import { apiClient } from './client';
import type { FoodSearchResult } from '@fittrack/shared';

export const foodApi = {
  /** GET /api/food-search?query= */
  search(query: string): Promise<{ results: FoodSearchResult[] }> {
    return apiClient
      .get<{ results: FoodSearchResult[] }>('/food-search', { params: { query } })
      .then((r) => r.data);
  },
};
