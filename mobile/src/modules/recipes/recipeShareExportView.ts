import type {
  PrepareRecipeExportViewSuggestionV2,
  Recipe,
  RecipeExportViewInput,
  RecipeShareBundleExportDraft,
} from '@fittrack/shared';
import type { PendingRecipeExportDraft } from './recipeWizardExportView';
import {
  buildWizardExportDraftFromPreparedSuggestion,
  buildWizardExportDraftFromRecipe,
  buildWizardIngredientFromRecipeIngredient,
} from './recipeWizardEditBootstrap';
import { validateWizardExportDraft } from './recipeWizardExportView';
import type { WizardExportDraft } from './recipeWizardTypes';

export function buildRecipeShareExportDraftFromStored(recipe: Recipe): WizardExportDraft | null {
  return recipe.exportView
    ? buildWizardExportDraftFromRecipe(recipe)
    : null;
}

export function buildRecipeShareExportDraftFromPending(
  pending: PendingRecipeExportDraft,
): WizardExportDraft {
  return {
    version: pending.version,
    teaser: pending.teaser,
    totalTimeMinutes: pending.totalTimeMinutes == null ? '' : String(pending.totalTimeMinutes),
    difficulty: pending.difficulty ?? '',
    steps: pending.steps.map((step, index) => ({
      order: index + 1,
      description: step.description,
    })),
    includedIngredientIds: [...pending.includedIngredientIds],
    includedIngredientKeys: [],
    analysisIngredientKeys: [],
    source: 'analysis',
    confirmed: false,
  };
}

export function buildRecipeShareExportDraftFromPreparation(
  recipe: Recipe,
  suggestion: PrepareRecipeExportViewSuggestionV2,
): WizardExportDraft {
  const legacyDefaults = buildWizardExportDraftFromRecipe(recipe);
  return buildWizardExportDraftFromPreparedSuggestion(suggestion, legacyDefaults);
}

export function validateRecipeShareExportDraft(
  draft: WizardExportDraft,
  recipe: Recipe,
) {
  const validation = validateWizardExportDraft(
    {
      ...draft,
      includedIngredientKeys: [],
      analysisIngredientKeys: [],
      confirmed: false,
    },
    recipe.ingredients.map(buildWizardIngredientFromRecipeIngredient),
  );
  const totalTimeText = draft.totalTimeMinutes.trim();
  const difficultyText = draft.difficulty.trim();
  const timeValidationError = 'Bitte gib eine ganze Zubereitungszeit zwischen 1 und 10080 Minuten an.';
  const difficultyValidationError = 'Bitte gib eine Schwierigkeit in einer Zeile an.';
  const previewErrors = validation.errors.filter((error) => (
    !(totalTimeText.length === 0 && error === timeValidationError)
    && !(difficultyText.length === 0 && error === difficultyValidationError)
  ));
  const parsedTotalTime = /^\d+$/.test(totalTimeText) ? Number(totalTimeText) : null;
  const bundleDraft: RecipeShareBundleExportDraft | null = previewErrors.length === 0
    ? {
        version: draft.version,
        teaser: draft.teaser.trim(),
        totalTimeMinutes: parsedTotalTime,
        difficulty: difficultyText || null,
        steps: draft.steps.map((step, index) => ({
          order: index + 1,
          description: step.description.trim(),
        })),
        includedIngredientIds: [...validation.ingredientResolution.includedIngredientIds],
      }
    : null;

  return {
    ...validation,
    bundleDraft,
    previewErrors,
    saveErrors: validation.errors,
  };
}

export function buildRecipeShareExportDraftFromView(
  exportView: RecipeExportViewInput,
): WizardExportDraft {
  return {
    version: exportView.version,
    teaser: exportView.teaser,
    totalTimeMinutes: String(exportView.totalTimeMinutes),
    difficulty: exportView.difficulty,
    steps: exportView.steps.map((step) => ({ ...step })),
    includedIngredientIds: [...exportView.includedIngredientIds],
    includedIngredientKeys: [],
    analysisIngredientKeys: [],
    source: 'persisted',
    confirmed: false,
  };
}

export function isSameRecipeExportView(
  current: Recipe['exportView'] | undefined,
  candidate: RecipeExportViewInput,
): boolean {
  if (!current || current.version !== candidate.version
    || current.teaser !== candidate.teaser
    || current.totalTimeMinutes !== candidate.totalTimeMinutes
    || current.difficulty !== candidate.difficulty
    || current.steps.length !== candidate.steps.length
    || current.includedIngredientIds.length !== candidate.includedIngredientIds.length) {
    return false;
  }

  return current.steps.every((step, index) => {
    const candidateStep = candidate.steps[index];
    return candidateStep != null
      && step.order === candidateStep.order
      && step.description === candidateStep.description;
  }) && current.includedIngredientIds.every((id, index) => (
    id === candidate.includedIngredientIds[index]
  ));
}