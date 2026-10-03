import type { RecipeShareBundleExportDraft } from '@fittrack/shared';

export type RecipeInstagramNutritionHighlight = 'high-protein' | null;

export interface RecipeInstagramPresentation {
  focusX: number;
  focusY: number;
  zoom: number;
}

export interface RecipeInstagramRecipeMeta {
  totalTimeMinutes: number | null;
  difficulty: string | null;
}

export interface RecipeInstagramRenderOptions {
  selectedTags: string[];
  nutritionHighlight: RecipeInstagramNutritionHighlight;
  recipeMeta: RecipeInstagramRecipeMeta;
  presentation?: RecipeInstagramPresentation;
}

export interface RecipeShareBundleOptions {
  imageId?: string;
  selectedTags: string[];
  nutritionHighlight: RecipeInstagramNutritionHighlight;
  exportViewDraft?: RecipeShareBundleExportDraft;
  presentation?: RecipeInstagramPresentation;
}

export interface RecipeShareBundlePng {
  mimeType: 'image/png';
  size: number;
  data: string;
}

export interface RecipeShareBundleResponse {
  recipeId: string;
  instagram: RecipeShareBundlePng;
  detail: RecipeShareBundlePng;
}

export const TEMPORARY_RECIPE_RENDER_META: RecipeInstagramRecipeMeta = {
  totalTimeMinutes: null,
  difficulty: null,
};