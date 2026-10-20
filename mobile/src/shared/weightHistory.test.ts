import { describe, expect, it } from 'vitest';
import type { WeightEntry } from '@fittrack/shared';
import { buildCompletedWeekGroups, buildLast7DaysItems, getWeightWeekComparison } from './weightHistory';

function entry(date: string, value: number): WeightEntry {
  return { id: `${date}-${value}`, userId: 'user', date, value, unit: 'kg', createdAt: `${date}T12:00:00Z` };
}

describe('rolling seven-day average versus last completed week', () => {
  it('uses the same rolling window and most recent completed week as history', () => {
    const entries = [entry('2026-10-16', 78), entry('2026-10-11', 80), entry('2026-10-10', 82), entry('2026-10-05', 84), entry('2026-10-04', 100), entry('2026-10-17', 200)];
    const groups = buildCompletedWeekGroups(entries.map((weight) => ({ entry: weight })), '2026-10-16');
    const rolling = buildLast7DaysItems(entries.map((weight) => ({ entry: weight })), '2026-10-16');
    const comparison = getWeightWeekComparison(entries, '2026-10-16');

    expect(rolling.map((item) => item.entry.value)).toEqual([78, 80, 82]);
    expect(comparison.recent).toEqual({ label: '10.10. – 16.10.', average: 80, count: 3 });
    expect(comparison.previous).toEqual({ label: groups[0]!.label, average: groups[0]!.avgValue, count: 3 });
    expect(comparison.previous.label).toBe('05.10. – 11.10.');
    expect(comparison.delta).toBe(-2);
  });

  it('does not skip a missing week to compare against an older one', () => {
    const comparison = getWeightWeekComparison([entry('2026-10-16', 80), entry('2026-09-22', 90)], '2026-10-16');
    expect(comparison.recent.average).toBe(80);
    expect(comparison.previous.average).toBeNull();
    expect(comparison.delta).toBeNull();
  });

  it('accepts a single measurement per week and preserves equal averages', () => {
    const comparison = getWeightWeekComparison([entry('2026-10-16', 80), entry('2026-10-08', 80)], '2026-10-16');
    expect(comparison.delta).toBe(0);
  });

  it('only closes Sunday after the local calendar date has advanced to Monday', () => {
    const entries = [entry('2026-10-11', 80), entry('2026-10-04', 82)];
    expect(getWeightWeekComparison(entries, '2026-10-11').previous.average).toBe(82);
    expect(getWeightWeekComparison(entries, '2026-10-12').previous.average).toBe(80);
  });

  it('handles absent weeks and ranges crossing the year boundary', () => {
    const comparison = getWeightWeekComparison([], '2027-01-04');
    expect(comparison.recent.label).toBe('29.12. – 04.01.');
    expect(comparison.previous.label).toBe('28.12. – 03.01.');
    expect(comparison.recent.average).toBeNull();
    expect(comparison.previous.average).toBeNull();
    expect(comparison.delta).toBeNull();
  });

  it('cannot compare when only the completed week has measurements', () => {
    const comparison = getWeightWeekComparison([entry('2026-10-05', 82)], '2026-10-16');
    expect(comparison.recent.average).toBeNull();
    expect(comparison.previous.average).toBe(82);
    expect(comparison.delta).toBeNull();
  });
});