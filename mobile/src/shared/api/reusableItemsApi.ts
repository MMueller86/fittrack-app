// ReusableItems API
import { apiClient } from './client';
import type { ReusableItem, NutritionValues } from '@fittrack/shared';

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
  nutritionPer100g: NutritionValues & { fiber?: number; salt?: number };
  portion?: { label: string; weightGrams: number };
  aiConfidence?: number;
  aiWarnings?: string[];
  searchTerms?: string[];
}

export type CreateReusableItemInput = CreateManualItemInput | CreateAiItemInput;

export const reusableItemsApi = {
  /** GET /api/reusable-items?query= */
  search(query: string): Promise<{ items: ReusableItem[] }> {
    return apiClient
      .get<{ items: ReusableItem[] }>('/reusable-items', { params: { query } })
      .then((r) => r.data);
  },

  /** POST /api/reusable-items — accepts flat manual macros or AI-estimated product */
  create(item: CreateReusableItemInput): Promise<{ item: ReusableItem }> {
    return apiClient.post<{ item: ReusableItem }>('/reusable-items', item).then((r) => r.data);
  },
};
