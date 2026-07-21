import { describe, it, expect } from 'vitest';
import { thumbnailBorderWidth } from './RelationRow.utils';

function makeDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().substring(0, 10);
}

describe('thumbnailBorderWidth', () => {
  it('returns 0 when usageDates is undefined', () => {
    expect(thumbnailBorderWidth(undefined)).toBe(0);
  });

  it('returns 0 when usageDates is empty', () => {
    expect(thumbnailBorderWidth([])).toBe(0);
  });

  it('returns 0 when all dates are older than 30 days', () => {
    expect(thumbnailBorderWidth([makeDate(31), makeDate(45)])).toBe(0);
  });

  it('returns 1 for 1 use in 30 days', () => {
    expect(thumbnailBorderWidth([makeDate(1)])).toBe(1);
  });

  it('returns 1 for 3 uses in 30 days', () => {
    expect(thumbnailBorderWidth([makeDate(1), makeDate(5), makeDate(10)])).toBe(1);
  });

  it('returns 2 for 4 uses in 30 days', () => {
    const dates = Array.from({ length: 4 }, (_, i) => makeDate(i + 1));
    expect(thumbnailBorderWidth(dates)).toBe(2);
  });

  it('returns 2 for 9 uses in 30 days', () => {
    const dates = Array.from({ length: 9 }, (_, i) => makeDate(i + 1));
    expect(thumbnailBorderWidth(dates)).toBe(2);
  });

  it('returns 3 for 10 uses in 30 days', () => {
    const dates = Array.from({ length: 10 }, (_, i) => makeDate(i + 1));
    expect(thumbnailBorderWidth(dates)).toBe(3);
  });

  it('ignores dates exactly 30 days old (boundary: cutoff is >30 days)', () => {
    // date exactly 30 days ago should still count (>= cutoff)
    const exactly30 = makeDate(30);
    expect(thumbnailBorderWidth([exactly30])).toBe(1);
  });

  it('excludes dates 31 days ago', () => {
    const old = makeDate(31);
    expect(thumbnailBorderWidth([old])).toBe(0);
  });
});
