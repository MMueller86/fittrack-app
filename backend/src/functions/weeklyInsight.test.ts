import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/quota', () => ({
  enforceQuota: vi.fn().mockResolvedValue(null),
  trackUsage: vi.fn().mockResolvedValue(undefined),
}));

import { __setOpenAiClientForTests, WEEKLY_INSIGHT_TEXT_MAX_LENGTH } from '../lib/openai';
import { enforceQuota, trackUsage } from '../lib/quota';
import { weeklyInsightHandler } from './weeklyInsight';
import { getDiaryRepository, __resetDiaryRepositoryForTests } from '../lib/repositories/diaryRepository';
import { getDayMetaRepository, __resetDayMetaRepositoryForTests } from '../lib/repositories/dayMetaRepository';
import {
  getInsightRepository,
  makeWeeklyInsightId,
  _resetInsightRepositoryForTests,
} from '../lib/repositories/insightRepository';
import { computeWeeklyInputHash } from '../lib/weeklyInsight';
import { getProfileRepository, __resetProfileRepositoryForTests } from '../lib/repositories/profileRepository';
import type { UserProfile } from '@fittrack/shared';
import {
  makeAuthRequest,
  makeContext,
  setupTestAuth,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';

const originalEnv = { ...process.env };

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  vi.clearAllMocks();
  vi.mocked(enforceQuota).mockResolvedValue(null);
  vi.mocked(trackUsage).mockResolvedValue(undefined);
  __resetDiaryRepositoryForTests();
  __resetDayMetaRepositoryForTests();
  __resetProfileRepositoryForTests();
  _resetInsightRepositoryForTests();
});

afterEach(() => {
  __setOpenAiClientForTests(null);
  for (const key of ['COSMOS_ENDPOINT', 'COSMOS_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY']) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  __resetDiaryRepositoryForTests();
  __resetDayMetaRepositoryForTests();
  __resetProfileRepositoryForTests();
  _resetInsightRepositoryForTests();
});

function mockOpenAi(response: string | Error, finishReason = 'stop') {
  const create = vi.fn();
  if (response instanceof Error) {
    create.mockRejectedValue(response);
  } else {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ text: response }) }, finish_reason: finishReason }],
      usage: { total_tokens: 17 },
    });
  }
  __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
  return create;
}

async function addDiaryItem(
  date: string,
  calories: number,
  macros = { protein: 10, carbs: 20, fat: 5 },
): Promise<void> {
  const diary = getDiaryRepository();
  const meal = await diary.createMeal({
    userId: TEST_USER_ID,
    date,
    type: 'dinner',
    name: 'Test meal',
  });
  await diary.addItem(TEST_USER_ID, meal.id, {
    name: 'Test item',
    calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    fiber: 2,
  });
}

async function setTarget(date: string, calories = 2000): Promise<void> {
  await getDayMetaRepository().upsert(
    TEST_USER_ID,
    date,
    'rest',
    null,
    { calories, capturedAt: `${date}T08:00:00.000Z`, source: 'profile' },
  );
}

async function setProfile(
  restDayCalories = 2000,
  trainingDayCalories = 2400,
  updatedAt = '2026-08-01T00:00:00.000Z',
): Promise<void> {
  const profile: UserProfile = {
    id: 'profile',
    userId: TEST_USER_ID,
    gender: 'male',
    age: 35,
    heightCm: 178,
    weightKg: 70,
    targetWeightKg: 68,
    stepsPerDay: 8000,
    activityLevel: null,
    trainingFrequencyPerWeek: 3,
    trainingDurationMinutes: 60,
    sports: ['hiking'],
    goal: 'maintain',
    goalIntensity: null,
    targets: {
      restDay: { calories: restDayCalories, proteinG: 150, carbsG: 200, fatG: 70, fiberG: 25 },
      trainingDay: { calories: trainingDayCalories, proteinG: 160, carbsG: 250, fatG: 75, fiberG: 28 },
    },
    calculationMeta: {
      formulaVersion: 'profile-targets-v1-pal',
      bmr: 1700,
      pal: 1.4,
      maintenanceRestDay: 2380,
      trainingDayBonus: 300,
      goalAdjustment: 0,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
  };
  await getProfileRepository().upsert(profile);
}

function bodyOf(response: { jsonBody?: unknown }) {
  return response.jsonBody as {
    periodStart: string;
    periodEnd: string;
    days: Array<{
      date: string;
      consumedCalories: number | null;
      consumedMacros: { protein: number; carbs: number; fat: number } | null;
      baseTargetCalories: number | null;
      effectiveTargetCalories: number | null;
      activityBonusCalories: number | null;
      dataStatus: string;
      targetSource: string;
      targetPercent: number | null;
      dayType: string | null;
      workoutType: string | null;
    }>;
    totals: {
      includedDayCount: number;
      totalConsumedCalories: number | null;
      totalTargetCalories: number | null;
      overallTargetPercent: number | null;
    };
    evaluation: { status: string; text: string | null };
  };
}

describe('GET /api/ai/weekly-insight', () => {
  it('requires authentication and a real local reference date', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const unauthenticated = await weeklyInsightHandler(makeRequest({ query: { date: '2026-08-14' } }), makeContext());
    expect(unauthenticated.status).toBe(401);

    const invalid = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-02-30' } }),
      makeContext(),
    );
    expect(invalid.status).toBe(400);
  });

  it('returns exactly seven completed dates and separates all missing data states', async () => {
    mockOpenAi('Die vorhandenen Tage lassen sich relativ zu ihren Zielen einordnen.');
    await addDiaryItem('2026-08-13', 2000);
    await setTarget('2026-08-13');
    await addDiaryItem('2026-08-12', 0, { protein: 0, carbs: 0, fat: 0 });
    await addDiaryItem('2026-08-11', 1500);
    // 2026-08-11 deliberately has no target; 2026-08-10 has an empty meal only.
    const emptyMeal = await getDiaryRepository().createMeal({
      userId: TEST_USER_ID,
      date: '2026-08-10',
      type: 'breakfast',
      name: 'Empty meal',
    });
    expect(emptyMeal.items).toEqual([]);
    await setTarget('2026-08-10');

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );
    expect(response.status).toBe(200);
    const body = bodyOf(response);
    expect(body.periodStart).toBe('2026-08-07');
    expect(body.periodEnd).toBe('2026-08-13');
    expect(body.days).toHaveLength(7);
    expect(body.days.map((day) => day.date)).toEqual([
      '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10',
      '2026-08-11', '2026-08-12', '2026-08-13',
    ]);
    expect(body.days.find((day) => day.date === '2026-08-10')?.dataStatus).toBe('missing_nutrition');
    expect(body.days.find((day) => day.date === '2026-08-11')?.dataStatus).toBe('missing_target');
    expect(body.days.find((day) => day.date === '2026-08-07')?.dataStatus).toBe('missing_nutrition_and_target');
    expect(body.days.find((day) => day.date === '2026-08-12')).toMatchObject({
      consumedCalories: 0,
      consumedMacros: { protein: 0, carbs: 0, fat: 0 },
      targetPercent: null,
      dataStatus: 'missing_target',
    });
    expect(body.days.find((day) => day.date === '2026-08-13')).toMatchObject({
      consumedCalories: 2000,
      consumedMacros: { protein: 10, carbs: 20, fat: 5 },
      targetPercent: 100,
      dataStatus: 'available',
    });
  });

  it('sums consumed macros across meals and items without adding them to the AI context', async () => {
    const create = mockOpenAi('Makros werden nur in den Daten angezeigt.');
    const diary = getDiaryRepository();
    const breakfast = await diary.createMeal({
      userId: TEST_USER_ID,
      date: '2026-08-13',
      type: 'breakfast',
      name: 'Breakfast',
    });
    await diary.addItem(TEST_USER_ID, breakfast.id, {
      name: 'First item',
      calories: 800.5,
      protein: 12.5,
      carbs: 30.25,
      fat: 4.75,
      fiber: 2,
    });
    await diary.addItem(TEST_USER_ID, breakfast.id, {
      name: 'Second item',
      calories: 199.25,
      protein: 0.75,
      carbs: 1.5,
      fat: 2.25,
      fiber: 1,
    });
    const dinner = await diary.createMeal({
      userId: TEST_USER_ID,
      date: '2026-08-13',
      type: 'dinner',
      name: 'Dinner',
    });
    await diary.addItem(TEST_USER_ID, dinner.id, {
      name: 'Third item',
      calories: 700.25,
      protein: 8.125,
      carbs: 20.125,
      fat: 6.5,
      fiber: 3,
    });
    await setTarget('2026-08-13');
    const getDay = vi.spyOn(diary, 'getDay');

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    const body = bodyOf(response);
    expect(body.days.find((day) => day.date === '2026-08-13')).toMatchObject({
      consumedCalories: 1700,
      consumedMacros: { protein: 21.375, carbs: 51.875, fat: 13.5 },
      dataStatus: 'available',
    });
    expect(body.days.find((day) => day.date === '2026-08-07')?.consumedMacros).toBeNull();
    expect(getDay).toHaveBeenCalledTimes(7);
    const promptRequest = create.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
    expect(promptRequest.messages[1]!.content).not.toContain('consumedMacros');
  });

  it('resolves default rest and explicit training targets for 2026-08-10 through 2026-08-16', async () => {
    mockOpenAi('Ziele und Ernährungstage sind vollständig eingeordnet.');
    await setProfile();
    await addDiaryItem('2026-08-13', 2000);
    await getDayMetaRepository().upsert(TEST_USER_ID, '2026-08-15', 'training', 'gym');
    await addDiaryItem('2026-08-15', 2400);

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-17' } }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    const body = bodyOf(response);
    expect(body.periodStart).toBe('2026-08-10');
    expect(body.periodEnd).toBe('2026-08-16');
    expect(body.days.map((day) => day.date)).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
      '2026-08-14', '2026-08-15', '2026-08-16',
    ]);
    expect(body.days.find((day) => day.date === '2026-08-13')).toMatchObject({
      consumedCalories: 2000,
      baseTargetCalories: 2000,
      effectiveTargetCalories: 2000,
      targetPercent: 100,
      targetSource: 'profile_fallback',
      dataStatus: 'available',
    });
    expect(body.days.find((day) => day.date === '2026-08-15')).toMatchObject({
      consumedCalories: 2400,
      baseTargetCalories: 2400,
      effectiveTargetCalories: 2400,
      targetPercent: 100,
      targetSource: 'profile_fallback',
      dayType: 'training',
      workoutType: 'gym',
      activityBonusCalories: 0,
      dataStatus: 'available',
    });
    expect(body.days.find((day) => day.date === '2026-08-14')).toMatchObject({
      consumedCalories: null,
      dataStatus: 'missing_nutrition',
    });
    expect(body.totals).toMatchObject({
      includedDayCount: 2,
      totalConsumedCalories: 4400,
      totalTargetCalories: 4400,
      overallTargetPercent: 100,
    });
  });

  it('keeps a stored historical snapshot when the current profile changes', async () => {
    mockOpenAi('Historisches Ziel bleibt stabil.');
    await setProfile(2000, 2400);
    await addDiaryItem('2026-08-13', 2300);
    await setTarget('2026-08-13', 2300);
    await setProfile(1800, 2200, '2026-08-14T00:00:00.000Z');

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(bodyOf(response).days.find((day) => day.date === '2026-08-13')).toMatchObject({
      baseTargetCalories: 2300,
      effectiveTargetCalories: 2300,
      targetPercent: 100,
      targetSource: 'day_target_snapshot',
      dataStatus: 'available',
    });
  });

  it('uses a stored special-activity snapshot as the effective target', async () => {
    mockOpenAi('Aktivität und Ziel sind gemeinsam eingeordnet.');
    await addDiaryItem('2026-08-13', 2800);
    await getDayMetaRepository().setSpecialActivity(TEST_USER_ID, '2026-08-13', {
      type: 'cycling',
      movementTimeMinutes: 120,
      distanceKm: 40,
      elevationGainM: 200,
      elevationLossM: 0,
      asphaltShare: 1,
      gravelShare: 0,
      trailShare: 0,
      ebikeSupport: 'NONE',
      bodyWeightKg: 70,
      dailyCalorieTarget: 2300,
      calculatedAt: '2026-08-13T10:00:00.000Z',
      estimatedMet: 6,
      activityCalories: 840,
      alreadyAccountedCalories: 190,
      activityBonus: 500,
    });

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );
    const day = bodyOf(response).days.find((entry) => entry.date === '2026-08-13');
    expect(day).toMatchObject({ consumedCalories: 2800, targetPercent: 100, dataStatus: 'available' });
    expect((day as typeof day & { effectiveTargetCalories?: number; activity?: { label: string } }).effectiveTargetCalories).toBe(2800);
    expect((day as typeof day & { activity?: { label: string } }).activity).toEqual({ type: 'cycling', label: 'Radtour' });
  });

  it('serves an identical week from cache without another AI call', async () => {
    const sentinel = '__END_OF_WEEKLY_REVIEW__';
    const text = `${'x'.repeat(WEEKLY_INSIGHT_TEXT_MAX_LENGTH - sentinel.length)}${sentinel}`;
    const create = mockOpenAi(text);
    const request = await makeAuthRequest({ query: { date: '2026-08-14' } });

    const first = await weeklyInsightHandler(request, makeContext());
    const second = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );

    expect(bodyOf(first).evaluation).toEqual({ status: 'fresh', text, generatedAt: expect.any(String) });
    expect(bodyOf(second).evaluation).toEqual({ status: 'cached', text, generatedAt: expect.any(String) });
    expect(bodyOf(first).evaluation.text).toHaveLength(WEEKLY_INSIGHT_TEXT_MAX_LENGTH);
    expect(bodyOf(second).evaluation.text?.endsWith(sentinel)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(enforceQuota).toHaveBeenCalledTimes(1);
    expect(trackUsage).toHaveBeenCalledTimes(1);
  });

  it('keeps dual-write fields while nested response fields remain canonical', async () => {
    mockOpenAi('Kompatible Wochenbewertung.');

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    const document = await getInsightRepository().getWeekly(TEST_USER_ID, '2026-08-13');
    expect(document).toMatchObject({
      response: {
        status: 'fresh',
        text: 'Kompatible Wochenbewertung.',
        generatedAt: expect.any(String),
      },
      status: 'fresh',
      generatedAt: expect.any(String),
    });
    expect(document?.generatedAt).toBe(document?.response.generatedAt);
  });

  it('invalidates a v1 cache entry after the prompt version bump', async () => {
    const create = mockOpenAi('Neue v2 Bewertung.');
    const periodDates = [
      '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10',
      '2026-08-11', '2026-08-12', '2026-08-13',
    ];
    const inputHash = computeWeeklyInputHash(
      {
        referenceDate: '2026-08-14',
        days: periodDates.map((date) => ({ date, meals: [], dayMeta: null })),
        profileTargets: null,
      },
      'v1',
    );
    const generatedAt = '2026-08-01T10:00:00.000Z';
    await getInsightRepository().upsertWeekly({
      id: makeWeeklyInsightId(TEST_USER_ID, '2026-08-13'),
      userId: TEST_USER_ID,
      _docType: 'weeklyInsight',
      referenceDate: '2026-08-14',
      periodStart: '2026-08-07',
      periodEnd: '2026-08-13',
      inputHash,
      promptVersion: 'v1',
      model: 'gpt4o-mini',
      response: { status: 'fresh', text: 'Alte v1 Bewertung.', generatedAt },
      status: 'fresh',
      generatedAt,
      lastAttemptAt: generatedAt,
      expiresAt: '2026-08-21T00:00:00.000Z',
      ttl: 604800,
      tokensUsed: 3,
    });

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );

    expect(bodyOf(response).evaluation).toEqual({
      status: 'fresh',
      text: 'Neue v2 Bewertung.',
      generatedAt: expect.any(String),
    });
    expect(create).toHaveBeenCalledTimes(1);
    await expect(getInsightRepository().getWeekly(TEST_USER_ID, '2026-08-13')).resolves.toMatchObject({
      promptVersion: 'v2',
      response: { text: 'Neue v2 Bewertung.' },
    });
  });

  it('does not return old text after a meal change inside the regeneration interval', async () => {
    const create = mockOpenAi('Alte Bewertung.');
    const meal = await getDiaryRepository().createMeal({
      userId: TEST_USER_ID,
      date: '2026-08-13',
      type: 'dinner',
      name: 'Meal',
    });
    const first = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );
    expect(bodyOf(first).evaluation.text).toBe('Alte Bewertung.');
    const cachedBeforeChange = await getInsightRepository().getWeekly(TEST_USER_ID, '2026-08-13');
    expect(cachedBeforeChange?.response.status).toBe('fresh');

    await getDiaryRepository().addItem(TEST_USER_ID, meal.id, {
      name: 'New item', calories: 1800, protein: 10, carbs: 20, fat: 5, fiber: 2,
    });
    const changed = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );

    expect(bodyOf(changed).evaluation).toEqual({ status: 'unavailable', text: null, generatedAt: null });
    expect(create).toHaveBeenCalledTimes(1);
    await expect(getInsightRepository().getWeekly(TEST_USER_ID, '2026-08-13')).resolves.toMatchObject({
      inputHash: cachedBeforeChange?.inputHash,
      response: {
        status: 'fresh',
        text: 'Alte Bewertung.',
        generatedAt: cachedBeforeChange?.response.generatedAt,
      },
    });
  });

  it('checks quota before AI and tracks only after a valid response', async () => {
    const order: string[] = [];
    vi.mocked(enforceQuota).mockImplementation(async () => {
      order.push('quota');
      return null;
    });
    const create = mockOpenAi('Valide Wochenbewertung.');
    create.mockImplementation(async () => {
      order.push('ai');
      return { choices: [{ message: { content: JSON.stringify({ text: 'Valide Wochenbewertung.' }) } }], usage: { total_tokens: 3 } };
    });
    vi.mocked(trackUsage).mockImplementation(async () => {
      order.push('track');
    });

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );
    expect(response.status).toBe(200);
    expect(order).toEqual(['quota', 'ai', 'track']);
  });

  it('keeps the chart usable and returns neutral text when quota or provider fails', async () => {
    vi.mocked(enforceQuota).mockResolvedValue({
      status: 429,
      jsonBody: { error: 'quota_exceeded', feature: 'daily-insight', used: 30, limit: 30, resetsAt: '2026-09-01T00:00:00.000Z' },
    });
    const quotaResponse = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );
    expect(quotaResponse.status).toBe(200);
    expect(bodyOf(quotaResponse).evaluation).toEqual({ status: 'quota_exceeded', text: null, generatedAt: null });
    expect(trackUsage).not.toHaveBeenCalled();

    _resetInsightRepositoryForTests();
    vi.mocked(enforceQuota).mockResolvedValue(null);
    mockOpenAi(new Error('provider unavailable'));
    const providerResponse = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );
    expect(providerResponse.status).toBe(200);
    expect(bodyOf(providerResponse).evaluation).toEqual({ status: 'unavailable', text: null, generatedAt: null });
  });

  it('does not persist or track a provider response truncated at the token limit', async () => {
    mockOpenAi('x'.repeat(WEEKLY_INSIGHT_TEXT_MAX_LENGTH), 'length');

    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(bodyOf(response).evaluation).toEqual({ status: 'unavailable', text: null, generatedAt: null });
    expect(trackUsage).not.toHaveBeenCalled();
    await expect(getInsightRepository().getWeekly(TEST_USER_ID, '2026-08-13')).resolves.toMatchObject({
      status: 'unavailable',
      response: { text: null },
      tokensUsed: 0,
    });
  });

  it('does not send raw meal names to the AI context', async () => {
    const create = mockOpenAi('Sanitisierte Bewertung.');
    await addDiaryItem('2026-08-13', 2000);
    const response = await weeklyInsightHandler(
      await makeAuthRequest({ query: { date: '2026-08-14' } }),
      makeContext(),
    );
    expect(response.status).toBe(200);
    const request = create.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
    expect(request.messages[1]!.content).not.toContain('Test item');
    expect(request.messages[1]!.content).not.toContain(TEST_USER_ID);
  });
});