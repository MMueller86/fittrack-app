// diaryItemUtils — helpers for copying/moving diary items while preserving sourceId links.
//
// buildCopyPayload() implements 4-case logic:
//   1. gram-based item WITH sourceId  → productId + amountGrams (server recalculates from ReusableItem)
//   2. portion-based item WITH sourceId + portionWeightGrams → productId + amountGrams (derived) + portion mode
//   3. portion-based item WITH sourceId but NO portionWeightGrams → flat macros fallback
//   4. no sourceId (AI, manual) → flat macros + all aiMealEstimate* fields

import type { MealItem, ReusableItem } from '@fittrack/shared';
import type { AddItemInput } from '../../shared/api/diaryApi';

export function buildCopyPayload(
  item: MealItem,
  sourceProduct: ReusableItem | null,
): AddItemInput {
  const portionWeightGrams = sourceProduct?.portion?.weightGrams;

  // Case 1: gram-based with sourceId — server recalculates authoritative macros
  if (item.sourceId && item.unit === 'g') {
    return {
      productId: item.sourceId,
      productName: item.name,
      inputMode: 'grams',
      inputAmount: item.quantity,
      amountGrams: item.quantity,
      calculatedNutrition: {
        calories: item.macros.calories,
        protein: item.macros.protein,
        carbs: item.macros.carbs,
        fat: item.macros.fat,
        fiber: item.macros.fiber,
      },
    };
  }

  // Case 2: portion-based with sourceId AND portionWeightGrams available
  if (item.sourceId && item.unit === 'portion' && portionWeightGrams) {
    return {
      productId: item.sourceId,
      productName: item.name,
      inputMode: 'portion',
      inputAmount: item.quantity,
      amountGrams: item.quantity * portionWeightGrams,
      calculatedNutrition: {
        calories: item.macros.calories,
        protein: item.macros.protein,
        carbs: item.macros.carbs,
        fat: item.macros.fat,
        fiber: item.macros.fiber,
      },
    };
  }

  // Case 3 & 4: flat macros fallback (portion without portionGrams, or no sourceId)
  const base: AddItemInput = {
    name: item.name,
    calories: item.macros.calories,
    protein: item.macros.protein,
    carbs: item.macros.carbs,
    fat: item.macros.fat,
    fiber: item.macros.fiber,
    quantity: item.quantity,
    unit: item.unit,
    isAiEstimate: item.isAiEstimate,
  };

  // Preserve AI meal estimate metadata for Case 4
  if (item.sourceType === 'ai-meal-estimate') {
    return {
      ...base,
      sourceType: 'ai-meal-estimate',
      ...(item.aiMealEstimateComponents ? { aiMealEstimateComponents: item.aiMealEstimateComponents } : {}),
      ...(item.aiMealEstimateContext ? { aiMealEstimateContext: item.aiMealEstimateContext } : {}),
      ...(item.aiMealEstimateConfidence ? { aiMealEstimateConfidence: item.aiMealEstimateConfidence } : {}),
      ...(item.aiMealEstimateAssumptions ? { aiMealEstimateAssumptions: item.aiMealEstimateAssumptions } : {}),
      ...(item.aiMealEstimatePhotoUsed ? { aiMealEstimatePhotoUsed: item.aiMealEstimatePhotoUsed } : {}),
    };
  }

  return base;
}
