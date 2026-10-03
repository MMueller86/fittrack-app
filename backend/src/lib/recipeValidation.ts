import { z } from 'zod';
import type {
  RecipeExportViewInput,
  RecipeIngredient,
} from '@fittrack/shared';
import {
  RECIPE_EXPORT_MAX_INGREDIENTS,
  RECIPE_EXPORT_MAX_STEP_LENGTH,
  RECIPE_EXPORT_MAX_STEPS,
  RECIPE_EXPORT_MAX_TEASER_LENGTH,
  RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES,
  RECIPE_EXPORT_MIN_STEPS,
  RECIPE_EXPORT_VIEW_VERSION,
} from '../../../shared/types/recipeExport';

const RecipeExportStepSchema = z.object({
  order: z.number().finite().int().positive(),
  description: z.string().trim().min(1).max(RECIPE_EXPORT_MAX_STEP_LENGTH),
}).strict();

export const RecipeExportViewInputSchema = z.object({
  version: z.literal(RECIPE_EXPORT_VIEW_VERSION),
  teaser: z.string().trim().min(1).max(RECIPE_EXPORT_MAX_TEASER_LENGTH),
  totalTimeMinutes: z.number().finite().int().positive().max(RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES),
  difficulty: z.string().trim().min(1).refine((value) => !/[\r\n]/.test(value), {
    message: 'difficulty must be a single-line string',
  }),
  steps: z.array(RecipeExportStepSchema)
    .min(RECIPE_EXPORT_MIN_STEPS)
    .max(RECIPE_EXPORT_MAX_STEPS)
    .superRefine((steps, ctx) => {
      for (let index = 1; index < steps.length; index += 1) {
        if (steps[index]!.order <= steps[index - 1]!.order) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'order'],
            message: 'export steps must be in ascending order',
          });
        }
      }
    }),
  includedIngredientIds: z.array(z.string().trim().min(1))
    .max(RECIPE_EXPORT_MAX_INGREDIENTS)
    .superRefine((ids, ctx) => {
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'invalid_export_view_ingredient',
        });
      }
    }),
}).strict();

export const RecipeShareBundleExportDraftSchema = RecipeExportViewInputSchema
  .omit({ totalTimeMinutes: true, difficulty: true })
  .extend({
    totalTimeMinutes: z.number().finite().int().positive()
      .max(RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES)
      .nullable(),
    difficulty: z.string().trim().min(1).refine((value) => !/[\r\n\u2028\u2029]/u.test(value), {
      message: 'difficulty must be a single-line string',
    }).nullable(),
  })
  .strict();

export const RecipeExportViewSchema = RecipeExportViewInputSchema.extend({
  sourceFingerprint: z.string().min(1),
}).strict();

export function validateRecipeExportIngredients(
  exportView: Pick<RecipeExportViewInput, 'includedIngredientIds'>,
  ingredients: RecipeIngredient[],
): string | undefined {
  const ingredientsById = new Map<string, RecipeIngredient[]>();
  for (const ingredient of ingredients) {
    const matchingIngredients = ingredientsById.get(ingredient.id);
    if (matchingIngredients) {
      matchingIngredients.push(ingredient);
    } else {
      ingredientsById.set(ingredient.id, [ingredient]);
    }
  }

  for (const ingredientId of exportView.includedIngredientIds) {
    const matchingIngredients = ingredientsById.get(ingredientId);
    if (!matchingIngredients) return `Unknown included ingredient: ${ingredientId}`;
    if (matchingIngredients.length !== 1) {
      return `Included ingredient must occur exactly once: ${ingredientId}`;
    }

    const ingredient = matchingIngredients[0]!;
    if (ingredient.category === 'seasoning') {
      return `Seasoning ingredients cannot be included in exportView: ${ingredientId}`;
    }
  }
  return undefined;
}
