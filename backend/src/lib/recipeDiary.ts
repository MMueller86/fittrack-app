import type { Meal } from '@fittrack/shared';
import { resolveRecipeForRead } from './communityRecipes';
import { getDiaryRepository } from './repositories/diaryRepository';
import { getRecipesRepository } from './repositories/recipesRepository';
import { getUserFoodRelationRepository } from './repositories/userFoodRelationRepository';

export type RecipeDiaryInput = {
  inputMode: 'grams' | 'portion';
  inputAmount: number;
};

export type RecipeDiaryResult =
  | { ok: true; meal: Meal }
  | { ok: false; reason: 'invalid_portions' | 'meal_not_found' | 'recipe_not_found' };

export async function addRecipeDiarySnapshot(
  userId: string,
  recipeId: string,
  mealId: string,
  input: RecipeDiaryInput,
): Promise<RecipeDiaryResult> {
  const diary = getDiaryRepository();
  const targetMeal = await diary.getMealById(userId, mealId);
  if (!targetMeal) return { ok: false, reason: 'meal_not_found' };

  const resolved = await resolveRecipeForRead(userId, recipeId);
  if (!resolved.recipe) return { ok: false, reason: 'recipe_not_found' };
  const recipe = resolved.recipe;

  let portions = input.inputAmount;
  if (input.inputMode === 'grams') {
    const totalGrams = recipe.ingredients.reduce((sum, ingredient) => sum + (ingredient.amountGrams ?? 0), 0);
    const portionWeightGrams = totalGrams > 0
      ? Math.max(totalGrams / (recipe.portions ?? 1), 1)
      : 300;
    portions = input.inputAmount / portionWeightGrams;
  }
  if (!Number.isFinite(portions) || portions <= 0 || portions > 50) {
    return { ok: false, reason: 'invalid_portions' };
  }

  const snapshot = {
    calories: Math.round(recipe.nutritionPerPortion.calories * portions * 10) / 10,
    protein: Math.round(recipe.nutritionPerPortion.protein * portions * 10) / 10,
    carbs: Math.round(recipe.nutritionPerPortion.carbs * portions * 10) / 10,
    fat: Math.round(recipe.nutritionPerPortion.fat * portions * 10) / 10,
    fiber: Math.round(recipe.nutritionPerPortion.fiber * portions * 10) / 10,
  };
  const meal = await diary.addItem(userId, mealId, {
    name: recipe.name,
    ...snapshot,
    quantity: portions,
    unit: portions === 1 ? 'Portion' : 'Portionen',
    sourceType: 'recipe',
    recipeId: recipe.id,
    recipePortions: portions,
  });

  const recipes = getRecipesRepository();
  void recipes.incrementUsage(resolved.ownerUserId, recipe.id).catch(() => {});
  void getUserFoodRelationRepository().recordUsage(userId, {
    foodRef: recipe.id,
    foodRefType: 'recipe',
    displayName: recipe.name,
    lastInputMode: input.inputMode,
    lastInputAmount: input.inputAmount,
    mealType: meal.type,
    usageDate: meal.date,
  }).catch(() => {});

  return { ok: true, meal };
}