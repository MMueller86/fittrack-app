import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@fittrack/shared';
import { preservePublishedCommunityRecipe } from './communityRecipeTransfer';
import type { OwnerlessCommunityRecipe } from './repositories/recipesRepository';

const nutrition = { calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 1 };
const recipe: Recipe = {
  id: 'recipe-1',
  ownerUserId: 'personal-user',
  name: 'Suppe',
  portions: 2,
  ingredients: [{
    id: 'ingredient-1', displayName: 'Gemüse', inputMode: 'grams', inputAmount: 200,
    amountGrams: 200, unit: 'g', linkedProductId: null, linkedReusableItemId: 'personal-library-id',
    isAiEstimate: false, nutritionPer100g: nutrition, nutritionContribution: nutrition,
  }],
  steps: [{ order: 1, description: 'Kochen.' }],
  images: [
    { id: 'image-1', blobName: 'personal-user/recipe-1/image-1.png', order: 1 },
    { id: 'image-2', blobName: 'personal-user/recipe-1/image-2.jpg', order: 2 },
  ],
  nutritionTotal: nutrition,
  nutritionPerPortion: nutrition,
  visibility: 'community',
  communityPublication: { contentConfirmedAt: '2026-10-01T00:00:00.000Z', displayNameConsent: true },
  sharedWithUserIds: ['another-personal-user'],
  tags: [],
  usageCount: 3,
  lastUsedAt: '2026-10-02T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

describe('preservePublishedCommunityRecipe', () => {
  it('copies images before idempotently saving an ownerless recipe snapshot', async () => {
    const saveRecipe = vi.fn<(value: OwnerlessCommunityRecipe) => Promise<void>>().mockResolvedValue(undefined);
    const copyImage = vi.fn(async (_blobName: string, _recipeId: string, imageId: string) => `community/recipe-1/${imageId}.png`);
    const dependencies = { saveRecipe, copyImage };

    const first = await preservePublishedCommunityRecipe(recipe, dependencies);
    const second = await preservePublishedCommunityRecipe(recipe, dependencies);

    expect(copyImage).toHaveBeenCalledTimes(4);
    expect(saveRecipe).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
    expect(first.images.map(({ blobName }) => blobName)).toEqual([
      'community/recipe-1/image-1.png',
      'community/recipe-1/image-2.png',
    ]);
    expect(first).not.toHaveProperty('ownerUserId');
    expect(first).not.toHaveProperty('communityPublication');
    expect(first).not.toHaveProperty('sharedWithUserIds');
    expect(first.ingredients[0]).not.toHaveProperty('linkedReusableItemId');
    expect(recipe.images[0].blobName).toBe('personal-user/recipe-1/image-1.png');
  });

  it('does not save the recipe when an image copy fails', async () => {
    const saveRecipe = vi.fn().mockResolvedValue(undefined);
    const copyImage = vi.fn().mockRejectedValue(new Error('copy failed'));

    await expect(preservePublishedCommunityRecipe(recipe, { saveRecipe, copyImage }))
      .rejects.toThrow('copy failed');
    expect(saveRecipe).not.toHaveBeenCalled();
  });
});