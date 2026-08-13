import type { WizardPhase } from './recipeWizardTypes';

export const RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL = 'openLogRecipeModal' as const;
export type RecipeDetailNavigationIntent = typeof RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL;

export type RecipeDetailNavigationParams = {
  id: string;
  intent?: RecipeDetailNavigationIntent;
};

export function buildRecipeDetailAfterSaveParams(id: string): RecipeDetailNavigationParams {
  return {
    id,
    intent: RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL,
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