import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addLocalDays,
  differenceInLocalDays,
  getLocalDateContext,
  getLocalHour,
  getLocalIsoDate,
  getLocalTimezoneOffsetMinutes,
  isValidDateOnly,
} from './localDate';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getLocalIsoDate', () => {
  it('uses the local calendar date without a UTC conversion', () => {
    const date = new Date(2026, 7, 14, 0, 30, 0);

    expect(getLocalIsoDate(date)).toBe('2026-08-14');
  });

  it('pads single-digit month and day values', () => {
    const date = new Date(2026, 0, 2, 12, 0, 0);

    expect(getLocalIsoDate(date)).toBe('2026-01-02');
  });
});

describe('isValidDateOnly', () => {
  it('accepts real calendar dates and leap days', () => {
    expect(isValidDateOnly('2026-08-14')).toBe(true);
    expect(isValidDateOnly('2024-02-29')).toBe(true);
  });

  it('rejects malformed and non-calendar route values', () => {
    expect(isValidDateOnly('2026-8-14')).toBe(false);
    expect(isValidDateOnly('2026-02-30')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly(undefined)).toBe(false);
  });
});

describe('getLocalTimezoneOffsetMinutes', () => {
  it('normalizes the native offset to local-minus-UTC minutes', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(120);

    expect(getLocalTimezoneOffsetMinutes(new Date())).toBe(-120);
  });

  it('rejects offsets outside the supported timezone range', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(900);

    expect(getLocalTimezoneOffsetMinutes(new Date())).toBeNull();
  });
});

describe('getLocalDateContext', () => {
  it('keeps the local calendar date and local hour together', () => {
    const date = new Date(2026, 7, 14, 23, 30, 0);

    expect(getLocalDateContext(date)).toEqual({
      currentLocalDate: '2026-08-14',
      currentHour: 23,
    });
  });

  it('uses null for an invalid local hour', () => {
    const date = new Date('invalid');

    expect(getLocalHour(date)).toBeNull();
  });
});

describe('addLocalDays', () => {
  it('crosses month and year boundaries using calendar days', () => {
    expect(addLocalDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addLocalDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addLocalDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('keeps date-only arithmetic independent of a DST transition', () => {
    expect(addLocalDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addLocalDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('rejects invalid dates and fractional offsets', () => {
    expect(() => addLocalDays('2026-02-30', 1)).toThrow(RangeError);
    expect(() => addLocalDays('2026-02-28', 1.5)).toThrow(RangeError);
  });
});

describe('differenceInLocalDays', () => {
  it('uses calendar days across DST transitions', () => {
    expect(differenceInLocalDays('2026-03-09', '2026-03-08')).toBe(1);
    expect(differenceInLocalDays('2026-11-02', '2026-11-01')).toBe(1);
  });

  it('rejects invalid date-only values', () => {
    expect(() => differenceInLocalDays('2026-02-30', '2026-02-28')).toThrow(RangeError);
  });
});