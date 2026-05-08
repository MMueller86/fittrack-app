// ReusableItems API
import { apiClient } from './client';
import type { ReusableItem } from '@fittrack/shared';

export interface CreateManualItemInput {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const reusableItemsApi = {
  /** GET /api/reusable-items?query= */
  search(query: string): Promise<{ items: ReusableItem[] }> {
    return apiClient
      .get<{ items: ReusableItem[] }>('/reusable-items', { params: { query } })
      .then((r) => r.data);
  },

  /** POST /api/reusable-items — accepts flat manual macros */
  create(item: CreateManualItemInput): Promise<{ item: ReusableItem }> {
    return apiClient.post<{ item: ReusableItem }>('/reusable-items', item).then((r) => r.data);
  },
};
