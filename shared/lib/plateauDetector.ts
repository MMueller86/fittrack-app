// Plateau Detector — Single Source of Truth for plateau detection logic.
//
// Algorithm: Standard deviation of weight values over a 28-day window.
// A plateau = weights are too consistent to signal meaningful change.
// Std-dev < 0.4 kg means the body is not moving enough to indicate a real trend.
//
// Consumed by:
//   - backend/src/lib/progressIntelligence.ts (AI insight engine)
//   - Future: mobile screens that want plateau-aware indicators
//
// NOT a replacement for mobile's slope-based trend indicator (computeWeightTrend).
// That function answers "which direction is the user moving?" — a different question.
// This module answers "has the user stopped moving at all, and for how long?"

import type { WeightEntry } from '../types/weights';
import type { PlateauIntelligence } from '../types/insight';

// ---------------------------------------------------------------------------
// Configurable thresholds — exported so callers can reference them in tests
// ---------------------------------------------------------------------------

/** Maximum std dev (kg) for a set of measurements to be considered a plateau. */
export const PLATEAU_STD_DEV_THRESHOLD_KG = 0.4;

/** Minimum number of measurements required in the window to detect a plateau. */
export const PLATEAU_MIN_MEASUREMENTS = 6;

/** Number of days to look back for the plateau analysis window. */
export const PLATEAU_WINDOW_DAYS = 28;

/** Minimum kg of movement in the recent window to consider a plateau broken. */
export const PLATEAU_BROKEN_MOVEMENT_KG = 0.5;

/** Number of recent days to classify as "after the break". */
export const PLATEAU_BROKEN_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Internal helpers — not exported, not shared further
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

/** Population standard deviation. Returns 0 for arrays with fewer than 2 items. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Returns all entries within the last N days of referenceIso, newest first.
 * Entries on the reference date itself are included.
 */
function entriesInWindow(
  entries: WeightEntry[],
  referenceIso: string,
  days: number,
): WeightEntry[] {
  const cutoff = parseIsoDate(referenceIso);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return entries
    .filter((e) => parseIsoDate(e.date) >= cutoff)
    .sort((a, b) => parseIsoDate(b.date).getTime() - parseIsoDate(a.date).getTime());
}

/**
 * Extends a confirmed plateau core backwards through older entries as long as
 * adding each older entry keeps std dev below the threshold.
 *
 * This gives the REAL plateau duration instead of just the analysis window size.
 *
 * @param allEntries   All weight entries for the user (any order).
 * @param coreEntries  Entries already confirmed to be in the plateau (newest-first).
 * @param referenceIso The plateau end date (todayIso for active, break-start for brokenRecently).
 * @returns Duration in whole weeks (minimum 1).
 */
function computePlateauExtent(
  allEntries: WeightEntry[],
  coreEntries: WeightEntry[],
  referenceIso: string,
): number {
  if (coreEntries.length === 0) return 1;

  // Oldest confirmed plateau entry
  const oldestCore = coreEntries.reduce(
    (oldest, e) => (parseIsoDate(e.date) < parseIsoDate(oldest.date) ? e : oldest),
  );

  // Entries older than the core, sorted oldest-first for backwards scan
  const olderEntries = [...allEntries]
    .filter((e) => parseIsoDate(e.date) < parseIsoDate(oldestCore.date))
    .sort((a, b) => parseIsoDate(a.date).getTime() - parseIsoDate(b.date).getTime());

  const kgValues = coreEntries.map((e) => toKg(e.value, e.unit));
  let plateauStart = parseIsoDate(oldestCore.date);

  // Scan backwards: accept each older entry as long as std dev stays below threshold
  for (let i = olderEntries.length - 1; i >= 0; i--) {
    const entry = olderEntries[i]!;
    const candidate = [...kgValues, toKg(entry.value, entry.unit)];
    if (stdDev(candidate) < PLATEAU_STD_DEV_THRESHOLD_KG) {
      kgValues.push(toKg(entry.value, entry.unit));
      plateauStart = parseIsoDate(entry.date);
    } else {
      break; // Once std dev exceeds threshold, the plateau didn't extend further back
    }
  }

  const days = daysBetween(plateauStart, parseIsoDate(referenceIso));
  return Math.max(1, Math.floor(days / 7));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the plateau signal for a user's weight history.
 *
 * Returns `null` when there are fewer than `PLATEAU_MIN_MEASUREMENTS` entries
 * in the `PLATEAU_WINDOW_DAYS`-day window — not enough data to make a call.
 *
 * Returns a `PlateauIntelligence` object with:
 * - `active`: whether a plateau is currently in effect
 * - `brokenRecently`: whether a plateau was broken in the last 7 days
 * - `durationWeeks`: real plateau duration based on historical data (not window size)
 */
export function computePlateauSignal(
  entries: WeightEntry[],
  todayIso: string,
): PlateauIntelligence | null {
  const window = entriesInWindow(entries, todayIso, PLATEAU_WINDOW_DAYS);
  if (window.length < PLATEAU_MIN_MEASUREMENTS) return null;

  const kgValues = window.map((e) => toKg(e.value, e.unit));
  const sd = stdDev(kgValues);
  const active = sd < PLATEAU_STD_DEV_THRESHOLD_KG;

  const recentWindow = entriesInWindow(entries, todayIso, PLATEAU_BROKEN_WINDOW_DAYS);
  let brokenRecently = false;
  let durationWeeks = 1;

  if (active) {
    durationWeeks = computePlateauExtent(entries, window, todayIso);
  } else {
    // Not currently plateauing — check if a plateau was recently broken
    const olderWindow = window.slice(recentWindow.length);
    if (olderWindow.length >= 3) {
      const olderSd = stdDev(olderWindow.map((e) => toKg(e.value, e.unit)));
      const recentKg = recentWindow.map((e) => toKg(e.value, e.unit));
      const recentMovement =
        recentKg.length >= 2
          ? Math.abs(recentKg[0]! - recentKg[recentKg.length - 1]!)
          : 0;
      brokenRecently =
        olderSd < PLATEAU_STD_DEV_THRESHOLD_KG &&
        recentMovement >= PLATEAU_BROKEN_MOVEMENT_KG;

      if (brokenRecently) {
        // Duration = how long the plateau lasted before it was broken
        const plateauEndIso = recentWindow[recentWindow.length - 1]!.date;
        durationWeeks = computePlateauExtent(entries, olderWindow, plateauEndIso);
      }
    }
  }

  return { active, brokenRecently, durationWeeks };
}
