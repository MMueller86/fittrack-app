import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InsightInputContext } from '@fittrack/shared';
import {
  __setOpenAiClientForTests,
  DAILY_INSIGHT_SCHEMA,
  generateDailyInsight,
} from './openai';
import { buildDailyInsightPrompt } from './prompts/dailyInsightPrompt';

function makeContext(overrides: Partial<InsightInputContext> = {}): InsightInputContext {
  return {
    date: '2026-08-20',
    dayType: 'rest',
    workoutType: null,
    weight: {
      latestKg: null,
      previousKg: null,
      targetKg: null,
      weeklyTrend30d: null,
      last7Values: [],
      isOutlierPrevious: false,
      isOutlierLatest: false,
      daysSinceLastMeasurement: null,
      lastMeasurementDate: null,
    },
    nutrition: {
      today: { calories: 1500, protein: 100, carbs: 150, fat: 50, fiber: 20, hasMealItem: true },
      targets: {
        calories: 2000,
        proteinG: 140,
        carbsG: 220,
        fatG: 70,
        fiberG: 30,
        macroRanges: {
          proteinG: { minG: 140, maxG: 180 },
          carbsG: { minG: 160, maxG: 220 },
        },
      },
      remainingCalories: 500,
      dailyInsightProteinStatus: 'below_range',
      mealAdviceAllowed: false,
      last3Days: [],
    },
    userGoal: 'maintain',
    userGoalIntensity: null,
    displayName: 'Sportler',
    progressIntelligence: {
      version: 'v1',
      primarySignal: { type: 'daily_context', confidence: 0.5, freshnessScore: 0 },
      contextSignals: [],
      progress: null,
      phase: null,
      plateau: null,
      milestone: null,
      monthlyTrend: null,
      dayCompleteness: 1,
      goalAtCalculation: 'maintain',
    },
    currentHourLocal: 18,
    specialActivity: null,
    dailyActivityStatus: null,
    ...overrides,
  };
}

const validResponse = {
  greeting: 'Hallo, Sportler! 👋',
  shortInsight: 'Dein Tag ist noch offen und du kannst ihn ruhig gestalten.',
  title: 'Dein Tagesfokus',
  summary: 'Heute hast du eine gute Basis gelegt und kannst den restlichen Tag ruhig und passend zu deinem Ziel gestalten.',
  recommendation: null,
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

describe('generateDailyInsight', () => {
  it('uses strict structured output and returns the exact prompt snapshot', async () => {
    const context = makeContext();
    const create = mockClient(JSON.stringify(validResponse));

    const result = await generateDailyInsight(context, 'nutrition_guidance');

    expect(result).toMatchObject({
      response: { title: validResponse.title, summary: validResponse.summary },
      tokensUsed: 42,
      intent: 'nutrition_guidance',
    });
    const request = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
      response_format: { type: string; json_schema: { name: string; strict: boolean; schema: typeof DAILY_INSIGHT_SCHEMA } };
    };
    expect(request.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'daily_insight', strict: true, schema: DAILY_INSIGHT_SCHEMA },
    });
    expect(DAILY_INSIGHT_SCHEMA.properties).not.toHaveProperty('cta');
    expect(DAILY_INSIGHT_SCHEMA.properties).not.toHaveProperty('ctaTarget');
    expect(DAILY_INSIGHT_SCHEMA.properties.summary.maxLength).toBe(5_000);
    expect(request.messages[0]?.content).toBe(result.promptSnapshot.system);
    expect(request.messages[1]?.content).toBe(result.promptSnapshot.user);
    const promptInput = JSON.parse(result.promptSnapshot.user);
    expect(promptInput).toMatchObject({
      intent: 'nutrition_guidance',
      grounding: { focus: 'combined', mealAdviceAllowed: false, actionFields: 'intent_scoped' },
      context: {
        dailyActivityStatus: null,
        nutrition: {
          dailyInsightProteinStatus: 'below_range',
          mealAdviceAllowed: false,
        },
      },
    });
    expect(promptInput).toMatchObject({
      context: {
        nutrition: {
          today: { calories: 1500, hasMealItem: true },
          targets: {
            calories: 2000,
            fatG: 70,
            fiberG: 30,
            macroRanges: {
              proteinG: { minG: 140, maxG: 180 },
              carbsG: { minG: 160, maxG: 220 },
            },
          },
        },
      },
    });
    expect(promptInput.context.dailyActivityStatus).toBeNull();
    expect(promptInput.context.nutrition.today).not.toHaveProperty('protein');
    expect(promptInput.context.nutrition).not.toHaveProperty('remainingProteinG');
    expect(promptInput.context.nutrition).not.toHaveProperty('proteinCoachingBand');
  });

  it('uses a server-provided prompt snapshot verbatim', async () => {
    const snapshot = { system: 'server-system', user: '{"server":true}' };
    const create = mockClient(JSON.stringify(validResponse));

    await expect(generateDailyInsight(makeContext(), 'general', snapshot)).resolves.toMatchObject({
      promptSnapshot: snapshot,
      intent: 'general',
    });
    expect(create.mock.calls[0]?.[0].messages).toEqual([
      { role: 'system', content: snapshot.system },
      { role: 'user', content: snapshot.user },
    ]);
  });

  it.each([
    ['length', 'provider: length'],
    ['content_filter', 'provider: content_filter'],
  ])('rejects provider failure %s', async (finishReason, error) => {
    mockClient(JSON.stringify(validResponse), finishReason);
    await expect(generateDailyInsight(makeContext())).rejects.toThrow(error);
  });

  it('rejects parse and schema failures', async () => {
    mockClient('{"title":');
    await expect(generateDailyInsight(makeContext())).rejects.toThrow('Invalid JSON');

    mockClient(JSON.stringify({ ...validResponse, extra: true }));
    await expect(generateDailyInsight(makeContext())).rejects.toThrow('invalid schema');

    mockClient(JSON.stringify({ ...validResponse, cta: 'Ernährung öffnen', ctaTarget: 'Nutrition' }));
    await expect(generateDailyInsight(makeContext())).rejects.toThrow('invalid schema');
  });

  it('corrects an unsupported calorie value once without echoing the rejected draft', async () => {
    const rejectedDraft = { ...validResponse, summary: 'Du hast noch 777 Kalorien offen.' };
    const correctedDraft = { ...validResponse, summary: 'Du hast noch 500 Kalorien offen.' };
    const create = vi.fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(rejectedDraft) }, finish_reason: 'stop' }],
        usage: { total_tokens: 42 },
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(correctedDraft) }, finish_reason: 'stop' }],
        usage: { total_tokens: 37 },
      });
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);

    const result = await generateDailyInsight(makeContext(), 'nutrition_guidance');

    expect(result.response.summary).toBe(correctedDraft.summary);
    expect(result.tokensUsed).toBe(79);
    expect(create).toHaveBeenCalledTimes(2);
    const correctionPayload = String(create.mock.calls[1]?.[0].messages[1]?.content);
    expect(correctionPayload).toContain('calorie value that was not supplied');
    expect(correctionPayload).not.toContain(JSON.stringify(rejectedDraft));
  });

  it('fails after the single correction when the calorie value is still unsupported', async () => {
    const create = mockClient(JSON.stringify({ ...validResponse, summary: 'Du hast noch 777 Kalorien offen.' }));
    await expect(generateDailyInsight(makeContext())).rejects.toThrow('calorie value that was not supplied');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('returns nullable fields as optional public response fields', async () => {
    mockClient(JSON.stringify(validResponse));
    const result = await generateDailyInsight(makeContext());
    expect(result.response).not.toHaveProperty('recommendation');
    expect(result.response).not.toHaveProperty('cta');
    expect(result.response).not.toHaveProperty('ctaTarget');
  });

  it('builds the same snapshot as the public prompt builder', async () => {
    const context = makeContext();
    mockClient(JSON.stringify(validResponse));
    const result = await generateDailyInsight(context, 'general');
    expect(result.promptSnapshot).toEqual(buildDailyInsightPrompt('general', context));
  });
});
