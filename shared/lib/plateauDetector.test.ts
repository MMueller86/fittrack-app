// Unit tests for shared/lib/plateauDetector.ts
//
// These tests are the canonical test suite for plateau detection logic.
// Backend-specific integration tests live in progressIntelligence.test.ts.

import { describe, it, expect } from 'vitest';
import type { WeightEntry } from '../types/weights';
import {
  computePlateauSignal,
  PLATEAU_STD_DEV_THRESHOLD_KG,
  PLATEAU_MIN_MEASUREMENTS,
  PLATEAU_WINDOW_DAYS,
  PLATEAU_BROKEN_MOVEMENT_KG,
} from './plateauDetector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(date: string, value: number, unit: 'kg' | 'lbs' = 'kg'): WeightEntry {
  return { id: date, userId: 'u1', date, value, unit, createdAt: date + 'T00:00:00Z' };
}

/** Build N entries ending at todayIso, spaced 1 day apart, all at the same value. */
function flatEntries(todayIso: string, count: number, value = 80.0): WeightEntry[] {
  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number];
  const base = new Date(Date.UTC(y, m - 1, d));
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() - (count - 1 - i));
    return makeEntry(date.toISOString().split('T')[0]!, value);
  });
}

const TODAY = '2026-06-15';

// ---------------------------------------------------------------------------
// Null conditions (insufficient data)
// ---------------------------------------------------------------------------

describe('computePlateauSignal — null conditions', () => {
  it('returns null for empty entries', () => {
    expect(computePlateauSignal([], TODAY)).toBeNull();
  });

  it('returns null when fewer than PLATEAU_MIN_MEASUREMENTS entries', () => {
    const entries = flatEntries(TODAY, PLATEAU_MIN_MEASUREMENTS - 1);
    expect(computePlateauSignal(entries, TODAY)).toBeNull();
  });

  it('returns null when entries exist but none within 28-day window', () => {
    // All entries are 60 days ago — outside the window
    const old = Array.from({ length: 8 }, (_, i) =>
      makeEntry(`2026-03-${String(i + 1).padStart(2, '0')}`, 80),
    );
    expect(computePlateauSignal(old, TODAY)).toBeNull();
  });

  it('does NOT return null when exactly PLATEAU_MIN_MEASUREMENTS entries in window', () => {
    const entries = flatEntries(TODAY, PLATEAU_MIN_MEASUREMENTS);
    expect(computePlateauSignal(entries, TODAY)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Active plateau detection
// ---------------------------------------------------------------------------

describe('computePlateauSignal — active plateau', () => {
  it('detects active plateau when all values identical (std dev = 0)', () => {
    const entries = flatEntries(TODAY, 8, 80.0);
    const result = computePlateauSignal(entries, TODAY);
    expect(result!.active).toBe(true);
  });

  it('detects active plateau when std dev is well below threshold', () => {
    // Small fluctuations: std dev ≈ 0.05 kg
    const vals = [80.0, 80.1, 80.0, 79.9, 80.1, 80.0, 80.0, 80.1];
    const entries = vals.map((v, i) =>
      makeEntry(`2026-05-${String(i + 18).padStart(2, '0')}`, v),
    );
    const result = computePlateauSignal(entries, TODAY);
    expect(result!.active).toBe(true);
  });

  it('detects active plateau for std dev just below PLATEAU_STD_DEV_THRESHOLD_KG', () => {
    // Craft values with std dev ≈ 0.35 kg (below 0.4 threshold)
    const vals = [80.0, 80.3, 79.7, 80.2, 79.8, 80.3, 79.7, 80.0];
    const entries = vals.map((v, i) =>
      makeEntry(`2026-05-${String(i + 18).padStart(2, '0')}`, v),
    );
    const result = computePlateauSignal(entries, TODAY);
    expect(result!.active).toBe(true);
  });

  it('does NOT detect active plateau when values are spread (high std dev)', () => {
    const vals = [80, 78, 82, 79, 83, 77, 81, 76];
    const entries = vals.map((v, i) =>
      makeEntry(`2026-05-${String(i + 18).padStart(2, '0')}`, v),
    );
    const result = computePlateauSignal(entries, TODAY);
    expect(result!.active).toBe(false);
  });

  it('active plateau has brokenRecently = false', () => {
    const entries = flatEntries(TODAY, 8, 80.0);
    const result = computePlateauSignal(entries, TODAY);
    expect(result!.brokenRecently).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Real durationWeeks (not just window size)
// ---------------------------------------------------------------------------

describe('computePlateauSignal — durationWeeks', () => {
  it('durationWeeks is at least 1', () => {
    const entries = flatEntries(TODAY, PLATEAU_MIN_MEASUREMENTS, 80.0);
    const result = computePlateauSignal(entries, TODAY);
    expect(result!.durationWeeks).toBeGreaterThanOrEqual(1);
  });

  it('durationWeeks reflects real duration beyond PLATEAU_WINDOW_DAYS', () => {
    // 6 weeks of flat entries ending at TODAY → durationWeeks should be ~6, not 4
    const entries = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 5, 15)); // TODAY
      d.setUTCDate(d.getUTCDate() - (41 - i));
      return makeEntry(d.toISOString().split('T')[0]!, 80.0);
    });
    const result = computePlateauSignal(entries, TODAY);
    expect(result).not.toBeNull();
    expect(result!.active).toBe(true);
    expect(result!.durationWeeks).toBeGreaterThan(PLATEAU_WINDOW_DAYS / 7); // > 4
  });

  it('stops extending when old entry breaks the std dev threshold', () => {
    // 4 weeks flat at 80, then 1 very old outlier at 85 — should not extend past the outlier
    const flat = Array.from({ length: 28 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 5, 15));
      d.setUTCDate(d.getUTCDate() - (27 - i));
      return makeEntry(d.toISOString().split('T')[0]!, 80.0);
    });
    const outlier = makeEntry('2026-04-01', 85.0); // 75 days ago — would break std dev
    const result = computePlateauSignal([...flat, outlier], TODAY);
    expect(result!.active).toBe(true);
    // Duration should NOT reach back to April (10+ weeks) — stops before the outlier
    expect(result!.durationWeeks).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// Broken plateau (brokenRecently)
// ---------------------------------------------------------------------------

describe('computePlateauSignal — brokenRecently', () => {
  it('detects brokenRecently when older entries are flat and recent entries show large movement', () => {
    // Flat entries May 1 - June 3 (34 entries all at 80.0 kg).
    // Entries within the 28-day window (May 18 - June 3) form the "older plateau" portion.
    // Entries before May 18 allow computePlateauExtent to extend duration further back.
    const oldFlat = Array.from({ length: 34 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 4, 1)); // May 1
      d.setUTCDate(d.getUTCDate() + i);
      return makeEntry(d.toISOString().split('T')[0]!, 80.0);
    });
    const recentDrop = [
      makeEntry('2026-06-09', 80.0), makeEntry('2026-06-10', 79.5),
      makeEntry('2026-06-11', 79.0), makeEntry('2026-06-12', 78.5),
      makeEntry('2026-06-13', 78.0), makeEntry('2026-06-14', 77.5),
      makeEntry(TODAY, 77.0),
    ];
    const result = computePlateauSignal([...oldFlat, ...recentDrop], TODAY);
    expect(result).not.toBeNull();
    expect(result!.brokenRecently).toBe(true);
  });

  it('does NOT detect brokenRecently when recent movement is too small', () => {
    // Old flat entries within the 28-day window (May 19 - June 3) + tiny fluctuations recently.
    // Overall window std dev stays low → active plateau, not broken.
    const oldFlat = Array.from({ length: 16 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 4, 19)); // May 19
      d.setUTCDate(d.getUTCDate() + i);
      return makeEntry(d.toISOString().split('T')[0]!, 80.0);
    });
    const tinyMove = [
      makeEntry('2026-06-09', 80.0), makeEntry('2026-06-10', 80.1),
      makeEntry('2026-06-11', 80.0), makeEntry('2026-06-12', 80.2),
      makeEntry('2026-06-13', 80.1), makeEntry('2026-06-14', 80.3),
      makeEntry(TODAY, 80.3),
    ];
    const result = computePlateauSignal([...oldFlat, ...tinyMove], TODAY);
    // The overall std dev is low → still an active plateau, not broken
    expect(result!.brokenRecently).toBe(false);
  });

  it('does NOT detect brokenRecently when older entries were already spread (no plateau before)', () => {
    // Old entries with high variance within the 28-day window — there was no plateau to break
    const oldSpread = [80, 76, 84, 78, 82, 75, 83, 79].map((v, i) => {
      const d = new Date(Date.UTC(2026, 4, 19)); // May 19
      d.setUTCDate(d.getUTCDate() + i);
      return makeEntry(d.toISOString().split('T')[0]!, v);
    });
    const recentDrop = [
      makeEntry('2026-06-09', 80.0), makeEntry('2026-06-10', 79.0),
      makeEntry('2026-06-11', 78.0), makeEntry('2026-06-12', 77.0),
      makeEntry('2026-06-13', 76.0), makeEntry('2026-06-14', 75.5),
      makeEntry(TODAY, 75.0),
    ];
    const result = computePlateauSignal([...oldSpread, ...recentDrop], TODAY);
    if (result) {
      expect(result.brokenRecently).toBe(false);
    }
  });

  it('brokenRecently plateau durationWeeks reflects the pre-break duration', () => {
    // Flat entries May 1 - June 3 (34 entries all at 80.0 kg).
    // Entries within window form olderWindow; entries before May 18 extend durationWeeks backwards.
    const oldFlat = Array.from({ length: 34 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 4, 1)); // May 1
      d.setUTCDate(d.getUTCDate() + i);
      return makeEntry(d.toISOString().split('T')[0]!, 80.0);
    });
    const recentDrop = [
      makeEntry('2026-06-09', 80.0), makeEntry('2026-06-10', 79.5),
      makeEntry('2026-06-11', 79.0), makeEntry('2026-06-12', 78.5),
      makeEntry('2026-06-13', 78.0), makeEntry('2026-06-14', 77.5),
      makeEntry(TODAY, 77.0),
    ];
    const result = computePlateauSignal([...oldFlat, ...recentDrop], TODAY);
    expect(result!.brokenRecently).toBe(true);
    // Duration should reflect the weeks of plateau before the break, not the post-break period
    expect(result!.durationWeeks).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Mixed units
// ---------------------------------------------------------------------------

describe('computePlateauSignal — unit handling', () => {
  it('handles kg entries correctly (baseline)', () => {
    const entries = flatEntries(TODAY, 8, 80.0);
    expect(computePlateauSignal(entries, TODAY)!.active).toBe(true);
  });

  it('handles lbs entries — converts to kg for std dev calculation', () => {
    // 176.4 lbs ≈ 80 kg — all the same → std dev = 0 → plateau
    const entries = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 5, 15));
      d.setUTCDate(d.getUTCDate() - (7 - i));
      return makeEntry(d.toISOString().split('T')[0]!, 176.4, 'lbs');
    });
    expect(computePlateauSignal(entries, TODAY)!.active).toBe(true);
  });

  it('mixed kg and lbs entries — all converted to kg for comparison', () => {
    // Some entries in kg (~80), some in lbs (~176.4) — both represent same weight
    // std dev should be near 0 → active plateau
    const entries = [
      makeEntry('2026-05-18', 80.0, 'kg'),
      makeEntry('2026-05-20', 176.4, 'lbs'),  // ≈ 80.0 kg
      makeEntry('2026-05-22', 79.9, 'kg'),
      makeEntry('2026-05-24', 176.3, 'lbs'),  // ≈ 79.95 kg
      makeEntry('2026-05-26', 80.1, 'kg'),
      makeEntry('2026-05-28', 176.5, 'lbs'),  // ≈ 80.04 kg
      makeEntry('2026-05-30', 80.0, 'kg'),
      makeEntry('2026-06-01', 80.0, 'kg'),
    ];
    const result = computePlateauSignal(entries, TODAY);
    expect(result).not.toBeNull();
    expect(result!.active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Entry ordering and window boundary
// ---------------------------------------------------------------------------

describe('computePlateauSignal — ordering and boundaries', () => {
  it('result is the same regardless of input order', () => {
    const entries = flatEntries(TODAY, 8, 80.0);
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const r1 = computePlateauSignal(entries, TODAY);
    const r2 = computePlateauSignal(shuffled, TODAY);
    expect(r1!.active).toBe(r2!.active);
    expect(r1!.durationWeeks).toBe(r2!.durationWeeks);
    expect(r1!.brokenRecently).toBe(r2!.brokenRecently);
  });

  it('excludes entries outside the 28-day window from plateau decision', () => {
    // 6 entries within window all flat at 80
    const inWindow = flatEntries(TODAY, 6, 80.0);
    // 4 old outlier entries 60 days ago at very different values — must be excluded
    const outliers = Array.from({ length: 4 }, (_, i) =>
      makeEntry(`2026-04-${String(i + 1).padStart(2, '0')}`, 95.0),
    );
    const result = computePlateauSignal([...inWindow, ...outliers], TODAY);
    expect(result).not.toBeNull();
    // Outliers are outside window — plateau is still detected from the 6 in-window entries
    expect(result!.active).toBe(true);
  });

  it('entry on exactly the boundary date (todayIso) is included', () => {
    const entries = [...flatEntries('2026-06-14', 5, 80.0), makeEntry(TODAY, 80.0)];
    const result = computePlateauSignal(entries, TODAY);
    expect(result).not.toBeNull();
    expect(result!.active).toBe(true);
  });

  it('entry exactly PLATEAU_WINDOW_DAYS days ago is included in window', () => {
    // Entry on the cutoff boundary: 28 days before TODAY = 2026-05-18
    const entries = [...flatEntries(TODAY, PLATEAU_MIN_MEASUREMENTS - 1, 80.0)];
    entries.push(makeEntry('2026-05-18', 80.0)); // exactly 28 days ago
    const result = computePlateauSignal(entries, TODAY);
    // Should have enough entries now
    expect(result).not.toBeNull();
  });
});
