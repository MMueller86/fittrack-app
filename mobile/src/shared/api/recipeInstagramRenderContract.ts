export type RecipeInstagramNutritionHighlight = 'high-protein' | null;

export interface RecipeInstagramPresentation {
  focusX: number;
  focusY: number;
  zoom: number;
}

export interface RecipeInstagramRecipeMeta {
  totalTimeMinutes: number;
  difficulty: string;
}

export interface RecipeInstagramRenderOptions {
  selectedTags: string[];
  nutritionHighlight: RecipeInstagramNutritionHighlight;
  recipeMeta: RecipeInstagramRecipeMeta;
  presentation?: RecipeInstagramPresentation;
}

export const TEMPORARY_RECIPE_RENDER_META = {
  totalTimeMinutes: 30,
  difficulty: 'Einfach',
} as const;