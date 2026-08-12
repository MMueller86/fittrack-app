import { describe, expect, it } from 'vitest';
import type { RecipeIngredient } from '@fittrack/shared';
import {
  buildRecipePreviewViewModel,
  formatRecipeIngredientAmount,
} from './recipePreviewViewModel';

function makeIngredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    id: 'ingredient-1',
    displayName: 'Zutat',
    inputMode: 'grams',
    inputAmount: 100,
    amountGrams: 100,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    nutritionPer100g: { calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 1 },
    nutritionContribution: { calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 1 },
    ...overrides,
  };
}

describe('recipePreviewViewModel', () => {
  it('groups ingredients in food-first order and preserves order within each group', () => {
    const viewModel = buildRecipePreviewViewModel([
      makeIngredient({ id: 'seasoning-1', displayName: 'Salz', category: 'seasoning', amountLabel: '1 TL' }),
      makeIngredient({ id: 'food-1', displayName: 'Reis' }),
      makeIngredient({ id: 'seasoning-2', displayName: 'Pfeffer', category: 'seasoning', amountLabel: '1 Prise' }),
      makeIngredient({ id: 'food-2', displayName: 'Erbsen' }),
    ]);

    expect(viewModel.groups.map((group) => group.category)).toEqual(['food', 'seasoning']);
  expect(viewModel.groups.map((group) => group.title)).toEqual(['Hauptzutaten', 'Gewürze & Kräuter']);
    expect(viewModel.groups[0]?.ingredients.map(({ ingredient }) => ingredient.id)).toEqual(['food-1', 'food-2']);
    expect(viewModel.groups[1]?.ingredients.map(({ ingredient }) => ingredient.id)).toEqual(['seasoning-1', 'seasoning-2']);
  });

  it('uses a seasoning persistent amountLabel', () => {
    const ingredient = makeIngredient({
      category: 'seasoning',
      inputAmount: null,
      amountGrams: null,
      amountLabel: 'nach Geschmack',
    });

    expect(formatRecipeIngredientAmount(ingredient)).toBe('nach Geschmack');
    expect(buildRecipePreviewViewModel([ingredient]).groups[1]?.ingredients[0]?.amountLabel).toBe('nach Geschmack');
  });

  it('omits an indeterminate zero amount instead of rendering 0 g', () => {
    const ingredient = makeIngredient({
      category: 'seasoning',
      inputAmount: null,
      amountGrams: 0,
      amountLabel: undefined,
    });

    expect(formatRecipeIngredientAmount(ingredient)).toBeNull();
    expect(buildRecipePreviewViewModel([ingredient]).groups[1]?.ingredients[0]?.amountLabel).toBeNull();
  });

  it('falls back to resolved grams for a food ingredient without an input amount', () => {
    const ingredient = makeIngredient({ inputAmount: null, amountGrams: 125 });

    expect(formatRecipeIngredientAmount(ingredient)).toBe('125 g');
  });

  it('does not render 0 g when a food input amount is nonpositive', () => {
    const ingredient = makeIngredient({ inputAmount: 0, amountGrams: 125 });

    expect(formatRecipeIngredientAmount(ingredient)).toBe('125 g');
  });
});