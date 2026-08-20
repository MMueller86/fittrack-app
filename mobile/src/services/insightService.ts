// Insight service — wraps GET /api/ai/daily-insight.
// Non-blocking by design: callers should NOT await this in a Promise.all
// that blocks the HomeScreen render.

import { apiClient } from '../shared/api/client';
import type { InsightResponse } from '@fittrack/shared';
import { getLocalTimezoneOffsetMinutes } from '../shared/date/localDate';

export interface DailyInsightResponse extends InsightResponse {
  /** Explicitly false for legacy Daily documents without feedback provenance. */
  feedbackAvailable?: boolean;
}

/**
 * Fetch or generate the daily AI insight for the given date.
 * Returns the InsightResponse (may be fresh, cached, quota_exceeded, or unavailable).
 * Never throws — returns null on unexpected network errors.
 */
export async function getInsight(date: string): Promise<DailyInsightResponse | null> {
  try {
    const now = new Date();
    const localHour = now.getHours();
    const validLocalHour = Number.isInteger(localHour) && localHour >= 0 && localHour <= 23
      ? localHour
      : null;
    const timezoneOffsetMinutes = getLocalTimezoneOffsetMinutes(now);
    const query = [`date=${encodeURIComponent(date)}`];
    if (validLocalHour !== null) query.push(`localHour=${validLocalHour}`);
    if (timezoneOffsetMinutes !== null) query.push(`timezoneOffsetMinutes=${timezoneOffsetMinutes}`);

    const { data } = await apiClient.get<DailyInsightResponse>(`/ai/daily-insight?${query.join('&')}`);
    return data;
  } catch {
    return null;
  }
}
