// Insight service — wraps GET /api/ai/daily-insight.
// Non-blocking by design: callers should NOT await this in a Promise.all
// that blocks the HomeScreen render.

import { aiApi, type DailyInsightResponse } from '../shared/api/aiApi';

export type { DailyInsightResponse } from '../shared/api/aiApi';

export function hasCompactInsight(insight: DailyInsightResponse | null): insight is DailyInsightResponse & {
  greeting: string;
  shortInsight: string;
} {
  return insight !== null
    && (insight.status === 'fresh' || insight.status === 'cached')
    && typeof insight.greeting === 'string'
    && insight.greeting.trim().length > 0
    && insight.greeting.length <= 120
    && typeof insight.shortInsight === 'string'
    && insight.shortInsight.trim().length > 0
    && insight.shortInsight.length <= 240;
}

/**
 * Fetch or generate the daily AI insight for the given date.
 * Returns the InsightResponse (may be fresh, cached, quota_exceeded, or unavailable).
 * Never throws — returns null on unexpected network errors.
 */
export async function getInsight(date?: string): Promise<DailyInsightResponse | null> {
  try {
    return await aiApi.getDailyInsight(date);
  } catch {
    return null;
  }
}
