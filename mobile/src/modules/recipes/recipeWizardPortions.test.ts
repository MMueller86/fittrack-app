import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECIPE_WIZARD_PORTIONS,
  isValidRecipeWizardPortions,
  normalizeRecipeWizardPortions,
  stepRecipeWizardPortions,
} from './recipeWizardPortions';

describe('recipe wizard portions', () => {
  it.each([1, 50])('accepts the boundary value %s', (value) => {
    expect(isValidRecipeWizardPortions(value)).toBe(true);
    expect(normalizeRecipeWizardPortions(value)).toBe(value);
  });

  it.each([0, 51, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2', null, undefined])(
    'rejects invalid portion value %s',
    (value) => {
      expect(isValidRecipeWizardPortions(value)).toBe(false);
      expect(normalizeRecipeWizardPortions(value)).toBe(DEFAULT_RECIPE_WIZARD_PORTIONS);
    },
  );

  it('keeps the stepper at both boundaries', () => {
    expect(stepRecipeWizardPortions(1, -1)).toBe(1);
    expect(stepRecipeWizardPortions(50, 1)).toBe(50);
  });

  it('steps by one for valid values', () => {
    expect(stepRecipeWizardPortions(1, 1)).toBe(2);
    expect(stepRecipeWizardPortions(50, -1)).toBe(49);
  });
});