import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __setOpenAiClientForTests,
  generateWeeklyInsight,
  WEEKLY_INSIGHT_TEXT_MAX_LENGTH,
} from './openai';
import type { WeeklyInsightPromptContext } from './prompts/weeklyInsightV2';

const context: WeeklyInsightPromptContext = {
  periodStart: '2026-08-07',
  periodEnd: '2026-08-13',
  days: [{
    date: '2026-08-07',
    consumedCalories: 2100,
    baseTargetCalories: 2200,
    effectiveTargetCalories: 2400,
    activityBonusCalories: 200,
    targetPercent: 87.5,
    dayType: 'training',
    activity: { type: 'cycling', label: 'Radtour' },
    hasNutritionData: true,
  }],
  totals: {
    includedDayCount: 1,
    totalConsumedCalories: 2100,
    totalTargetCalories: 2400,
    averageConsumedCalories: 2100,
    averageTargetCalories: 2400,
    overallTargetPercent: 87.5,
  },
};

function mockClient(content: string, finishReason = 'stop') {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage: { total_tokens: 42 },
  });
  __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
  return create;
}

beforeEach(() => {
  process.env['AZURE_OPENAI_ENDPOINT'] = 'https://example.openai.azure.com';
  process.env['AZURE_OPENAI_API_KEY'] = 'test-key';
});

afterEach(() => {
  __setOpenAiClientForTests(null);
  delete process.env['AZURE_OPENAI_ENDPOINT'];
  delete process.env['AZURE_OPENAI_API_KEY'];
});

describe('generateWeeklyInsight', () => {
  it('uses strict structured output and forwards only the sanitized context', async () => {
    const create = mockClient(JSON.stringify({ text: 'Die Woche zeigt ein gemischtes, aber gut einordenbares Bild.' }));

    await expect(generateWeeklyInsight(context)).resolves.toEqual({
      text: 'Die Woche zeigt ein gemischtes, aber gut einordenbares Bild.',
      tokensUsed: 42,
    });

    const request = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
      response_format: {
        type: string;
        json_schema: {
          name: string;
          strict: boolean;
          schema: {
            additionalProperties: boolean;
            properties: { text: { minLength: number; maxLength: number } };
          };
        };
        max_tokens: number;
      };
    };
    expect(request.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'weekly_insight', strict: true },
    });
    expect(request.response_format.json_schema.schema.additionalProperties).toBe(false);
    expect(request.response_format.json_schema.schema.properties.text).toEqual({
      type: 'string',
      minLength: 1,
      maxLength: WEEKLY_INSIGHT_TEXT_MAX_LENGTH,
    });
    expect(request.max_tokens).toBe(1024);
    expect(request.messages[0]!.content).toContain(`${WEEKLY_INSIGHT_TEXT_MAX_LENGTH} Zeichen`);
    expect(JSON.parse(request.messages[1]!.content)).toEqual(context);
  });

  it('accepts exactly the 750-character boundary and preserves the sentinel', async () => {
    const sentinel = '__END_OF_WEEKLY_REVIEW__';
    const text = `${'x'.repeat(WEEKLY_INSIGHT_TEXT_MAX_LENGTH - sentinel.length)}${sentinel}`;
    mockClient(JSON.stringify({ text: `  ${text}  ` }));

    await expect(generateWeeklyInsight(context)).resolves.toMatchObject({
      text,
      tokensUsed: 42,
    });
    expect(text).toHaveLength(WEEKLY_INSIGHT_TEXT_MAX_LENGTH);
    expect(text.endsWith(sentinel)).toBe(true);
  });

  it('trims surrounding whitespace before returning the validated text', async () => {
    mockClient(JSON.stringify({ text: '  Wochenbewertung.  ' }));

    await expect(generateWeeklyInsight(context)).resolves.toMatchObject({ text: 'Wochenbewertung.' });
  });

  it.each([
    ['zero-length text', JSON.stringify({ text: '' })],
    ['whitespace-only text', JSON.stringify({ text: '   ' })],
    ['751-character text', JSON.stringify({ text: 'x'.repeat(WEEKLY_INSIGHT_TEXT_MAX_LENGTH + 1) })],
    ['additional properties', JSON.stringify({ text: 'Gültiger Text.', extra: 'nicht erlaubt' })],
    ['non-string text', JSON.stringify({ text: 42 })],
  ])('rejects %s after the provider response', async (_caseName, content) => {
    mockClient(content);
    await expect(generateWeeklyInsight(context)).rejects.toThrow();
  });

  it('rejects invalid JSON from the provider', async () => {
    mockClient('{"text":');

    await expect(generateWeeklyInsight(context)).rejects.toThrow('Invalid JSON response');
  });

  it('rejects a provider response truncated by the output token limit', async () => {
    mockClient(JSON.stringify({ text: 'Teiltext' }), 'length');

    await expect(generateWeeklyInsight(context)).rejects.toThrow('truncated');
  });

  it('rejects an empty provider response', async () => {
    mockClient('');
    await expect(generateWeeklyInsight(context)).rejects.toThrow('Empty response');
  });
});