// Insight service — wraps GET /api/ai/daily-insight.
// Non-blocking by design: callers should NOT await this in a Promise.all
// that blocks the HomeScreen render.

import { apiClient } from '../shared/api/client';
import type { InsightResponse } from '@fittrack/shared';

/**
 * Fetch or generate the daily AI insight for the given date.
 * Returns the InsightResponse (may be fresh, cached, quota_exceeded, or unavailable).
 * Never throws — returns null on unexpected network errors.
 */
export async function getInsight(date: string): Promise<InsightResponse | null> {
  try {
    const { data } = await apiClient.get<InsightResponse>(
      `/ai/daily-insight?date=${encodeURIComponent(date)}`,
    );
    return data;
  } catch {
    return null;
  }
}
