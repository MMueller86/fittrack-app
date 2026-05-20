// AI API — meal parser + food nutrition estimator
import { apiClient } from './client';
import type { FoodSearchResult, AiFoodEstimatePreview } from '@fittrack/shared';

// Re-export for convenience so callers don't need to import from @fittrack/shared directly
export type { AiFoodEstimatePreview };

// ---------------------------------------------------------------------------
// Types — mirror backend MealParserPreviewItem
// ---------------------------------------------------------------------------

export type ItemStatus = 'matched' | 'needsSelection' | 'unmatched';

export interface MealParserPreviewItem {
  rawText: string;
  displayName: string;
  status: ItemStatus;
  selectedProductId: string | null;
  selectedProductName: string | null;
  candidates: FoodSearchResult[];
  inputMode: 'grams' | 'portion' | 'unknown';
  inputAmount: number | null;
  amountGrams: number | null;
  needsReview: boolean;
  warnings: string[];
}

export interface MealParserPreviewResponse {
  items: MealParserPreviewItem[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const aiApi = {
  /** POST /api/ai/meal-parser/preview — parse free-text meal and match against internal DB */
  previewMeal(text: string): Promise<MealParserPreviewResponse> {
    return apiClient
      .post<MealParserPreviewResponse>('/ai/meal-parser/preview', { text })
      .then((r) => r.data);
  },

  /** POST /api/ai/food-estimate/preview — estimate nutrition for an unmatched food item */
  estimateFood(input: { name: string; contextText?: string }): Promise<AiFoodEstimatePreview> {
    return apiClient
      .post<AiFoodEstimatePreview>('/ai/food-estimate/preview', input)
      .then((r) => r.data);
  },
};

