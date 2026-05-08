// Thin re-export — canonical implementation lives in @fittrack/shared.
// Import from here within the mobile module for a stable local reference.
export type {
  InputMode,
  CalculatedNutrition,
  NutritionCalculationResult,
} from '@fittrack/shared';
export {
  NutritionCalculationError,
  resolveAmountGrams,
  scaleNutritionToGrams,
  calculateNutrition,
} from '@fittrack/shared';
