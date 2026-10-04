import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { RecipeIngredient, UserProfile } from '@fittrack/shared';
import { projectCommunityRecipe, projectRecipeReferenceAccess, resolveRecipeForRead } from './communityRecipes';
import { __resetRecipesRepositoryForTests, getRecipesRepository } from './repositories/recipesRepository';
import { effectiveRecipeVisibility } from './repositories/recipePublication';
import { resolveRecipeIngredientProvenance } from './repositories/recipeIngredientProvenance';

const nutrition = { calories: 10, protein: 1, carbs: 1, fat: 0, fiber: 0 };
const ingredient: RecipeIngredient = {
  id: 'ingredient', displayName: 'Food', inputMode: 'grams', inputAmount: 100,
  amountGrams: 100, unit: 'g', linkedProductId: null, linkedReusableItemId: null,
  isAiEstimate: false, nutritionPer100g: nutrition, nutritionContribution: nutrition,
};
const input = { name: 'Recipe', portions: 1, ingredients: [ingredient], steps: [], tags: [], nutritionTotal: nutrition, nutritionPerPortion: nutrition };
const imagePath = (recipeId: string, imageId: string) => `/api/test-recipes/${recipeId}/images/${imageId}`;

beforeEach(() => {
  vi.stubEnv('COSMOS_ENDPOINT', ''); vi.stubEnv('COSMOS_KEY', '');
  __resetRecipesRepositoryForTests();
});
afterEach(() => { vi.unstubAllEnvs(); __resetRecipesRepositoryForTests(); });

describe('community access and projection', () => {
  it('defaults missing and unknown visibility to private', () => {
    for (const value of [undefined, null, 'public', 'private', '', true]) expect(effectiveRecipeVisibility(value)).toBe('private');
    expect(effectiveRecipeVisibility('community')).toBe('community');
  });

  it('resolves own first, never discloses private owners and does not persist access status', async () => {
    const repo = getRecipesRepository();
    const created = await repo.createVersioned('owner', input);
    expect((await resolveRecipeForRead('owner', created.recipe.id)).access).toBe('owner');
    expect(await resolveRecipeForRead('other', created.recipe.id)).toEqual({ access: 'unavailable', recipe: null });
    const reference = { id: 'entry', userId: 'other', foodRef: created.recipe.id, foodRefType: 'recipe' as const, displayName: 'Stale name', displayBrand: 'Stale brand', imageUrl: 'https://blob.invalid/old?sas=stale', isFavorite: true, lastUsedAt: null, usageCount: 0, createdAt: '2026-10-01T00:00:00.000Z', nutritionPer100g: nutrition, portion: { label: 'Portion', weightGrams: 300 } };
    expect((await projectRecipeReferenceAccess('other', reference)).recipeAccess).toBe('unavailable');
    expect(reference).not.toHaveProperty('recipeAccess');
    const unavailable = await projectRecipeReferenceAccess('other', reference);
    expect(unavailable.displayName).toBe('Rezept nicht verfügbar');
    expect(unavailable).not.toHaveProperty('imageUrl');
    expect(unavailable).not.toHaveProperty('nutritionPer100g');
    await repo.setVisibility('owner', created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: false });
    expect((await resolveRecipeForRead('other', created.recipe.id)).access).toBe('community');
    const communityRelation = await projectRecipeReferenceAccess('other', reference);
    expect(communityRelation.recipeAccess).toBe('community');
    expect(communityRelation.displayName).toBe('Recipe');
    expect(communityRelation).not.toHaveProperty('displayBrand');
    expect(communityRelation).not.toHaveProperty('imageUrl');
    expect(communityRelation).not.toHaveProperty('nutritionPer100g');
    expect(communityRelation).not.toHaveProperty('portion');
    expect(await repo.get('other', created.recipe.id)).toBeNull();
  });

  it('redacts stale recipe relation data when the referenced recipe is unavailable', async () => {
    const repo = getRecipesRepository();
    const recipe = await repo.create('owner', input);
    const reference = {
      id: 'reader:recipe',
      userId: 'reader',
      foodRef: recipe.id,
      foodRefType: 'recipe' as const,
      displayName: 'Old recipe title',
      displayBrand: 'Old author',
      imageUrl: 'https://blob.invalid/image.jpg?sig=stale',
      isFavorite: true,
      lastUsedAt: '2026-10-01T12:00:00.000Z',
      usageCount: 2,
      createdAt: '2026-10-01T12:00:00.000Z',
      nutritionPer100g: nutrition,
      portion: { label: 'Portion', weightGrams: 300 },
    };

    const projected = await projectRecipeReferenceAccess('reader', reference, repo);

    expect(projected).toMatchObject({
      displayName: 'Rezept nicht verfügbar',
      recipeAccess: 'unavailable',
    });
    expect(projected).not.toHaveProperty('displayBrand');
    expect(projected).not.toHaveProperty('imageUrl');
    expect(projected).not.toHaveProperty('nutritionPer100g');
    expect(projected).not.toHaveProperty('portion');
  });

  it('uses active consent and current profile only, propagating profile failures', async () => {
    const recipe = { ...(await getRecipesRepository().create('owner', input)), visibility: 'community' as const };
    const profiles = { get: vi.fn(async () => ({ displayName: ' Current name ' } as UserProfile)) };
    expect((await projectCommunityRecipe(recipe, 'other', imagePath, profiles)).authorDisplayName).toBe('Anonymous');
    expect(profiles.get).not.toHaveBeenCalled();
    recipe.communityPublication = { contentConfirmedAt: new Date().toISOString(), displayNameConsent: true };
    expect((await projectCommunityRecipe(recipe, 'other', imagePath, profiles)).authorDisplayName).toBe('Current name');
    profiles.get.mockResolvedValue({ displayName: ' ' } as UserProfile);
    expect((await projectCommunityRecipe(recipe, 'other', imagePath, profiles)).authorDisplayName).toBe('Anonymous');
    profiles.get.mockResolvedValue(null as unknown as UserProfile);
    expect((await projectCommunityRecipe(recipe, 'other', imagePath, profiles)).authorDisplayName).toBe('Anonymous');
    profiles.get.mockRejectedValue(new Error('profile infrastructure failure'));
    await expect(projectCommunityRecipe(recipe, 'other', imagePath, profiles)).rejects.toThrow('profile infrastructure failure');
  });

  it('allowlists ingredients, images and steps and preserves positive legacy AI evidence', async () => {
    const recipe = { ...(await getRecipesRepository().create('owner', input)), visibility: 'community' as const };
    recipe.ingredients = [
      { ...ingredient, nutritionSource: 'manual', linkedProductId: 'private-link' },
      { ...ingredient, id: 'ai', isAiEstimate: true, nutritionSource: 'manual' },
      { ...ingredient, id: 'seasoning', category: 'seasoning', amountGrams: null },
    ];
    recipe.images = [{ id: 'image', order: 1, blobName: 'owner/blob', url: 'https://blob.invalid?sas=hidden' }];
    const dto = await projectCommunityRecipe(recipe, 'owner', imagePath);
    expect(dto.ingredientNotices).toEqual({ containsAiEstimates: true, containsManualIngredients: true });
    expect(dto.ingredients[1].nutritionSource).toBe('ai');
    expect(dto.ingredients[2].nutritionSource).toBe('unknown');
    expect(dto.images[0].url).toBe(imagePath(recipe.id, 'image'));
    for (const field of ['ownerUserId', 'userId', 'sharedWithUserIds', 'communityPublication', 'usageCount', 'lastUsedAt', 'exportView', 'exportViewStatus']) expect(dto).not.toHaveProperty(field);
    expect(dto.ingredients[0]).not.toHaveProperty('linkedProductId');
    expect(dto.ingredients[0]).not.toHaveProperty('linkedReusableItemId');
    expect(dto.images[0]).not.toHaveProperty('blobName');
    await expect(projectCommunityRecipe(recipe, 'owner', () => 'https://blob.invalid?sas=hidden')).rejects.toThrow();
  });
});

describe('recipe ingredient provenance', () => {
  const personal = vi.fn();
  const product = vi.fn();
  const repositories = { reusableItems: { getById: personal }, products: { getById: product } };
  beforeEach(() => { personal.mockReset().mockResolvedValue(null); product.mockReset().mockResolvedValue(null); });

  it('does not infer manual from null links, or AI from seasoning category', async () => {
    const result = await resolveRecipeIngredientProvenance('owner', [ingredient, { ...ingredient, id: 'seasoning', category: 'seasoning', amountGrams: null }], [], repositories);
    expect(result.map((entry) => entry.nutritionSource)).toEqual(['unknown', 'unknown']);
    expect((await resolveRecipeIngredientProvenance('owner', [{ ...ingredient, nutritionSource: 'manual' }], [], repositories))[0].nutritionSource).toBe('manual');
    expect((await resolveRecipeIngredientProvenance('owner', [{ ...ingredient, isAiEstimate: true }], [], repositories))[0].nutritionSource).toBe('ai');
  });

  it.each(['manual', 'openFoodFacts', 'ai', 'label-scan'] as const)('resolves personal source %s in owner partition, including legacy product links', async (sourceType) => {
    personal.mockResolvedValue({ userId: 'owner', sourceType });
    const result = await resolveRecipeIngredientProvenance('owner', [{ ...ingredient, linkedProductId: 'library', isAiEstimate: sourceType === 'ai' }], [], repositories);
    expect(personal).toHaveBeenCalledWith('owner', 'library');
    expect(result[0].nutritionSource).toBe(sourceType);
  });

  it('requires existing OFF catalog, ignoring foreign personal items', async () => {
    personal.mockResolvedValue({ userId: 'other', sourceType: 'manual' });
    expect((await resolveRecipeIngredientProvenance('owner', [{ ...ingredient, linkedReusableItemId: 'foreign' }], [], repositories))[0].nutritionSource).toBe('unknown');
    product.mockResolvedValue({ source: 'openFoodFacts' });
    expect((await resolveRecipeIngredientProvenance('owner', [{ ...ingredient, linkedProductId: 'off' }], [], repositories))[0].nutritionSource).toBe('openFoodFacts');
  });

  it('preserves historical unknown and positive AI evidence without consulting changed library sources', async () => {
    personal.mockResolvedValue({ userId: 'owner', sourceType: 'manual' });
    const legacy = { ...ingredient, linkedReusableItemId: 'library' };
    expect((await resolveRecipeIngredientProvenance('owner', [{ ...legacy, amountGrams: 200 }], [legacy], repositories))[0].nutritionSource).toBe('unknown');
    const contradictory = { ...legacy, isAiEstimate: true, nutritionSource: 'manual' as const };
    expect((await resolveRecipeIngredientProvenance('owner', [contradictory], [contradictory], repositories))[0].nutritionSource).toBe('ai');
    const sourceOnly = { ...legacy, nutritionSource: 'ai' as const };
    expect((await resolveRecipeIngredientProvenance('owner', [sourceOnly], [sourceOnly], repositories))[0]).toMatchObject({ nutritionSource: 'ai', isAiEstimate: true });
    expect(personal).not.toHaveBeenCalled();
  });

  it('rejects new contradictory source/AI flags and dual links', async () => {
    await expect(resolveRecipeIngredientProvenance('owner', [ingredient], [{ ...ingredient, isAiEstimate: true }], repositories)).rejects.toThrow('Contradictory');
    await expect(resolveRecipeIngredientProvenance('owner', [{ ...ingredient, isAiEstimate: true, nutritionSource: 'manual' }], [], repositories)).rejects.toThrow('Contradictory');
    await expect(resolveRecipeIngredientProvenance('owner', [{ ...ingredient, nutritionSource: 'ai' }], [], repositories)).rejects.toThrow('Contradictory');
    await expect(resolveRecipeIngredientProvenance('owner', [{ ...ingredient, linkedProductId: 'one', linkedReusableItemId: 'two' }], [], repositories)).rejects.toThrow('Contradictory');
    personal.mockResolvedValue({ userId: 'owner', sourceType: 'manual' });
    await expect(resolveRecipeIngredientProvenance('owner', [{ ...ingredient, linkedReusableItemId: 'manual', isAiEstimate: true }], [], repositories)).rejects.toThrow('Contradictory');
  });
});