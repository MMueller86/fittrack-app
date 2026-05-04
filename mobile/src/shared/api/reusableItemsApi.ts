// ReusableItems API
import { apiClient } from './client';
import type { ReusableItem } from '@fittrack/shared';

export const reusableItemsApi = {
  /** GET /api/reusable-items?query= */
  search(query: string): Promise<{ items: ReusableItem[] }> {
    return apiClient
      .get<{ items: ReusableItem[] }>('/reusable-items', { params: { query } })
      .then((r) => r.data);
  },

  /** POST /api/reusable-items */
  create(item: Omit<ReusableItem, 'id' | 'userId' | 'usageCount' | 'createdAt'>): Promise<{ item: ReusableItem }> {
    return apiClient.post<{ item: ReusableItem }>('/reusable-items', item).then((r) => r.data);
  },
};
