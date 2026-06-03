// Quota enforcement for AI endpoints.
//
// Call `enforceQuota()` before executing expensive AI operations.
// Returns null if allowed, or an HttpResponseInit (429) if quota is exceeded.

import type { HttpResponseInit } from '@azure/functions';
import type { AiFeature, QuotaExceededResponse } from '@fittrack/shared';
import type { UserContext } from './auth';
import { getAiUsageRepository } from './repositories/aiUsageRepository';
import { getPeriodResetDate } from './quotaConfig';

/**
 * Check quota and return a 429 response if exceeded, or null if allowed.
 * Does NOT increment usage — call `trackUsage()` after successful AI call.
 */
export async function enforceQuota(
  user: UserContext,
  feature: AiFeature,
): Promise<HttpResponseInit | null> {
  const repo = getAiUsageRepository();
  const result = await repo.checkQuota(user.userId, feature, user.tier);

  if (result.allowed) {
    return null;
  }

  console.warn(
    `[quota] Quota exceeded: userId=${user.userId} feature=${feature} tier=${user.tier} used=${result.used} limit=${result.limit}`,
  );

  const body: QuotaExceededResponse = {
    error: 'quota_exceeded',
    feature,
    used: result.used,
    limit: result.limit,
    resetsAt: getPeriodResetDate(result.period),
  };

  return {
    status: 429,
    jsonBody: body,
  };
}

/**
 * Record a successful AI call. Call this AFTER the AI operation completes.
 * This ensures we don't increment on failed AI calls.
 */
export async function trackUsage(user: UserContext, feature: AiFeature): Promise<void> {
  const repo = getAiUsageRepository();
  await repo.incrementUsage(user.userId, feature, user.tier);
}
