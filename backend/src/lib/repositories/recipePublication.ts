import type { Recipe, RecipeVisibilityInput } from '@fittrack/shared';

export function effectiveRecipeVisibility(value: unknown): Recipe['visibility'] {
  return value === 'community' ? 'community' : 'private';
}

export function applyRecipeVisibility(recipe: Recipe, input: RecipeVisibilityInput): Recipe {
  if (input.visibility === 'private') {
    const { communityPublication, ...privateRecipe } = recipe;
    return { ...privateRecipe, visibility: 'private', updatedAt: new Date().toISOString() };
  }
  if (input.visibility !== 'community' || input.contentConfirmed !== true ||
      typeof input.displayNameConsent !== 'boolean') {
    throw new Error('Invalid recipe publication confirmation');
  }
  const now = new Date().toISOString();
  return {
    ...recipe,
    visibility: 'community',
    communityPublication: { contentConfirmedAt: now, displayNameConsent: input.displayNameConsent },
    updatedAt: now,
  };
}

export function communityPageSize(limit = 20): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid community page size');
  return limit;
}