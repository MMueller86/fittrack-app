import { describe, expect, it } from 'vitest';
import type { WeightEntry } from '../types/weights';
import {
  calculateWeightTrendPerWeek,
  classifyWeightTrend,
  getWeightEntriesInLastDays,
} from './weightTrend';

const NOW = new Date('2026-08-21T12:00:00.000Z');

function makeEntry(date: string, value: number, unit: 'kg' | 'lbs' = 'kg'): WeightEntry {
  return { id: date, userId: 'user-1', date, value, unit, createdAt: `${date}T08:00:00.000Z` };
}

describe('weightTrend', () => {
  it('uses the last 30 days and excludes older measurements', () => {
    const entries = [
      makeEntry('2026-07-20', 90),
      makeEntry('2026-07-23', 80),
      makeEntry('2026-08-16', 79),
      makeEntry('2026-08-20', 78),
    ];

    expect(getWeightEntriesInLastDays(entries, 30, NOW).map((entry) => entry.date)).toEqual([
      '2026-07-23',
      '2026-08-16',
      '2026-08-20',
    ]);
  });

  it('matches the chart regression and projects the slope to one week', () => {
    const entries = [
      makeEntry('2026-08-01', 80),
      makeEntry('2026-08-08', 79),
      makeEntry('2026-08-15', 78),
    ];

    expect(calculateWeightTrendPerWeek(entries, 'kg', NOW)).toBeCloseTo(-1, 10);
  });

  it('converts mixed-unit entries before calculating the trend', () => {
    const entries = [
      makeEntry('2026-08-01', 176.370, 'lbs'),
      makeEntry('2026-08-08', 79, 'kg'),
      makeEntry('2026-08-15', 78, 'kg'),
    ];

    expect(calculateWeightTrendPerWeek(entries, 'kg', NOW)).toBeLessThan(0);
  });

  it('classifies the regression using the chart thresholds', () => {
    expect(classifyWeightTrend(null)).toBeNull();
    expect(classifyWeightTrend(-0.0101)).toBe('losing');
    expect(classifyWeightTrend(0.0101)).toBe('gaining');
    expect(classifyWeightTrend(0.01)).toBe('stable');
  });

  it('recognizes a long-term loss despite a short-term increase', () => {
    const entries = [
      makeEntry('2026-07-25', 84),
      makeEntry('2026-08-01', 83.5),
      makeEntry('2026-08-08', 83),
      makeEntry('2026-08-12', 81.5),
      makeEntry('2026-08-14', 82.1),
      makeEntry('2026-08-17', 83.45),
      makeEntry('2026-08-18', 83.05),
      makeEntry('2026-08-19', 82.6),
      makeEntry('2026-08-20', 82.7),
    ];

    expect(classifyWeightTrend(calculateWeightTrendPerWeek(entries, 'kg', NOW))).toBe('losing');
  });
});
