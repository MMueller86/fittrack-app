import { RECIPE_PORTION_MAX, RECIPE_PORTION_MIN } from '@fittrack/shared';

export const DEFAULT_RECIPE_WIZARD_PORTIONS = 4;

export function isValidRecipeWizardPortions(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= RECIPE_PORTION_MIN
    && value <= RECIPE_PORTION_MAX;
}

export function normalizeRecipeWizardPortions(value: unknown): number {
  return isValidRecipeWizardPortions(value)
    ? value
    : DEFAULT_RECIPE_WIZARD_PORTIONS;
}

export function stepRecipeWizardPortions(value: number, delta: -1 | 1): number {
  const current = normalizeRecipeWizardPortions(value);
  return Math.max(
    RECIPE_PORTION_MIN,
    Math.min(RECIPE_PORTION_MAX, current + delta),
  );
}