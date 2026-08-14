import { describe, expect, it } from 'vitest';
import { scaleRecipeText } from '../openai';
import { RECIPE_SCALE_PROMPT_VERSION } from './recipeScale';
import { RECIPE_SCALE_EVAL_FIXTURES } from './recipeScale.eval.fixtures';

/** Update this constant whenever RECIPE_SCALE_PROMPT_VERSION changes and re-review the fixtures. */
const TESTED_PROMPT_VERSION = 'v1';

it('prompt version matches fixture expectations', () => {
  expect(RECIPE_SCALE_PROMPT_VERSION).toBe(TESTED_PROMPT_VERSION);
});

const hasCredentials =
  !!process.env['AZURE_OPENAI_ENDPOINT'] && !!process.env['AZURE_OPENAI_API_KEY'];

describe.skipIf(!hasCredentials)('recipeScale: live prompt evaluation', () => {
  it.each(RECIPE_SCALE_EVAL_FIXTURES)('[$id] $description', async (fixture) => {
    const result = await scaleRecipeText(fixture.input);

    expect(result.description === null || typeof result.description === 'string').toBe(true);
    expect(result.steps).toHaveLength(fixture.constraints.expectedStepOrders.length);
    expect(result.steps.map((step) => step.order)).toEqual(fixture.constraints.expectedStepOrders);

    for (const step of result.steps) {
      expect(typeof step.description).toBe('string');
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.title === null || typeof step.title === 'string').toBe(true);
    }

    if (fixture.constraints.descriptionMustBeNull) {
      expect(result.description).toBeNull();
    }

    for (const [index, requiredText] of fixture.constraints.unchangedTextByStep.entries()) {
      if (requiredText !== undefined) {
        expect(result.steps[index]?.description).toContain(requiredText);
      }
    }
  });
});
