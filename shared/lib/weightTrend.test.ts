import { describe, expect, it } from 'vitest';
import type { WeightEntry } from '../types/weights';
import {
    calculateWeightTrendRegressionSeries,
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

  it('keeps the 30-day boundary calendar-based across the DST fall-back', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      const entries = [makeEntry('2026-10-31', 80)];
      const now = new Date('2026-11-30T04:30:00.000Z');

      expect(getWeightEntriesInLastDays(entries, 30, now)).toHaveLength(1);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it('matches the chart regression and projects the slope to one week', () => {
    const entries = [
      makeEntry('2026-08-01', 80),
      makeEntry('2026-08-08', 79),
      makeEntry('2026-08-15', 78),
    ];

    expect(calculateWeightTrendPerWeek(entries, 'kg', NOW)).toBeCloseTo(-1, 10);
  });

  it('uses equal calendar-day spacing across the DST spring-forward', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      const entries = [
        makeEntry('2026-03-07', 80),
        makeEntry('2026-03-14', 79),
        makeEntry('2026-03-21', 78),
      ];

      expect(calculateWeightTrendPerWeek(entries, 'kg', new Date('2026-03-22T16:00:00.000Z')))
        .toBeCloseTo(-1, 10);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
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
  it('includes exactly the requested calendar dates and excludes future measurements', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'UTC';

    try {
      const result = calculateWeightTrendRegressionSeries(
        [
          makeEntry('2026-08-22', 77),
          makeEntry('2026-08-07', 76),
          makeEntry('2026-08-21', 80),
          makeEntry('2026-08-08', 79),
        ],
        14,
        NOW,
      );

      expect(result.measurements.map((entry) => entry.date)).toEqual([
        '2026-08-08',
        '2026-08-21',
      ]);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it('returns kg measurements, a raw kg-per-week slope, and fitted regression endpoints', () => {
    const result = calculateWeightTrendRegressionSeries(
      [
        makeEntry('2026-08-15', 78),
        makeEntry('2026-08-01', 80 * 2.20462, 'lbs'),
        makeEntry('2026-08-08', 82),
      ],
      30,
      NOW,
    );

    expect(result.measurements[0]?.weightKg).toBeCloseTo(80, 10);
    expect(result.slopeKgPerWeek).toBeCloseTo(-1, 10);
    expect(result.regressionLine?.start.date).toBe('2026-08-01');
    expect(result.regressionLine?.start.weightKg).toBeCloseTo(81, 10);
    expect(result.regressionLine?.end.date).toBe('2026-08-15');
    expect(result.regressionLine?.end.weightKg).toBeCloseTo(79, 10);
  });

  it('calculates a raw regression from two dates without applying a display threshold', () => {
    const result = calculateWeightTrendRegressionSeries(
      [makeEntry('2026-08-01', 80), makeEntry('2026-08-08', 79)],
      30,
      NOW,
    );

    expect(result.slopeKgPerWeek).toBeCloseTo(-1, 10);
  });

  it('returns measurements but no regression when there are not two distinct dates', () => {
    const result = calculateWeightTrendRegressionSeries(
      [makeEntry('2026-08-20', 80), makeEntry('2026-08-20', 79)],
      14,
      NOW,
    );

    expect(result.measurements).toHaveLength(2);
    expect(result.slopeKgPerWeek).toBeNull();
    expect(result.regressionLine).toBeNull();
  });

  it('uses calendar-day regression spacing across the DST spring-forward', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      const result = calculateWeightTrendRegressionSeries(
        [
          makeEntry('2026-03-07', 80),
          makeEntry('2026-03-14', 79),
          makeEntry('2026-03-21', 78),
        ],
        16,
        new Date('2026-03-22T16:00:00.000Z'),
      );

      expect(result.slopeKgPerWeek).toBeCloseTo(-1, 10);
      expect(result.regressionLine?.start.date).toBe('2026-03-07');
      expect(result.regressionLine?.end.date).toBe('2026-03-21');
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});
