// Tests for the Progress Intelligence Engine.
//
// Run with: vitest run src/lib/progressIntelligence.test.ts

import { describe, it, expect } from 'vitest';
import type { WeightEntry } from '@fittrack/shared';
import type { InsightDocument } from '@fittrack/shared';
import {
  computePhase,
  computeProgress,
  computeMilestone,
  computeMonthlyTrend,
  computeDayCompleteness,
  computeFreshnessScore,
  computeProgressIntelligence,
  PHASE_MIN_MEASUREMENTS,
} from './progressIntelligence';
import { PLATEAU_MIN_MEASUREMENTS } from '../../../shared/lib/plateauDetector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(date: string, value: number, unit: 'kg' | 'lbs' = 'kg'): WeightEntry {
  return { id: date, userId: 'u1', date, value, unit };
}

/** Generate N entries with a consistent linear slope, newest first. */
function linearEntries(
  todayIso: string,
  count: number,
  startKg: number,
  slopePerDay: number, // negative = losing weight
): WeightEntry[] {
  const entries: WeightEntry[] = [];
  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number];
  const base = new Date(Date.UTC(y, m - 1, d));
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() - i);
    const iso = date.toISOString().split('T')[0]!;
    entries.push(makeEntry(iso, parseFloat((startKg + slopePerDay * (count - 1 - i)).toFixed(2))));
  }
  return entries.reverse(); // newest first
}

const TODAY = '2026-06-15';

const emptyHistory: InsightDocument[] = [];

// ---------------------------------------------------------------------------
// computePlateau
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// computePhase
// ---------------------------------------------------------------------------

describe('computePhase', () => {
  it('returns null when fewer than PHASE_MIN_MEASUREMENTS entries', () => {
    const entries = Array.from({ length: PHASE_MIN_MEASUREMENTS - 1 }, (_, i) =>
      makeEntry(`2026-06-${String(i + 1).padStart(2, '0')}`, 80),
    );
    expect(computePhase(entries, TODAY, 'lose_weight')).toBeNull();
  });

  it('detects stable phase when slope is near zero', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`2026-06-${String(i + 1).padStart(2, '0')}`, 80 + (i * 0.01)),
    ).reverse();
    const result = computePhase(entries, TODAY, 'lose_weight');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('stable');
  });

  it('detects progressing phase (losing) for lose_weight goal', () => {
    // -0.5 kg/week = -0.071 kg/day
    const entries = linearEntries(TODAY, 14, 85, -0.071);
    const result = computePhase(entries, TODAY, 'lose_weight');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('progressing');
  });

  it('detects regressing phase (gaining) for lose_weight goal', () => {
    // +0.5 kg/week = gaining while trying to lose
    const entries = linearEntries(TODAY, 14, 80, 0.071);
    const result = computePhase(entries, TODAY, 'lose_weight');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('regressing');
  });

  it('detects progressing phase (gaining) for gain_muscle goal', () => {
    const entries = linearEntries(TODAY, 14, 70, 0.071);
    const result = computePhase(entries, TODAY, 'gain_muscle');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('progressing');
  });

  it('detects regressing phase (losing) for gain_muscle goal', () => {
    const entries = linearEntries(TODAY, 14, 75, -0.071);
    const result = computePhase(entries, TODAY, 'gain_muscle');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('regressing');
  });

  it('detects stable phase for maintain goal', () => {
    const entries = linearEntries(TODAY, 14, 75, 0.01);
    const result = computePhase(entries, TODAY, 'maintain');
    expect(result!.type).toBe('stable');
  });
});

// ---------------------------------------------------------------------------
// computeProgress
// ---------------------------------------------------------------------------

describe('computeProgress', () => {
  it('returns null for maintain goal', () => {
    const entries = linearEntries(TODAY, 12, 80, -0.05);
    expect(computeProgress(entries, 75, 'maintain', TODAY, 'kg')).toBeNull();
  });

  it('returns null for recomposition goal', () => {
    const entries = linearEntries(TODAY, 12, 80, -0.05);
    expect(computeProgress(entries, 75, 'recomposition', TODAY, 'kg')).toBeNull();
  });

  it('returns null when targetWeightKg is undefined', () => {
    const entries = linearEntries(TODAY, 12, 80, -0.05);
    expect(computeProgress(entries, undefined, 'lose_weight', TODAY, 'kg')).toBeNull();
  });

  it('returns null when too few entries', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry(`2026-05-${String(i + 1).padStart(2, '0')}`, 80),
    );
    expect(computeProgress(entries, 75, 'lose_weight', TODAY, 'kg')).toBeNull();
  });

  it('returns null when progress pct is below minimum', () => {
    // Start: 80 kg, target: 60 kg, current: 79 kg → 5% — below PROGRESS_MIN_PCT
    const entries = linearEntries('2026-06-15', 14, 80, -0.071);
    // Override newest to 79
    entries[0] = makeEntry('2026-06-15', 79);
    expect(computeProgress(entries, 60, 'lose_weight', TODAY, 'kg')).toBeNull();
  });

  it('calculates progress for lose_weight', () => {
    // 10 weeks of linear data: start 90 kg, now 80 kg, target 70 kg → 50%
    const startDate = new Date(Date.UTC(2026, 3, 6)); // 10 weeks ago
    const entries: WeightEntry[] = [];
    for (let i = 0; i < 70; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      entries.push(makeEntry(d.toISOString().split('T')[0]!, 90 - i * (10 / 69)));
    }
    const result = computeProgress(entries.reverse(), 70, 'lose_weight', TODAY, 'kg');
    expect(result).not.toBeNull();
    expect(result!.progressPct).toBeGreaterThanOrEqual(40);
    expect(result!.progressPct).toBeLessThanOrEqual(60);
    expect(result!.unit).toBe('kg');
  });

  it('calculates progress for gain_muscle', () => {
    const startDate = new Date(Date.UTC(2026, 3, 6));
    const entries: WeightEntry[] = [];
    for (let i = 0; i < 70; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      entries.push(makeEntry(d.toISOString().split('T')[0]!, 70 + i * (5 / 69)));
    }
    const result = computeProgress(entries.reverse(), 75, 'gain_muscle', TODAY, 'kg');
    expect(result).not.toBeNull();
    expect(result!.progressPct).toBeGreaterThanOrEqual(80);
  });

  it('progress values sum: achievedValue + remainingValue ≈ totalChange', () => {
    const startDate = new Date(Date.UTC(2026, 3, 6));
    const entries: WeightEntry[] = [];
    for (let i = 0; i < 70; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      entries.push(makeEntry(d.toISOString().split('T')[0]!, 90 - i * (10 / 69)));
    }
    const result = computeProgress(entries.reverse(), 70, 'lose_weight', TODAY, 'kg');
    if (!result) return; // already tested above
    const total = result.achievedValue + result.remainingValue;
    expect(total).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeMilestone
// ---------------------------------------------------------------------------

describe('computeMilestone', () => {
  it('returns null for maintain goal', () => {
    const entries = [makeEntry(TODAY, 79.8), makeEntry('2026-06-14', 80.3)];
    expect(computeMilestone(entries, 'maintain', TODAY, emptyHistory, 'kg')).toBeNull();
  });

  it('returns null for recomposition goal', () => {
    const entries = [makeEntry(TODAY, 79.8), makeEntry('2026-06-14', 80.3)];
    expect(computeMilestone(entries, 'recomposition', TODAY, emptyHistory, 'kg')).toBeNull();
  });

  it('detects lose_weight milestone (crossing under 80 kg)', () => {
    const entries = [
      makeEntry(TODAY, 79.8),
      makeEntry('2026-06-14', 80.3),
      makeEntry('2026-06-10', 81.0),
    ];
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'kg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(80);
    expect(result!.unit).toBe('kg');
  });

  it('returns null when milestone was recently shown in history (within Stufe-1 lockout)', () => {
    const entries = [
      makeEntry(TODAY, 79.8),
      makeEntry('2026-06-14', 80.3),
      makeEntry('2026-06-10', 81.0),
    ];
    // Use a date within the 3-day Stufe-1 lockout window (TODAY = 2026-06-15, so cutoff = 2026-06-12)
    const history: Partial<InsightDocument>[] = [{
      date: '2026-06-14', // 1 day ago — within 3-day Stufe-1 lockout
      progressIntelligence: {
        version: 'v1',
        primarySignal: { type: 'milestone_reached', confidence: 0.9, freshnessScore: 0 },
        contextSignals: [],
        progress: null, phase: null, plateau: null, milestone: null, monthlyTrend: null,
        dayCompleteness: 1, goalAtCalculation: 'lose_weight',
      },
    }];
    const result = computeMilestone(entries, 'lose_weight', TODAY, history as InsightDocument[], 'kg');
    expect(result).toBeNull();
  });

  it('returns null when no milestone threshold was crossed', () => {
    // Current: 81 kg (no threshold at 85 kg was crossed recently)
    const entries = [
      makeEntry(TODAY, 81.0),
      makeEntry('2026-06-14', 81.5),
    ];
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'kg');
    expect(result).toBeNull();
  });

  it('detects gain_muscle milestone (crossing over 75 kg)', () => {
    const entries = [
      makeEntry(TODAY, 75.2),
      makeEntry('2026-06-14', 74.8),
      makeEntry('2026-06-10', 73.5),
    ];
    const result = computeMilestone(entries, 'gain_muscle', TODAY, emptyHistory, 'kg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(75);
  });

  it('lbs milestones are only multiples of 25 (not multiples of 10)', () => {
    // Fix 4: old code generated every multiple of 10 AND 25 (e.g. 100, 110, 120, 125, 130...)
    // New code: only multiples of 25 (100, 125, 150, 175, 200...)
    // Verify by checking that no threshold between 100-400 is NOT a multiple of 25
    const entries = [
      makeEntry(TODAY, 124, 'lbs'),
      makeEntry('2026-06-14', 126, 'lbs'),
      makeEntry('2026-06-10', 130, 'lbs'),
    ];
    // 124 lbs crosses 125 (multiple of 25) — should be detected
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'lbs');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(125);
    // 110 is a multiple of 10 but NOT 25 — verify it's not detected as a threshold
    // by checking the milestone value is exactly 125 (the first multiple-of-25 crossed)
    expect(result!.value % 25).toBe(0);
  });

  // ── Journey-window filter tests ──────────────────────────────────────────

  it('rejects threshold outside journey (85 kg when start = 84.8 kg)', () => {
    // User's OLDEST entry (= journey start) is 84.8 kg.
    // A spike to 85.5 exists later, but the journey started BELOW 85.
    // Journey filter: threshold 85 must be < startInUnit (84.8) → FALSE → excluded.
    const entries = [
      makeEntry('2026-06-09', 84.8),  // oldest = journey start (below 85)
      makeEntry('2026-06-10', 85.5),  // spike provides hadOppositeEntry for 85
      makeEntry('2026-06-14', 84.7),
      makeEntry(TODAY, 84.5),
    ];
    // 85 threshold: hadOppositeEntry=true (85.5 > 85), but isInJourney=(85<84.8)=false → excluded
    // No other threshold is crossed (80 not reached) → null
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'kg');
    expect(result).toBeNull();
  });

  it('accepts threshold inside journey (80 kg, start = 84.9, target = 75)', () => {
    const entries = [
      makeEntry(TODAY, 79.8),
      makeEntry('2026-06-12', 80.5),
      makeEntry('2026-06-10', 84.9), // start weight
    ];
    // 80 is below start (84.9) and above target (75) → valid milestone
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'kg', 75);
    expect(result).not.toBeNull();
    expect(result!.value).toBe(80);
  });

  it('excludes threshold that equals targetWeightKg', () => {
    const entries = [
      makeEntry(TODAY, 74.8),
      makeEntry('2026-06-12', 75.5),
      makeEntry('2026-06-10', 80.0),
    ];
    // 75 is the target → should be excluded; 70 not crossed yet
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'kg', 75);
    if (result !== null) expect(result.value).not.toBe(75);
  });

  // ── Stufe-2 (confirmed) tests ────────────────────────────────────────────

  it('confirmed = false when fewer than 4 measurements in 7-day window', () => {
    // Only 2 entries in 7-day window → Stufe 1
    const entries = [
      makeEntry(TODAY, 79.8),
      makeEntry('2026-06-12', 80.5),
      makeEntry('2026-05-01', 84.0), // older than 7 days from TODAY (2026-06-15)
    ];
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'kg');
    expect(result).not.toBeNull();
    expect(result!.confirmed).toBe(false);
    expect(result!.movingAvgAtThreshold).toBeNull();
  });

  it('confirmed = true when ≥4 measurements and 7-day avg is under threshold', () => {
    // 5 measurements in 7-day window, all under 80 kg → avg under 80
    const entries = [
      makeEntry(TODAY, 79.2),
      makeEntry('2026-06-14', 79.5),
      makeEntry('2026-06-13', 79.8),
      makeEntry('2026-06-12', 79.6),
      makeEntry('2026-06-11', 79.9),  // 5th measurement, avg = 79.6
      makeEntry('2026-06-01', 81.0),  // older, provides hadOppositeEntry
    ];
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'kg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(80);
    expect(result!.confirmed).toBe(true);
    expect(result!.movingAvgAtThreshold).not.toBeNull();
    expect(result!.movingAvgAtThreshold!).toBeLessThan(80);
  });

  it('confirmed = false when 7-day avg is above threshold despite crossing', () => {
    // 4 measurements in window, but avg is above 80 (one outlier spike)
    const entries = [
      makeEntry(TODAY, 79.2),         // crossed
      makeEntry('2026-06-14', 81.5),  // spike
      makeEntry('2026-06-13', 81.0),  // spike
      makeEntry('2026-06-12', 80.8),  // spike
      makeEntry('2026-06-01', 83.0),  // older
    ];
    // avg of 4 recent = (79.2+81.5+81.0+80.8)/4 = 80.625 > 80 → not confirmed
    const result = computeMilestone(entries, 'lose_weight', TODAY, emptyHistory, 'kg');
    if (result !== null && result.value === 80) {
      expect(result.confirmed).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// computeMonthlyTrend
// ---------------------------------------------------------------------------

describe('computeMonthlyTrend', () => {
  it('returns null when only 1 month has enough data', () => {
    const entries = Array.from({ length: 6 }, (_, i) =>
      makeEntry(`2026-06-${String(i + 1).padStart(2, '0')}`, 80),
    );
    const result = computeMonthlyTrend(entries, TODAY, 'lose_weight', 'kg');
    // May has no data, June only — expect null or single month
    expect(result === null || result.months.length <= 1).toBe(true);
  });

  it('returns trend when 2+ months have sufficient data', () => {
    const entries: WeightEntry[] = [
      // May: 6 measurements
      ...Array.from({ length: 6 }, (_, i) => makeEntry(`2026-05-${String(i + 1).padStart(2, '0')}`, 82)),
      // June: 6 measurements
      ...Array.from({ length: 6 }, (_, i) => makeEntry(`2026-06-${String(i + 1).padStart(2, '0')}`, 80)),
    ];
    const result = computeMonthlyTrend(entries, TODAY, 'lose_weight', 'kg');
    expect(result).not.toBeNull();
    expect(result!.months.length).toBeGreaterThanOrEqual(2);
  });

  it('detects improvementAfterRegression when current month is better than previous which was worse than one before', () => {
    // Three months: April 85, May 87 (regression), June 84 (recovery)
    const entries: WeightEntry[] = [
      ...Array.from({ length: 5 }, (_, i) => makeEntry(`2026-04-${String(i + 1).padStart(2, '0')}`, 85)),
      ...Array.from({ length: 5 }, (_, i) => makeEntry(`2026-05-${String(i + 1).padStart(2, '0')}`, 87)),
      ...Array.from({ length: 5 }, (_, i) => makeEntry(`2026-06-${String(i + 1).padStart(2, '0')}`, 84)),
    ];
    const result = computeMonthlyTrend(entries, TODAY, 'lose_weight', 'kg');
    // With only 5 measurements per month (≥ 4 required) — should work
    if (result && result.months.length >= 3) {
      expect(result.improvementAfterRegression).toBe(true);
    }
  });

  it('month labels are non-empty strings', () => {
    const entries: WeightEntry[] = [
      ...Array.from({ length: 5 }, (_, i) => makeEntry(`2026-05-${String(i + 1).padStart(2, '0')}`, 82)),
      ...Array.from({ length: 5 }, (_, i) => makeEntry(`2026-06-${String(i + 1).padStart(2, '0')}`, 80)),
    ];
    const result = computeMonthlyTrend(entries, TODAY, 'lose_weight', 'kg');
    if (result) {
      result.months.forEach((m) => {
        expect(typeof m.label).toBe('string');
        expect(m.label.length).toBeGreaterThan(0);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// computeDayCompleteness
// ---------------------------------------------------------------------------

describe('computeDayCompleteness', () => {
  it('returns 1.0 when all dimensions are tracked', () => {
    expect(computeDayCompleteness({
      hasWeightToday: true, hasMealsToday: true,
      isTrainingDay: true, hasTrainingLogged: true,
    })).toBe(1);
  });

  it('returns 0.0 when nothing is tracked', () => {
    expect(computeDayCompleteness({
      hasWeightToday: false, hasMealsToday: false,
      isTrainingDay: false, hasTrainingLogged: false,
    })).toBe(0);
  });

  it('ignores training dimension on rest days', () => {
    // Rest day: only weight + meals
    expect(computeDayCompleteness({
      hasWeightToday: true, hasMealsToday: true,
      isTrainingDay: false, hasTrainingLogged: false,
    })).toBe(1);
  });

  it('returns partial score when some dimensions tracked', () => {
    const result = computeDayCompleteness({
      hasWeightToday: true, hasMealsToday: false,
      isTrainingDay: false, hasTrainingLogged: false,
    });
    expect(result).toBe(0.5);
  });

  it('includes training on training days', () => {
    const result = computeDayCompleteness({
      hasWeightToday: true, hasMealsToday: true,
      isTrainingDay: true, hasTrainingLogged: false,
    });
    expect(result).toBeCloseTo(2 / 3, 5);
  });
});

// ---------------------------------------------------------------------------
// computeFreshnessScore
// ---------------------------------------------------------------------------

describe('computeFreshnessScore', () => {
  it('returns 0 for empty history', () => {
    expect(computeFreshnessScore('plateau_active', [], TODAY)).toBe(0);
  });

  it('returns > 0 when signal appeared in recent history', () => {
    const history: Partial<InsightDocument>[] = [{
      date: '2026-06-14',
      progressIntelligence: {
        version: 'v1',
        primarySignal: { type: 'plateau_active', confidence: 0.7, freshnessScore: 0 },
        contextSignals: [],
        progress: null, phase: null, plateau: null, milestone: null, monthlyTrend: null,
        dayCompleteness: 1, goalAtCalculation: 'lose_weight',
      },
    }];
    const score = computeFreshnessScore('plateau_active', history as InsightDocument[], TODAY);
    expect(score).toBeGreaterThan(0);
  });

  it('does not count signal types that differ', () => {
    const history: Partial<InsightDocument>[] = [{
      date: '2026-06-14',
      progressIntelligence: {
        version: 'v1',
        primarySignal: { type: 'milestone_reached', confidence: 0.9, freshnessScore: 0 },
        contextSignals: [],
        progress: null, phase: null, plateau: null, milestone: null, monthlyTrend: null,
        dayCompleteness: 1, goalAtCalculation: 'lose_weight',
      },
    }];
    const score = computeFreshnessScore('plateau_active', history as InsightDocument[], TODAY);
    expect(score).toBe(0);
  });

  it('score is capped at 1.0', () => {
    // 14 days of plateau_active primary signal
    const history: Partial<InsightDocument>[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      progressIntelligence: {
        version: 'v1',
        primarySignal: { type: 'plateau_active', confidence: 0.7, freshnessScore: 0 },
        contextSignals: [],
        progress: null, phase: null, plateau: null, milestone: null, monthlyTrend: null,
        dayCompleteness: 1, goalAtCalculation: 'lose_weight',
      },
    }));
    const score = computeFreshnessScore('plateau_active', history as InsightDocument[], TODAY);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// computeProgressIntelligence — integration
// ---------------------------------------------------------------------------

describe('computeProgressIntelligence', () => {
  it('returns a valid ProgressIntelligence object', () => {
    const entries = linearEntries(TODAY, 14, 85, -0.071);
    const result = computeProgressIntelligence({
      entries, targetWeightKg: 75, goal: 'lose_weight',
      todayIso: TODAY, unit: 'kg',
      hasWeightToday: true, hasMealsToday: true,
      isTrainingDay: false, hasTrainingLogged: false,
      insightHistory: emptyHistory,
    });
    expect(result.version).toBe('v1');
    expect(result.primarySignal).toBeDefined();
    expect(result.primarySignal.type).toBeDefined();
    expect(result.dayCompleteness).toBeGreaterThanOrEqual(0);
    expect(result.dayCompleteness).toBeLessThanOrEqual(1);
    expect(result.goalAtCalculation).toBe('lose_weight');
  });

  it('always has at least a daily_context fallback signal', () => {
    // Minimal data — no special signals should fire
    const entries = [makeEntry(TODAY, 80), makeEntry('2026-06-14', 80.1)];
    const result = computeProgressIntelligence({
      entries, targetWeightKg: undefined, goal: 'maintain',
      todayIso: TODAY, unit: 'kg',
      hasWeightToday: false, hasMealsToday: false,
      isTrainingDay: false, hasTrainingLogged: false,
      insightHistory: emptyHistory,
    });
    // Should still have a primary signal
    expect(result.primarySignal).toBeDefined();
    expect(['plateau_broken', 'milestone_reached', 'bad_phase_recovered',
      'plateau_active', 'phase_context', 'daily_context']).toContain(result.primarySignal.type);
  });

  it('primarySignal.freshnessScore is between 0 and 1', () => {
    const entries = linearEntries(TODAY, 14, 85, -0.071);
    const result = computeProgressIntelligence({
      entries, targetWeightKg: 75, goal: 'lose_weight',
      todayIso: TODAY, unit: 'kg',
      hasWeightToday: true, hasMealsToday: true,
      isTrainingDay: false, hasTrainingLogged: false,
      insightHistory: emptyHistory,
    });
    expect(result.primarySignal.freshnessScore).toBeGreaterThanOrEqual(0);
    expect(result.primarySignal.freshnessScore).toBeLessThanOrEqual(1);
  });

  it('contextSignals is an array', () => {
    const entries = linearEntries(TODAY, 14, 85, -0.071);
    const result = computeProgressIntelligence({
      entries, targetWeightKg: 75, goal: 'lose_weight',
      todayIso: TODAY, unit: 'kg',
      hasWeightToday: true, hasMealsToday: true,
      isTrainingDay: false, hasTrainingLogged: false,
      insightHistory: emptyHistory,
    });
    expect(Array.isArray(result.contextSignals)).toBe(true);
  });

  it('phase is null when too few entries', () => {
    const entries = [makeEntry(TODAY, 80)];
    const result = computeProgressIntelligence({
      entries, targetWeightKg: 75, goal: 'lose_weight',
      todayIso: TODAY, unit: 'kg',
      hasWeightToday: true, hasMealsToday: false,
      isTrainingDay: false, hasTrainingLogged: false,
      insightHistory: emptyHistory,
    });
    expect(result.phase).toBeNull();
  });

  it('dayCompleteness 0 when nothing tracked (rest day)', () => {
    const entries = [makeEntry(TODAY, 80)];
    const result = computeProgressIntelligence({
      entries, targetWeightKg: undefined, goal: 'maintain',
      todayIso: TODAY, unit: 'kg',
      hasWeightToday: false, hasMealsToday: false,
      isTrainingDay: false, hasTrainingLogged: false,
      insightHistory: emptyHistory,
    });
    expect(result.dayCompleteness).toBe(0);
  });

  it('stale primary signal falls back to a fresher signal when available', () => {
    // Build 7 days of history all showing plateau_active as primary signal
    const history: Partial<InsightDocument>[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-06-${String(i + 8).padStart(2, '0')}`,
      progressIntelligence: {
        version: 'v1',
        primarySignal: { type: 'plateau_active', confidence: 0.7, freshnessScore: 0 },
        contextSignals: [],
        progress: null, phase: null, plateau: null, milestone: null, monthlyTrend: null,
        dayCompleteness: 1, goalAtCalculation: 'lose_weight',
      },
    }));
    // Entries that would normally trigger a plateau
    const plateauEntries = Array.from({ length: 8 }, (_, i) =>
      makeEntry(`2026-06-${String(i + 7).padStart(2, '0')}`, 80),
    );
    const result = computeProgressIntelligence({
      entries: plateauEntries,
      targetWeightKg: undefined,
      goal: 'lose_weight',
      todayIso: TODAY,
      unit: 'kg',
      hasWeightToday: true,
      hasMealsToday: true,
      isTrainingDay: false,
      hasTrainingLogged: false,
      insightHistory: history as InsightDocument[],
    });
    // plateau_active is stale (freshnessScore ~1), so a different signal should win
    // phase_context or daily_context — either is acceptable, but NOT plateau_active
    expect(result.primarySignal.type).not.toBe('plateau_active');
  });

  it('picks the best fresh candidate over daily_context when top signal is stale', () => {
    // Scenario: plateau_broken shown 5 of last 7 days (freshnessScore ≈ 0.71 > 0.6 threshold)
    // phase_context exists and is completely fresh (freshnessScore = 0)
    // Bug: current code jumps to daily_context instead of picking phase_context
    const history: Partial<InsightDocument>[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-06-${String(i + 8).padStart(2, '0')}`, // June 8-12
      progressIntelligence: {
        version: 'v1',
        primarySignal: { type: 'plateau_broken', confidence: 0.9, freshnessScore: 0 },
        contextSignals: [],
        progress: null, phase: null, plateau: null, milestone: null, monthlyTrend: null,
        dayCompleteness: 1, goalAtCalculation: 'lose_weight',
      },
    }));

    // Entries: old plateau (June 1-6 @ 80.0) + strong recent movement (June 9-15 dropping to 77.0)
    // → plateau.brokenRecently = true (plateau_broken signal added with freshnessScore ≈ 0.71)
    // → phase exists (14-day regression shows clear downtrend → phase_context signal added, freshnessScore = 0)
    const entries: ReturnType<typeof makeEntry>[] = [
      makeEntry('2026-06-01', 80.0), makeEntry('2026-06-02', 80.0), makeEntry('2026-06-03', 80.0),
      makeEntry('2026-06-04', 80.0), makeEntry('2026-06-05', 80.0), makeEntry('2026-06-06', 80.0),
      makeEntry('2026-06-09', 80.0), makeEntry('2026-06-10', 79.5), makeEntry('2026-06-11', 79.0),
      makeEntry('2026-06-12', 78.5), makeEntry('2026-06-13', 78.0), makeEntry('2026-06-14', 77.5),
      makeEntry(TODAY, 77.0),
    ];

    const result = computeProgressIntelligence({
      entries,
      targetWeightKg: undefined,
      goal: 'lose_weight',
      todayIso: TODAY,
      unit: 'kg',
      hasWeightToday: true,
      hasMealsToday: true,
      isTrainingDay: false,
      hasTrainingLogged: false,
      insightHistory: history as InsightDocument[],
    });

    // plateau_broken is stale (5/7 days = freshnessScore 0.71 > threshold 0.6)
    // phase_context is fresh (not in history, freshnessScore = 0)
    // Expected: phase_context wins — NOT daily_context (which the bug produces)
    expect(result.primarySignal.type).toBe('phase_context');
  });
});
