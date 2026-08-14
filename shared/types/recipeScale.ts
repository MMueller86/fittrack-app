import type { RecipeStep } from './recipes';

export const RECIPE_PORTION_MIN = 1;
export const RECIPE_PORTION_MAX = 50;

export interface RecipeScalePreviewRequest {
  recipeId: string;
  targetPortions: number;
}

export interface RecipeScalePreviewResponse {
  targetPortions: number;
  description: string | null;
  steps: RecipeStep[];
}