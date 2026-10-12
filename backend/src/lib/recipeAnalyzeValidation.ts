import { z } from 'zod';
import type { AiRecipeIngredientLine, AiRecipeRaw, RecipePreparationContext, RecipeExportPreparationOutput } from './openai';
import {
  RECIPE_EXPORT_MAX_INGREDIENTS,
  RECIPE_EXPORT_MAX_STEP_LENGTH,
  RECIPE_EXPORT_MAX_STEPS,
  RECIPE_EXPORT_MAX_TEASER_LENGTH,
  RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES,
  RECIPE_EXPORT_MIN_STEPS,
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
  steps: z.array(RecipeAnalyzeExportStepSchema).min(RECIPE_EXPORT_MIN_STEPS).max(RECIPE_EXPORT_MAX_STEPS),
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
  version: z.literal(1),
  teaser: z.string().min(1).max(RECIPE_EXPORT_MAX_TEASER_LENGTH).refine((value) => value.trim().length > 0),
  totalTimeMinutes: z.number().finite().int().positive().max(RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES).nullable(),
  difficulty: SingleLineTextSchema.refine((value) => value === value.trim()).nullable(),
  steps: z.array(RecipeAnalyzeExportStepSchema.omit({ ingredientKeys: true }))
    .min(RECIPE_EXPORT_MIN_STEPS).max(RECIPE_EXPORT_MAX_STEPS),
}).strict();

const RecipePreparationSourceSchema = z.array(z.object({
  order: z.number().finite().int().positive(),
  title: z.string().optional(),
  description: NonEmptyTextSchema,
}).strict()).min(1);

export interface RecipeExportPreparationDiagnostic {
  phase: 'schema' | 'semantic' | 'template';
  code: string;
  path: string;
  stepIndex?: number;
  stepOrder?: number;
  constraint?: string;
  allowedRange?: { min?: number; max?: number };
  offendingReferences?: number[];
  explanation?: string;
  layout?: 'large' | 'compact';
  stepCount?: number;
  font?: { family: string; size: number; weight: number; style: string; lineHeight: number };
  actual?: { width: number; height?: number };
  bounds?: { width: number; height?: number; tolerance: number };
  textLength?: number;
}

interface RecipeExportStepTraceIssue extends RecipeExportPreparationDiagnostic {
  phase: 'semantic';
  message: string;
}

function preparationSchemaDiagnostics(issues: z.ZodIssue[], prefix = '', raw?: unknown): RecipeExportPreparationDiagnostic[] {
  return issues.map((issue) => {
    const stepIndex = issue.path[0] === 'steps' && typeof issue.path[1] === 'number' ? issue.path[1] : undefined;
    const candidate = raw as { steps?: Array<{ order?: unknown; sourceStepOrders?: unknown[] }> } | undefined;
    const order = stepIndex !== undefined ? candidate?.steps?.[stepIndex]?.order : undefined;
    const referenceIndex = issue.path[2] === 'sourceStepOrders' && typeof issue.path[3] === 'number' ? issue.path[3] : undefined;
    const reference = stepIndex !== undefined && referenceIndex !== undefined ? candidate?.steps?.[stepIndex]?.sourceStepOrders?.[referenceIndex] : undefined;
    return {
      phase: 'schema', code: issue.code, path: prefix + formatValidationPath(issue.path),
      ...(stepIndex !== undefined ? { stepIndex } : {}),
      ...(typeof order === 'number' && Number.isFinite(order) ? { stepOrder: order } : {}),
      ...(typeof reference === 'number' && Number.isFinite(reference) ? { offendingReferences: [reference] } : {}),
      constraint: issue.code,
      ...(issue.code === 'too_big' && typeof issue.maximum === 'number' ? { allowedRange: { max: issue.maximum } } : {}),
      ...(issue.code === 'too_small' && typeof issue.minimum === 'number' ? { allowedRange: { min: issue.minimum } } : {}),
      explanation: 'The field must satisfy the strict Preparation schema.',
    };
  });
}

export function validateRecipePreparationSource(savedSource: unknown):
  | { ok: true; data: RecipePreparationContext['steps'] }
  | { ok: false; errors: string[]; diagnostics: RecipeExportPreparationDiagnostic[] } {
  const source = RecipePreparationSourceSchema.safeParse(savedSource);
  if (!source.success) {
    const diagnostics = preparationSchemaDiagnostics(source.error.issues, 'sourceSteps.');
    return { ok: false, diagnostics, errors: diagnostics.map(({ code, path }) => `${code}@${path}`) };
  }
  const diagnostics: RecipeExportPreparationDiagnostic[] = [];
  const indicesByOrder = new Map<number, number[]>();
  source.data.forEach((step, index) => indicesByOrder.set(step.order, [...(indicesByOrder.get(step.order) ?? []), index]));
  source.data.forEach((step, index) => {
    if (indicesByOrder.get(step.order)!.length > 1) {
      diagnostics.push({ phase: 'semantic', code: 'duplicate_source_step_order', path: `sourceSteps[${index}].order` });
    }
    if (index > 0 && step.order <= source.data[index - 1]!.order) {
      diagnostics.push({ phase: 'semantic', code: 'source_step_order_not_ascending', path: `sourceSteps[${index}].order` });
    }
  });
  return diagnostics.length ? { ok: false, diagnostics, errors: diagnostics.map(({ code, path }) => `${code}@${path}`) }
    : { ok: true, data: source.data };
}

export function validateRecipeExportPreparationOutput(raw: unknown, savedSource: RecipePreparationContext['steps']):
  | { ok: true; data: RecipeExportPreparationOutput }
  | { ok: false; errors: string[]; diagnostics: RecipeExportPreparationDiagnostic[] } {
  const parsed = RecipeExportPreparationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'output'}: ${issue.message}`),
      diagnostics: preparationSchemaDiagnostics(parsed.error.issues, '', raw),
    };
  }
  const source = validateRecipePreparationSource(savedSource);
  if (!source.ok) return source;
  const issues: RecipeExportStepTraceIssue[] = [];
  const report = (code: string, index: number, field: string, message: string, offendingReferences?: number[]) => {
    issues.push({ phase: 'semantic', code, path: `steps[${index}].${field}`, stepIndex: index,
      stepOrder: parsed.data.steps[index]!.order, constraint: code, explanation: message, message,
      ...(offendingReferences ? { offendingReferences } : {}) });
  };
  const sourceOrders = source.data.map((step) => step.order);
  const knownOrders = new Set(sourceOrders);
  const referenceIndices = new Map<number, Set<number>>();
  parsed.data.steps.forEach((step, index) => step.sourceStepOrders.forEach((order) => {
    const indices = referenceIndices.get(order) ?? new Set<number>();
    indices.add(index);
    referenceIndices.set(order, indices);
  }));
  let previousFirstReference = 0;
  for (const [index, step] of parsed.data.steps.entries()) {
    if (step.order !== index + 1) {
      report('export_step_order_not_contiguous', index, 'order', 'steps.order must start at 1 and be contiguous');
    }
    if (step.sourceStepOrders[0]! <= previousFirstReference) {
      for (const affected of [index - 1, index]) {
        report('export_source_trace_not_ascending', affected, 'sourceStepOrders', 'groups must be ascending by first reference',
          [parsed.data.steps[affected]!.sourceStepOrders[0]!]);
      }
    }
    previousFirstReference = step.sourceStepOrders[0]!;
    for (const [referenceIndex, order] of step.sourceStepOrders.entries()) {
      if (referenceIndex > 0 && order <= step.sourceStepOrders[referenceIndex - 1]!) {
        report('source_step_references_not_ascending', index, 'sourceStepOrders', 'sourceStepOrders must be ascending within each group', [order]);
      }
      if (!knownOrders.has(order)) {
        report('unknown_source_step_reference', index, 'sourceStepOrders', 'sourceStepOrders references an unknown saved step', [order]);
      }
      if (referenceIndices.get(order)!.size > 1 || step.sourceStepOrders.filter((value) => value === order).length > 1) {
        report('duplicate_export_source_reference', index, 'sourceStepOrders', 'sourceStepOrders must be globally unique', [order]);
      }
    }
  }
  return issues.length > 0
    ? {
        ok: false,
        errors: issues.map((issue) => issue.message),
        diagnostics: issues.map(({ message: _message, ...diagnostic }) => diagnostic),
      }
    : { ok: true, data: parsed.data };
}

/** Semantic contract violations of an otherwise schema-valid import analysis, for one directed model correction. */
export function importContractViolations(raw: unknown): string[] {
  if (!RecipeAnalyzeOutputSchema.safeParse(raw).success) return [];
  const result = validateRecipeAnalyzeOutput(raw);
  return result.ok ? [] : result.errors;
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

function validateExportStepTrace(data: Pick<AiRecipeRaw, 'steps' | 'exportSuggestion'>): RecipeExportStepTraceIssue[] {
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
  if (new Set(flattenedSourceOrders).size !== flattenedSourceOrders.length) {
    issues.push({
      phase: 'semantic',
      code: 'duplicate_export_source_reference',
      path: 'exportSuggestion.steps',
      message: 'exportSuggestion source references must be globally unique',
    });
  }
  for (let index = 1; index < flattenedSourceOrders.length; index += 1) {
    if (flattenedSourceOrders[index]! <= flattenedSourceOrders[index - 1]!) {
      issues.push({
        phase: 'semantic',
        code: 'export_source_trace_not_ascending',
        path: 'exportSuggestion.steps',
        message: 'exportSuggestion source trace must be strictly ascending',
      });
      break;
    }
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