import { describe, expect, it } from 'vitest';
import type { InsightInputContext, PrimarySignalType } from '@fittrack/shared';
import { selectInsightIntent } from './dailyInsightIntent';

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
      today: null,
      targets: null,
      remainingCalories: null,
      remainingProteinG: null,
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
      dayCompleteness: 0,
      goalAtCalculation: 'maintain',
    },
    currentHourLocal: null,
    specialActivity: null,
    activityCompletionStatus: null,
    activityStatusSource: null,
    ...overrides,
  };
}

function withSignal(type: PrimarySignalType): Partial<InsightInputContext> {
  const context = makeContext();
  return {
    progressIntelligence: {
      ...context.progressIntelligence,
      primarySignal: { type, confidence: 0.9, freshnessScore: 0 },
    },
  };
}

describe('selectInsightIntent', () => {
  it('uses activity focus for every present activity status', () => {
    for (const status of ['planned', 'likely_completed', 'unknown'] as const) {
      expect(selectInsightIntent(makeContext({
        specialActivity: {} as InsightInputContext['specialActivity'],
        activityCompletionStatus: status,
        activityStatusSource: status === 'unknown' ? 'unavailable' : 'local_time_heuristic',
      }))).toBe('activity_focus');
    }
  });

  it.each([
    'plateau_broken',
    'milestone_reached',
    'bad_phase_recovered',
  ] as const)('routes %s to weight_signal', (type) => {
    expect(selectInsightIntent(makeContext(withSignal(type)))).toBe('weight_signal');
  });

  it('routes phase context to phase progress', () => {
    expect(selectInsightIntent(makeContext(withSignal('phase_context')))).toBe('phase_progress');
  });

  it('routes an empty early morning to morning orientation', () => {
    expect(selectInsightIntent(makeContext({ currentHourLocal: 9 }))).toBe('morning_orientation');
  });

  it('does not treat a valid zero-kcal entry as an empty morning', () => {
    expect(selectInsightIntent(makeContext({
      currentHourLocal: 9,
      nutrition: {
        today: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, hasMealItem: true },
        targets: null,
        remainingCalories: null,
        remainingProteinG: null,
        last3Days: [],
      },
    }))).toBe('general');
  });

  it('routes a complete current nutrition context to nutrition guidance', () => {
    expect(selectInsightIntent(makeContext({
      nutrition: {
        today: { calories: 1200, protein: 80, carbs: 100, fat: 40, fiber: 15, hasMealItem: true },
        targets: { calories: 2000, proteinG: 140, carbsG: 220, fatG: 70, fiberG: 30 },
        remainingCalories: 800,
        remainingProteinG: 60,
        last3Days: [],
      },
    }))).toBe('nutrition_guidance');
  });

  it('uses the explicit priority and is deterministic', () => {
    const context = makeContext({ currentHourLocal: 9, ...withSignal('milestone_reached') });
    expect(selectInsightIntent(context)).toBe('weight_signal');
    expect(selectInsightIntent(context)).toBe('weight_signal');
  });

  it('falls back to general without a higher-priority signal', () => {
    expect(selectInsightIntent(makeContext())).toBe('general');
  });
});