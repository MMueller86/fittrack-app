// ReusableItems API
import { apiClient } from './client';
import type { NutritionValues, PortionInfo, ReusableItem } from '@fittrack/shared';

export interface CreateManualItemInput {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface CreateAiItemInput {
  sourceType: 'ai' | 'label-scan' | 'manual';
  name: string;
  brand?: string;
  nutritionPer100g: NutritionValues & { fiber?: number; salt?: number };
  portion?: { label: string; weightGrams: number };
  aiConfidence?: number;
  aiWarnings?: string[];
  searchTerms?: string[];
}

export interface UpdateReusableItemInput {
  name?: string;
  brand?: string | null;
  nutritionPer100g?: NutritionValues & { fiber?: number; salt?: number };
  portion?: { label: string; weightGrams: number } | null;
}

export type CreateReusableItemInput = CreateManualItemInput | CreateAiItemInput;

export const reusableItemsApi = {
  /** GET /api/reusable-items/:id */
  getById(id: string): Promise<{ item: ReusableItem }> {
    return apiClient.get<{ item: ReusableItem }>(`/reusable-items/${id}`).then((r) => r.data);
  },

  /** GET /api/reusable-items?query= */
  search(query: string): Promise<{ items: ReusableItem[] }> {
    return apiClient
      .get<{ items: ReusableItem[] }>('/reusable-items', { params: { query } })
      .then((r) => r.data);
  },

  /** GET /api/reusable-items (empty query = all user items) */
  list(): Promise<{ items: ReusableItem[] }> {
    return apiClient
      .get<{ items: ReusableItem[] }>('/reusable-items', { params: { query: '' } })
      .then((r) => r.data);
  },

  /** POST /api/reusable-items — accepts flat manual macros or AI-estimated product */
  create(item: CreateReusableItemInput): Promise<{ item: ReusableItem }> {
    return apiClient.post<{ item: ReusableItem }>('/reusable-items', item).then((r) => r.data);
  },

  /** PATCH /api/reusable-items/:id */
  update(
    id: string,
    data: UpdateReusableItemInput,
    updateHistory = false,
  ): Promise<{ item: ReusableItem; updatedItemCount: number }> {
    return apiClient
      .patch<{ item: ReusableItem; updatedItemCount: number }>(`/reusable-items/${id}`, {
        ...data,
        updateHistory,
      })
      .then((r) => r.data);
  },

  /** DELETE /api/reusable-items/:id */
  remove(id: string): Promise<{ deleted: boolean; diaryUsageCount: number }> {
    return apiClient
      .delete<{ deleted: boolean; diaryUsageCount: number }>(`/reusable-items/${id}`)
      .then((r) => r.data);
  },
};
