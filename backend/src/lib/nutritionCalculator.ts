// Nutrition calculator — backend wrapper around the shared canonical implementation.
//
// Core logic lives in shared/lib/nutritionCalculator.ts.
// Runtime imports use relative paths so that TypeScript rewrites them correctly
// in the CommonJS dist output (path aliases are not rewritten by tsc).

import type { MealItemMacros, NutritionValues } from '@fittrack/shared';
import {
  NutritionCalculationError,
  scaleNutritionToGrams,
} from '../../../shared/lib/nutritionCalculator';

export { NutritionCalculationError } from '../../../shared/lib/nutritionCalculator';
export type { InputMode, CalculatedNutrition, NutritionCalculationResult } from '../../../shared/lib/nutritionCalculator';
export { resolveAmountGrams, scaleNutritionToGrams, calculateNutrition } from '../../../shared/lib/nutritionCalculator';

export type QuantityMode = 'grams' | 'portions';

export interface CalculationInput {
  quantityMode: QuantityMode;
  quantity: number;
  nutritionPer100g?: NutritionValues;
  portionNutrition?: NutritionValues;
}

/** Converts CalculatedNutrition (fiber optional) to MealItemMacros (fiber required). */
function toMealItemMacros(nutrition: ReturnType<typeof scaleNutritionToGrams>): MealItemMacros {
  return {
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    fiber: nutrition.fiber ?? 0,
  };
}

/**
 * Calculate macros for a given quantity from 100g reference data.
 */
export function calculateFromGrams(
  grams: number,
  nutritionPer100g: NutritionValues,
): MealItemMacros {
  if (!Number.isFinite(grams) || grams < 0) {
    throw new NutritionCalculationError('Quantity in grams must be a non-negative number');
  }
  return toMealItemMacros(scaleNutritionToGrams(nutritionPer100g, grams));
}

/**
 * Calculate macros for a given number of portions using pre-computed portion nutrition.
 * @param portions - Number of portions (can be fractional, e.g. 0.5)
 * @param portionNutrition - Macro values for exactly 1 portion
 */
export function calculateFromPortions(
  portions: number,
  portionNutrition: NutritionValues,
): MealItemMacros {
  if (!Number.isFinite(portions) || portions < 0) {
    throw new NutritionCalculationError('Number of portions must be a non-negative number');
  }
  return toMealItemMacros(scaleNutritionToGrams(portionNutrition, portions * 100));
}

/**
 * Unified calculator — delegates to the right method based on quantityMode.
 * Throws NutritionCalculationError if the required reference data is missing.
 */
export function calculate(input: CalculationInput): MealItemMacros {
  const { quantityMode, quantity, nutritionPer100g, portionNutrition } = input;

  if (quantityMode === 'grams') {
    if (!nutritionPer100g) {
      throw new NutritionCalculationError(
        'Cannot calculate from grams: nutritionPer100g is not available for this item',
      );
    }
    return calculateFromGrams(quantity, nutritionPer100g);
  }

  // quantityMode === 'portions'
  if (!portionNutrition) {
    throw new NutritionCalculationError(
      'Cannot calculate from portions: portion nutrition data is not available for this item',
    );
  }
  return calculateFromPortions(quantity, portionNutrition);
}
