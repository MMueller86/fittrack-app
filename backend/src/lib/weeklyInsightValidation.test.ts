import { describe, expect, it } from 'vitest';

import { validateWeeklyInsightExceedanceClaims } from './weeklyInsightValidation';

describe('validateWeeklyInsightExceedanceClaims', () => {
  it('accepts neutral language when no day exceeded the effective target', () => {
    expect(validateWeeklyInsightExceedanceClaims(
      'Die Woche lag insgesamt nah an deinen effektiven Tageszielen.',
      [{ targetPercent: 99 }, { targetPercent: 90 }, { targetPercent: 81 }],
    )).toEqual({ valid: true });
  });

  it('rejects exceedance language when no day exceeded the effective target', () => {
    expect(validateWeeklyInsightExceedanceClaims(
      'An drei Tagen hast du dein Ziel überschritten.',
      [{ targetPercent: 99 }, { targetPercent: 90 }, { targetPercent: 81 }],
    )).toEqual({
      valid: false,
      reason: 'Exceedance language detected but no day exceeded effective target',
    });
  });

  it('accepts exceedance language when at least one day exceeded the effective target', () => {
    expect(validateWeeklyInsightExceedanceClaims(
      'An einem Tag hast du dein Ziel überschritten.',
      [{ targetPercent: 99 }, { targetPercent: 101 }, { targetPercent: 81 }],
    )).toEqual({ valid: true });
  });

  it('accepts neutral language when all target percentages are null', () => {
    expect(validateWeeklyInsightExceedanceClaims(
      'Für diese Woche liegen keine ausreichenden Zieldaten vor.',
      [{ targetPercent: null }, { targetPercent: null }],
    )).toEqual({ valid: true });
  });
});