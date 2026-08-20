import { describe, expect, it } from 'vitest';

import { generateWeeklyInsight } from '../openai';
import { WEEKLY_INSIGHT_PROMPT_VERSION, WEEKLY_INSIGHT_TEXT_MAX_LENGTH } from './weeklyInsightV2';
import { WEEKLY_INSIGHT_EVAL_FIXTURES } from './weeklyInsight.eval.fixtures';

/** Update this constant whenever WEEKLY_INSIGHT_PROMPT_VERSION changes and re-review the fixtures. */
const TESTED_PROMPT_VERSION = 'v2';

it('weekly insight prompt version matches fixture expectations', () => {
  expect(WEEKLY_INSIGHT_PROMPT_VERSION).toBe(TESTED_PROMPT_VERSION);
});

const hasCredentials =
  !!process.env['AZURE_OPENAI_ENDPOINT'] && !!process.env['AZURE_OPENAI_API_KEY'];

describe.skipIf(!hasCredentials)('weeklyInsight: live prompt evaluation', () => {
  it.each(WEEKLY_INSIGHT_EVAL_FIXTURES)('[$id] $description', async (fixture) => {
    const result = await generateWeeklyInsight(fixture.input);

    expect(typeof result.text).toBe('string');
    expect(result.text.trim().length).toBeGreaterThan(0);
    expect(result.text.length).toBeLessThanOrEqual(WEEKLY_INSIGHT_TEXT_MAX_LENGTH);

    const lowerText = result.text.toLocaleLowerCase('de-DE');
    for (const phrase of fixture.forbiddenPhrases) {
      expect(lowerText).not.toContain(phrase);
    }
  });
});