import type { Recipe } from '@fittrack/shared';
import { copyRecipeImageToCommunity } from './storage';
import {
  getRecipesRepository,
  toOwnerlessCommunityRecipe,
  type OwnerlessCommunityRecipe,
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