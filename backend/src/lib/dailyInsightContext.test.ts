import { describe, expect, it, vi } from 'vitest';
import type {
  DayMeta,
  DiaryDayResponse,
  Meal,
  SpecialActivity,
  UserProfile,
} from '@fittrack/shared';
import {
  buildDailyInsightContext,
  resolveActivityCompletionStatus,
} from './dailyInsightContext';

const USER_ID = 'context-test-user';
const REFERENCE_DATE = '2026-08-14';

function activity(overrides: Partial<SpecialActivity> = {}): SpecialActivity {
  return {
    type: 'hiking',
    movementTimeMinutes: 120,
    distanceKm: 8,
    elevationGainM: 300,
    bodyWeightKg: 70,
    dailyCalorieTarget: 2100,
    calculatedAt: '2026-08-13T10:00:00.000Z',
    estimatedMet: 5,
    activityCalories: 700,
    alreadyAccountedCalories: 175,
    activityBonus: 500,
    ...overrides,
  } as SpecialActivity;
}

function meal(calories: number): Meal {
  return {
    id: `meal-${calories}`,
    userId: USER_ID,
    date: REFERENCE_DATE,
    type: 'dinner',
    name: 'Test meal',
    createdAt: '2026-08-13T18:00:00.000Z',
    items: [{
      id: `item-${calories}`,
      name: 'Test item',
      sourceType: 'manual',
      quantity: 1,
      unit: 'serving',
      macros: { calories, protein: calories === 0 ? 0 : 20, carbs: 30, fat: 10, fiber: 3 },
    }],
  };
}

function diary(date: string, meals: Meal[]): DiaryDayResponse {
  const summary = meals.flatMap((entry) => entry.items).reduce(
    (current, item) => ({
      calories: current.calories + item.macros.calories,
      protein: current.protein + item.macros.protein,
      carbs: current.carbs + item.macros.carbs,
      fat: current.fat + item.macros.fat,
      fiber: current.fiber + item.macros.fiber,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
  return { meals: meals.map((entry) => ({ ...entry, date })), summary };
}

function profile(): UserProfile {
  return {
    id: 'profile',
    userId: USER_ID,
    gender: 'other',
    age: 35,
    heightCm: 175,
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
      restDay: { calories: 2000, proteinG: 150, carbsG: 200, fatG: 70, fiberG: 25 },
      trainingDay: { calories: 2400, proteinG: 160, carbsG: 250, fatG: 75, fiberG: 28 },
    },
    calculationMeta: {
      formulaVersion: 'profile-targets-v1-pal',
      bmr: 1700,
      pal: 1.4,
      maintenanceRestDay: 2000,
      trainingDayBonus: 300,
      goalAdjustment: 0,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function meta(date: string, overrides: Partial<DayMeta> = {}): DayMeta {
  return {
    id: `day:${date}`,
    userId: USER_ID,
    date,
    dayType: 'rest',
    updatedAt: `${date}T08:00:00.000Z`,
    _docType: 'dayMeta',
    ...overrides,
  };
}

function makeRepositories(options: {
  days?: Record<string, DiaryDayResponse>;
  metas?: Record<string, DayMeta>;
  historicalErrorDate?: string;
}) {
  const days = options.days ?? {};
  const metas = options.metas ?? {};
  return {
    diary: {
      getDay: vi.fn(async (_userId: string, date: string) => {
        if (date === options.historicalErrorDate) throw new Error('historical diary read failed');
        return days[date] ?? diary(date, []);
      }),
    },
    dayMeta: {
      get: vi.fn(async (_userId: string, date: string) => metas[date] ?? null),
    },
    insight: { listRecent: vi.fn(async () => []) },
    profile: { get: vi.fn(async () => profile()) },
    weights: { list: vi.fn(async () => []) },
  };
}

describe('resolveActivityCompletionStatus', () => {
  const storedActivity = activity();

  it.each([
    [0, 'planned'],
    [19, 'planned'],
    [20, 'likely_completed'],
    [23, 'likely_completed'],
  ] as const)('maps local hour %s to %s', (localHour, expected) => {
    expect(resolveActivityCompletionStatus(storedActivity, localHour, true)).toEqual({
      status: expected,
      source: 'local_time_heuristic',
    });
  });

  it.each([null, -1, 24, 20.5])('returns unknown for an invalid or missing hour (%s)', (localHour) => {
    expect(resolveActivityCompletionStatus(storedActivity, localHour, true)).toEqual({
      status: 'unknown',
      source: 'unavailable',
    });
  });

  it('does not expose a status when no activity exists', () => {
    expect(resolveActivityCompletionStatus(null, 23, true)).toEqual({ status: null, source: null });
  });

  it('does not infer historical completion from the current local hour', () => {
    expect(resolveActivityCompletionStatus(storedActivity, 23, false)).toEqual({
      status: 'unknown',
      source: 'unavailable',
    });
  });
});

describe('local-day activity status', () => {
  it('uses the valid offset to identify the current local day near a UTC boundary', async () => {
    const date = '2026-08-21';
    const repositories = makeRepositories({
      metas: { [date]: meta(date, { specialActivity: activity() }) },
    });

    const context = await buildDailyInsightContext({
      userId: USER_ID,
      date,
      localHour: 23,
      timezoneOffsetMinutes: 120,
      now: new Date('2026-08-20T23:30:00.000Z'),
      repositories,
    });

    expect(context.timezoneOffsetMinutes).toBe(120);
    expect(context.activityCompletionStatus).toBe('likely_completed');
    expect(context.activityStatusSource).toBe('local_time_heuristic');
  });

  it.each([
    ['missing offset', undefined],
    ['invalid offset', 900],
  ] as const)('does not infer completion with a %s', async (_label, timezoneOffsetMinutes) => {
    const repositories = makeRepositories({
      metas: { [REFERENCE_DATE]: meta(REFERENCE_DATE, { specialActivity: activity() }) },
    });

    const context = await buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      localHour: 23,
      timezoneOffsetMinutes,
      now: new Date('2026-08-20T23:30:00.000Z'),
      repositories,
    });

    expect(context.timezoneOffsetMinutes).toBeNull();
    expect(context.activityCompletionStatus).toBe('unknown');
    expect(context.activityStatusSource).toBe('unavailable');
  });

  it('does not apply a valid local hour retrospectively to a past or future date', async () => {
    const repositories = makeRepositories({
      metas: {
        '2026-08-19': meta('2026-08-19', { specialActivity: activity() }),
        '2026-08-22': meta('2026-08-22', { specialActivity: activity() }),
      },
    });

    for (const date of ['2026-08-19', '2026-08-22']) {
      const context = await buildDailyInsightContext({
        userId: USER_ID,
        date,
        localHour: 23,
        timezoneOffsetMinutes: 120,
        now: new Date('2026-08-20T23:30:00.000Z'),
        repositories,
      });

      expect(context.activityCompletionStatus).toBe('unknown');
      expect(context.activityStatusSource).toBe('unavailable');
    }
  });
});

describe('buildDailyInsightContext', () => {
  it('builds current and three historical days with zero-kcal and target-source semantics', async () => {
    const historicalDates = ['2026-08-13', '2026-08-12', '2026-08-11'];
    const repositories = makeRepositories({
      days: {
        [REFERENCE_DATE]: diary(REFERENCE_DATE, [meal(0)]),
        [historicalDates[0]]: diary(historicalDates[0], [meal(0)]),
        [historicalDates[1]]: diary(historicalDates[1], [meal(1800)]),
        [historicalDates[2]]: diary(historicalDates[2], []),
      },
      metas: {
        [REFERENCE_DATE]: meta(REFERENCE_DATE, {
          calorieTargetSnapshot: {
            calories: 2200,
            capturedAt: '2026-08-14T08:00:00.000Z',
            source: 'profile',
          },
          specialActivity: activity({ dailyCalorieTarget: 2100, activityBonus: 400 }),
        }),
        [historicalDates[0]]: meta(historicalDates[0], {
          calorieTargetSnapshot: {
            calories: 1900,
            capturedAt: '2026-08-13T08:00:00.000Z',
            source: 'profile',
          },
        }),
        [historicalDates[1]]: meta(historicalDates[1], {
          specialActivity: activity({ dailyCalorieTarget: 1800, activityBonus: 200 }),
        }),
      },
    });

    const context = await buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      localHour: 19,
      timezoneOffsetMinutes: 0,
      isCurrentDay: true,
      repositories,
    });

    expect(context.nutrition.today).toMatchObject({ calories: 0, protein: 0, hasMealItem: true });
    expect(context.nutrition.remainingCalories).toBe(2600);
    expect(context.activityCompletionStatus).toBe('planned');
    expect(context.activityStatusSource).toBe('local_time_heuristic');
    expect(context.nutrition.last3Days).toMatchObject([
      {
        date: historicalDates[0],
        calories: 0,
        hasMealItem: true,
        targetSource: 'day_target_snapshot',
        baseTargetCalories: 1900,
        effectiveTargetCalories: 1900,
        specialActivity: null,
      },
      {
        date: historicalDates[1],
        calories: 1800,
        hasMealItem: true,
        targetSource: 'special_activity_snapshot',
        baseTargetCalories: 1800,
        effectiveTargetCalories: 2000,
        specialActivity: { type: 'hiking' },
      },
      {
        date: historicalDates[2],
        calories: null,
        hasMealItem: false,
        targetSource: 'profile_fallback',
        baseTargetCalories: 2000,
        effectiveTargetCalories: 2000,
      },
    ]);
  });

  it('keeps an activity read without a usable historical target unavailable', async () => {
    const date = '2026-08-13';
    const repositories = makeRepositories({
      metas: { [date]: meta(date, { specialActivity: activity({ dailyCalorieTarget: 0 }) }) },
    });

    const context = await buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      localHour: null,
      repositories,
    });

    expect(context.nutrition.last3Days[0]).toMatchObject({
      date,
      targetSource: 'unavailable',
      baseTargetCalories: null,
      effectiveTargetCalories: null,
    });
  });

  it('propagates a historical repository error instead of creating an empty day', async () => {
    const repositories = makeRepositories({ historicalErrorDate: '2026-08-13' });

    await expect(buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      localHour: 12,
      repositories,
    })).rejects.toThrow('historical diary read failed');
  });
});