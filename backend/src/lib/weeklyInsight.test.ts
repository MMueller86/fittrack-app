import { describe, expect, it } from 'vitest';
import type { DayMeta, Meal, WeeklyNutritionCalculationInput } from '@fittrack/shared';

import {
  buildWeeklyInsightPromptContext,
  computeWeeklyInputHash,
  decideWeeklyCache,
} from './weeklyInsight';
import type { WeeklyInsightDocument } from './repositories/insightRepository';

function makeMeal(calories: number, id = `meal-${calories}`): Meal {
  return {
    id,
    userId: 'user1',
    date: '2026-08-13',
    type: 'dinner',
    name: 'Nicht für den Prompt',
    items: [{
      id: `item-${id}`,
      name: 'Rohtext nicht für den Prompt',
      sourceType: 'manual',
      quantity: 1,
      unit: 'serving',
      macros: { calories, protein: 10, carbs: 20, fat: 5, fiber: 2 },
    }],
    createdAt: '2026-08-13T18:00:00.000Z',
  };
}

function makeInput(overrides: Partial<WeeklyNutritionCalculationInput> = {}): WeeklyNutritionCalculationInput {
  return {
    referenceDate: '2026-08-14',
    days: [{ date: '2026-08-13', meals: [makeMeal(2000)], dayMeta: null }],
    ...overrides,
  };
}

function makeDayMeta(overrides: Partial<DayMeta> = {}): DayMeta {
  return {
    id: 'day:2026-08-13',
    userId: 'user1',
    date: '2026-08-13',
    dayType: 'rest',
    updatedAt: '2026-08-13T10:00:00.000Z',
    _docType: 'dayMeta',
    ...overrides,
  };
}

function makeCached(overrides: Partial<WeeklyInsightDocument> = {}): WeeklyInsightDocument {
  return {
    id: 'user1:weekly:2026-08-13',
    userId: 'user1',
    _docType: 'weeklyInsight',
    referenceDate: '2026-08-14',
    periodStart: '2026-08-07',
    periodEnd: '2026-08-13',
    inputHash: 'same',
    promptVersion: 'v1',
    model: 'gpt4o-mini',
    response: {
      status: 'fresh',
      text: 'Alte Bewertung darf bei Hashwechsel nicht erscheinen.',
      generatedAt: '2026-08-14T10:00:00.000Z',
    },
    status: 'fresh',
    generatedAt: '2026-08-14T10:00:00.000Z',
    lastAttemptAt: '2026-08-14T10:00:00.000Z',
    expiresAt: '2026-08-21T10:00:00.000Z',
    ttl: 604800,
    tokensUsed: 10,
    ...overrides,
  };
}

describe('weekly insight input hashing', () => {
  it('changes when a stored meal macro changes', () => {
    const first = makeInput();
    const second = makeInput({ days: [{ ...first.days[0]!, meals: [makeMeal(2100)] }] });
    expect(computeWeeklyInputHash(first as never, 'v1')).not.toBe(computeWeeklyInputHash(second as never, 'v1'));
  });

  it('changes when DayMeta or prompt version changes', () => {
    const first = makeInput({ days: [{ date: '2026-08-13', meals: [makeMeal(2000)], dayMeta: makeDayMeta() }] });
    const changedMeta = makeInput({ days: [{ date: '2026-08-13', meals: [makeMeal(2000)], dayMeta: makeDayMeta({ workoutType: 'gym' }) }] });
    expect(computeWeeklyInputHash(first as never, 'v1')).not.toBe(computeWeeklyInputHash(changedMeta as never, 'v1'));
    expect(computeWeeklyInputHash(first as never, 'v1')).not.toBe(computeWeeklyInputHash(first as never, 'v2'));
  });

  it('changes when a profile fallback target changes', () => {
    const first = makeInput({
      profileTargets: {
        restDay: { calories: 2000, proteinG: 150, carbsG: 200, fatG: 70, fiberG: 25 },
        trainingDay: { calories: 2400, proteinG: 160, carbsG: 250, fatG: 75, fiberG: 28 },
      },
    });
    const changedProfile = makeInput({
      profileTargets: {
        restDay: { calories: 1800, proteinG: 150, carbsG: 200, fatG: 70, fiberG: 25 },
        trainingDay: { calories: 2400, proteinG: 160, carbsG: 250, fatG: 75, fiberG: 28 },
      },
    });

    expect(computeWeeklyInputHash(first, 'v1')).not.toBe(computeWeeklyInputHash(changedProfile, 'v1'));
  });

  it('is stable when repository results return meals in another order', () => {
    const first = makeInput({
      days: [{ date: '2026-08-13', meals: [makeMeal(2000, 'b'), makeMeal(1000, 'a')], dayMeta: null }],
    });
    const second = makeInput({
      days: [{ date: '2026-08-13', meals: [makeMeal(1000, 'a'), makeMeal(2000, 'b')], dayMeta: null }],
    });
    expect(computeWeeklyInputHash(first as never, 'v1')).toBe(computeWeeklyInputHash(second as never, 'v1'));
  });
});

describe('buildWeeklyInsightPromptContext', () => {
  it('contains aggregate day values but no meal or product raw text', () => {
    const review = {
      referenceDate: '2026-08-14',
      periodStart: '2026-08-07',
      periodEnd: '2026-08-13',
      days: [{
        date: '2026-08-13',
        consumedCalories: 2000,
        baseTargetCalories: 2200,
        effectiveTargetCalories: 2400,
        activityBonusCalories: 200,
        targetPercent: 83.333,
        targetBand: 'outside_range' as const,
        dataStatus: 'available' as const,
        targetSource: 'day_target_snapshot' as const,
        dayType: 'training' as const,
        workoutType: 'gym' as const,
        activity: null,
        hasMealItem: true,
        mealItemCount: 1,
      }],
      totals: {
        includedDayCount: 1,
        totalConsumedCalories: 2000,
        totalTargetCalories: 2400,
        averageConsumedCalories: 2000,
        averageTargetCalories: 2400,
        overallTargetPercent: 83.333,
      },
    };
    const context = buildWeeklyInsightPromptContext(review);
    expect(context.days[0]).toMatchObject({ consumedCalories: 2000, effectiveTargetCalories: 2400 });
    expect(JSON.stringify(context)).not.toContain('Nicht für den Prompt');
    expect(JSON.stringify(context)).not.toContain('Rohtext');
    expect(context.days).toHaveLength(1);
  });
});

describe('decideWeeklyCache', () => {
  const now = new Date('2026-08-14T10:20:00.000Z');

  it('generates when there is no cache', () => {
    expect(decideWeeklyCache(null, 'new', now, false)).toEqual({ kind: 'generate' });
  });

  it('returns cached text for the same successful hash', () => {
    const decision = decideWeeklyCache(makeCached(), 'same', now, false);
    expect(decision).toEqual({
      kind: 'cached',
      evaluation: {
        status: 'cached',
        text: 'Alte Bewertung darf bei Hashwechsel nicht erscheinen.',
        generatedAt: '2026-08-14T10:00:00.000Z',
      },
    });
  });

  it('returns neutral data and replaces the cache after a recent hash change', () => {
    const decision = decideWeeklyCache(makeCached(), 'new', now, false);
    expect(decision).toEqual({
      kind: 'neutral',
      evaluation: { status: 'unavailable', text: null, generatedAt: null },
      replaceCache: true,
    });
  });

  it('allows regeneration after the minimum interval', () => {
    const old = makeCached({ lastAttemptAt: '2026-08-14T09:00:00.000Z' });
    expect(decideWeeklyCache(old, 'new', now, false)).toEqual({ kind: 'generate' });
  });

  it('lets an admin regenerate without the interval delay', () => {
    expect(decideWeeklyCache(makeCached(), 'new', now, true)).toEqual({ kind: 'generate' });
  });
});