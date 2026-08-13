import { describe, expect, it } from 'vitest';
import {
  buildRecipeDetailAfterSaveParams,
  canRunRecipeWizardAnalysis,
  consumeRecipeDetailNavigationIntent,
  getRecipeWizardPreviousPhase,
  RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL,
} from './recipeWizardNavigation';

describe('recipe wizard navigation', () => {
  it('keeps create mode back navigation from ingredients on the recipe input phase', () => {
    expect(getRecipeWizardPreviousPhase('ingredients', false)).toBe('input');
  });

  it('does not expose the recipe input phase as previous phase in edit mode', () => {
    expect(getRecipeWizardPreviousPhase('ingredients', true)).toBeNull();
  });

  it('keeps later edit phases navigable inside the edit flow', () => {
    expect(getRecipeWizardPreviousPhase('steps', true)).toBe('ingredients');
    expect(getRecipeWizardPreviousPhase('preview', true)).toBe('steps');
  });

  it('allows recipe analysis only for meaningful create-mode input', () => {
    expect(canRunRecipeWizardAnalysis(false, true)).toBe(true);
    expect(canRunRecipeWizardAnalysis(false, false)).toBe(false);
    expect(canRunRecipeWizardAnalysis(true, true)).toBe(false);
  });

  it('adds the one-time log-modal intent to the post-save detail route', () => {
    expect(buildRecipeDetailAfterSaveParams('recipe-1')).toEqual({
      id: 'recipe-1',
      intent: RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL,
    });
  });

  it('consumes the post-save log-modal intent only once', () => {
    const consumedRef = { current: false };

    expect(consumeRecipeDetailNavigationIntent(RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL, consumedRef)).toBe(true);
    expect(consumedRef.current).toBe(true);
    expect(consumeRecipeDetailNavigationIntent(RECIPE_DETAIL_INTENT_OPEN_LOG_MODAL, consumedRef)).toBe(false);
  });

  it('does not consume an absent detail intent', () => {
    const consumedRef = { current: false };

    expect(consumeRecipeDetailNavigationIntent(undefined, consumedRef)).toBe(false);
    expect(consumedRef.current).toBe(false);
  });
});