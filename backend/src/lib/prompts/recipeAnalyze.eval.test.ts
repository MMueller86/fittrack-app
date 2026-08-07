// Prompt eval tests for recipeAnalyze (RECIPE_ANALYZE_PROMPT_VERSION).
//
// These tests make real Azure OpenAI API calls and are intentionally excluded
// from the default `npm test` run. Run explicitly via `npm run test:eval`.
//
// Three eval layers per fixture:
//   Layer 1 — Structural: required fields, correct types, non-negative values.
//   Layer 2 — Semantic:   category classification and amountGrams ranges from reviewed fixtures.
//   Layer 3 — Edge-case:  critical prompt rules (no invented items, exact counts).
//
// Tests are skipped automatically when AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY are absent.
// The prompt version guard runs unconditionally and fails immediately on a version mismatch.

import { describe, it, expect } from 'vitest';
import { analyzeRecipeText } from '../openai';
import type { AiRecipeIngredientLine } from '../openai';
import { RECIPE_ANALYZE_PROMPT_VERSION } from './recipeAnalyze';
import {
  RECIPE_ANALYZE_EVAL_FIXTURES,
  type AmountGramsConstraint,
  type IngredientConstraint,
} from './recipeAnalyze.eval.fixtures';

// ---------------------------------------------------------------------------
// Prompt version guard — runs without credentials
// Fails immediately if the prompt was bumped without updating the fixtures.
// ---------------------------------------------------------------------------

/** Update this constant whenever RECIPE_ANALYZE_PROMPT_VERSION changes and re-review all fixtures. */
const TESTED_PROMPT_VERSION = 'v4';

it('prompt version matches fixture expectations', () => {
  expect(RECIPE_ANALYZE_PROMPT_VERSION).toBe(TESTED_PROMPT_VERSION);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findIngredient(
  ingredients: AiRecipeIngredientLine[],
  displayNameContains: string,
): AiRecipeIngredientLine | undefined {
  return ingredients.find((i) =>
    i.displayName.toLowerCase().includes(displayNameContains.toLowerCase()),
  );
}

function assertAmountGrams(
  actual: number | null,
  constraint: AmountGramsConstraint,
  label: string,
): void {
  if (constraint === null) {
    expect(actual, `${label}: expected amountGrams to be null`).toBeNull();
  } else if (constraint === 'not-null') {
    expect(actual, `${label}: expected amountGrams to be non-null (estimated)`).not.toBeNull();
  } else {
    expect(
      actual,
      `${label}: expected amountGrams >= ${constraint.min}`,
    ).toBeGreaterThanOrEqual(constraint.min);
    expect(
      actual,
      `${label}: expected amountGrams <= ${constraint.max}`,
    ).toBeLessThanOrEqual(constraint.max);
  }
}

function assertIngredientConstraint(
  ingredients: AiRecipeIngredientLine[],
  ic: IngredientConstraint,
): void {
  const found = findIngredient(ingredients, ic.displayNameContains);
  expect(
    found,
    `Expected an ingredient matching "${ic.displayNameContains}" in the output`,
  ).toBeDefined();
  if (!found) return;

  expect(
    found.category,
    `"${found.displayName}": expected category="${ic.category}"`,
  ).toBe(ic.category);

  if (ic.amountGrams !== undefined) {
    assertAmountGrams(found.amountGrams, ic.amountGrams, found.displayName);
  }
}

// ---------------------------------------------------------------------------
// Live eval tests — skipped when credentials are absent
// ---------------------------------------------------------------------------

const hasCredentials =
  !!process.env['AZURE_OPENAI_ENDPOINT'] && !!process.env['AZURE_OPENAI_API_KEY'];

describe.skipIf(!hasCredentials)('recipeAnalyze: live prompt evaluation', () => {
  it.each(RECIPE_ANALYZE_EVAL_FIXTURES)('[$id] $description', async (fixture) => {
    const result = await analyzeRecipeText(fixture.input);
    const { constraints } = fixture;

    // --- Layer 1: Structural / schema assertions ---

    expect(result.suggestedName, 'suggestedName must be non-empty').toBeTruthy();
    expect(result.description, 'description must be non-empty').toBeTruthy();
    expect(Array.isArray(result.ingredients), 'ingredients must be an array').toBe(true);
    expect(Array.isArray(result.steps), 'steps must be an array').toBe(true);
    expect(typeof result.suggestedPortions).toBe('number');
    expect(result.suggestedPortions, 'suggestedPortions must be > 0').toBeGreaterThan(0);

    for (const ing of result.ingredients) {
      expect(
        ['food', 'seasoning'],
        `ingredient.category must be 'food' or 'seasoning', got "${ing.category}"`,
      ).toContain(ing.category);
      expect(
        ing.amountGrams === null || typeof ing.amountGrams === 'number',
        `amountGrams must be number | null, got ${typeof ing.amountGrams}`,
      ).toBe(true);
      if (typeof ing.amountGrams === 'number') {
        expect(ing.amountGrams, `amountGrams must be >= 0`).toBeGreaterThanOrEqual(0);
      }
    }

    // --- Layer 1: Portions range ---

    if (constraints.suggestedPortionsMin !== undefined) {
      expect(result.suggestedPortions).toBeGreaterThanOrEqual(constraints.suggestedPortionsMin);
    }
    if (constraints.suggestedPortionsMax !== undefined) {
      expect(result.suggestedPortions).toBeLessThanOrEqual(constraints.suggestedPortionsMax);
    }

    // --- Layer 3: No lost or invented ingredients (exact count) ---

    if (constraints.exactIngredientCount !== undefined) {
      expect(
        result.ingredients,
        `expected exactly ${constraints.exactIngredientCount} ingredients`,
      ).toHaveLength(constraints.exactIngredientCount);
    }

    // --- Layer 2: Semantic constraint assertions (from reviewed fixtures) ---

    for (const ic of constraints.ingredients) {
      assertIngredientConstraint(result.ingredients, ic);
    }
  });
});
