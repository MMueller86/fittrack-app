// Tier-based quota limits for AI features.
//
// These are placeholder values for MVP. Adjust based on observed Azure OpenAI
// cost patterns. The `internal` tier is unlimited (for dev/test accounts).

import type { AiFeature, UserTier } from '@fittrack/shared';

export interface TierLimits {
  'meal-parser': number;
  'food-estimate': number;
}

const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    'meal-parser': 50,
    'food-estimate': 30,
  },
  premium: {
    'meal-parser': 500,
    'food-estimate': 300,
  },
  internal: {
    'meal-parser': Infinity,
    'food-estimate': Infinity,
  },
};

/**
 * Get the monthly limit for a given tier and feature.
 */
export function getLimit(tier: UserTier, feature: AiFeature): number {
  return TIER_LIMITS[tier][feature];
}

/**
 * Get the current period string (YYYY-MM) for quota tracking.
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Get the ISO timestamp when the given period resets (first day of next month, 00:00 UTC).
 */
export function getPeriodResetDate(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`;
}
