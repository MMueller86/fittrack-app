// nutritionValidator.ts — Server-side plausibility checks for AI-estimated nutrition values.
//
// AI models can hallucinate nutritional values (e.g. 800 kcal/100g for lettuce).
// This module is the hard gate: invalid estimates are rejected with 422 before
// reaching the client. It is a pure function with no external dependencies.
//
// Rules are based on known food science limits:
//   - Pure fat (oil) = ~900 kcal/100g — hard upper bound
//   - Pure protein/carbs = ~4 kcal/g → max realistic ~100g/100g
//   - Protein + carbs + fat cannot exceed 100g (dry weight basis, with 5g tolerance for rounding)
//   - Salt > 10g/100g exists (e.g. table salt itself) but is highly suspicious for foods
//   - Fiber > 20g/100g is suspicious for most foods

export interface NutritionEstimateInput {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  salt?: number;
}

export interface NutritionValidationResult {
  valid: boolean;
  /** Hard errors — estimate is rejected if any exist */
  errors: string[];
  /** Soft warnings — estimate is accepted but warnings are forwarded to client */
  warnings: string[];
}

/**
 * Validates an AI-generated nutrition estimate per 100g.
 * Returns { valid, errors, warnings }.
 *
 * Errors → 422, estimate is blocked.
 * Warnings → forwarded to client, estimate proceeds.
 */
export function validateNutritionEstimate(
  input: NutritionEstimateInput,
): NutritionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { calories, protein, carbs, fat, fiber, salt } = input;

  // --- Hard errors ---

  // Non-finite values
  for (const [label, val] of [
    ['calories', calories],
    ['protein', protein],
    ['carbs', carbs],
    ['fat', fat],
  ] as [string, number][]) {
    if (!Number.isFinite(val) || val < 0) {
      errors.push(`${label} must be a non-negative finite number (got ${val})`);
    }
  }

  // Calorie ceiling: pure fat = ~900 kcal/100g
  if (Number.isFinite(calories) && calories > 900) {
    errors.push(`calories (${calories}) exceed the maximum of 900 kcal per 100g`);
  }

  // Single macro ceiling: no single macro can exceed 100g per 100g of food
  if (Number.isFinite(protein) && protein > 100) {
    errors.push(`protein (${protein}g) cannot exceed 100g per 100g`);
  }
  if (Number.isFinite(carbs) && carbs > 100) {
    errors.push(`carbs (${carbs}g) cannot exceed 100g per 100g`);
  }
  if (Number.isFinite(fat) && fat > 100) {
    errors.push(`fat (${fat}g) cannot exceed 100g per 100g`);
  }

  // Macro sum: protein + carbs + fat ≤ 105 (5g tolerance for rounding)
  if (Number.isFinite(protein) && Number.isFinite(carbs) && Number.isFinite(fat)) {
    const macroSum = protein + carbs + fat;
    if (macroSum > 105) {
      errors.push(
        `protein + carbs + fat = ${macroSum.toFixed(1)}g, which exceeds 100g per 100g (tolerance 5g for rounding)`,
      );
    }
  }

  // Fiber cannot exceed carbs (fiber is a subset of carbohydrates)
  if (fiber != null && Number.isFinite(fiber)) {
    if (fiber < 0) {
      errors.push(`fiber (${fiber}g) cannot be negative`);
    } else if (Number.isFinite(carbs) && fiber > carbs + 1) {
      // 1g tolerance for rounding
      errors.push(`fiber (${fiber}g) cannot exceed carbs (${carbs}g) — fiber is a subset of carbs`);
    }
  }

  // --- Soft warnings ---

  // Salt > 10g/100g is highly suspicious for consumer foods
  if (salt != null && Number.isFinite(salt) && salt > 10) {
    warnings.push(`salt (${salt}g/100g) is unusually high — please verify`);
  }

  // Fiber > 20g/100g is suspicious for most foods
  if (fiber != null && Number.isFinite(fiber) && fiber > 20) {
    warnings.push(`fiber (${fiber}g/100g) is unusually high — please verify`);
  }

  // Very low calories for a non-zero macro sum (possible hallucination)
  if (
    Number.isFinite(calories) &&
    Number.isFinite(protein) &&
    Number.isFinite(carbs) &&
    Number.isFinite(fat)
  ) {
    const estimatedCalories = protein * 4 + carbs * 4 + fat * 9;
    const deviation = Math.abs(calories - estimatedCalories);
    // Allow up to 20% deviation from the 4/4/9 rule (fiber contributes ~2 kcal/g which is ignored here)
    if (estimatedCalories > 5 && deviation / estimatedCalories > 0.25) {
      warnings.push(
        `calories (${calories} kcal) deviate significantly from macro-based estimate (${Math.round(estimatedCalories)} kcal) — AI may have been inconsistent`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
