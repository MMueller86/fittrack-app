// Builder functions for RecipeIngredient — used by RecipeWizardScreen.
// Extracted to this module so they can be unit-tested independently of React Native.
import { randomUUID } from 'expo-crypto';
import type {
  AiFoodEstimatePreview,
  FoodSearchResult,
  RecipeIngredient,
  RecipeIngredientInputMode,
} from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';

// ---------------------------------------------------------------------------
// Recipe ingredient builders
// ---------------------------------------------------------------------------

export function buildFromProduct(
  product: FoodSearchResult,
  mode: RecipeIngredientInputMode,
  amount: number,
): RecipeIngredient {
  const portionWeightGrams = product.portion?.weightGrams;
  const portionLabel = product.portion?.label;
  const hasPortion = portionWeightGrams != null && portionWeightGrams > 0;
  const amountGrams =
    mode === 'portion' && hasPortion ? amount * portionWeightGrams! : amount;
  const raw = product.nutritionPer100g;
  const n = {
    calories: raw?.calories ?? 0,
    protein: raw?.protein ?? 0,
    carbs: raw?.carbs ?? 0,
    fat: raw?.fat ?? 0,
    fiber: raw?.fiber ?? 0,
  };
  const scale = amountGrams / 100;
  return {
    id: randomUUID(),
    displayName: product.name,
    inputMode: mode,
    inputAmount: amount,
    amountGrams,
    unit: mode === 'portion' ? (portionLabel ?? 'Portion') : 'g',
    category: 'food',
    linkedProductId: product.id,
    linkedReusableItemId: null,
    isAiEstimate: false,
    portionWeightGrams: hasPortion ? portionWeightGrams : undefined,
    portionLabel: hasPortion ? (portionLabel ?? 'Portion') : undefined,
    nutritionPer100g: n,
    nutritionContribution: {
      calories: Math.round(n.calories * scale * 10) / 10,
      protein: Math.round(n.protein * scale * 10) / 10,
      carbs: Math.round(n.carbs * scale * 10) / 10,
      fat: Math.round(n.fat * scale * 10) / 10,
      fiber: Math.round(n.fiber * scale * 10) / 10,
    },
  };
}

// ---------------------------------------------------------------------------
// RecipeWizardScreen builders
// ---------------------------------------------------------------------------

export function buildIngFromCandidate(
  id: string,
  item: MealParserPreviewItem,
  candidate: FoodSearchResult,
): RecipeIngredient {
  const portionWeightGrams = candidate.portion?.weightGrams;
  const portionLabel = candidate.portion?.label;
  const hasPortions = portionWeightGrams != null && portionWeightGrams > 0;

  // Preserve portion mode when both the parser and the product support it.
  const inputMode: 'grams' | 'portion' =
    item.inputMode === 'portion' && hasPortions ? 'portion' : 'grams';

  const inputAmount = item.inputAmount ?? (hasPortions && inputMode === 'portion' ? 1 : 100);
  const amountGrams =
    inputMode === 'portion'
      ? inputAmount * portionWeightGrams!
      : (item.amountGrams ?? inputAmount);

  const raw = candidate.nutritionPer100g;
  const n = {
    calories: raw?.calories ?? 0,
    protein: raw?.protein ?? 0,
    carbs: raw?.carbs ?? 0,
    fat: raw?.fat ?? 0,
    fiber: raw?.fiber ?? 0,
  };
  const scale = amountGrams / 100;
  return {
    id,
    displayName: candidate.name,
    inputMode,
    inputAmount,
    amountGrams,
    unit: inputMode === 'portion' ? (portionLabel ?? 'Portion') : 'g',
    category: 'food',
    linkedProductId: candidate.id,
    linkedReusableItemId: null,
    isAiEstimate: false,
    portionWeightGrams: hasPortions ? portionWeightGrams : undefined,
    portionLabel: hasPortions ? (portionLabel ?? 'Portion') : undefined,
    nutritionPer100g: n,
    nutritionContribution: {
      calories: Math.round(n.calories * scale * 10) / 10,
      protein: Math.round(n.protein * scale * 10) / 10,
      carbs: Math.round(n.carbs * scale * 10) / 10,
      fat: Math.round(n.fat * scale * 10) / 10,
      fiber: Math.round(n.fiber * scale * 10) / 10,
    },
  };
}

export function buildIngFromAiEstimate(
  id: string,
  item: MealParserPreviewItem,
  estimate: AiFoodEstimatePreview,
): RecipeIngredient {
  const amountGrams = item.amountGrams ?? item.inputAmount ?? 100;
  const e = estimate.estimatedNutritionPer100g;
  const n = {
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    fiber: e.fiber ?? 0,
  };
  const scale = amountGrams / 100;
  return {
    id,
    displayName: estimate.displayName,
    inputMode: item.inputMode === 'grams' ? 'grams' : 'portion',
    inputAmount: item.inputAmount ?? amountGrams,
    amountGrams,
    unit: item.inputMode === 'grams' ? 'g' : 'Stück',
    category: 'food',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: true,
    nutritionPer100g: n,
    nutritionContribution: {
      calories: Math.round(n.calories * scale * 10) / 10,
      protein: Math.round(n.protein * scale * 10) / 10,
      carbs: Math.round(n.carbs * scale * 10) / 10,
      fat: Math.round(n.fat * scale * 10) / 10,
      fiber: Math.round(n.fiber * scale * 10) / 10,
    },
  };
}

export function buildWizardIngredientFromAiEstimate(
  id: string,
  item: MealParserPreviewItem,
  estimate: AiFoodEstimatePreview,
): {
  status: 'confirmed';
  userConfirmed: true;
  resolvedIngredient: RecipeIngredient;
} {
  return {
    status: 'confirmed',
    userConfirmed: true,
    resolvedIngredient: buildIngFromAiEstimate(id, item, estimate),
  };
}

export function buildIngFromSeasoning(id: string, item: MealParserPreviewItem): RecipeIngredient {
  const amountGrams = item.amountGrams;
  const zero = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  return {
    id,
    displayName: item.displayName,
    inputMode: 'grams',
    inputAmount: amountGrams,
    amountGrams,
    unit: 'g',
    amountLabel: item.kitchenAmountText ?? undefined,
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    category: 'seasoning',
    nutritionPer100g: zero,
    nutritionContribution: zero,
  };
}
