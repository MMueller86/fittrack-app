import type { Recipe, NutritionValues, PortionInfo } from '@fittrack/shared';

export function computeRecipeQuickEntryData(recipe: Recipe): {
  nutritionPer100g: NutritionValues;
  portion: PortionInfo;
} {
  const totalGrams = recipe.ingredients?.reduce((s, i) => s + (i.amountGrams ?? 0), 0) ?? 0;
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
