import type { Recipe, RecipeIngredient, RecipeShareBundleExportDraft } from '@fittrack/shared';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../../shared/types/recipeImageHeroCrop';
import type { RecipeImageHeroCrop } from '../../../../shared/types/recipeImageHeroCrop';

import type { RecipeDetailsTemplateInput, RenderInput } from './types';

export type RecipeRenderOptions = {
  storedHeroCrop?: RecipeImageHeroCrop;
  presentation?: Partial<RenderInput['presentation']>;
  selectedTags?: string[];
  nutritionHighlight?: RenderInput['nutritionHighlight'];
  recipeMeta?: {
    totalTimeMinutes: number | null;
    difficulty: string | null;
  };
};

export type RecipeDetailsRenderOptions = {
  storedHeroCrop?: RecipeImageHeroCrop;
  presentation?: Partial<RenderInput['presentation']>;
  exportViewDraft?: RecipeShareBundleExportDraft;
  recipeMeta?: Pick<NonNullable<RenderInput['recipeMeta']>, 'totalTimeMinutes' | 'difficulty'>;
  highlight?: RecipeDetailsTemplateInput['highlight'];
  nutritionHighlight?: RecipeDetailsTemplateInput['highlight'];
};

export type RecipeDetailsAdapterErrorCode =
  | 'MISSING_EXPORT_VIEW'
  | 'UNKNOWN_EXPORT_INGREDIENT'
  | 'INVALID_EXPORT_INGREDIENT';

export class RecipeDetailsAdapterError extends Error {
  readonly code: RecipeDetailsAdapterErrorCode;
  readonly field: 'exportView' | 'ingredients';
  readonly ingredientId?: string;

  constructor(
    code: RecipeDetailsAdapterErrorCode,
    field: 'exportView' | 'ingredients',
    message: string,
    ingredientId?: string,
  ) {
    super(message);
    this.name = 'RecipeDetailsAdapterError';
    this.code = code;
    this.field = field;
    this.ingredientId = ingredientId;
  }
}

function formatAmountNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

export function formatRecipeIngredientAmount(ingredient: RecipeIngredient): string {
  const inputAmount = ingredient.inputAmount;
  const unit = ingredient.unit.trim();
  if (typeof inputAmount === 'number' && Number.isFinite(inputAmount) && inputAmount > 0 && unit) {
    return `${formatAmountNumber(inputAmount)} ${unit}`;
  }

  const amountGrams = ingredient.amountGrams;
  if (typeof amountGrams === 'number' && Number.isFinite(amountGrams) && amountGrams > 0) {
    return `${formatAmountNumber(amountGrams)} g`;
  }

  throw new RecipeDetailsAdapterError(
    'INVALID_EXPORT_INGREDIENT',
    'ingredients',
    `Ingredient ${ingredient.id} has no positive renderable amount.`,
    ingredient.id,
  );
}

function getRecipeExportView(recipe: Recipe): NonNullable<Recipe['exportView']> {
  if (!recipe.exportView) {
    throw new RecipeDetailsAdapterError(
      'MISSING_EXPORT_VIEW',
      'exportView',
      'A confirmed export view is required for the recipe details image.',
    );
  }
  return recipe.exportView;
}

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
  const selectedTagSet = options.selectedTags === undefined ? undefined : new Set(options.selectedTags);
  const tags =
    selectedTagSet === undefined
      ? recipe.tags
      : recipe.tags.filter((tag) => selectedTagSet.has(tag));

  return {
    image: { buffer: image },
    presentation: {
      focusX: presentation?.focusX ?? storedHeroCrop.focusX,
      focusY: presentation?.focusY ?? storedHeroCrop.focusY,
      zoom: presentation?.zoom ?? storedHeroCrop.zoom,
    },
    title: recipe.name,
    tags: tags.map((tag) => ({ id: tag, label: tag })),
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

export function adaptRecipeToDetailsTemplateInput(
  recipe: Recipe,
  image: Buffer,
  options: RecipeDetailsRenderOptions = {},
): RecipeDetailsTemplateInput {
  const exportView = options.exportViewDraft ?? getRecipeExportView(recipe);
  const recipeMeta = options.recipeMeta ?? exportView;
  const ingredientsById = new Map(recipe.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const ingredients = exportView.includedIngredientIds.flatMap((ingredientId) => {
    const ingredient = ingredientsById.get(ingredientId);
    if (!ingredient) {
      throw new RecipeDetailsAdapterError(
        'UNKNOWN_EXPORT_INGREDIENT',
        'ingredients',
        `Export view references unknown ingredient ${ingredientId}.`,
        ingredientId,
      );
    }
    if (ingredient.category === 'seasoning') return [];
    return [{ amount: formatRecipeIngredientAmount(ingredient), name: ingredient.displayName.trim() }];
  });

  const storedHeroCrop = options.storedHeroCrop ?? DEFAULT_RECIPE_IMAGE_HERO_CROP;
  const presentation = options.presentation;

  return {
    image: { buffer: image },
    presentation: {
      focusX: presentation?.focusX ?? storedHeroCrop.focusX,
      focusY: presentation?.focusY ?? storedHeroCrop.focusY,
      zoom: presentation?.zoom ?? storedHeroCrop.zoom,
    },
    description: exportView.teaser,
    highlight: options.highlight ?? options.nutritionHighlight,
    title: recipe.name,
    totalTimeMinutes: recipeMeta.totalTimeMinutes,
    difficulty: recipeMeta.difficulty,
    portions: recipe.portions,
    ingredients,
    steps: exportView.steps.map((step) => step.description),
  };
}