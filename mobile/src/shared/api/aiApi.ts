// AI API — meal parser + food nutrition estimator + label scan
import { apiClient } from './client';
import type { FoodSearchResult, AiFoodEstimatePreview, NutritionLabelScanResult } from '@fittrack/shared';

// Re-export for convenience so callers don't need to import from @fittrack/shared directly
export type { AiFoodEstimatePreview, NutritionLabelScanResult };

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
      .post<MealParserPreviewResponse>('/ai/meal-parser/preview', { text }, { timeout: 60_000 })
      .then((r) => r.data);
  },

  /** POST /api/ai/food-estimate/preview — estimate nutrition for an unmatched food item */
  estimateFood(input: { name: string; contextText?: string }): Promise<AiFoodEstimatePreview> {
    return apiClient
      .post<AiFoodEstimatePreview>('/ai/food-estimate/preview', input, { timeout: 60_000 })
      .then((r) => r.data);
  },

  /** POST /api/ai/label-scan — OCR + AI parse a nutrition label image */
  scanLabel(imageUri: string, mimeType: 'image/jpeg' | 'image/png'): Promise<NutritionLabelScanResult> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: mimeType,
      name: `label.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    } as unknown as Blob);

    return apiClient
      .post<NutritionLabelScanResult>('/ai/label-scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000, // OCR + AI can take 20-30s
      })
      .then((r) => r.data);
  },
};

