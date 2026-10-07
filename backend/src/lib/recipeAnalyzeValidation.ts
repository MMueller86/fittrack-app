import { z } from 'zod';
import type { AiRecipeIngredientLine, AiRecipeRaw } from './openai';
import {
  RECIPE_EXPORT_MAX_INGREDIENTS,
  RECIPE_EXPORT_MAX_STEP_LENGTH,
  RECIPE_EXPORT_MAX_STEPS,
  RECIPE_EXPORT_MAX_TEASER_LENGTH,
  RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES,
} from '../../../shared/types/recipeExport';

const NonEmptyTextSchema = z.string().min(1).refine((value) => value.trim().length > 0);
const SingleLineTextSchema = NonEmptyTextSchema.refine((value) => !/[\r\n\u2028\u2029]/u.test(value));
const AnalysisKeySchema = SingleLineTextSchema.refine((value) => value === value.trim());

const RecipeAnalyzeIngredientSchema = z.object({
  analysisKey: AnalysisKeySchema,
  line: NonEmptyTextSchema,
  displayName: NonEmptyTextSchema,
  category: z.enum(['food', 'seasoning']),
  amountGrams: z.number().finite().positive().nullable(),
  kitchenAmountText: NonEmptyTextSchema.nullable(),
}).strict();

const RecipeAnalyzeSourceStepSchema = z.object({
  order: z.number().finite().int().positive(),
  title: NonEmptyTextSchema.nullable(),
  description: NonEmptyTextSchema,
}).strict();

const RecipeAnalyzeExportStepSchema = z.object({
  order: z.number().finite().int().positive(),
  description: z.string().min(1).max(RECIPE_EXPORT_MAX_STEP_LENGTH).refine((value) => value.trim().length > 0),
  sourceStepOrders: z.array(z.number().finite().int().positive()).min(1),
  ingredientKeys: z.array(AnalysisKeySchema),
}).strict();

const RecipeAnalyzeExportSuggestionSchema = z.object({
  version: z.literal(1),
  teaser: z.string().min(1).max(RECIPE_EXPORT_MAX_TEASER_LENGTH).refine((value) => value.trim().length > 0),
  totalTimeMinutes: z.number().finite().int().positive().max(RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES).nullable(),
  difficulty: SingleLineTextSchema.nullable(),
  steps: z.array(RecipeAnalyzeExportStepSchema).max(RECIPE_EXPORT_MAX_STEPS),
  includedIngredientKeys: z.array(AnalysisKeySchema).max(RECIPE_EXPORT_MAX_INGREDIENTS),
}).strict();

const RecipeAnalyzeOutputSchema = z.object({
  suggestedName: NonEmptyTextSchema,
  description: NonEmptyTextSchema,
  suggestedPortions: z.number().finite().positive(),
  tags: z.array(NonEmptyTextSchema),
  ingredients: z.array(RecipeAnalyzeIngredientSchema),
  steps: z.array(RecipeAnalyzeSourceStepSchema),
  exportSuggestion: RecipeAnalyzeExportSuggestionSchema,
}).strict();

export type RecipeAnalyzeValidationResult =
  | { ok: true; data: AiRecipeRaw }
  | { ok: false; errors: string[] };

const RecipeExportPreparationSchema = z.object({
  steps: z.array(RecipeAnalyzeSourceStepSchema),
  exportSuggestion: RecipeAnalyzeExportSuggestionSchema
    .omit({ includedIngredientKeys: true })
    .extend({
      steps: z.array(RecipeAnalyzeExportStepSchema.omit({ ingredientKeys: true }).strip())
        .max(RECIPE_EXPORT_MAX_STEPS),
    })
    .strip(),
});

type RecipeExportPreparation = z.infer<typeof RecipeExportPreparationSchema>;

export interface RecipeExportPreparationDiagnostic {
  phase: 'schema' | 'semantic';
  code: string;
  path: string;
}

interface RecipeExportStepTraceIssue extends RecipeExportPreparationDiagnostic {
  phase: 'semantic';
  message: string;
}

export function validateRecipeExportPreparationOutput(raw: unknown):
  | { ok: true; data: RecipeExportPreparation }
  | { ok: false; errors: string[]; diagnostics: RecipeExportPreparationDiagnostic[] } {
  const parsed = RecipeExportPreparationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'output'}: ${issue.message}`),
      diagnostics: parsed.error.issues.map((issue) => ({
        phase: 'schema',
        code: issue.code,
        path: formatValidationPath(issue.path),
      })),
    };
  }
  const issues = validateExportStepTrace(parsed.data);
  return issues.length > 0
    ? {
        ok: false,
        errors: issues.map((issue) => issue.message),
        diagnostics: issues.map(({ phase, code, path }) => ({ phase, code, path })),
      }
    : { ok: true, data: parsed.data };
}

function formatValidationPath(path: PropertyKey[]): string {
  let formatted = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      formatted += `[${segment}]`;
      continue;
    }
    const field = typeof segment === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/u.test(segment)
      ? segment
      : 'unknown';
    formatted += `${formatted.length > 0 ? '.' : ''}${field}`;
  }
  return formatted || 'output';
}

function validateExportStepTrace(data: RecipeExportPreparation): RecipeExportStepTraceIssue[] {
  const issues: RecipeExportStepTraceIssue[] = [];
  const sourceOrders = data.steps.map((step) => step.order);
  if (new Set(sourceOrders).size !== sourceOrders.length) {
    issues.push({
      phase: 'semantic',
      code: 'duplicate_source_step_order',
      path: 'steps.order',
      message: 'steps.order must be unique',
    });
  }
  for (let index = 1; index < sourceOrders.length; index += 1) {
    if (sourceOrders[index]! <= sourceOrders[index - 1]!) {
      issues.push({
        phase: 'semantic',
        code: 'source_step_order_not_ascending',
        path: 'steps.order',
        message: 'steps.order must be in ascending order',
      });
      break;
    }
  }

  const exportOrders = data.exportSuggestion.steps.map((step) => step.order);
  if (new Set(exportOrders).size !== exportOrders.length) {
    issues.push({
      phase: 'semantic',
      code: 'duplicate_export_step_order',
      path: 'exportSuggestion.steps.order',
      message: 'exportSuggestion.steps.order must be unique',
    });
  }
  for (let index = 0; index < exportOrders.length; index += 1) {
    if (exportOrders[index] !== index + 1) {
      issues.push({
        phase: 'semantic',
        code: 'export_step_order_not_contiguous',
        path: 'exportSuggestion.steps.order',
        message: 'exportSuggestion.steps.order must start at 1 and be contiguous',
      });
      break;
    }
  }

  const flattenedSourceOrders: number[] = [];
  for (const [stepIndex, step] of data.exportSuggestion.steps.entries()) {
    for (let index = 1; index < step.sourceStepOrders.length; index += 1) {
      if (step.sourceStepOrders[index]! <= step.sourceStepOrders[index - 1]!) {
        issues.push({
          phase: 'semantic',
          code: 'source_step_references_not_ascending',
          path: `exportSuggestion.steps[${stepIndex}].sourceStepOrders`,
          message: `exportSuggestion step ${step.order} sourceStepOrders must be ascending`,
        });
        break;
      }
    }
    for (const sourceOrder of step.sourceStepOrders) {
      if (!sourceOrders.includes(sourceOrder)) {
        issues.push({
          phase: 'semantic',
          code: 'unknown_source_step_reference',
          path: `exportSuggestion.steps[${stepIndex}].sourceStepOrders`,
          message: `exportSuggestion step ${step.order} references unknown source step: ${sourceOrder}`,
        });
      }
      flattenedSourceOrders.push(sourceOrder);
    }
  }
  if (flattenedSourceOrders.length !== sourceOrders.length ||
      flattenedSourceOrders.some((order, index) => order !== sourceOrders[index])) {
    issues.push({
      phase: 'semantic',
      code: 'source_step_coverage_mismatch',
      path: 'exportSuggestion.steps',
      message: 'exportSuggestion steps must trace every source step exactly once and in order',
    });
  }
  return issues;
}

/**
 * Validate the semantic part of the v10 recipe-analyze contract after the
 * provider's strict JSON schema has been applied.
 */
export function validateRecipeAnalyzeOutput(raw: unknown): RecipeAnalyzeValidationResult {
  const parsed = RecipeAnalyzeOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'output'}: ${issue.message}`),
    };
  }

  const data = parsed.data as AiRecipeRaw;
  const errors: string[] = [];
  const ingredientsByKey = new Map<string, AiRecipeIngredientLine>();

  for (const ingredient of data.ingredients) {
    if (ingredientsByKey.has(ingredient.analysisKey)) {
      errors.push(`ingredients.analysisKey must be unique: ${ingredient.analysisKey}`);
    } else {
      ingredientsByKey.set(ingredient.analysisKey, ingredient);
    }
  }

  const includedKeys = new Set<string>();
  for (const key of data.exportSuggestion.includedIngredientKeys) {
    if (includedKeys.has(key)) {
      errors.push(`exportSuggestion.includedIngredientKeys must be unique: ${key}`);
      continue;
    }
    includedKeys.add(key);

    const ingredient = ingredientsByKey.get(key);
    if (!ingredient) {
      errors.push(`exportSuggestion.includedIngredientKeys references an unknown ingredient: ${key}`);
    } else if (ingredient.category === 'seasoning') {
      errors.push(`exportSuggestion.includedIngredientKeys cannot include seasoning: ${key}`);
    }
  }

  let previousIncludedIngredientIndex = -1;
  for (const key of data.exportSuggestion.includedIngredientKeys) {
    const ingredientIndex = data.ingredients.findIndex((ingredient) => ingredient.analysisKey === key);
    if (ingredientIndex <= previousIncludedIngredientIndex) {
      errors.push('exportSuggestion.includedIngredientKeys must preserve ingredient order');
      break;
    }
    previousIncludedIngredientIndex = ingredientIndex;
  }

  errors.push(...validateExportStepTrace(data).map((issue) => issue.message));
  for (const step of data.exportSuggestion.steps) {
    const stepIngredientKeys = new Set<string>();
    for (const key of step.ingredientKeys) {
      if (stepIngredientKeys.has(key)) {
        errors.push(`exportSuggestion step ${step.order} ingredientKeys must be unique: ${key}`);
      }
      stepIngredientKeys.add(key);
      if (!ingredientsByKey.has(key)) {
        errors.push(`exportSuggestion step ${step.order} references an unknown ingredient: ${key}`);
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, data };
}