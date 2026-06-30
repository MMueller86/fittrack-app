// AI API — meal parser + food nutrition estimator + label scan + meal estimate
import { apiClient } from './client';
import type { FoodSearchResult, AiFoodEstimatePreview, NutritionLabelScanResult, AiMealEstimatePreview } from '@fittrack/shared';

// Re-export for convenience so callers don't need to import from @fittrack/shared directly
export type { AiFoodEstimatePreview, NutritionLabelScanResult, AiMealEstimatePreview };

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
// Types — mirror backend AiRecipeAnalysisResponse
// ---------------------------------------------------------------------------

export interface AiRecipeStep {
  order: number;
  title: string | null;
  description: string;
}

export interface AiRecipeAnalysis {
  suggestedName: string;
  description: string;
  suggestedPortions: number;
  tags: string[];
  steps: AiRecipeStep[];
  ingredients: MealParserPreviewItem[];
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const aiApi = {
  /**
   * POST /api/ai/meal-parser/preview — parse free-text meal and match against internal DB.
   * @param text     Food items as free text or comma-separated list.
   * @param context  Optional eating context (e.g. "Bäcker") — improves portion estimation.
   */
  previewMeal(text: string, context?: string): Promise<MealParserPreviewResponse> {
    return apiClient
      .post<MealParserPreviewResponse>('/ai/meal-parser/preview', { text, context }, { timeout: 60_000 })
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

  /**
   * POST /api/ai/meal-estimate/preview
   * Fast Path: estimate total meal nutrition + components in a single AI call.
   * When imageUri is provided, the request is sent as multipart/form-data
   * including the photo so the AI can use it to improve portion estimation.
   */
  estimateMeal(
    text: string,
    imageUri?: string,
    imageMimeType?: 'image/jpeg' | 'image/png',
  ): Promise<AiMealEstimatePreview> {
    if (imageUri && imageMimeType) {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('image', {
        uri: imageUri,
        type: imageMimeType,
        name: `meal.${imageMimeType === 'image/png' ? 'png' : 'jpg'}`,
      } as unknown as Blob);
      return apiClient
        .post<AiMealEstimatePreview>('/ai/meal-estimate/preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60_000,
        })
        .then((r) => r.data);
    }
    return apiClient
      .post<AiMealEstimatePreview>('/ai/meal-estimate/preview', { text }, { timeout: 60_000 })
      .then((r) => r.data);
  },

  /** POST /api/ai/recipe-analyze — parse freetext recipe into name, description, steps, and resolved ingredients */
  analyzeRecipe(text: string): Promise<AiRecipeAnalysis> {
    return apiClient
      .post<AiRecipeAnalysis>('/ai/recipe-analyze', { text }, { timeout: 90_000 })
      .then((r) => r.data);
  },

  /** POST /api/ai/food-estimate/batch — estimate nutrition for up to 10 items in one AI call */
  estimateFoodBatch(items: Array<{ name: string }>): Promise<AiFoodEstimatePreview[]> {
    return apiClient
      .post<{ results: AiFoodEstimatePreview[] }>('/ai/food-estimate/batch', { items }, { timeout: 60_000 })
      .then((r) => r.data.results);
  },
};

