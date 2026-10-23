import { createHash } from 'node:crypto';
import type { Recipe, RecipeIngredient } from '@fittrack/shared';
import { copyRecipeImageToCommunity, copyRecipeImageToOwnerSnapshot } from './storage';
import { effectiveIngredientNutritionSource } from './repositories/recipeIngredientProvenance';
import { computeRecipeSourceFingerprint, type RecipeFingerprintSource } from './repositories/recipeExport';
import {
  getRecipesRepository,
  toOwnerlessCommunityRecipe,
  type OwnerlessCommunityRecipe,
  type CommunityRecipeRecord,
} from './repositories/recipesRepository';

export interface CommunityRecipeTransferDependencies {
  saveRecipe(recipe: OwnerlessCommunityRecipe): Promise<void>;
  copyImage(blobName: string, recipeId: string, imageId: string): Promise<string>;
}

export async function preservePublishedCommunityRecipe(
  recipe: Recipe,
  dependencies?: CommunityRecipeTransferDependencies,
): Promise<OwnerlessCommunityRecipe> {
  const ownerlessRecipe = toOwnerlessCommunityRecipe(recipe);
  const saveRecipe = dependencies?.saveRecipe ?? ((value) => getRecipesRepository().saveOwnerlessCommunityRecipe(value));
  const copyImage = dependencies?.copyImage ?? copyRecipeImageToCommunity;
  const images = await Promise.all(ownerlessRecipe.images.map(async (image) => ({
    ...image,
    blobName: await copyImage(image.blobName, ownerlessRecipe.id, image.id),
  })));
  const preservedRecipe = { ...ownerlessRecipe, images };
  await saveRecipe(preservedRecipe);
  return preservedRecipe;
}

export interface CommunityRecipeCopyDependencies {
  saveRecipe(userId: string, recipe: Recipe): Promise<boolean>;
  copyImage(blobName: string, userId: string, recipeId: string, imageId: string): Promise<string>;
  now(): string;
}

export function deriveCommunityRecipeCopyId(userId: string, sourceRecipeId: string): string {
  const bytes = createHash('sha256')
    .update('fittrack:community-recipe-copy:v1\0', 'utf8')
    .update(userId, 'utf8')
    .update('\0', 'utf8')
    .update(sourceRecipeId, 'utf8')
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function currentTimeSnapshot(source: CommunityRecipeRecord): Recipe['communityCopyTimeSnapshot'] {
  const copyTimeSnapshot = source.communityCopyTimeSnapshot;
  if (copyTimeSnapshot && (
    !('ownerUserId' in source) ||
    copyTimeSnapshot.sourceFingerprint === computeRecipeSourceFingerprint(source as RecipeFingerprintSource)
  )) {
    return {
      totalTimeMinutes: copyTimeSnapshot.totalTimeMinutes,
      sourceFingerprint: copyTimeSnapshot.sourceFingerprint,
    };
  }
  const exportView = source.exportView;
  if (!exportView || exportView.sourceFingerprint !== computeRecipeSourceFingerprint(source as RecipeFingerprintSource)) {
    return undefined;
  }
  return {
    totalTimeMinutes: exportView.totalTimeMinutes,
    sourceFingerprint: exportView.sourceFingerprint,
  };
}

function snapshotIngredients(source: CommunityRecipeRecord): RecipeIngredient[] {
  return source.ingredients.map((ingredient) => {
    const copy = structuredClone(ingredient);
    copy.linkedReusableItemId = null;
    if (!/^openFoodFacts:[0-9]+$/u.test(copy.linkedProductId ?? '')) copy.linkedProductId = null;
    copy.nutritionSource = effectiveIngredientNutritionSource(copy);
    return copy as RecipeIngredient;
  });
}

export async function copyPublishedCommunityRecipe(
  userId: string,
  source: CommunityRecipeRecord,
  dependencies?: Partial<CommunityRecipeCopyDependencies>,
): Promise<{ recipeId: string; created: boolean }> {
  const recipeId = deriveCommunityRecipeCopyId(userId, source.id);
  const saveRecipe = dependencies?.saveRecipe ?? ((ownerId: string, recipe: Recipe) =>
    getRecipesRepository().createSnapshotCopy(ownerId, recipe));
  const copyImage = dependencies?.copyImage ?? copyRecipeImageToOwnerSnapshot;
  const now = dependencies?.now ?? (() => new Date().toISOString());
  const timeSnapshot = currentTimeSnapshot(source);
  const images = await Promise.all(source.images.map(async (image) => ({
    id: image.id,
    blobName: await copyImage(image.blobName, userId, recipeId, image.id),
    order: image.order,
    ...(image.heroCrop !== undefined ? { heroCrop: structuredClone(image.heroCrop) } : {}),
  })));
  const timestamp = now();
  const recipe: Recipe = {
    id: recipeId,
    ownerUserId: userId,
    name: source.name,
    ...(source.description !== undefined ? { description: source.description } : {}),
    portions: source.portions,
    ingredients: snapshotIngredients(source),
    steps: structuredClone(source.steps),
    images,
    nutritionTotal: structuredClone(source.nutritionTotal),
    nutritionPerPortion: structuredClone(source.nutritionPerPortion),
    visibility: 'private',
    sharedWithUserIds: [],
    tags: [...source.tags],
    usageCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (timeSnapshot) {
    recipe.communityCopyTimeSnapshot = {
      totalTimeMinutes: timeSnapshot.totalTimeMinutes,
      sourceFingerprint: computeRecipeSourceFingerprint(recipe),
    };
  }
  return { recipeId, created: await saveRecipe(userId, recipe) };
}