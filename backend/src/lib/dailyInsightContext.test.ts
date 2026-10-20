import { describe, expect, it, vi } from 'vitest';
import type {
  DayMeta,
  DiaryDayResponse,
  Meal,
  SpecialActivity,
  UserProfile,
  WeightEntry,
} from '@fittrack/shared';
import {
  buildDailyInsightContext,
  resolveDailyInsightActivityStatus,
} from './dailyInsightContext';
import { calculateMacroRanges } from '../../../shared/lib/macroRanges';

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

function meal(calories: number, type: Meal['type'] = 'dinner', protein = calories === 0 ? 0 : 20): Meal {
  return {
    id: `meal-${calories}`,
    userId: USER_ID,
    date: REFERENCE_DATE,
    type,
    name: 'Test meal',
    createdAt: '2026-08-13T18:00:00.000Z',
    items: [{
      id: `item-${calories}`,
      name: 'Test item',
      sourceType: 'manual',
      quantity: 1,
      unit: 'serving',
      macros: { calories, protein, carbs: 30, fat: 10, fiber: 3 },
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
      restDay: {
        calories: 2000,
        proteinG: 150,
        carbsG: 200,
        fatG: 70,
        fiberG: 25,
        macroRanges: calculateMacroRanges(70, 2000, 70),
      },
      trainingDay: {
        calories: 2400,
        proteinG: 160,
        carbsG: 250,
        fatG: 75,
        fiberG: 28,
        macroRanges: calculateMacroRanges(70, 2400, 75),
      },
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
  weights?: WeightEntry[];
  profile?: UserProfile | null;
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
    profile: { get: vi.fn(async () => options.profile === undefined ? profile() : options.profile) },
    weights: { list: vi.fn(async () => options.weights ?? []) },
  };
}

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
    expect(context.dailyActivityStatus).toBe('completed');
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
    expect(context.dailyActivityStatus).toBe('unknown');
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

      expect(context.dailyActivityStatus).toBe(date < '2026-08-21' ? 'completed' : 'unknown');
    }
  });
});

describe('resolveDailyInsightActivityStatus', () => {
  it('uses only completed or unknown for a logged activity', () => {
    expect(resolveDailyInsightActivityStatus(activity(), REFERENCE_DATE, REFERENCE_DATE, 21, true)).toBe('unknown');
    expect(resolveDailyInsightActivityStatus(activity(), REFERENCE_DATE, REFERENCE_DATE, 22, true)).toBe('completed');
    expect(resolveDailyInsightActivityStatus(activity(), '2026-08-13', REFERENCE_DATE, 8, false)).toBe('completed');
    expect(resolveDailyInsightActivityStatus(activity(), '2026-08-15', REFERENCE_DATE, 23, false)).toBe('unknown');
    expect(resolveDailyInsightActivityStatus(null, REFERENCE_DATE, REFERENCE_DATE, 23, true)).toBeNull();
  });
});

describe('buildDailyInsightContext', () => {
  async function buildForMeals(
    meals: Meal[],
    repositoryOptions: { weights?: WeightEntry[]; profile?: UserProfile | null } = {},
  ) {
    const repositories = makeRepositories({
      ...repositoryOptions,
      days: { [REFERENCE_DATE]: diary(REFERENCE_DATE, meals) },
    });
    return buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      localHour: 12,
      timezoneOffsetMinutes: 0,
      isCurrentDay: true,
      now: new Date(`${REFERENCE_DATE}T12:00:00.000Z`),
      repositories,
    });
  }

  async function buildForWeights(weights: WeightEntry[]) {
    const repositories = makeRepositories({ weights });
    return buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      now: new Date(`${REFERENCE_DATE}T12:00:00.000Z`),
      repositories,
    });
  }

  it.each([
    [104, 'below_range'],
    [105, 'in_range'],
    [140, 'in_range'],
    [141, 'above_range'],
    [175, 'at_or_above_2_5_g_per_kg'],
  ] as const)('classifies %s g protein for a 70 kg profile as %s', async (protein, expected) => {
    const context = await buildForMeals([meal(0, 'dinner', protein)]);
    expect(context.nutrition.dailyInsightProteinStatus).toBe(expected);
  });

  it('returns unknown protein status when weight is unavailable or stale', async () => {
    const mealWithProtein = [meal(0, 'dinner', 140)];
    const withoutProfile = await buildForMeals(mealWithProtein, { profile: null });
    const withStaleWeight = await buildForMeals(mealWithProtein, {
      weights: [{ id: 'old', userId: USER_ID, date: '2026-07-30', value: 70, unit: 'kg' }],
    });

    expect(withoutProfile.nutrition.dailyInsightProteinStatus).toBe('unknown');
    expect(withStaleWeight.nutrition.dailyInsightProteinStatus).toBe('unknown');
  });

  it('allows meal advice at 300 kcal remaining only when breakfast, lunch, and dinner have items', async () => {
    const exactly300Remaining = await buildForMeals([
      meal(500, 'breakfast'),
      meal(500, 'lunch'),
      meal(700, 'dinner'),
    ]);
    const below300Remaining = await buildForMeals([
      meal(500, 'breakfast'),
      meal(500, 'lunch'),
      meal(701, 'dinner'),
    ]);
    const snackInsteadOfDinner = await buildForMeals([
      meal(500, 'breakfast'),
      meal(500, 'lunch'),
      meal(700, 'snack'),
    ]);
    const emptyDinner = await buildForMeals([
      meal(500, 'breakfast'),
      meal(500, 'lunch'),
      { ...meal(700, 'dinner'), items: [] },
    ]);

    expect(exactly300Remaining.nutrition.remainingCalories).toBe(300);
    expect(exactly300Remaining.nutrition.mealAdviceAllowed).toBe(true);
    expect(below300Remaining.nutrition.remainingCalories).toBe(299);
    expect(below300Remaining.nutrition.mealAdviceAllowed).toBe(false);
    expect(snackInsteadOfDinner.nutrition.mealAdviceAllowed).toBe(false);
    expect(emptyDinner.nutrition.mealAdviceAllowed).toBe(false);
  });

  it('uses the selected training-day snapshot for a normal training day without a special activity', async () => {
    const repositories = makeRepositories({
      days: { [REFERENCE_DATE]: diary(REFERENCE_DATE, [meal(900)]) },
      metas: {
        [REFERENCE_DATE]: meta(REFERENCE_DATE, {
          dayType: 'training',
          workoutType: 'gym',
          calorieTargetSnapshot: {
            calories: 2400,
            capturedAt: '2026-08-14T08:00:00.000Z',
            source: 'profile',
          },
        }),
      },
    });

    const context = await buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      localHour: 18,
      repositories,
    });

    expect(context.nutrition.targets).toMatchObject({
      calories: 2400,
      baseCalories: 2400,
      activityBonusCalories: 0,
      targetSource: 'day_target_snapshot',
    });
    expect(context.nutrition.remainingCalories).toBe(1500);
  });

  it('uses selected profile-day ranges unchanged by a special-activity calorie bonus', async () => {
    const selectedTargets = profile().targets.trainingDay;
    const repositories = makeRepositories({
      days: { [REFERENCE_DATE]: diary(REFERENCE_DATE, [meal(300)]) },
      metas: {
        [REFERENCE_DATE]: meta(REFERENCE_DATE, {
          dayType: 'training',
          calorieTargetSnapshot: {
            calories: 2400,
            capturedAt: '2026-08-14T08:00:00.000Z',
            source: 'profile',
          },
          specialActivity: activity({ activityBonus: 400 }),
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

    expect(context.nutrition.targets).toMatchObject({
      calories: 2800,
      baseCalories: 2400,
      activityBonusCalories: 400,
      macroRanges: selectedTargets.macroRanges,
    });
    expect(context.nutrition.dailyInsightProteinStatus).toBe('below_range');
  });

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
      now: new Date(`${REFERENCE_DATE}T19:00:00.000Z`),
      repositories,
    });

    expect(context.nutrition.today).toMatchObject({ calories: 0, protein: 0, hasMealItem: true });
    expect(context.nutrition.remainingCalories).toBe(2600);
    expect(context.dailyActivityStatus).toBe('unknown');
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

  it('prefers a historical day-target snapshot over a conflicting activity target', async () => {
    const date = '2026-08-13';
    const repositories = makeRepositories({
      metas: {
        [date]: meta(date, {
          dayType: 'training',
          calorieTargetSnapshot: {
            calories: 2300,
            capturedAt: '2026-08-13T08:00:00.000Z',
            source: 'profile',
          },
          specialActivity: activity({ dailyCalorieTarget: 1600, activityBonus: 600 }),
        }),
      },
    });

    const context = await buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      repositories,
    });

    expect(context.nutrition.last3Days[0]).toMatchObject({
      targetSource: 'day_target_snapshot',
      baseTargetCalories: 2300,
      activityBonusCalories: 600,
      effectiveTargetCalories: 2900,
    });
  });

  it('keeps a 2250 historical snapshot distinct from the current 2000 profile target', async () => {
    const historicalDate = '2026-08-13';
    const repositories = makeRepositories({
      days: {
        [REFERENCE_DATE]: diary(REFERENCE_DATE, [meal(1600)]),
        [historicalDate]: diary(historicalDate, [meal(2100)]),
      },
      metas: {
        [historicalDate]: meta(historicalDate, {
          calorieTargetSnapshot: {
            calories: 2250,
            capturedAt: '2026-08-13T08:00:00.000Z',
            source: 'profile',
          },
        }),
      },
    });

    const context = await buildDailyInsightContext({
      userId: USER_ID,
      date: REFERENCE_DATE,
      localHour: 12,
      repositories,
    });

    expect(context.nutrition.targets?.calories).toBe(2000);
    expect(context.nutrition.remainingCalories).toBe(400);
    expect(context.nutrition.last3Days[0]).toMatchObject({
      date: historicalDate,
      calories: 2100,
      baseTargetCalories: 2250,
      effectiveTargetCalories: 2250,
      targetSource: 'day_target_snapshot',
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

  it('uses the Home 14-day trend when it differs from the 30-day direction', async () => {
    const recentWeights = Array.from({ length: 7 }, (_, index): WeightEntry => {
      const date = new Date(`${REFERENCE_DATE}T12:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() - index * 2);
      return {
        id: `recent-${index}`,
        userId: USER_ID,
        date: date.toISOString().slice(0, 10),
        value: 79.6 - index * 0.1,
        unit: 'kg',
      };
    });
    const olderWeights: WeightEntry[] = [20, 27].map((daysAgo, index) => {
      const date = new Date(`${REFERENCE_DATE}T12:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() - daysAgo);
      return {
        id: `older-${index}`,
        userId: USER_ID,
        date: date.toISOString().slice(0, 10),
        value: 82 + index,
        unit: 'kg',
      };
    });
    const context = await buildForWeights([...recentWeights, ...olderWeights]);

    expect(context.weight.weeklyTrend30d).toBe('losing');
    expect(context.weight.homeTrend14d).toBe('gaining');
  });

  it('matches Home minimum-measurement and neutral trend rules', async () => {
    const makeRecentWeights = (count: number, valueStep: number): WeightEntry[] =>
      Array.from({ length: count }, (_, index) => {
        const date = new Date(`${REFERENCE_DATE}T12:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() - index * 2);
        return {
          id: `weight-${count}-${index}`,
          userId: USER_ID,
          date: date.toISOString().slice(0, 10),
          value: 80 + (count - 1 - index) * valueStep,
          unit: 'kg',
        };
      });

    const insufficientContext = await buildForWeights(makeRecentWeights(6, 0.1));
    const neutralContext = await buildForWeights(makeRecentWeights(7, 0.01));

    expect(insufficientContext.weight.homeTrend14d).toBeNull();
    expect(neutralContext.weight.homeTrend14d).toBe('stable');
  });

  it('normalizes the current Home weight value to kilograms', async () => {
    const context = await buildForWeights([{
      id: 'pounds',
      userId: USER_ID,
      date: REFERENCE_DATE,
      value: 176.37,
      unit: 'lbs',
    }]);

    expect(context.weight.latestKg).toBeCloseTo(80, 1);
  });
});