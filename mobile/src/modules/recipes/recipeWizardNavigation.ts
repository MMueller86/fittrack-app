import type { WizardPhase } from './recipeWizardTypes';
import type { PendingRecipeExportDraft } from './recipeWizardExportView';

export const RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL = 'openLogRecipeModal' as const;
export type RecipeDetailNavigationIntent = typeof RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL;

export type RecipeDetailNavigationParams = {
  id: string;
  intent?: RecipeDetailNavigationIntent;
  pendingExportDraft?: PendingRecipeExportDraft;
};

export function buildRecipeDetailAfterSaveParams(
  id: string,
  pendingExportDraft?: PendingRecipeExportDraft,
): RecipeDetailNavigationParams {
  return {
    id,
    intent: RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL,
    ...(pendingExportDraft ? { pendingExportDraft } : {}),
  };
}

export function consumeRecipeDetailNavigationIntent(
  intent: RecipeDetailNavigationIntent | undefined,
  consumedRef: { current: boolean },
): boolean {
  if (consumedRef.current || intent !== RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL) return false;
  consumedRef.current = true;
  return true;
}

const PHASE_PREV: Record<WizardPhase, WizardPhase> = {
  input: 'input',
  analyzing: 'input',
  ingredients: 'input',
  steps: 'ingredients',
  preview: 'steps',
};

export function getRecipeWizardPreviousPhase(phase: WizardPhase, isEdit: boolean): WizardPhase | null {
  if (isEdit && phase === 'ingredients') return null;
  return PHASE_PREV[phase];
}

export function canRunRecipeWizardAnalysis(isEdit: boolean, hasMeaningfulRecipeText: boolean): boolean {
  return !isEdit && hasMeaningfulRecipeText;
}