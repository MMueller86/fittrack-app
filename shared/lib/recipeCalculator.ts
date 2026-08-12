// Recipe nutrition calculator.
// Aggregates ingredient contributions and divides by portion count.
// Pure functions — no side effects, easily testable.

import type { RecipeIngredient, RecipeNutrition } from '../types/recipes';
import { scaleNutritionToGrams } from './nutritionCalculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function divideNutrition(n: RecipeNutrition, divisor: number): RecipeNutrition {
  if (divisor <= 0) throw new Error('portions must be greater than 0');
  return {
    calories: round1(n.calories / divisor),
    protein: round1(n.protein / divisor),
    carbs: round1(n.carbs / divisor),
    fat: round1(n.fat / divisor),
    fiber: round1(n.fiber / divisor),
  };
}

function zeroNutrition(): RecipeNutrition {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

// ---------------------------------------------------------------------------
// Ingredient contribution
// ---------------------------------------------------------------------------

/**
 * Calculate the nutrition contribution of a single ingredient.
 * Seasonings and ingredients without a resolved gram amount contribute zero.
 */
export function calculateIngredientContribution(ingredient: RecipeIngredient): RecipeNutrition {
  if (ingredient.category === 'seasoning' || ingredient.amountGrams == null) {
    return zeroNutrition();
  }

  const scaled = scaleNutritionToGrams(
    {
      calories: ingredient.nutritionPer100g.calories,
      protein: ingredient.nutritionPer100g.protein,
      carbs: ingredient.nutritionPer100g.carbs,
      fat: ingredient.nutritionPer100g.fat,
      fiber: ingredient.nutritionPer100g.fiber,
    },
    ingredient.amountGrams,
  );
  return {
    calories: scaled.calories,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    fiber: scaled.fiber ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Recipe totals
// ---------------------------------------------------------------------------

export interface RecipeNutritionResult {
  nutritionTotal: RecipeNutrition;
  nutritionPerPortion: RecipeNutrition;
}

/**
 * Calculate total and per-portion nutrition from a list of ingredients.
 * Food ingredients require a resolved gram amount; seasonings and indeterminate
 * ingredients contribute zero.
 *
 * @param ingredients  Array of recipe ingredients.
 * @param portions     Number of portions the recipe yields (must be > 0).
 */
export function calculateRecipeNutrition(
  ingredients: RecipeIngredient[],
  portions: number,
): RecipeNutritionResult {
  if (portions <= 0) throw new Error('portions must be greater than 0');

  const total = zeroNutrition();

  for (const ingredient of ingredients) {
    const contribution = calculateIngredientContribution(ingredient);
    total.calories += contribution.calories;
    total.protein += contribution.protein;
    total.carbs += contribution.carbs;
    total.fat += contribution.fat;
    total.fiber += contribution.fiber;
  }

  // Round totals
  const nutritionTotal: RecipeNutrition = {
    calories: round1(total.calories),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
    fiber: round1(total.fiber),
  };

  const nutritionPerPortion = divideNutrition(nutritionTotal, portions);

  return { nutritionTotal, nutritionPerPortion };
}
