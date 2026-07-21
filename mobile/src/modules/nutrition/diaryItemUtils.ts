// diaryItemUtils — helpers for copying/moving diary items while preserving sourceId links.
//
// buildCopyPayload() implements 4-case logic:
//   1. gram-based item WITH sourceId  → productId + amountGrams (server recalculates from ReusableItem)
//   2. portion-based item WITH sourceId + portionWeightGrams → productId + amountGrams (derived) + portion mode
//   3. portion-based item WITH sourceId but NO portionWeightGrams → flat macros fallback
//   4. no sourceId (AI, manual) → flat macros + all aiMealEstimate* fields

import type { DiaryDayResponse, MealItem, MealType, ReusableItem } from '@fittrack/shared';
import type { AddItemInput } from '../../shared/api/diaryApi';

export async function applyAddMeal(params: {
  type: MealType;
  date: string;
  tempId: string;
  setData: (updater: (prev: DiaryDayResponse | null) => DiaryDayResponse | null) => void;
  showSnackbar: (opts: { message: string }) => void;
  loadDay: (date: string) => Promise<boolean>;
  createMeal: (date: string, type: MealType) => Promise<unknown>;
  mealLabels: Record<MealType, string>;
}): Promise<void> {
  const { type, date, tempId, setData, showSnackbar, loadDay, createMeal } = params;

  try {
    await createMeal(date, type);
  } catch {
    setData((prev) =>
      prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== tempId) } : prev,
    );
    showSnackbar({ message: 'Mahlzeit konnte nicht angelegt werden.' });
    return;
  }

  const synced = await loadDay(date);
  if (!synced) {
    setData((prev) =>
      prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== tempId) } : prev,
    );
    showSnackbar({ message: 'Ansicht konnte nicht aktualisiert werden. Bitte einmal nach unten ziehen.' });
  }
}

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
