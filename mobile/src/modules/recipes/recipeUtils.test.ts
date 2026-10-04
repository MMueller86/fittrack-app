import { describe, expect, it } from 'vitest';
import {
  computeRecipeQuickEntryData,
  resolveRecipeQuickEntryPortions,
} from './recipeUtils';

type RecipeQuickEntrySource = Parameters<typeof computeRecipeQuickEntryData>[0];

function makeRecipe(overrides: Partial<RecipeQuickEntrySource> = {}): RecipeQuickEntrySource {
  return {
    portions: 4,
    ingredients: [{ amountGrams: 1200 }],
    nutritionPerPortion: {
      calories: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
      fiber: 5,
    },
    ...overrides,
  };
}

describe('resolveRecipeQuickEntryPortions', () => {
  it('converts a saved gram preference using the recipe weight per portion', () => {
    expect(resolveRecipeQuickEntryPortions(makeRecipe(), {
      inputMode: 'grams',
      inputAmount: 450,
    })).toBe(1.5);
  });

  it('preserves a saved portion preference exactly', () => {
    expect(resolveRecipeQuickEntryPortions(makeRecipe(), {
      inputMode: 'portion',
      inputAmount: 1.2345,
    })).toBe(1.2345);
  });

  it('uses the existing 300g fallback when recipe ingredient weight is unavailable', () => {
    const recipe = makeRecipe({ ingredients: [{ amountGrams: null }] });

    expect(computeRecipeQuickEntryData(recipe).portion.weightGrams).toBe(300);
    expect(resolveRecipeQuickEntryPortions(recipe, {
      inputMode: 'grams',
      inputAmount: 150,
    })).toBe(0.5);
  });
});