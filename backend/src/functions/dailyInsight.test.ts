import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/dailyInsightContext', () => ({
  buildDailyInsightContext: vi.fn(),
}));

const { quotaCheckMock, trackUsageMock, generateDailyInsightMock } = vi.hoisted(() => ({
  quotaCheckMock: vi.fn(),
  trackUsageMock: vi.fn(),
  generateDailyInsightMock: vi.fn(),
}));

vi.mock('../lib/repositories/aiUsageRepository', () => ({
  getAiUsageRepository: () => ({ checkQuota: quotaCheckMock }),
}));

vi.mock('../lib/quota', () => ({
  trackUsage: trackUsageMock,
}));

vi.mock('../lib/openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/openai')>();
  return { ...actual, generateDailyInsight: generateDailyInsightMock };
});

import { dailyInsightHandler } from './dailyInsight';
import { buildDailyInsightContext } from '../lib/dailyInsightContext';
import {
  computeInputHash,
  getInsightRepository,
  _resetInsightRepositoryForTests,
  MIN_REGEN_INTERVAL_MS,
} from '../lib/repositories/insightRepository';
import { selectInsightIntent } from '../lib/dailyInsightIntent';
import type { InsightDocument, InsightInputContext, InsightResponse } from '@fittrack/shared';
import { DAILY_INSIGHT_PROMPT_VERSION, generateDailyInsight } from '../lib/openai';
import type { GenerateInsightResult } from '../lib/openai';
import {
  buildDailyInsightPrompt,
  computeDailyInsightSystemPromptHash,
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
} from '../lib/prompts/dailyInsightPrompt';
import { DailyInsightValidationError } from '../lib/dailyInsightValidation';
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

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T12:00:00.000Z'));
  vi.clearAllMocks();
  vi.mocked(buildDailyInsightContext).mockResolvedValue(makeInputContext());
  quotaCheckMock.mockResolvedValue({
    allowed: true,
    used: 0,
    limit: 30,
    remaining: 30,
    feature: 'daily-insight',
    period: '2026-08',
  });
  trackUsageMock.mockResolvedValue(undefined);
  generateDailyInsightMock.mockResolvedValue(makeGenerationResult());
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
      weeklyTrend30d: 'losing',
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

function makeResponse(overrides: Partial<InsightResponse> = {}): InsightResponse {
  return {
    title: 'Dein Fokus heute',
    summary: 'Dein Tag entwickelt sich in die richtige Richtung.',
    generatedAt: GENERATED_AT,
    promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
    status: 'fresh',
    ...overrides,
  };
}

function makeGenerationResult(overrides: Partial<GenerateInsightResult> = {}): GenerateInsightResult {
  return {
    response: {
      title: 'Dein Fokus heute',
      summary: 'Dein Tag entwickelt sich in die richtige Richtung.',
    },
    tokensUsed: 17,
    intent: 'phase_progress',
    promptSnapshot: { system: 'provider system', user: 'provider user' },
    ...overrides,
  };
}

function makeDaily(
  context: InsightInputContext,
  overrides: Partial<InsightDocument> = {},
): InsightDocument {
  const normalizedContext = { ...context, timezoneOffsetMinutes: context.timezoneOffsetMinutes ?? null };
  const intent = selectInsightIntent(normalizedContext);
  const promptSnapshot = buildDailyInsightPrompt(intent, normalizedContext);
  const systemPromptHash = computeDailyInsightSystemPromptHash(promptSnapshot.system);
  return {
    _docType: 'dailyInsight',
    id: `${TEST_USER_ID}:${DATE}`,
    userId: TEST_USER_ID,
    date: DATE,
    generatedAt: GENERATED_AT,
    expiresAt: '2026-08-21T00:00:00.000Z',
    ttl: 3600,
    promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
    promptFingerprint: DAILY_INSIGHT_PROMPT_FINGERPRINT,
    systemPromptHash,
    intent,
    promptSnapshot,
    model: 'gpt4o-mini',
    inputHash: computeInputHash(
      normalizedContext,
      DAILY_INSIGHT_PROMPT_VERSION,
      intent,
      DAILY_INSIGHT_PROMPT_FINGERPRINT,
      systemPromptHash,
    ),
    inputContext: normalizedContext,
    response: makeResponse(),
    dailyGenerations: 1,
    lastGeneratedAt: GENERATED_AT,
    feedbackScore: null,
    tokensUsed: 42,
    intelligenceVersion: 'v1',
    ...overrides,
  };
}

function getIdentityMismatch(
  identity: 'intent' | 'system' | 'user',
  current: InsightDocument,
): Partial<InsightDocument> {
  if (identity === 'intent') return { intent: 'general' };

  const promptSnapshot = current.promptSnapshot!;
  return {
    promptSnapshot: identity === 'system'
      ? { ...promptSnapshot, system: `${promptSnapshot.system} changed` }
      : { ...promptSnapshot, user: `${promptSnapshot.user} changed` },
  };
}

async function expectFreshForIdentityMismatch(
  identity: 'intent' | 'system' | 'user',
  lastGeneratedAt: string,
  dailyGenerations: number,
): Promise<void> {
  const context = makeInputContext();
  const current = makeDaily(context);
  await getInsightRepository().upsert(makeDaily(context, {
    ...getIdentityMismatch(identity, current),
    inputHash: current.inputHash,
    lastGeneratedAt,
    dailyGenerations,
  }));

  const response = await dailyInsightHandler(
    await makeDailyRequest(),
    makeContext(),
  );

  expect(response.jsonBody).toMatchObject({ status: 'fresh', feedbackAvailable: true });
  expect(generateDailyInsight).toHaveBeenCalledTimes(1);
}

async function makeDailyRequest(query: Record<string, string> = { date: DATE }) {
  const search = new URLSearchParams(query).toString();
  const request = await makeAuthRequest();
  Object.assign(request, { url: `http://localhost/api/ai/daily-insight${search ? `?${search}` : ''}` });
  return request;
}

describe('GET /api/ai/daily-insight handler contract', () => {
  it.each([
    ['missing token', {}],
    ['invalid token', { headers: { authorization: 'Bearer not.a.valid.jwt' } }],
  ])('requires authentication: %s', async (_label, init) => {
    const response = await dailyInsightHandler(makeRequest(init), makeContext());

    expect(response.status).toBe(401);
    expect(buildDailyInsightContext).not.toHaveBeenCalled();
    expect(generateDailyInsight).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed date and out-of-range hour', { date: 'not-a-date', localHour: '24' }, DATE, null],
    ['calendar-invalid date shape and fractional hour', { date: '2026-02-30', localHour: '1.5' }, '2026-02-30', null],
    ['valid late hour', { date: DATE, localHour: '23' }, DATE, 23],
  ])('normalizes date and localHour for %s', async (_label, query, expectedDate, expectedHour) => {
    const response = await dailyInsightHandler(
      await makeDailyRequest(query),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(buildDailyInsightContext).toHaveBeenCalledWith(expect.objectContaining({
      userId: TEST_USER_ID,
      date: expectedDate,
      localHour: expectedHour,
      now: expect.any(Date),
      insightRepository: expect.any(Object),
    }));
  });

  it.each([
    ['valid offset', { date: DATE, timezoneOffsetMinutes: '120' }, 120, true],
    ['missing offset', { date: DATE }, null, false],
    ['fractional offset', { date: DATE, timezoneOffsetMinutes: '120.5' }, null, false],
    ['out-of-range offset', { date: DATE, timezoneOffsetMinutes: '900' }, null, false],
  ] as const)('normalizes timezoneOffsetMinutes for %s', async (_label, query, expectedOffset, expectedCurrentDay) => {
    const response = await dailyInsightHandler(
      await makeDailyRequest(query),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(buildDailyInsightContext).toHaveBeenCalledWith(expect.objectContaining({
      timezoneOffsetMinutes: expectedOffset,
      isCurrentDay: expectedCurrentDay,
    }));
  });

  it('uses the next local midnight for expiresAt and the matching upward TTL', async () => {
    const date = '2026-08-21';
    vi.setSystemTime(new Date('2026-08-20T23:30:00.000Z'));
    vi.mocked(buildDailyInsightContext).mockResolvedValue({
      ...makeInputContext(),
      date,
    });

    const response = await dailyInsightHandler(
      await makeDailyRequest({ date, timezoneOffsetMinutes: '840', localHour: '23' }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    const stored = await getInsightRepository().get(TEST_USER_ID, date);
    expect(stored).toMatchObject({
      expiresAt: '2026-08-21T10:00:00.000Z',
      ttl: 37_800,
      inputContext: { timezoneOffsetMinutes: 840 },
    });
  });

  it('keeps the UTC expiry fallback for an invalid offset', async () => {
    vi.setSystemTime(new Date('2026-08-20T23:30:00.000Z'));

    const response = await dailyInsightHandler(
      await makeDailyRequest({ date: DATE, timezoneOffsetMinutes: '900', localHour: '23' }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(buildDailyInsightContext).toHaveBeenCalledWith(expect.objectContaining({
      timezoneOffsetMinutes: null,
      isCurrentDay: false,
    }));
    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toMatchObject({
      expiresAt: '2026-08-21T00:00:00.000Z',
      ttl: 1_800,
      inputContext: { timezoneOffsetMinutes: null },
    });
  });

  it('does not reuse a cached Daily after the normalized offset changes', async () => {
    const cachedContext = { ...makeInputContext(), timezoneOffsetMinutes: 0 };
    await getInsightRepository().upsert(makeDaily(cachedContext, {
      inputHash: computeInputHash(cachedContext, DAILY_INSIGHT_PROMPT_VERSION, selectInsightIntent(cachedContext)),
      lastGeneratedAt: new Date(Date.now() - MIN_REGEN_INTERVAL_MS - 1_000).toISOString(),
    }));
    vi.mocked(buildDailyInsightContext).mockResolvedValue({
      ...makeInputContext(),
      timezoneOffsetMinutes: 120,
    });

    const response = await dailyInsightHandler(
      await makeDailyRequest({ date: DATE, timezoneOffsetMinutes: '120' }),
      makeContext(),
    );

    expect(response.jsonBody).toMatchObject({ status: 'fresh' });
    expect(generateDailyInsight).toHaveBeenCalledTimes(1);
  });

  it('invalidates an old Daily cache entry before returning a fresh v11 response', async () => {
    const context = makeInputContext();
    const cached = makeDaily(context, {
      promptVersion: 'v9',
      intent: undefined,
      promptSnapshot: undefined,
      inputHash: 'old-v9-hash',
      response: makeResponse({ title: 'Alte v9 Analyse' }),
    });
    await getInsightRepository().upsert(cached);

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      title: 'Dein Fokus heute',
      status: 'fresh',
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      feedbackAvailable: true,
    });
    expect((response.jsonBody as InsightResponse).title).not.toBe('Alte v9 Analyse');
    expect(generateDailyInsight).toHaveBeenCalledTimes(1);
    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toMatchObject({
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      dailyGenerations: 2,
      response: { status: 'fresh', promptVersion: DAILY_INSIGHT_PROMPT_VERSION },
    });
  });

  it('hard-invalidates a current-version Daily missing prompt identities despite cache limits', async () => {
    const context = makeInputContext();
    await getInsightRepository().upsert(makeDaily(context, {
      promptFingerprint: undefined,
      systemPromptHash: undefined,
      dailyGenerations: 3,
      lastGeneratedAt: new Date().toISOString(),
      response: makeResponse({ title: 'Unvollständige alte Analyse' }),
    }));

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({ status: 'fresh', feedbackAvailable: true });
    expect((response.jsonBody as InsightResponse).title).not.toBe('Unvollständige alte Analyse');
    expect(generateDailyInsight).toHaveBeenCalledTimes(1);
  });

  it.each(['intent', 'system', 'user'] as const)(
    'hard-invalidates a current Daily with a mismatched %s snapshot identity during the recent-cache interval',
    async (identity) => {
      await expectFreshForIdentityMismatch(
        identity,
        new Date(Date.now() - MIN_REGEN_INTERVAL_MS + 60_000).toISOString(),
        1,
      );
    },
  );

  it.each(['intent', 'system', 'user'] as const)(
    'hard-invalidates a current Daily with a mismatched %s snapshot identity at the generation limit',
    async (identity) => {
      await expectFreshForIdentityMismatch(
        identity,
        new Date(Date.now() - MIN_REGEN_INTERVAL_MS - 1_000).toISOString(),
        3,
      );
    },
  );

  it('serves an unchanged complete current identity from cache despite cache limits', async () => {
    const context = makeInputContext();
    const current = makeDaily(context, {
      dailyGenerations: 3,
      lastGeneratedAt: new Date().toISOString(),
    });
    await getInsightRepository().upsert(current);

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.jsonBody).toMatchObject({ status: 'cached', feedbackAvailable: true });
    expect(generateDailyInsight).not.toHaveBeenCalled();
    expect(quotaCheckMock).not.toHaveBeenCalled();
  });

  it('returns HTTP 200 unavailable when context construction fails without quota or persistence side effects', async () => {
    vi.mocked(buildDailyInsightContext).mockRejectedValue(new Error('context unavailable'));

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      status: 'unavailable',
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      feedbackAvailable: false,
      generatedAt: '2026-08-20T12:00:00.000Z',
    });
    expect(quotaCheckMock).not.toHaveBeenCalled();
    expect(generateDailyInsight).not.toHaveBeenCalled();
    expect(trackUsageMock).not.toHaveBeenCalled();
    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toBeNull();
  });

  it('returns HTTP 200 unavailable when the provider fails without persistence or usage tracking', async () => {
    generateDailyInsightMock.mockRejectedValue(new Error('provider unavailable'));

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      status: 'unavailable',
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      feedbackAvailable: false,
      generatedAt: '2026-08-20T12:00:00.000Z',
    });
    expect(quotaCheckMock).toHaveBeenCalledWith(TEST_USER_ID, 'daily-insight', 'free');
    expect(trackUsageMock).not.toHaveBeenCalled();
    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toBeNull();
  });

  it('returns HTTP 200 unavailable for stale-weight semantic rejection without persistence or usage tracking', async () => {
    const staleContext = {
      ...makeInputContext(),
      weight: {
        ...makeInputContext().weight,
        daysSinceLastMeasurement: 15,
        lastMeasurementDate: '2026-08-05',
      },
    };
    vi.mocked(buildDailyInsightContext).mockResolvedValue(staleContext);
    generateDailyInsightMock.mockRejectedValue(
      new DailyInsightValidationError('Daily insight refers to stale weight data as current'),
    );

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      status: 'unavailable',
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      feedbackAvailable: false,
    });
    expect(quotaCheckMock).toHaveBeenCalledWith(TEST_USER_ID, 'daily-insight', 'free');
    expect(trackUsageMock).not.toHaveBeenCalled();
    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toBeNull();
  });

  it('returns quota exhaustion as HTTP 200 and does not call the provider or track usage', async () => {
    quotaCheckMock.mockResolvedValue({
      allowed: false,
      used: 30,
      limit: 30,
      remaining: 0,
      feature: 'daily-insight',
      period: '2026-08',
    });

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      status: 'quota_exceeded',
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      feedbackAvailable: false,
      generatedAt: '2026-08-20T12:00:00.000Z',
    });
    expect(generateDailyInsight).not.toHaveBeenCalled();
    expect(trackUsageMock).not.toHaveBeenCalled();
    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toBeNull();
  });

  it('persists a successful Daily and tracks usage only after persistence', async () => {
    const order: string[] = [];
    quotaCheckMock.mockImplementation(async () => {
      order.push('quota');
      return {
        allowed: true,
        used: 0,
        limit: 30,
        remaining: 30,
        feature: 'daily-insight',
        period: '2026-08',
      };
    });
    generateDailyInsightMock.mockImplementation(async () => {
      order.push('provider');
      return makeGenerationResult({ tokensUsed: 42 });
    });
    const repository = getInsightRepository();
    const originalUpsert = repository.upsert.bind(repository);
    vi.spyOn(repository, 'upsert').mockImplementation(async (document) => {
      order.push('persist');
      await originalUpsert(document);
    });
    trackUsageMock.mockImplementation(async () => {
      order.push('track');
    });

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      status: 'fresh',
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      feedbackAvailable: true,
      generatedAt: '2026-08-20T12:00:00.000Z',
    });
    expect(order).toEqual(['quota', 'provider', 'persist', 'track']);
    expect(trackUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: TEST_USER_ID, tier: 'free', isAdmin: false }),
      'daily-insight',
    );

    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toMatchObject({
      id: `${TEST_USER_ID}:${DATE}`,
      userId: TEST_USER_ID,
      date: DATE,
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      promptFingerprint: DAILY_INSIGHT_PROMPT_FINGERPRINT,
      systemPromptHash: expect.any(String),
      intent: 'phase_progress',
      inputContext: makeInputContext(),
      response: {
        title: 'Dein Fokus heute',
        summary: 'Dein Tag entwickelt sich in die richtige Richtung.',
        generatedAt: '2026-08-20T12:00:00.000Z',
        promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
        status: 'fresh',
        feedbackAvailable: true,
      },
      tokensUsed: 42,
    });
  });

  it('does not advertise feedback when persistence fails after a valid generation', async () => {
    const repository = getInsightRepository();
    vi.spyOn(repository, 'upsert').mockRejectedValue(new Error('storage unavailable'));

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      status: 'fresh',
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      feedbackAvailable: false,
    });
    expect(trackUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: TEST_USER_ID }),
      'daily-insight',
    );
    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toBeNull();
  });

  it('persists an explicitly stale-marked response and tracks usage normally', async () => {
    const baseContext = makeInputContext();
    const staleContext = {
      ...baseContext,
      weight: {
        ...baseContext.weight,
        daysSinceLastMeasurement: 15,
        lastMeasurementDate: '2026-08-05',
      },
    };
    vi.mocked(buildDailyInsightContext).mockResolvedValue(staleContext);
    generateDailyInsightMock.mockResolvedValue(makeGenerationResult({
      response: {
        title: 'Gewichtsdaten im Blick',
        summary: 'Deine Gewichtsdaten sind veraltet. Ein neuer Eintrag würde die Analyse verbessern.',
      },
    }));

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      status: 'fresh',
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      feedbackAvailable: true,
      summary: 'Deine Gewichtsdaten sind veraltet. Ein neuer Eintrag würde die Analyse verbessern.',
    });
    expect(trackUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: TEST_USER_ID, tier: 'free', isAdmin: false }),
      'daily-insight',
    );
    await expect(getInsightRepository().get(TEST_USER_ID, DATE)).resolves.toMatchObject({
      response: {
        status: 'fresh',
        summary: 'Deine Gewichtsdaten sind veraltet. Ein neuer Eintrag würde die Analyse verbessern.',
      },
    });
  });
});

describe('GET /api/ai/daily-insight feedback capability', () => {
  it('returns true for a cached current Daily with complete feedback provenance', async () => {
    const context = makeInputContext();
    vi.mocked(buildDailyInsightContext).mockResolvedValue(context);
    const insight = makeDaily(context);
    await getInsightRepository().upsert(insight);

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      ...insight.response,
      status: 'cached',
      feedbackAvailable: true,
    });
  });

  it('returns false for a cached Daily with incomplete feedback provenance', async () => {
    const context = makeInputContext();
    vi.mocked(buildDailyInsightContext).mockResolvedValue(context);
    const insight = makeDaily(context, {
      model: '',
      response: makeResponse({ feedbackAvailable: true }),
    });
    await getInsightRepository().upsert(insight);

    const response = await dailyInsightHandler(
      await makeDailyRequest(),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      ...insight.response,
      status: 'cached',
      feedbackAvailable: false,
    });
  });
});