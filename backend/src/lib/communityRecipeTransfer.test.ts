import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@fittrack/shared';
import { copyPublishedCommunityRecipe, deriveCommunityRecipeCopyId, preservePublishedCommunityRecipe } from './communityRecipeTransfer';
import { computeRecipeSourceFingerprint, createRecipeExportView } from './repositories/recipeExport';
import { toOwnerlessCommunityRecipe, type OwnerlessCommunityRecipe } from './repositories/recipesRepository';

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

  it('preserves only a current confirmed time snapshot in the ownerless record', () => {
    const exportView = createRecipeExportView({
      version: 1,
      teaser: 'Suppe',
      totalTimeMinutes: 35,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Kochen.' }],
      includedIngredientIds: [],
    }, recipe);
    const current = toOwnerlessCommunityRecipe({ ...recipe, exportView });
    const stale = toOwnerlessCommunityRecipe({ ...recipe, name: 'Andere Suppe', exportView });

    expect(current.communityCopyTimeSnapshot).toEqual({
      totalTimeMinutes: 35,
      sourceFingerprint: exportView.sourceFingerprint,
    });
    expect(stale).not.toHaveProperty('communityCopyTimeSnapshot');
  });

  it('does not save the recipe when an image copy fails', async () => {
    const saveRecipe = vi.fn().mockResolvedValue(undefined);
    const copyImage = vi.fn().mockRejectedValue(new Error('copy failed'));

    await expect(preservePublishedCommunityRecipe(recipe, { saveRecipe, copyImage }))
      .rejects.toThrow('copy failed');
    expect(saveRecipe).not.toHaveBeenCalled();
  });
});

describe('copyPublishedCommunityRecipe', () => {
  it.each([
    {
      caseName: 'current export view',
      source: {
        ...recipe,
        exportView: createRecipeExportView({
          version: 1,
          teaser: 'Suppe',
          totalTimeMinutes: 35,
          difficulty: 'Einfach',
          steps: [{ order: 1, description: 'Kochen.' }],
          includedIngredientIds: [],
        }, recipe),
      },
      expectedMinutes: 35,
    },
    { caseName: 'missing time values', source: recipe, expectedMinutes: undefined },
    {
      caseName: 'stale export view',
      source: {
        ...recipe,
        name: 'Updated source',
        exportView: createRecipeExportView({
          version: 1,
          teaser: 'Suppe',
          totalTimeMinutes: 35,
          difficulty: 'Einfach',
          steps: [{ order: 1, description: 'Kochen.' }],
          includedIngredientIds: [],
        }, recipe),
      },
      expectedMinutes: undefined,
    },
    {
      caseName: 'stale copy-time snapshot',
      source: {
        ...recipe,
        name: 'Updated source',
        communityCopyTimeSnapshot: {
          totalTimeMinutes: 35,
          sourceFingerprint: computeRecipeSourceFingerprint(recipe),
        },
      },
      expectedMinutes: undefined,
    },
  ])('copies only current private time values: $caseName', async ({ source, expectedMinutes }) => {
    const saveRecipe = vi.fn<(userId: string, snapshot: Recipe) => Promise<boolean>>().mockResolvedValue(true);
    const copyImage = vi.fn(async (_blobName: string, userId: string, recipeId: string, imageId: string) =>
      `${userId}/${recipeId}/${imageId}.jpg`);

    await copyPublishedCommunityRecipe('copy-owner', source, { saveRecipe, copyImage });

    const snapshot = saveRecipe.mock.calls[0]![1];
    if (expectedMinutes === undefined) {
      expect(snapshot).not.toHaveProperty('communityCopyTimeSnapshot');
    } else {
      expect(snapshot.communityCopyTimeSnapshot).toEqual({
        totalTimeMinutes: expectedMinutes,
        sourceFingerprint: computeRecipeSourceFingerprint(snapshot),
      });
    }
  });

  it('carries a current private-copy time snapshot into a subsequent copy', async () => {
    const source: Recipe = {
      ...recipe,
      communityCopyTimeSnapshot: {
        totalTimeMinutes: 35,
        sourceFingerprint: computeRecipeSourceFingerprint(recipe),
      },
    };
    const saveRecipe = vi.fn<(userId: string, snapshot: Recipe) => Promise<boolean>>().mockResolvedValue(true);
    const copyImage = vi.fn(async (_blobName: string, userId: string, recipeId: string, imageId: string) =>
      `${userId}/${recipeId}/${imageId}.png`);

    await copyPublishedCommunityRecipe('next-owner', source, { saveRecipe, copyImage });

    const snapshot = saveRecipe.mock.calls[0]![1];
    expect(snapshot.communityCopyTimeSnapshot).toEqual({
      totalTimeMinutes: 35,
      sourceFingerprint: computeRecipeSourceFingerprint(snapshot),
    });
  });

  it('derives a stable UUID and copies only an allowlisted private snapshot without resolving source links', async () => {
    expect(deriveCommunityRecipeCopyId('user-1', 'source-1')).toBe('607f7a61-6d5b-57f1-8d33-e1f7e82ffa47');
    expect(deriveCommunityRecipeCopyId('user-1', 'source-1'))
      .toBe(deriveCommunityRecipeCopyId('user-1', 'source-1'));
    expect(deriveCommunityRecipeCopyId('user-2', 'source-1'))
      .not.toBe(deriveCommunityRecipeCopyId('user-1', 'source-1'));

    const ingredients: Recipe['ingredients'] = [
      { ...recipe.ingredients[0]!, id: 'manual', linkedReusableItemId: null, nutritionSource: 'manual' },
      { ...recipe.ingredients[0]!, id: 'ai', linkedReusableItemId: null, linkedProductId: null, isAiEstimate: true, nutritionSource: 'ai' },
      { ...recipe.ingredients[0]!, id: 'off', linkedReusableItemId: null, linkedProductId: 'openFoodFacts:1234567890123', nutritionSource: 'openFoodFacts' },
      { ...recipe.ingredients[0]!, id: 'foreign', linkedReusableItemId: 'foreign-library', linkedProductId: 'private-product-id', nutritionSource: 'label-scan' },
    ];
    const source: Recipe = {
      ...recipe,
      ingredients,
      exportView: createRecipeExportView({
        version: 1,
        teaser: 'Suppe',
        totalTimeMinutes: 35,
        difficulty: 'Einfach',
        steps: [{ order: 1, description: 'Kochen.' }],
        includedIngredientIds: [],
      }, { ...recipe, ingredients }),
    };
    const saveRecipe = vi.fn<(userId: string, snapshot: Recipe) => Promise<boolean>>().mockResolvedValue(true);
    const copyImage = vi.fn(async (_blobName: string, userId: string, recipeId: string, imageId: string) =>
      `${userId}/${recipeId}/${imageId}.jpg`);
    const result = await copyPublishedCommunityRecipe('copy-owner', source, {
      saveRecipe,
      copyImage,
      now: () => '2026-10-22T00:00:00.000Z',
    });
    const snapshot = saveRecipe.mock.calls[0]![1];

    expect(result).toEqual({ recipeId: deriveCommunityRecipeCopyId('copy-owner', recipe.id), created: true });
    expect(snapshot).toMatchObject({
      id: result.recipeId,
      ownerUserId: 'copy-owner',
      visibility: 'private',
      name: source.name,
      portions: source.portions,
      nutritionTotal: source.nutritionTotal,
      nutritionPerPortion: source.nutritionPerPortion,
      communityCopyTimeSnapshot: { totalTimeMinutes: 35 },
    });
    expect(snapshot.images.map(({ id, order, blobName }) => ({ id, order, blobName }))).toEqual([
      { id: 'image-1', order: 1, blobName: `copy-owner/${result.recipeId}/image-1.jpg` },
      { id: 'image-2', order: 2, blobName: `copy-owner/${result.recipeId}/image-2.jpg` },
    ]);
    expect(snapshot.ingredients.map(({ linkedProductId, linkedReusableItemId, nutritionSource }) => ({
      linkedProductId, linkedReusableItemId, nutritionSource,
    }))).toEqual([
      { linkedProductId: null, linkedReusableItemId: null, nutritionSource: 'manual' },
      { linkedProductId: null, linkedReusableItemId: null, nutritionSource: 'ai' },
      { linkedProductId: 'openFoodFacts:1234567890123', linkedReusableItemId: null, nutritionSource: 'openFoodFacts' },
      { linkedProductId: null, linkedReusableItemId: null, nutritionSource: 'label-scan' },
    ]);
    expect(snapshot.ingredients.map(({ nutritionContribution }) => nutritionContribution))
      .toEqual(source.ingredients.map(({ nutritionContribution }) => nutritionContribution));
    expect(snapshot).not.toHaveProperty('exportView');
    expect(snapshot).not.toHaveProperty('communityPublication');
    expect(snapshot).not.toHaveProperty('lastUsedAt');
    expect(copyImage).toHaveBeenCalledTimes(source.images.length);
  });

  it('retains a current copy-time snapshot through ownerless preservation and another copy', async () => {
    const publishedCopy: Recipe = {
      ...recipe,
      communityCopyTimeSnapshot: {
        totalTimeMinutes: 35,
        sourceFingerprint: computeRecipeSourceFingerprint(recipe),
      },
    };
    const ownerless = toOwnerlessCommunityRecipe(publishedCopy);
    expect(ownerless.communityCopyTimeSnapshot).toEqual(publishedCopy.communityCopyTimeSnapshot);

    const saveRecipe = vi.fn<(userId: string, snapshot: Recipe) => Promise<boolean>>().mockResolvedValue(true);
    const copyImage = vi.fn(async (_blobName: string, userId: string, recipeId: string, imageId: string) =>
      `${userId}/${recipeId}/${imageId}.png`);
    await copyPublishedCommunityRecipe('next-owner', ownerless, { saveRecipe, copyImage });

    const snapshot = saveRecipe.mock.calls[0]![1];
    expect(snapshot.communityCopyTimeSnapshot).toEqual({
      totalTimeMinutes: 35,
      sourceFingerprint: computeRecipeSourceFingerprint(snapshot),
    });
  });
});