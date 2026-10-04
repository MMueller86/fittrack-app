import type { CommunityRecipe, CommunityRecipeIngredient, MealItem, Recipe, RecipeAccess, RecipeNutrition, UserFoodRelation } from '@fittrack/shared';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../shared/types/recipeImageHeroCrop';
import { effectiveIngredientNutritionSource } from './repositories/recipeIngredientProvenance';
import { getRecipesRepository, type RecipesRepository } from './repositories/recipesRepository';
import { getProfileRepository, type ProfileRepository } from './repositories/profileRepository';
import { stripRecipeRelationCache } from './repositories/userFoodRelationRepository';

export type ResolvedRecipeRead =
  | { access: 'owner' | 'community'; recipe: Recipe; ownerUserId: string }
  | { access: 'unavailable'; recipe: null };

export async function resolveRecipeForRead(
  userId: string,
  id: string,
  recipes: Pick<RecipesRepository, 'get' | 'getCommunityById'> = getRecipesRepository(),
): Promise<ResolvedRecipeRead> {
  const own = await recipes.get(userId, id);
  if (own && own.ownerUserId === userId) return { access: 'owner', recipe: own, ownerUserId: userId };
  const published = await recipes.getCommunityById(id);
  if (published?.visibility === 'community') {
    return { access: 'community', recipe: published, ownerUserId: published.ownerUserId };
  }
  return { access: 'unavailable', recipe: null };
}

function projectNutrition(nutrition: RecipeNutrition): RecipeNutrition {
  return { calories: nutrition.calories, protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat, fiber: nutrition.fiber };
}

export async function projectCommunityRecipe(
  recipe: Recipe,
  viewerUserId: string,
  imageApiPath: (recipeId: string, imageId: string) => string,
  profiles: Pick<ProfileRepository, 'get'> = getProfileRepository(),
): Promise<CommunityRecipe> {
  if (recipe.visibility !== 'community') throw new Error('Recipe is not published');
  let authorDisplayName = 'Anonymous';
  if (recipe.communityPublication?.displayNameConsent === true &&
      typeof recipe.communityPublication.contentConfirmedAt === 'string' &&
      Number.isFinite(Date.parse(recipe.communityPublication.contentConfirmedAt))) {
    const profile = await profiles.get(recipe.ownerUserId);
    authorDisplayName = profile?.displayName?.trim() || 'Anonymous';
  }
  const ingredients: CommunityRecipeIngredient[] = recipe.ingredients.map((ingredient) => ({
    id: ingredient.id,
    displayName: ingredient.displayName,
    inputMode: ingredient.inputMode,
    inputAmount: ingredient.inputAmount,
    amountGrams: ingredient.amountGrams,
    unit: ingredient.unit,
    ...(ingredient.amountLabel !== undefined ? { amountLabel: ingredient.amountLabel } : {}),
    ...(ingredient.category !== undefined ? { category: ingredient.category } : {}),
    ...(ingredient.portionWeightGrams !== undefined ? { portionWeightGrams: ingredient.portionWeightGrams } : {}),
    ...(ingredient.portionLabel !== undefined ? { portionLabel: ingredient.portionLabel } : {}),
    isAiEstimate: ingredient.isAiEstimate === true || ingredient.nutritionSource === 'ai',
    nutritionSource: effectiveIngredientNutritionSource(ingredient),
    nutritionPer100g: projectNutrition(ingredient.nutritionPer100g),
    nutritionContribution: projectNutrition(ingredient.nutritionContribution),
  }));
  return {
    id: recipe.id,
    name: recipe.name,
    ...(recipe.description !== undefined ? { description: recipe.description } : {}),
    portions: recipe.portions,
    ingredients,
    steps: recipe.steps.map(({ order, title, description }) => ({ order, ...(title !== undefined ? { title } : {}), description })),
    images: recipe.images.map((image) => {
      const url = imageApiPath(recipe.id, image.id);
      if (!url.startsWith('/api/') || /[?#\\]/.test(url)) throw new Error('Expected protected API image path');
      const crop = image.heroCrop ?? DEFAULT_RECIPE_IMAGE_HERO_CROP;
      return { id: image.id, order: image.order, url, heroCrop: { version: crop.version, frame: crop.frame, focusX: crop.focusX, focusY: crop.focusY, zoom: crop.zoom } };
    }),
    nutritionTotal: projectNutrition(recipe.nutritionTotal),
    nutritionPerPortion: projectNutrition(recipe.nutritionPerPortion),
    tags: [...recipe.tags],
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    authorDisplayName,
    isOwnRecipe: recipe.ownerUserId === viewerUserId,
    ingredientNotices: {
      containsAiEstimates: ingredients.some((ingredient) => ingredient.isAiEstimate),
      containsManualIngredients: ingredients.some((ingredient) => ingredient.nutritionSource === 'manual'),
    },
  };
}

export async function projectRecipeReferenceAccess<T extends UserFoodRelation | MealItem>(
  userId: string,
  reference: T,
  recipes: Pick<RecipesRepository, 'get' | 'getCommunityById'> = getRecipesRepository(),
): Promise<T & { recipeAccess?: RecipeAccess }> {
  const { recipeAccess, ...snapshot } = reference;
  const id = 'foodRefType' in reference
    ? (reference.foodRefType === 'recipe' ? reference.foodRef : undefined)
    : (reference.sourceType === 'recipe' ? reference.recipeId ?? reference.sourceId : undefined);
  if (!id) return snapshot as T & { recipeAccess?: RecipeAccess };
  const resolved = await resolveRecipeForRead(userId, id, recipes);
  const access: RecipeAccess = resolved.access;
  if ('foodRefType' in snapshot) {
    const removableReference = stripRecipeRelationCache(snapshot as unknown as UserFoodRelation);
    return {
      ...removableReference,
      displayName: resolved.recipe?.name ?? 'Rezept nicht verfügbar',
      recipeAccess: access,
    } as unknown as T & { recipeAccess?: RecipeAccess };
  }
  return { ...snapshot, recipeAccess: access } as T & { recipeAccess?: RecipeAccess };
}