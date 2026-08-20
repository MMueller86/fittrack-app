import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { dailyInsightFeedbackHandler } from './dailyInsightFeedback';
import {
  getInsightRepository,
  _resetInsightRepositoryForTests,
} from '../lib/repositories/insightRepository';
import type {
  InsightDocument,
  InsightInputContext,
  InsightResponse,
} from '@fittrack/shared';
import {
  makeAuthRequest,
  makeContext,
  makeRequest,
  setupTestAuth,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';

const originalEnv = { ...process.env };
const DATE = '2026-08-20';
const GENERATED_AT = '2026-08-20T08:30:00.000Z';
const SUBMISSION_ID = '11111111-1111-4111-8111-111111111111';

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  _resetInsightRepositoryForTests();
});

afterEach(() => {
  vi.useRealTimers();
  Object.assign(process.env, originalEnv);
  _resetInsightRepositoryForTests();
});

function makeInputContext(): InsightInputContext {
  return {
    date: DATE,
    dayType: 'training',
    workoutType: 'gym',
    currentHourLocal: 10,
    specialActivity: null,
    activityCompletionStatus: null,
    activityStatusSource: null,
    weight: {
      latestKg: 80,
      previousKg: 80.5,
      targetKg: 78,
      trend7d: 'losing',
      last7Values: [80, 80.5],
      isOutlierPrevious: false,
      isOutlierLatest: false,
      daysSinceLastMeasurement: 0,
      lastMeasurementDate: DATE,
    },
    nutrition: {
      today: { calories: 1600, protein: 120, carbs: 150, fat: 50, fiber: 20, hasMealItem: true },
      targets: {
        calories: 2200,
        proteinG: 160,
        carbsG: 250,
        fatG: 75,
        fiberG: 30,
        baseCalories: 2200,
        activityBonusCalories: 0,
        targetSource: 'profile_fallback',
      },
      remainingCalories: 600,
      remainingProteinG: 40,
      last3Days: [],
    },
    userGoal: 'lose_weight',
    userGoalIntensity: 'gentle',
    displayName: 'Testperson',
    progressIntelligence: {
      version: 'v1',
      primarySignal: { type: 'phase_context', confidence: 0.8, freshnessScore: 0.5 },
      contextSignals: [],
      progress: null,
      phase: { type: 'progressing' },
      plateau: null,
      milestone: null,
      monthlyTrend: null,
      dayCompleteness: 0.8,
      goalAtCalculation: 'lose_weight',
    },
  };
}

function makeDaily(overrides: Partial<InsightDocument> = {}): InsightDocument {
  const inputContext = makeInputContext();
  const response: InsightResponse = {
    title: 'Dein Fokus heute',
    summary: 'Dein Tag entwickelt sich in die richtige Richtung.',
    recommendation: 'Plane deine nächste Mahlzeit bewusst.',
    cta: 'Ernährung öffnen',
    ctaTarget: 'Nutrition',
    generatedAt: GENERATED_AT,
    promptVersion: 'v10',
    status: 'fresh',
  };
  return {
    _docType: 'dailyInsight',
    id: `${TEST_USER_ID}:${DATE}`,
    userId: TEST_USER_ID,
    date: DATE,
    generatedAt: GENERATED_AT,
    expiresAt: '2026-08-21T00:00:00.000Z',
    ttl: 3600,
    promptVersion: 'v10',
    intent: 'nutrition_guidance',
    promptSnapshot: { system: 'server system prompt', user: '{"intent":"nutrition_guidance"}' },
    model: 'gpt4o-mini',
    inputHash: 'server-input-hash',
    inputContext,
    response,
    dailyGenerations: 1,
    lastGeneratedAt: GENERATED_AT,
    feedbackScore: null,
    tokensUsed: 42,
    intelligenceVersion: 'v1',
    ...overrides,
  };
}

const validBody = {
  date: DATE,
  insightGeneratedAt: GENERATED_AT,
  submissionId: SUBMISSION_ID,
  userComment: '  Die Aktivität war nur geplant.  ',
};

async function seedDaily(overrides: Partial<InsightDocument> = {}): Promise<InsightDocument> {
  const document = makeDaily(overrides);
  await getInsightRepository().upsert(document);
  return document;
}

describe('POST /api/ai/daily-insight/feedback', () => {
  it('requires authentication', async () => {
    const response = await dailyInsightFeedbackHandler(
      makeRequest({ body: validBody }),
      makeContext(),
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 for an invalid Bearer token', async () => {
    const response = await dailyInsightFeedbackHandler(
      makeRequest({
        body: validBody,
        headers: { authorization: 'Bearer not.a.valid.jwt' },
      }),
      makeContext(),
    );

    expect(response.status).toBe(401);
  });

  it.each([
    ['impossible date', { ...validBody, date: '2026-02-30' }],
    ['non-canonical timestamp', { ...validBody, insightGeneratedAt: '2026-08-20T08:30:00Z' }],
    ['invalid UUID', { ...validBody, submissionId: 'not-a-uuid' }],
    ['empty comment', { ...validBody, userComment: '   ' }],
    ['comment above maximum', { ...validBody, userComment: 'x'.repeat(501) }],
    ['client snapshot field', { ...validBody, response: {} }],
  ])('returns 400 for %s', async (_label, body) => {
    const response = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body }),
      makeContext(),
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const response = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ rawBody: '{not json' }),
      makeContext(),
    );

    expect(response.status).toBe(400);
    expect(response.jsonBody).toEqual({ error: 'Invalid JSON body' });
  });

  it('accepts the 1- and 500-character comment boundaries', async () => {
    await seedDaily();
    const oneCharacter = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: { ...validBody, userComment: 'x' } }),
      makeContext(),
    );
    const fiveHundredCharacters = await dailyInsightFeedbackHandler(
      await makeAuthRequest({
        body: {
          ...validBody,
          submissionId: '22222222-2222-4222-8222-222222222222',
          userComment: 'x'.repeat(500),
        },
      }),
      makeContext(),
    );

    expect(oneCharacter.status).toBe(201);
    expect(fiveHundredCharacters.status).toBe(201);
  });

  it('returns 404 when the referenced Daily insight does not exist', async () => {
    const response = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: validBody }),
      makeContext(),
    );

    expect(response.status).toBe(404);
    expect(response.jsonBody).toEqual({ code: 'insight_not_found' });
  });

  it('returns 409 when the requested generation is no longer the stored instance', async () => {
    await seedDaily({ generatedAt: '2026-08-20T09:00:00.000Z' });

    const response = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: validBody }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect(response.jsonBody).toEqual({ code: 'insight_generation_changed' });
  });

  it('rejects a legacy Daily without complete feedback provenance', async () => {
    await seedDaily({ intent: undefined, promptSnapshot: undefined });

    const response = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: validBody }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect(response.jsonBody).toEqual({ code: 'feedback_snapshot_unavailable' });
  });

  it('creates a trimmed negative feedback snapshot and only returns its id', async () => {
    const insight = await seedDaily();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:00:00.000Z'));

    const response = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: validBody }),
      makeContext(),
    );

    expect(response.status).toBe(201);
    expect(response.jsonBody).toEqual({
      feedbackId: `${TEST_USER_ID}:feedback:${SUBMISSION_ID}`,
      created: true,
    });
    expect(Object.keys(response.jsonBody as object).sort()).toEqual(['created', 'feedbackId']);

    const feedback = await getInsightRepository().getFeedbackBySubmissionId(TEST_USER_ID, SUBMISSION_ID);
    expect(feedback).toMatchObject({
      id: `${TEST_USER_ID}:feedback:${SUBMISSION_ID}`,
      userId: TEST_USER_ID,
      _docType: 'insightFeedback',
      insightId: insight.id,
      date: insight.date,
      insightGeneratedAt: insight.generatedAt,
      submittedAt: '2026-08-20T12:00:00.000Z',
      submissionId: SUBMISSION_ID,
      score: 'negative',
      userComment: 'Die Aktivität war nur geplant.',
      response: insight.response,
      promptSnapshot: insight.promptSnapshot,
      promptVersion: insight.promptVersion,
      intent: insight.intent,
      inputContext: insight.inputContext,
      inputHash: insight.inputHash,
      model: insight.model,
      intelligenceVersion: insight.intelligenceVersion,
      tokensUsed: insight.tokensUsed,
    });
    expect(feedback && Object.hasOwn(feedback, 'ttl')).toBe(false);
    expect(feedback && Object.hasOwn(feedback, 'expiresAt')).toBe(false);
    expect((await getInsightRepository().get(TEST_USER_ID, DATE))?.feedbackScore).toBe('negative');
  });

  it('returns 200 for an identical retry before reading the Daily document', async () => {
    await seedDaily();
    const first = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: { ...validBody, userComment: 'Ein Kommentar.' } }),
      makeContext(),
    );
    expect(first.status).toBe(201);

    const repository = getInsightRepository();
    const getSpy = vi.spyOn(repository, 'get').mockRejectedValue(new Error('Daily should not be read'));
    try {
      const retry = await dailyInsightFeedbackHandler(
        await makeAuthRequest({ body: { ...validBody, userComment: '  Ein Kommentar.  ' } }),
        makeContext(),
      );
      expect(retry.status).toBe(200);
      expect(retry.jsonBody).toEqual({
        feedbackId: `${TEST_USER_ID}:feedback:${SUBMISSION_ID}`,
        created: false,
      });
      expect(getSpy).not.toHaveBeenCalled();
    } finally {
      getSpy.mockRestore();
    }
  });

  it('returns a submission conflict when the same id carries a different normalized request', async () => {
    await seedDaily();
    await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: { ...validBody, userComment: 'Erster Kommentar.' } }),
      makeContext(),
    );

    const response = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: { ...validBody, userComment: 'Anderer Kommentar.' } }),
      makeContext(),
    );

    expect(response.status).toBe(409);
    expect(response.jsonBody).toEqual({ code: 'feedback_submission_conflict' });
  });

  it('creates separate documents for multiple submission ids on one insight', async () => {
    await seedDaily();
    const first = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: validBody }),
      makeContext(),
    );
    const secondId = '22222222-2222-4222-8222-222222222222';
    const second = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: { ...validBody, submissionId: secondId } }),
      makeContext(),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await getInsightRepository().getFeedbackBySubmissionId(TEST_USER_ID, SUBMISSION_ID)).not.toBeNull();
    expect(await getInsightRepository().getFeedbackBySubmissionId(TEST_USER_ID, secondId)).not.toBeNull();
  });

  it('keeps feedback isolated by the authenticated user', async () => {
    await seedDaily({ userId: 'another-user', id: `another-user:${DATE}` });

    const response = await dailyInsightFeedbackHandler(
      await makeAuthRequest({ body: validBody }),
      makeContext(),
    );

    expect(response.status).toBe(404);
    expect(response.jsonBody).toEqual({ code: 'insight_not_found' });
  });
});