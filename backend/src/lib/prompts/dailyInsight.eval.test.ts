import { describe, expect, it } from 'vitest';
import { generateDailyInsight } from '../openai';
import { DailyInsightValidationError } from '../dailyInsightValidation';
import { DAILY_INSIGHT_PROMPT_VERSION } from './dailyInsightPrompt';
import { DAILY_INSIGHT_EVAL_FIXTURES } from './dailyInsight.eval.fixtures';

const TESTED_PROMPT_VERSION = 'v15';

it('daily insight prompt version matches fixture expectations', () => {
  expect(DAILY_INSIGHT_PROMPT_VERSION).toBe(TESTED_PROMPT_VERSION);
});

const hasCredentials =
  !!process.env['AZURE_OPENAI_ENDPOINT'] && !!process.env['AZURE_OPENAI_API_KEY'];
const evaluationStatus = hasCredentials ? 'VERIFIED' : 'UNVERIFIED';

describe('dailyInsight: live prompt evaluation', () => {
  it.each(DAILY_INSIGHT_EVAL_FIXTURES)(`[${evaluationStatus}] [$id] $description`, async (fixture) => {
    if (!hasCredentials) return;

    let result: Awaited<ReturnType<typeof generateDailyInsight>>;
    try {
      result = await generateDailyInsight(fixture.input);
    } catch (error) {
      const expectedErrors = fixture.expectUnavailableOnValidationError;
      if (
        expectedErrors != null
        && error instanceof DailyInsightValidationError
        && (Array.isArray(expectedErrors)
          ? expectedErrors.includes(error.message)
          : error.message === expectedErrors)
      ) {
        return;
      }
      throw error;
    }

    expect(result.intent).toBe(fixture.intent);
    expect(result.response.title.length).toBeGreaterThan(0);
    expect(result.response.title.length).toBeLessThanOrEqual(40);
    expect(result.response.summary.length).toBeGreaterThan(0);

    const summaryWordCount = result.response.summary.trim().split(/\s+/).length;
    expect(summaryWordCount).toBeGreaterThanOrEqual(45);
    expect(summaryWordCount).toBeLessThanOrEqual(140);

    const lowerText = [
      result.response.title,
      result.response.summary,
      result.response.recommendation,
      result.response.cta,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('de-DE');

    expect(lowerText).toMatch(/\b(du|dein|deine|deinem|deinen|dir)\b/);
    expect(result.response.cta == null).toBe(result.response.ctaTarget == null);

    if (fixture.expectNullActionFields) {
      expect(result.response.recommendation).toBeUndefined();
      expect(result.response.cta).toBeUndefined();
      expect(result.response.ctaTarget).toBeUndefined();
    }

    for (const phrase of fixture.forbiddenPhrases) {
      expect(lowerText).not.toContain(phrase);
    }

    for (const [index, alternatives] of (fixture.requiredPhraseGroups ?? []).entries()) {
      expect(
        alternatives.some((phrase) => lowerText.includes(phrase.toLocaleLowerCase('de-DE'))),
        `required concept group ${index + 1} missing; expected one of: ${alternatives.join(', ')}; output: ${lowerText}`,
      ).toBe(true);
    }
  });
});