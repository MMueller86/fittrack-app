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
      targets: { calories: 2000, proteinG: 140, carbsG: 220, fatG: 70, fiberG: 30 },
      remainingCalories: 500,
      remainingProteinG: 40,
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
    activityCompletionStatus: null,
    activityStatusSource: null,
    ...overrides,
  };
}

const validResponse = {
  title: 'Dein Tagesfokus',
  summary: 'Heute hast du eine gute Basis gelegt und kannst den restlichen Tag ruhig und passend zu deinem Ziel gestalten.',
  recommendation: null,
  cta: null,
  ctaTarget: null,
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
    expect(request.messages[0]?.content).toBe(result.promptSnapshot.system);
    expect(request.messages[1]?.content).toBe(result.promptSnapshot.user);
    expect(JSON.parse(result.promptSnapshot.user)).toEqual({ intent: 'nutrition_guidance', context });
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

  it('rejects parse, schema and semantic failures', async () => {
    mockClient('{"title":');
    await expect(generateDailyInsight(makeContext())).rejects.toThrow('Invalid JSON');

    mockClient(JSON.stringify({ ...validResponse, extra: true }));
    await expect(generateDailyInsight(makeContext())).rejects.toThrow('invalid schema');

    mockClient(JSON.stringify({
      ...validResponse,
      recommendation: 'Iss heute noch einen Snack.',
      cta: 'Mahlzeit hinzufügen',
      ctaTarget: 'Nutrition',
    }));
    await expect(generateDailyInsight(makeContext({
      nutrition: { ...makeContext().nutrition, remainingCalories: -50 },
    }))).rejects.toThrow('calorie budget');
  });

  it('validates stale weight semantics across structured provider responses', async () => {
    const baseContext = makeContext();
    const staleContext = {
      ...baseContext,
      weight: {
        ...baseContext.weight,
        latestKg: 80,
        previousKg: 80.2,
        weeklyTrend30d: 'losing' as const,
        last7Values: [80, 80.2, 80.4],
        daysSinceLastMeasurement: 15,
        lastMeasurementDate: '2026-08-05',
      },
    };
    const staleAsCurrent = {
      ...validResponse,
      title: 'Gewicht heute',
      summary: 'Dein Gewicht ist heute klar gesunken.',
    };
    mockClient(JSON.stringify(staleAsCurrent));

    await expect(generateDailyInsight(staleContext, 'nutrition_guidance'))
      .rejects.toThrow('stale weight');

    const staleMarked = {
      ...validResponse,
      summary: 'Der Trend deines Gewichts ist nicht aktuell.',
    };
    mockClient(JSON.stringify(staleMarked));

    await expect(generateDailyInsight(staleContext, 'nutrition_guidance'))
      .resolves.toMatchObject({
        response: { title: staleMarked.title, summary: staleMarked.summary },
        intent: 'nutrition_guidance',
      });
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