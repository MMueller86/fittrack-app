import type {
  RecipeExportStep,
  RecipeExportViewInput,
  RecipeExportViewRequest,
} from '@fittrack/shared';
import {
  RECIPE_EXPORT_MAX_INGREDIENTS,
  RECIPE_EXPORT_MAX_STEP_LENGTH,
  RECIPE_EXPORT_MAX_STEPS,
  RECIPE_EXPORT_MAX_TEASER_LENGTH,
  RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES,
  RECIPE_EXPORT_MIN_STEPS,
} from '../../../../shared/types/recipeExport';
import type {
  WizardExportDraft,
  WizardIngredient,
} from './recipeWizardTypes';

export interface WizardExportIngredientResolution {
  includedIngredientIds: string[];
  unresolvedAnalysisKeys: string[];
  unresolvedIngredientIds: string[];
  collidingAnalysisKeys: string[];
}

export interface WizardExportValidation {
  exportView: RecipeExportViewInput | null;
  errors: string[];
  ingredientResolution: WizardExportIngredientResolution;
}

export interface PendingRecipeExportDraft {
  version: 1;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: string | null;
  steps: RecipeExportStep[];
  includedIngredientIds: string[];
}

interface SelectedIngredient {
  id: string;
  analysisKey: string;
}

function isFoodIngredient(ingredient: WizardIngredient): boolean {
  return ingredient.resolvedIngredient != null
    && (ingredient.resolvedIngredient.category ?? 'food') !== 'seasoning';
}

export function resolveWizardExportIngredients(
  draft: WizardExportDraft,
  ingredients: WizardIngredient[],
): WizardExportIngredientResolution {
  const selectedByKey: SelectedIngredient[] = [];
  const selectedById: string[] = [];
  const unresolvedAnalysisKeys: string[] = [];
  const unresolvedIngredientIds: string[] = [];
  const collidingAnalysisKeys: string[] = [];

  for (const analysisKey of draft.includedIngredientKeys) {
    const matches = ingredients.filter((ingredient) => ingredient.analysisKey === analysisKey);
    const ingredient = matches.length === 1 ? matches[0] : undefined;
    if (!ingredient || !ingredient.userConfirmed || !isFoodIngredient(ingredient)) {
      unresolvedAnalysisKeys.push(analysisKey);
      continue;
    }
    selectedByKey.push({ id: ingredient.resolvedIngredient!.id, analysisKey });
  }

  for (const ingredientId of draft.includedIngredientIds) {
    const matches = ingredients.filter((ingredient) => ingredient.resolvedIngredient?.id === ingredientId);
    const ingredient = matches.length === 1 ? matches[0] : undefined;
    if (!ingredient || !ingredient.userConfirmed || !isFoodIngredient(ingredient)) {
      unresolvedIngredientIds.push(ingredientId);
      continue;
    }
    selectedById.push(ingredientId);
  }

  const assignmentsById = new Map<string, string[]>();
  for (const assignment of selectedByKey) {
    const assignedKeys = assignmentsById.get(assignment.id) ?? [];
    assignedKeys.push(assignment.analysisKey);
    assignmentsById.set(assignment.id, assignedKeys);
  }

  const collidingKeys = new Set<string>();
  for (const assignedKeys of assignmentsById.values()) {
    if (assignedKeys.length < 2) continue;
    for (const analysisKey of assignedKeys) collidingKeys.add(analysisKey);
  }
  collidingAnalysisKeys.push(...collidingKeys);
  for (const analysisKey of collidingKeys) {
    unresolvedAnalysisKeys.push(analysisKey);
  }

  const manualIdCounts = new Map<string, number>();
  for (const ingredientId of selectedById) {
    manualIdCounts.set(ingredientId, (manualIdCounts.get(ingredientId) ?? 0) + 1);
  }
  for (const [ingredientId, count] of manualIdCounts) {
    if (count > 1) unresolvedIngredientIds.push(ingredientId);
  }

  const includedIngredientIds = Array.from(new Set([
    ...selectedByKey
      .filter((assignment) => !collidingKeys.has(assignment.analysisKey ?? ''))
      .map((assignment) => assignment.id),
    ...selectedById.filter((ingredientId) => manualIdCounts.get(ingredientId) === 1),
  ]));

  return {
    includedIngredientIds,
    unresolvedAnalysisKeys: [...new Set(unresolvedAnalysisKeys)],
    unresolvedIngredientIds: [...new Set(unresolvedIngredientIds)],
    collidingAnalysisKeys: [...new Set(collidingAnalysisKeys)],
  };
}

export function buildPendingRecipeExportDraft(
  draft: WizardExportDraft | null,
  ingredients: WizardIngredient[],
): PendingRecipeExportDraft | undefined {
  if (draft?.source !== 'analysis') return undefined;

  const totalTimeText = draft.totalTimeMinutes.trim();
  const parsedTotalTime = /^\d+$/.test(totalTimeText) ? Number(totalTimeText) : Number.NaN;

  return {
    version: draft.version,
    teaser: draft.teaser,
    totalTimeMinutes: Number.isSafeInteger(parsedTotalTime) ? parsedTotalTime : null,
    difficulty: draft.difficulty.trim() || null,
    steps: draft.steps.map((step, index) => ({
      order: index + 1,
      description: step.description,
    })),
    includedIngredientIds: resolveWizardExportIngredients(draft, ingredients).includedIngredientIds,
  };
}

export function validateWizardExportDraft(
  draft: WizardExportDraft,
  ingredients: WizardIngredient[],
): WizardExportValidation {
  const errors: string[] = [];
  const teaser = draft.teaser.trim();
  const totalTimeText = draft.totalTimeMinutes.trim();
  const totalTimeMinutes = /^\d+$/.test(totalTimeText) ? Number(totalTimeText) : Number.NaN;
  const difficulty = draft.difficulty.trim();
  const ingredientResolution = resolveWizardExportIngredients(draft, ingredients);

  if (teaser.length === 0) errors.push('Bitte gib einen Teaser ein.');
  else if (teaser.length > RECIPE_EXPORT_MAX_TEASER_LENGTH) {
    errors.push(`Der Teaser darf höchstens ${RECIPE_EXPORT_MAX_TEASER_LENGTH} Zeichen umfassen.`);
  }

  if (!Number.isSafeInteger(totalTimeMinutes)
    || totalTimeMinutes < 1
    || totalTimeMinutes > RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES) {
    errors.push(`Bitte gib eine ganze Zubereitungszeit zwischen 1 und ${RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES} Minuten an.`);
  }

  if (difficulty.length === 0 || /[\r\n]/.test(difficulty)) {
    errors.push('Bitte gib eine Schwierigkeit in einer Zeile an.');
  }

  if (draft.steps.length < RECIPE_EXPORT_MIN_STEPS) {
    errors.push('Die Exportansicht benötigt mindestens einen Zubereitungsschritt.');
  } else if (draft.steps.length > RECIPE_EXPORT_MAX_STEPS) {
    errors.push(`Es sind höchstens ${RECIPE_EXPORT_MAX_STEPS} Exportschritte erlaubt.`);
  }

  draft.steps.forEach((step, index) => {
    const description = step.description.trim();
    if (description.length === 0) errors.push(`Exportschritt ${index + 1} darf nicht leer sein.`);
    else if (description.length > RECIPE_EXPORT_MAX_STEP_LENGTH) {
      errors.push(`Exportschritt ${index + 1} darf höchstens ${RECIPE_EXPORT_MAX_STEP_LENGTH} Zeichen umfassen.`);
    }
  });

  if (ingredientResolution.unresolvedAnalysisKeys.length > 0) {
    errors.push('Bestätige oder entferne alle nicht eindeutig zugeordneten KI-Zutaten.');
  }
  if (ingredientResolution.unresolvedIngredientIds.length > 0) {
    errors.push('Prüfe die ausgewählten Zutaten und ihre Bestätigung.');
  }
  if (ingredientResolution.collidingAnalysisKeys.length > 0) {
    errors.push('Eine Rezeptzutat kann nur einer KI-Zutat zugeordnet werden.');
  }
  if (ingredientResolution.includedIngredientIds.length > RECIPE_EXPORT_MAX_INGREDIENTS) {
    errors.push(`Es können höchstens ${RECIPE_EXPORT_MAX_INGREDIENTS} Zutaten ausgewählt werden.`);
  }

  if (errors.length > 0) {
    return { exportView: null, errors, ingredientResolution };
  }

  return {
    exportView: {
      version: draft.version,
      teaser,
      totalTimeMinutes,
      difficulty,
      steps: draft.steps.map((step, index) => ({
        order: index + 1,
        description: step.description.trim(),
      })),
      includedIngredientIds: ingredientResolution.includedIngredientIds,
    },
    errors,
    ingredientResolution,
  };
}

export function buildConfirmedWizardExportRequest(
  draft: WizardExportDraft | null,
  ingredients: WizardIngredient[],
): RecipeExportViewRequest | null {
  if (!draft?.confirmed) return null;
  const validation = validateWizardExportDraft(draft, ingredients);
  if (!validation.exportView) return null;
  return {
    exportView: validation.exportView,
    exportViewAction: 'confirm',
  };
}

export function getRecipeWizardHttpStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) return null;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) return null;
  return typeof response.status === 'number' ? response.status : null;
}

export function isRecipeRevisionConflict(error: unknown): boolean {
  if (getRecipeWizardHttpStatus(error) !== 412
    || typeof error !== 'object'
    || error === null
    || !('response' in error)) {
    return false;
  }

  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) {
    return false;
  }

  const data = response.data;
  return typeof data === 'object'
    && data !== null
    && 'error' in data
    && data.error === 'recipe_revision_conflict';
}