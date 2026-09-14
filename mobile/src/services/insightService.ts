// Insight service — wraps GET /api/ai/daily-insight.
// Non-blocking by design: callers should NOT await this in a Promise.all
// that blocks the HomeScreen render.

import { aiApi, type DailyInsightResponse } from '../shared/api/aiApi';

export type { DailyInsightResponse } from '../shared/api/aiApi';

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
