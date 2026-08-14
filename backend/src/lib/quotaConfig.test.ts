import { describe, it, expect } from 'vitest';
import { getLimit, getCurrentPeriod, getPeriodResetDate } from './quotaConfig';

describe('quotaConfig', () => {
  describe('getLimit', () => {
    it('returns 50 meal-parser calls for free tier', () => {
      expect(getLimit('free', 'meal-parser')).toBe(50);
    });

    it('returns 30 food-estimate calls for free tier', () => {
      expect(getLimit('free', 'food-estimate')).toBe(30);
    });

    it('returns 500 meal-parser calls for premium tier', () => {
      expect(getLimit('premium', 'meal-parser')).toBe(500);
    });

    it('returns 30 recipe-scale calls for free and premium tiers', () => {
      expect(getLimit('free', 'recipe-scale')).toBe(30);
      expect(getLimit('premium', 'recipe-scale')).toBe(30);
    });

    it('returns Infinity for internal tier', () => {
      expect(getLimit('internal', 'meal-parser')).toBe(Infinity);
      expect(getLimit('internal', 'food-estimate')).toBe(Infinity);
      expect(getLimit('internal', 'recipe-scale')).toBe(Infinity);
    });
  });

  describe('getCurrentPeriod', () => {
    it('returns YYYY-MM format', () => {
      const period = getCurrentPeriod();
      expect(period).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('getPeriodResetDate', () => {
    it('returns first day of next month for 2026-05', () => {
      expect(getPeriodResetDate('2026-05')).toBe('2026-06-01T00:00:00.000Z');
    });

    it('handles December → January rollover', () => {
      expect(getPeriodResetDate('2026-12')).toBe('2027-01-01T00:00:00.000Z');
    });

    it('handles January', () => {
      expect(getPeriodResetDate('2026-01')).toBe('2026-02-01T00:00:00.000Z');
    });
  });
});
