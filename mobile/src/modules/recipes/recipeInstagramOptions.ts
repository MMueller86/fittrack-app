import type { RecipeInstagramNutritionHighlight } from '../../shared/api/recipeInstagramRenderContract';

export const MAX_RECIPE_INSTAGRAM_TAGS = 4;

export interface RecipeInstagramOptions {
  selectedTags: string[];
  nutritionHighlight: RecipeInstagramNutritionHighlight;
}

function uniqueTagsInServerOrder(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const uniqueTags: string[] = [];

  for (const tag of tags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    uniqueTags.push(tag);
  }

  return uniqueTags;
}

export function normalizeRecipeInstagramTags(
  tags: readonly string[],
  selectedTags: readonly string[],
): string[] {
  const selected = new Set(selectedTags);
  return uniqueTagsInServerOrder(tags)
    .filter((tag) => selected.has(tag))
    .slice(0, MAX_RECIPE_INSTAGRAM_TAGS);
}

export function getInitialRecipeInstagramTags(tags: readonly string[]): string[] {
  return uniqueTagsInServerOrder(tags).slice(0, MAX_RECIPE_INSTAGRAM_TAGS);
}

export function toggleRecipeInstagramTag(
  tags: readonly string[],
  selectedTags: readonly string[],
  tag: string,
): string[] {
  const normalizedSelectedTags = normalizeRecipeInstagramTags(tags, selectedTags);
  const selected = new Set(normalizedSelectedTags);

  if (selected.has(tag)) {
    selected.delete(tag);
  } else if (selected.size < MAX_RECIPE_INSTAGRAM_TAGS && tags.includes(tag)) {
    selected.add(tag);
  }

  return normalizeRecipeInstagramTags(tags, [...selected]);
}