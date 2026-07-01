// Progress Intelligence Engine — computes behavioural signals from raw data.
//
// Pure module: no I/O, no Cosmos calls, no HTTP. All inputs are plain values.
// The AI receives the output and formulates text — it never re-calculates.
//
// Architecture note: This is the first implementation of a generalisable
// "Metric Intelligence" pattern. Future metrics (body measurements, body fat)
// will follow the same shape with metric-specific implementations.

import type { WeightEntry, GoalType } from '@fittrack/shared';
import type {
  ProgressIntelligence,
  IntelligenceSignal,
  PrimarySignalType,
  ProgressPhaseIntelligence,
  MilestoneIntelligence,
  ProgressValueIntelligence,
  MonthlyDataPoint,
  InsightDocument,
} from '@fittrack/shared';
// Relative imports required (Coding Rule: value-imports from shared must use relative paths)
import { PROGRESS_INTELLIGENCE_VERSION } from '../../../shared/types/insight';
import { evaluateWeightDelta, progressGrowsOnDecrease } from '../../../shared/lib/goalContext';
import { computePlateauSignal } from '../../../shared/lib/plateauDetector';

// ---------------------------------------------------------------------------
// Configurable thresholds — not hardcoded in logic, easy to tune post-launch
// ---------------------------------------------------------------------------

// Plateau constants live in shared/lib/plateauDetector.ts (Single Source of Truth)
export const PHASE_WINDOW_DAYS = 14;
export const PHASE_MIN_MEASUREMENTS = 3;
export const PHASE_STABLE_KG_PER_WEEK = 0.3;

export const PROGRESS_MIN_PCT = 20;
export const PROGRESS_MIN_WEEKS = 4;
export const PROGRESS_MIN_MEASUREMENTS = 8;

export const MILESTONE_WINDOW_DAYS = 7;
export const MILESTONE_LOCKOUT_DAYS = 14;

export const MONTHLY_MIN_MEASUREMENTS = 4;
export const MONTHLY_LOOKBACK_MONTHS = 6;

export const FRESHNESS_LOOKBACK_DAYS = 7;
export const FRESHNESS_SUPPRESS_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 86_400_000;
}

function toKg(value: number, unit: 'kg' | 'lbs'): number {
  return unit === 'lbs' ? value / 2.20462 : value;
}

function fromKg(kg: number, unit: 'kg' | 'lbs'): number {
  return unit === 'lbs' ? kg * 2.20462 : kg;
}

/** Standard deviation of an array of numbers. Returns 0 for arrays < 2 items. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Linear regression slope (kg per day).
 * Returns null when fewer than 2 points or zero x-variance.
 */
function linearRegressionSlope(entries: WeightEntry[]): number | null {
  if (entries.length < 2) return null;
  const xs = entries.map((e) => parseIsoDate(e.date).getTime() / 86_400_000);
  const ys = entries.map((e) => toKg(e.value, e.unit));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? null : num / den;
}

/** Filter entries to a recent window, sorted newest first. */
function entriesInWindow(entries: WeightEntry[], todayIso: string, days: number): WeightEntry[] {
  const cutoff = parseIsoDate(todayIso);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return entries
    .filter((e) => parseIsoDate(e.date) >= cutoff)
    .sort((a, b) => parseIsoDate(b.date).getTime() - parseIsoDate(a.date).getTime());
}

/** Milestone thresholds for a unit: multiples of 5 kg, multiples of 25 lbs. */
function milestoneThresholds(unit: 'kg' | 'lbs'): number[] {
  if (unit === 'lbs') {
    const thresholds: number[] = [];
    for (let v = 100; v <= 400; v += 25) {
      thresholds.push(v);
    }
    return thresholds;
  }
  const thresholds: number[] = [];
  for (let v = 30; v <= 250; v++) {
    if (v % 5 === 0) thresholds.push(v);
  }
  return thresholds;
}

// ---------------------------------------------------------------------------
// Signal computation functions
// ---------------------------------------------------------------------------

// Plateau detection: computePlateauSignal() from shared/lib/plateauDetector

export function computePhase(
  entries: WeightEntry[],
  todayIso: string,
  goal: GoalType,
): ProgressPhaseIntelligence | null {
  const window = entriesInWindow(entries, todayIso, PHASE_WINDOW_DAYS);
  if (window.length < PHASE_MIN_MEASUREMENTS) return null;

  const slopePerDay = linearRegressionSlope(window); // kg/day
  if (slopePerDay === null) return null;

  const slopePerWeek = slopePerDay * 7;
  const absSlope = Math.abs(slopePerWeek);

  let type: ProgressPhaseIntelligence['type'];
  if (absSlope < PHASE_STABLE_KG_PER_WEEK) {
    type = 'stable';
  } else {
    const eval_ = evaluateWeightDelta(goal, slopePerWeek);
    type = eval_ === 'positive' ? 'progressing' : 'regressing';
  }

  // Estimate how long this phase has been running
  return { type };
}

export function computeProgress(
  entries: WeightEntry[],
  targetWeightKg: number | undefined,
  goal: GoalType,
  todayIso: string,
  unit: 'kg' | 'lbs',
): ProgressValueIntelligence | null {
  // Only meaningful for directional goals
  if (goal === 'maintain' || goal === 'recomposition') return null;
  if (!targetWeightKg) return null;
  if (entries.length < PROGRESS_MIN_MEASUREMENTS) return null;

  const sorted = [...entries].sort(
    (a, b) => parseIsoDate(a.date).getTime() - parseIsoDate(b.date).getTime(),
  );
  const oldest = sorted[0]!;
  const newest = sorted[sorted.length - 1]!;

  const weeksSinceStart = daysBetween(parseIsoDate(oldest.date), parseIsoDate(todayIso)) / 7;
  if (weeksSinceStart < PROGRESS_MIN_WEEKS) return null;

  const startKg = toKg(oldest.value, oldest.unit);
  const currentKg = toKg(newest.value, newest.unit);
  const growsOnDecrease = progressGrowsOnDecrease(goal);
  if (growsOnDecrease === null) return null;

  const totalChange = Math.abs(startKg - targetWeightKg);
  if (totalChange < 0.1) return null; // start ≈ target

  const achieved = growsOnDecrease
    ? Math.max(0, startKg - currentKg)
    : Math.max(0, currentKg - startKg);
  const remaining = Math.max(0, totalChange - achieved);
  const pct = Math.min(100, Math.round((achieved / totalChange) * 100));

  if (pct < PROGRESS_MIN_PCT) return null;

  return {
    startValue: parseFloat(fromKg(startKg, unit).toFixed(1)),
    achievedValue: parseFloat(fromKg(achieved, unit).toFixed(1)),
    remainingValue: parseFloat(fromKg(remaining, unit).toFixed(1)),
    progressPct: pct,
    unit,
  };
}

export function computeMilestone(
  entries: WeightEntry[],
  goal: GoalType,
  todayIso: string,
  insightHistory: InsightDocument[],
  unit: 'kg' | 'lbs',
): MilestoneIntelligence | null {
  if (goal === 'maintain' || goal === 'recomposition') return null;

  const growsOnDecrease = progressGrowsOnDecrease(goal);
  if (growsOnDecrease === null) return null;

  const recentEntries = entriesInWindow(entries, todayIso, MILESTONE_WINDOW_DAYS);
  if (recentEntries.length < 2) return null;

  const sorted = [...entries].sort(
    (a, b) => parseIsoDate(a.date).getTime() - parseIsoDate(b.date).getTime(),
  );

  const thresholds = milestoneThresholds(unit);
  const newestKg = toKg(recentEntries[0]!.value, recentEntries[0]!.unit);
  const newestInUnit = fromKg(newestKg, unit);

  // Find a threshold crossed: the CURRENT value crosses it but some OLDER entry was on the other side
  let crossedThreshold: number | null = null;
  let crossedDate: string | null = null;

  for (const threshold of thresholds) {
    const isNowCrossed = growsOnDecrease ? newestInUnit <= threshold : newestInUnit >= threshold;
    if (!isNowCrossed) continue;

    // Check if any older entry was on the wrong side
    const hadOppositeEntry = sorted.some((e) => {
      // Only consider entries older than the most recent one
      if (e.date === recentEntries[0]!.date) return false;
      const v = fromKg(toKg(e.value, e.unit), unit);
      return growsOnDecrease ? v > threshold : v < threshold;
    });

    if (hadOppositeEntry) {
      crossedThreshold = threshold;
      // Find the first entry in the recent window that crossed it
      const crossing = recentEntries.find((e) => {
        const v = fromKg(toKg(e.value, e.unit), unit);
        return growsOnDecrease ? v <= threshold : v >= threshold;
      });
      crossedDate = crossing?.date ?? todayIso;
      break;
    }
  }

  if (crossedThreshold === null || crossedDate === null) return null;

  // Check lockout: was this milestone mentioned in recent history?
  const lockoutCutoff = new Date(parseIsoDate(todayIso));
  lockoutCutoff.setUTCDate(lockoutCutoff.getUTCDate() - MILESTONE_LOCKOUT_DAYS);

  const alreadyMentioned = insightHistory
    .filter((doc) => parseIsoDate(doc.date) >= lockoutCutoff)
    .some(
      (doc) =>
        doc.progressIntelligence?.primarySignal?.type === 'milestone_reached' ||
        doc.progressIntelligence?.contextSignals?.some((s) => s.type === 'milestone_reached'),
    );

  if (alreadyMentioned) return null;

  return { value: crossedThreshold, unit, reachedAt: crossedDate };
}

export function computeMonthlyTrend(
  entries: WeightEntry[],
  todayIso: string,
  goal: GoalType,
  unit: 'kg' | 'lbs',
): ProgressIntelligence['monthlyTrend'] {
  const today = parseIsoDate(todayIso);
  const months: MonthlyDataPoint[] = [];

  for (let i = MONTHLY_LOOKBACK_MONTHS - 1; i >= 0; i--) {
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i + 1, 0));
    const monthEntries = entries.filter((e) => {
      const d = parseIsoDate(e.date);
      return d >= monthStart && d <= monthEnd;
    });

    if (monthEntries.length < MONTHLY_MIN_MEASUREMENTS) continue;

    const avg = monthEntries.reduce((s, e) => s + fromKg(toKg(e.value, e.unit), unit), 0) / monthEntries.length;
    const label = monthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    months.push({ label, avgValue: parseFloat(avg.toFixed(1)), unit, measurementCount: monthEntries.length });
  }

  if (months.length < 2) return null;

  // improvementAfterRegression: month N-2 was worse than N-3, current month better than N-2
  const growsOnDecrease = progressGrowsOnDecrease(goal);
  let improvementAfterRegression = false;

  if (months.length >= 3 && growsOnDecrease !== null) {
    const last = months[months.length - 1]!;
    const prev = months[months.length - 2]!;
    const prevPrev = months[months.length - 3]!;

    const isBetterThan = (a: MonthlyDataPoint, b: MonthlyDataPoint) =>
      growsOnDecrease ? a.avgValue < b.avgValue : a.avgValue > b.avgValue;

    improvementAfterRegression = isBetterThan(last, prev) && !isBetterThan(prev, prevPrev);
  }

  return { months, improvementAfterRegression };
}

export function computeDayCompleteness(opts: {
  hasWeightToday: boolean;
  hasMealsToday: boolean;
  isTrainingDay: boolean;
  hasTrainingLogged: boolean;
}): number {
  const { hasWeightToday, hasMealsToday, isTrainingDay, hasTrainingLogged } = opts;
  const parts: number[] = [];
  parts.push(hasWeightToday ? 1 : 0);
  parts.push(hasMealsToday ? 1 : 0);
  if (isTrainingDay) {
    parts.push(hasTrainingLogged ? 1 : 0);
  }
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

export function computeFreshnessScore(
  signalType: PrimarySignalType,
  insightHistory: InsightDocument[],
  todayIso: string,
): number {
  const cutoff = parseIsoDate(todayIso);
  cutoff.setUTCDate(cutoff.getUTCDate() - FRESHNESS_LOOKBACK_DAYS);

  const recentHistory = insightHistory.filter((doc) => parseIsoDate(doc.date) >= cutoff);
  if (recentHistory.length === 0) return 0;

  const matchCount = recentHistory.filter(
    (doc) =>
      doc.progressIntelligence?.primarySignal?.type === signalType,
  ).length;

  return Math.min(1, matchCount / FRESHNESS_LOOKBACK_DAYS);
}

// Signal base priorities (higher = more relevant)
const SIGNAL_PRIORITY: Record<PrimarySignalType, number> = {
  plateau_broken: 10,
  milestone_reached: 9,
  bad_phase_recovered: 8,
  plateau_active: 6,
  phase_context: 4,
  daily_context: 2,
};

function buildSignal(
  type: PrimarySignalType,
  confidence: number,
  insightHistory: InsightDocument[],
  todayIso: string,
): IntelligenceSignal {
  const freshnessScore = computeFreshnessScore(type, insightHistory, todayIso);
  return { type, confidence, freshnessScore };
}

function signalScore(signal: IntelligenceSignal): number {
  return SIGNAL_PRIORITY[signal.type] * signal.confidence * (1 - signal.freshnessScore);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface ComputeProgressIntelligenceInput {
  entries: WeightEntry[];
  targetWeightKg: number | undefined;
  goal: GoalType;
  todayIso: string;
  unit: 'kg' | 'lbs';
  hasWeightToday: boolean;
  hasMealsToday: boolean;
  isTrainingDay: boolean;
  hasTrainingLogged: boolean;
  insightHistory: InsightDocument[];
}

export function computeProgressIntelligence(
  input: ComputeProgressIntelligenceInput,
): ProgressIntelligence {
  const {
    entries, targetWeightKg, goal, todayIso, unit,
    hasWeightToday, hasMealsToday, isTrainingDay, hasTrainingLogged,
    insightHistory,
  } = input;

  const plateau = computePlateauSignal(entries, todayIso);
  const phase = computePhase(entries, todayIso, goal);
  const progress = computeProgress(entries, targetWeightKg, goal, todayIso, unit);
  const milestone = computeMilestone(entries, goal, todayIso, insightHistory, unit);
  const monthlyTrend = computeMonthlyTrend(entries, todayIso, goal, unit);
  const dayCompleteness = computeDayCompleteness({
    hasWeightToday, hasMealsToday, isTrainingDay, hasTrainingLogged,
  });

  // Build candidate signals
  const candidates: IntelligenceSignal[] = [];

  if (plateau?.brokenRecently) {
    candidates.push(buildSignal('plateau_broken', 0.9, insightHistory, todayIso));
  }

  if (milestone) {
    candidates.push(buildSignal('milestone_reached', 0.9, insightHistory, todayIso));
  }

  if (monthlyTrend?.improvementAfterRegression) {
    candidates.push(buildSignal('bad_phase_recovered', 0.75, insightHistory, todayIso));
  }

  if (plateau?.active && !plateau.brokenRecently) {
    candidates.push(buildSignal('plateau_active', 0.7, insightHistory, todayIso));
  }

  if (phase) {
    candidates.push(buildSignal('phase_context', 0.6, insightHistory, todayIso));
  }

  // Always have a fallback
  candidates.push(buildSignal('daily_context', 0.5, insightHistory, todayIso));

  // Sort by effective score
  candidates.sort((a, b) => signalScore(b) - signalScore(a));

  // One Insight Principle: if the top-scoring signal is stale, find the best fresh alternative.
  // This ensures a fresh lower-priority signal beats a stale high-priority one.
  // If ALL candidates are stale, keep the best-scored one rather than forcing daily_context.
  const primarySignal: IntelligenceSignal =
    candidates.find((c) => c.freshnessScore <= FRESHNESS_SUPPRESS_THRESHOLD) ?? candidates[0]!;
  const contextSignals = candidates.filter((c) => c !== primarySignal);

  return {
    version: PROGRESS_INTELLIGENCE_VERSION,
    primarySignal,
    contextSignals,
    progress,
    phase,
    plateau,
    milestone,
    monthlyTrend,
    dayCompleteness,
    goalAtCalculation: goal,
  };
}
