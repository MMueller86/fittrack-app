import type { Recipe } from '@fittrack/shared';

import type { RenderInput } from './types';

export type RecipeRenderOptions = {
  presentation?: Partial<RenderInput['presentation']>;
  nutritionHighlight?: RenderInput['nutritionHighlight'];
  recipeMeta?: {
    totalTimeMinutes: number;
    difficulty: string;
  };
};

/**
 * Adapt the authenticated recipe and request-level presentation options to
 * the renderer contract. Recipe content is always sourced from the document.
 */
export function adaptRecipeToRenderInput(
  recipe: Recipe,
  image: Buffer,
  options: RecipeRenderOptions,
): RenderInput {
  const presentation = options.presentation;

  return {
    image: { buffer: image },
    presentation: {
      focusX: presentation?.focusX ?? 0.5,
      focusY: presentation?.focusY ?? 0.46,
      zoom: presentation?.zoom ?? 1.0,
    },
    title: recipe.name,
    tags: recipe.tags.map((tag) => ({ id: tag, label: tag })),
    nutritionHighlight: options.nutritionHighlight ?? null,
    nutrition: {
      calories: recipe.nutritionPerPortion.calories,
      protein: recipe.nutritionPerPortion.protein,
      carbs: recipe.nutritionPerPortion.carbs,
      fat: recipe.nutritionPerPortion.fat,
    },
    ...(options.recipeMeta
      ? {
          recipeMeta: {
            totalTimeMinutes: options.recipeMeta.totalTimeMinutes,
            difficulty: options.recipeMeta.difficulty,
            portions: recipe.portions,
          },
        }
      : {}),
  };
}