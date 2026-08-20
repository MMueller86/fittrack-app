import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalIsoDate, getLocalTimezoneOffsetMinutes, isValidDateOnly } from './localDate';

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