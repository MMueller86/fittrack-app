import type { Recipe } from '@fittrack/shared';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../../shared/types/recipeImageHeroCrop';
import type { RecipeImageHeroCrop } from '../../../../shared/types/recipeImageHeroCrop';

import type { RenderInput } from './types';

export type RecipeRenderOptions = {
  storedHeroCrop?: RecipeImageHeroCrop;
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
  const storedHeroCrop = options.storedHeroCrop ?? DEFAULT_RECIPE_IMAGE_HERO_CROP;

  return {
    image: { buffer: image },
    presentation: {
      focusX: presentation?.focusX ?? storedHeroCrop.focusX,
      focusY: presentation?.focusY ?? storedHeroCrop.focusY,
      zoom: presentation?.zoom ?? storedHeroCrop.zoom,
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