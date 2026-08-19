import { describe, expect, it } from 'vitest';

import {
  calculateWeeklyNutritionReview,
  getWeeklyReviewPeriod,
  getWeeklyTargetBand,
} from './weeklyReviewCalculator';

interface TestMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function mealWithItems(...macrosValues: TestMacros[]) {
  return {
    items: macrosValues.map((macros, index) => ({
      id: `item-${index}-${macros.calories}`,
      name: 'Test food',
      sourceType: 'manual' as const,
      quantity: 1,
      unit: 'serving',
      macros: { ...macros, fiber: 0 },
    })),
  };
}

function mealWithCalories(calories: number) {
  return mealWithItems({ calories, protein: 0, carbs: 0, fat: 0 });
}

function targetMeta(calories: number, dayType: 'rest' | 'training' = 'rest') {
  return {
    dayType,
    calorieTargetSnapshot: {
      calories,
      capturedAt: '2026-08-01T00:00:00.000Z',
      source: 'profile' as const,
    },
  };
}

function profileTargets(restDayCalories = 2000, trainingDayCalories = 2400) {
  return {
    restDay: { calories: restDayCalories, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
    trainingDay: { calories: trainingDayCalories, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  };
}

describe('getWeeklyReviewPeriod', () => {
  it('returns exactly the seven completed dates before the reference date', () => {
    expect(getWeeklyReviewPeriod('2026-08-14')).toEqual({
      periodStart: '2026-08-07',
      periodEnd: '2026-08-13',
      dates: [
        '2026-08-07',
        '2026-08-08',
        '2026-08-09',
        '2026-08-10',
        '2026-08-11',
        '2026-08-12',
        '2026-08-13',
      ],
    });
  });

  it('rejects a non-calendar reference date', () => {
    expect(() => getWeeklyReviewPeriod('2026-02-30')).toThrow(RangeError);
  });
});

describe('getWeeklyTargetBand', () => {
  it.each([95, 100, 105])('includes %s percent in the target range', (percent) => {
    expect(getWeeklyTargetBand(percent)).toBe('in_range');
  });

  it.each([94.99, 105.01])('marks %s percent outside the target range', (percent) => {
    expect(getWeeklyTargetBand(percent)).toBe('outside_range');
  });
});

describe('calculateWeeklyNutritionReview', () => {
  it('uses the default rest target and explicit training target without snapshots', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-17',
      profileTargets: profileTargets(),
      days: [
        { date: '2026-08-13', meals: [mealWithCalories(2000)], dayMeta: null },
        { date: '2026-08-15', meals: [mealWithCalories(2400)], dayMeta: { dayType: 'training' } },
      ],
    });

    expect(result.periodStart).toBe('2026-08-10');
    expect(result.periodEnd).toBe('2026-08-16');
    expect(result.days.map((day) => day.date)).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
      '2026-08-14', '2026-08-15', '2026-08-16',
    ]);
    expect(result.days.find((day) => day.date === '2026-08-13')).toMatchObject({
      baseTargetCalories: 2000,
      effectiveTargetCalories: 2000,
      targetPercent: 100,
      dataStatus: 'available',
      targetSource: 'profile_fallback',
    });
    expect(result.days.find((day) => day.date === '2026-08-15')).toMatchObject({
      baseTargetCalories: 2400,
      effectiveTargetCalories: 2400,
      targetPercent: 100,
      dataStatus: 'available',
      targetSource: 'profile_fallback',
    });
    expect(result.days.find((day) => day.date === '2026-08-14')?.dataStatus).toBe('missing_nutrition');
    expect(result.totals).toMatchObject({
      includedDayCount: 2,
      totalConsumedCalories: 4400,
      totalTargetCalories: 4400,
      overallTargetPercent: 100,
    });
  });

  it('preserves explicit training context when the profile fallback supplies the target', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      profileTargets: profileTargets(2000, 2400),
      days: [{
        date: '2026-08-13',
        meals: [mealWithCalories(2400)],
        dayMeta: { dayType: 'training', workoutType: 'gym' },
      }],
    });

    expect(result.days[6]).toMatchObject({
      baseTargetCalories: 2400,
      effectiveTargetCalories: 2400,
      targetSource: 'profile_fallback',
      dayType: 'training',
      workoutType: 'gym',
      activity: null,
      activityBonusCalories: 0,
    });
  });

  it('preserves training context when a historical target snapshot is available', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      profileTargets: profileTargets(1800, 2600),
      days: [{
        date: '2026-08-13',
        meals: [mealWithCalories(2300)],
        dayMeta: {
          dayType: 'training',
          workoutType: 'bouldering',
          calorieTargetSnapshot: {
            calories: 2300,
            capturedAt: '2026-08-13T08:00:00.000Z',
            source: 'profile',
          },
        },
      }],
    });

    expect(result.days[6]).toMatchObject({
      baseTargetCalories: 2300,
      effectiveTargetCalories: 2300,
      targetSource: 'day_target_snapshot',
      dayType: 'training',
      workoutType: 'bouldering',
    });
  });

  it('keeps missing days in the fixed period and excludes them from totals', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      days: [{ date: '2026-08-13', meals: [mealWithCalories(2000)], dayMeta: targetMeta(2000) }],
    });

    expect(result.days).toHaveLength(7);
    expect(result.days[0]?.dataStatus).toBe('missing_nutrition_and_target');
    expect(result.days[6]?.targetPercent).toBe(100);
    expect(result.totals).toEqual({
      includedDayCount: 1,
      totalConsumedCalories: 2000,
      totalTargetCalories: 2000,
      averageConsumedCalories: 2000,
      averageTargetCalories: 2000,
      overallTargetPercent: 100,
    });
  });

  it('treats an empty meal as missing nutrition', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      days: [{ date: '2026-08-13', meals: [{ items: [] }], dayMeta: targetMeta(2000) }],
    });

    const day = result.days[6]!;
    expect(day.hasMealItem).toBe(false);
    expect(day.consumedCalories).toBeNull();
    expect(day.consumedMacros).toBeNull();
    expect(day.dataStatus).toBe('missing_nutrition');
    expect(result.totals.includedDayCount).toBe(0);
  });

  it('sums protein, carbs, and fat across multiple meals and items', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      days: [{
        date: '2026-08-13',
        meals: [
          mealWithItems(
            { calories: 500, protein: 12.25, carbs: 31.5, fat: 8.75 },
            { calories: 250, protein: 5.5, carbs: 12.125, fat: 4.25 },
          ),
          mealWithItems({ calories: 150, protein: 0.375, carbs: 7.375, fat: 2.125 }),
        ],
        dayMeta: targetMeta(2000),
      }],
    });

    expect(result.days[6]).toMatchObject({
      consumedCalories: 900,
      consumedMacros: { protein: 18.125, carbs: 51, fat: 15.125 },
      targetPercent: 45,
      dataStatus: 'available',
      targetSource: 'day_target_snapshot',
    });
  });

  it('keeps zero calories as valid nutrition when a MealItem exists', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      days: [{ date: '2026-08-13', meals: [mealWithCalories(0)], dayMeta: targetMeta(2000) }],
    });

    const day = result.days[6]!;
    expect(day.hasMealItem).toBe(true);
    expect(day.mealItemCount).toBe(1);
    expect(day.consumedCalories).toBe(0);
    expect(day.consumedMacros).toEqual({ protein: 0, carbs: 0, fat: 0 });
    expect(day.targetPercent).toBe(0);
    expect(day.dataStatus).toBe('available');
    expect(result.totals.totalConsumedCalories).toBe(0);
  });

  it('keeps the target missing when no profile or historical target is available', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      days: [{ date: '2026-08-13', meals: [mealWithCalories(2000)], dayMeta: { dayType: 'training' } }],
    });

    const day = result.days[6]!;
    expect(day.baseTargetCalories).toBeNull();
    expect(day.effectiveTargetCalories).toBeNull();
    expect(day.targetPercent).toBeNull();
    expect(day.targetSource).toBe('unavailable');
    expect(day.dataStatus).toBe('missing_target');
    expect(result.totals.includedDayCount).toBe(0);
  });

  it('keeps a stored day snapshot ahead of the profile fallback', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      profileTargets: profileTargets(1800, 2400),
      days: [{ date: '2026-08-13', meals: [mealWithCalories(2300)], dayMeta: targetMeta(2300) }],
    });

    expect(result.days[6]).toMatchObject({
      baseTargetCalories: 2300,
      effectiveTargetCalories: 2300,
      targetSource: 'day_target_snapshot',
      targetPercent: 100,
    });
  });

  it('uses a valid special-activity target snapshot and bonus', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      profileTargets: profileTargets(1800, 2400),
      days: [{
        date: '2026-08-13',
        meals: [mealWithCalories(3600)],
        dayMeta: {
          dayType: 'rest',
          specialActivity: {
            type: 'cycling',
            movementTimeMinutes: 120,
            distanceKm: 40,
            elevationGainM: 200,
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
            activityBonus: 1300,
          },
        },
      }],
    });

    const day = result.days[6]!;
    expect(day.baseTargetCalories).toBe(2300);
    expect(day.effectiveTargetCalories).toBe(3600);
    expect(day.activityBonusCalories).toBe(1300);
    expect(day.activity).toEqual({ type: 'cycling', label: 'Radtour' });
    expect(day.targetPercent).toBe(100);
    expect(day.targetSource).toBe('special_activity_snapshot');
  });

  it('does not expose the implicit rest fallback as a historical day type', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      days: [{
        date: '2026-08-13',
        meals: [mealWithCalories(2300)],
        dayMeta: {
          dayType: 'rest',
          workoutType: undefined,
          specialActivity: {
            type: 'hiking',
            movementTimeMinutes: 60,
            distanceKm: 4,
            elevationGainM: 100,
            bodyWeightKg: 70,
            dailyCalorieTarget: 2000,
            calculatedAt: '2026-08-13T10:00:00.000Z',
            estimatedMet: 4,
            activityCalories: 280,
            alreadyAccountedCalories: 91.67,
            activityBonus: 300,
          },
        },
      }],
    });

    const day = result.days[6]!;
    expect(day.activity).toEqual({ type: 'hiking', label: 'Wanderung' });
    expect(day.dayType).toBeNull();
    expect(day.workoutType).toBeNull();
  });

  it('does not mutate input and does not average daily percentages', () => {
    const input = {
      referenceDate: '2026-08-14',
      days: [
        { date: '2026-08-12', meals: [mealWithCalories(1900)], dayMeta: targetMeta(2000) },
        { date: '2026-08-13', meals: [mealWithCalories(3000)], dayMeta: targetMeta(4000, 'training') },
      ],
    };
    const original = JSON.stringify(input);

    const result = calculateWeeklyNutritionReview(input);

    expect(JSON.stringify(input)).toBe(original);
    expect(result.totals.overallTargetPercent).toBeCloseTo((4900 / 6000) * 100, 10);
  });

  it('returns null totals when no day has both nutrition and a valid target', () => {
    const result = calculateWeeklyNutritionReview({
      referenceDate: '2026-08-14',
      days: [],
    });

    expect(result.totals).toEqual({
      includedDayCount: 0,
      totalConsumedCalories: null,
      totalTargetCalories: null,
      averageConsumedCalories: null,
      averageTargetCalories: null,
      overallTargetPercent: null,
    });
  });
});