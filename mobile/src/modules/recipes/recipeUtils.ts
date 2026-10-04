import type { Recipe, NutritionValues, PortionInfo } from '@fittrack/shared';

type RecipeQuickEntrySource = Pick<Recipe, 'nutritionPerPortion'> & {
  portions?: number | null;
  ingredients?: ReadonlyArray<{ amountGrams: number | null }> | null;
};

export interface RecipeQuickEntryPrefill {
  inputMode?: 'grams' | 'portion';
  inputAmount?: number;
}

export function computeRecipeQuickEntryData(recipe: RecipeQuickEntrySource): {
  nutritionPer100g: NutritionValues;
  portion: PortionInfo;
} {
  const totalGrams = recipe.ingredients?.reduce(
    (sum, ingredient) => sum + (ingredient.amountGrams ?? 0),
    0,
  ) ?? 0;
  const portionWeightGrams =
    totalGrams > 0 ? Math.max(totalGrams / (recipe.portions ?? 1), 1) : 300;

  return {
    nutritionPer100g: {
      calories: (recipe.nutritionPerPortion.calories / portionWeightGrams) * 100,
      protein: (recipe.nutritionPerPortion.protein / portionWeightGrams) * 100,
      carbs: (recipe.nutritionPerPortion.carbs / portionWeightGrams) * 100,
      fat: (recipe.nutritionPerPortion.fat / portionWeightGrams) * 100,
      ...(recipe.nutritionPerPortion.fiber != null && {
        fiber: (recipe.nutritionPerPortion.fiber / portionWeightGrams) * 100,
      }),
    },
    portion: { label: 'Portion', weightGrams: portionWeightGrams },
  };
}

export function resolveRecipeQuickEntryPortions(
  recipe: RecipeQuickEntrySource,
  prefill?: RecipeQuickEntryPrefill,
): number {
  const amount = prefill?.inputAmount;
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 1;
  if (prefill?.inputMode === 'portion') return amount;
  if (prefill?.inputMode === 'grams') {
    const weightGrams = computeRecipeQuickEntryData(recipe).portion.weightGrams ?? 300;
    return amount / weightGrams;
  }
  return 1;
}
