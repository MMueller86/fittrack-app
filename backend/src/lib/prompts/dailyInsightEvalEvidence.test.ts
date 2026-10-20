import { describe, expect, it } from 'vitest';
import { DAILY_INSIGHT_EVAL_FIXTURES } from './dailyInsight.eval.fixtures';
import { buildHistoricalComparisonEvidence } from './dailyInsightEvalEvidence';

describe('Daily compact eval historical comparison evidence', () => {
  const context = DAILY_INSIGHT_EVAL_FIXTURES.find((fixture) => fixture.id === 'historical-target-source-priority')!.input;

  it.each([
    [2100, 'below'],
    [2250, 'equal'],
    [2400, 'above'],
  ] as const)('compares %s with the resolved 2250 snapshot, not current or activity targets', (calories, relation) => {
    const before = structuredClone(context);
    const day = { ...context.nutrition.last3Days[0], calories };
    expect(buildHistoricalComparisonEvidence([day])).toEqual([{
      date: day.date,
      consumedCalories: calories,
      targetCalories: 2250,
      relation,
    }]);
    expect(context).toEqual(before);
  });

  it.each([
    { targetSource: 'profile_fallback' as const },
    { targetSource: 'unavailable' as const },
    { hasMealItem: false },
    { calories: null },
    { calories: Number.NaN },
    { effectiveTargetCalories: null },
    { effectiveTargetCalories: 0 },
    { baseTargetCalories: null },
    { targetSource: 'special_activity_snapshot' as const, specialActivity: null },
  ])('does not invent a reliable comparison for %j', (override) => {
    const day = { ...context.nutrition.last3Days[0], ...override };
    expect(buildHistoricalComparisonEvidence([day])[0].relation).toBe('unavailable');
  });

  it('allows a usable stored special-activity source and preserves empty history', () => {
    const day = { ...context.nutrition.last3Days[0], targetSource: 'special_activity_snapshot' as const };
    expect(buildHistoricalComparisonEvidence([day])[0].relation).toBe('below');
    expect(buildHistoricalComparisonEvidence([])).toEqual([]);
  });
});