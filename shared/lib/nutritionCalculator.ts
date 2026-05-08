// Nutrition calculator — canonical implementation shared by backend and mobile.
//
// Design:
//   - Always calculates from nutritionPer100g (never parses portion.label).
//   - For portion mode: convert inputAmount × portionWeightGrams → grams, then scale.
//   - fiber is optional in CalculatedNutrition; backends that require a non-nullable
//     fiber field (MealItemMacros) should default to 0 after calling scaleNutritionToGrams.

import type { NutritionValues } from '../types/diary';

export type InputMode = 'grams' | 'portion';

/** Nutrition preview result — fiber is omitted when not present in the source product. */
export interface CalculatedNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface NutritionCalculationResult {
  amountGrams: number;
  calculatedNutrition: CalculatedNutrition;
}

export class NutritionCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NutritionCalculationError';
  }
}

/**
 * Resolves the gram amount from user input.
 * - 'grams'  : amountGrams = inputAmount
 * - 'portion': amountGrams = inputAmount × portionWeightGrams
 */
export function resolveAmountGrams(
  inputMode: InputMode,
  inputAmount: number,
  portionWeightGrams?: number,
): number {
  if (inputMode === 'grams') return inputAmount;
  if (portionWeightGrams == null) {
    throw new NutritionCalculationError('portionWeightGrams is required for portion input mode');
  }
  return inputAmount * portionWeightGrams;
}

/**
 * Scales per-100g nutrition values to the given gram amount.
 * Rounds each value to 1 decimal to suppress floating-point noise.
 * fiber is only included in the result when present on the source object.
 */
export function scaleNutritionToGrams(
  nutritionPer100g: NutritionValues,
  grams: number,
): CalculatedNutrition {
  const factor = grams / 100;
  const r = (v: number) => Math.round(v * factor * 10) / 10;
  const result: CalculatedNutrition = {
    calories: r(nutritionPer100g.calories),
    protein: r(nutritionPer100g.protein),
    carbs: r(nutritionPer100g.carbs),
    fat: r(nutritionPer100g.fat),
  };
  if (nutritionPer100g.fiber != null) {
    result.fiber = r(nutritionPer100g.fiber);
  }
  return result;
}

/**
 * Full pipeline: resolve grams from user input, then scale nutritionPer100g.
 * Throws NutritionCalculationError for invalid inputs.
 */
export function calculateNutrition(
  inputMode: InputMode,
  inputAmount: number,
  nutritionPer100g: NutritionValues,
  portionWeightGrams?: number,
): NutritionCalculationResult {
  if (!Number.isFinite(inputAmount) || inputAmount < 0) {
    throw new NutritionCalculationError('inputAmount must be a non-negative number');
  }
  const amountGrams = resolveAmountGrams(inputMode, inputAmount, portionWeightGrams);
  const calculatedNutrition = scaleNutritionToGrams(nutritionPer100g, amountGrams);
  return { amountGrams, calculatedNutrition };
}
