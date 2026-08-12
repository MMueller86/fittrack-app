import { describe, it, expect } from 'vitest';
import { calculateRecipeNutrition, calculateIngredientContribution } from './recipeCalculator';
import type { RecipeIngredient } from '../types/recipes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIngredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    id: 'ing-1',
    displayName: 'Test Ingredient',
    inputMode: 'grams',
    inputAmount: 100,
    amountGrams: 100,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    nutritionPer100g: { calories: 200, protein: 10, carbs: 30, fat: 5, fiber: 2 },
    nutritionContribution: { calories: 200, protein: 10, carbs: 30, fat: 5, fiber: 2 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateIngredientContribution
// ---------------------------------------------------------------------------

describe('calculateIngredientContribution', () => {
  it('returns full nutrition for 100g', () => {
    const ing = makeIngredient({ amountGrams: 100 });
    const result = calculateIngredientContribution(ing);
    expect(result).toEqual({ calories: 200, protein: 10, carbs: 30, fat: 5, fiber: 2 });
  });

  it('scales correctly for 50g', () => {
    const ing = makeIngredient({ amountGrams: 50 });
    const result = calculateIngredientContribution(ing);
    expect(result.calories).toBe(100);
    expect(result.protein).toBe(5);
    expect(result.carbs).toBe(15);
    expect(result.fat).toBe(2.5);
    expect(result.fiber).toBe(1);
  });

  it('defaults fiber to 0 when nutritionPer100g.fiber is 0', () => {
    const ing = makeIngredient({
      amountGrams: 100,
      nutritionPer100g: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 0 },
    });
    expect(calculateIngredientContribution(ing).fiber).toBe(0);
  });

  it('handles 0g correctly (zero contribution)', () => {
    const ing = makeIngredient({ amountGrams: 0 });
    const result = calculateIngredientContribution(ing);
    expect(result).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it('returns zero for a seasoning even when nutrition data is present', () => {
    const ing = makeIngredient({
      category: 'seasoning',
      amountGrams: 5,
      nutritionPer100g: { calories: 300, protein: 10, carbs: 20, fat: 15, fiber: 4 },
    });
    expect(calculateIngredientContribution(ing)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });
  });

  it('returns zero when the gram amount is indeterminate', () => {
    const ing = makeIngredient({
      category: 'seasoning',
      amountLabel: 'nach Geschmack',
      inputAmount: null,
      amountGrams: null,
      nutritionPer100g: { calories: 300, protein: 10, carbs: 20, fat: 15, fiber: 4 },
    });
    expect(calculateIngredientContribution(ing)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });
  });

  it('treats a historical food ingredient without category as food', () => {
    const ing = makeIngredient({ amountGrams: 100 });

    expect(ing.category).toBeUndefined();
    expect(calculateIngredientContribution(ing)).toEqual({
      calories: 200,
      protein: 10,
      carbs: 30,
      fat: 5,
      fiber: 2,
    });
  });
});

// ---------------------------------------------------------------------------
// calculateRecipeNutrition
// ---------------------------------------------------------------------------

describe('calculateRecipeNutrition', () => {
  it('calculates total and per-portion for a single ingredient', () => {
    const ingredients = [makeIngredient({ amountGrams: 100 })];
    const { nutritionTotal, nutritionPerPortion } = calculateRecipeNutrition(ingredients, 2);
    expect(nutritionTotal).toEqual({ calories: 200, protein: 10, carbs: 30, fat: 5, fiber: 2 });
    expect(nutritionPerPortion).toEqual({ calories: 100, protein: 5, carbs: 15, fat: 2.5, fiber: 1 });
  });

  it('aggregates multiple ingredients', () => {
    const ingredients = [
      makeIngredient({ id: 'a', amountGrams: 100 }), // 200 kcal
      makeIngredient({
        id: 'b',
        amountGrams: 200,
        nutritionPer100g: { calories: 50, protein: 2, carbs: 5, fat: 1, fiber: 0.5 },
        nutritionContribution: { calories: 100, protein: 4, carbs: 10, fat: 2, fiber: 1 },
      }), // 100 kcal (200g @ 50kcal/100g)
    ];
    const { nutritionTotal, nutritionPerPortion } = calculateRecipeNutrition(ingredients, 1);
    expect(nutritionTotal.calories).toBe(300);
    expect(nutritionPerPortion.calories).toBe(300); // 1 portion
  });

  it('does not add an indeterminate seasoning to recipe nutrition', () => {
    const ingredients = [
      makeIngredient({ amountGrams: 100 }),
      makeIngredient({
        id: 'seasoning',
        category: 'seasoning',
        inputAmount: null,
        amountGrams: null,
        nutritionPer100g: { calories: 300, protein: 10, carbs: 20, fat: 15, fiber: 4 },
      }),
    ];
    const { nutritionTotal, nutritionPerPortion } = calculateRecipeNutrition(ingredients, 2);
    expect(nutritionTotal).toEqual({ calories: 200, protein: 10, carbs: 30, fat: 5, fiber: 2 });
    expect(nutritionPerPortion).toEqual({ calories: 100, protein: 5, carbs: 15, fat: 2.5, fiber: 1 });
  });

  it('divides correctly for fractional portions (4 portions)', () => {
    const ingredients = [makeIngredient({ amountGrams: 400 })]; // 800 kcal total
    const { nutritionTotal, nutritionPerPortion } = calculateRecipeNutrition(ingredients, 4);
    expect(nutritionTotal.calories).toBe(800);
    expect(nutritionPerPortion.calories).toBe(200);
  });

  it('returns zeros for empty ingredient list', () => {
    const { nutritionTotal, nutritionPerPortion } = calculateRecipeNutrition([], 4);
    expect(nutritionTotal).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    expect(nutritionPerPortion).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it('throws when portions <= 0', () => {
    expect(() => calculateRecipeNutrition([], 0)).toThrow('portions must be greater than 0');
    expect(() => calculateRecipeNutrition([], -1)).toThrow('portions must be greater than 0');
  });

  it('rounds to 1 decimal place', () => {
    // 10g @ 333.33 kcal/100g = 33.333 kcal → rounds to 33.3
    const ing = makeIngredient({
      amountGrams: 10,
      nutritionPer100g: { calories: 333.33, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    const { nutritionTotal } = calculateRecipeNutrition([ing], 1);
    expect(nutritionTotal.calories).toBe(33.3);
  });

  it('supports fractional portions (0.5)', () => {
    const ingredients = [makeIngredient({ amountGrams: 100 })]; // 200 kcal
    const { nutritionPerPortion } = calculateRecipeNutrition(ingredients, 0.5);
    expect(nutritionPerPortion.calories).toBe(400);
  });
});
