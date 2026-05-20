// AI Usage repository abstraction.
//
// Tracks per-user, per-feature, per-period usage counters for AI endpoints.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set, use CosmosAiUsageRepository.
//   - Otherwise, fall back to InMemoryAiUsageRepository.

import type { AiFeature, AiUsageCounter, QuotaCheckResult } from '@fittrack/shared';
import type { UserTier } from '../auth';
import { isCosmosConfigured } from '../cosmos';
import { getLimit, getCurrentPeriod } from '../quotaConfig';
import { CosmosAiUsageRepository } from './cosmosAiUsageRepository';

export interface AiUsageRepository {
  /** Get or create the usage counter for this user/feature/period. */
  getCounter(userId: string, feature: AiFeature, period: string): Promise<AiUsageCounter | null>;

  /** Increment usage by 1 and return updated counter. Creates if not exists. */
  incrementUsage(userId: string, feature: AiFeature, tier: UserTier): Promise<AiUsageCounter>;

  /** Check whether the user is within their quota for the current period. */
  checkQuota(userId: string, feature: AiFeature, tier: UserTier): Promise<QuotaCheckResult>;
}

// ---------------------------------------------------------------------------
// In-Memory implementation (local dev / tests)
// ---------------------------------------------------------------------------

export class InMemoryAiUsageRepository implements AiUsageRepository {
  private readonly counters = new Map<string, AiUsageCounter>();

  private makeId(userId: string, feature: AiFeature, period: string): string {
    return `${userId}:${feature}:${period}`;
  }

  async getCounter(userId: string, feature: AiFeature, period: string): Promise<AiUsageCounter | null> {
    return this.counters.get(this.makeId(userId, feature, period)) ?? null;
  }

  async incrementUsage(userId: string, feature: AiFeature, tier: UserTier): Promise<AiUsageCounter> {
    const period = getCurrentPeriod();
    const id = this.makeId(userId, feature, period);
    const now = new Date().toISOString();

    const existing = this.counters.get(id);
    if (existing) {
      existing.used += 1;
      existing.lastUsedAt = now;
      return { ...existing };
    }

    const counter: AiUsageCounter = {
      id,
      userId,
      feature,
      period,
      used: 1,
      limit: getLimit(tier, feature),
      tier,
      firstUsedAt: now,
      lastUsedAt: now,
    };
    this.counters.set(id, counter);
    return { ...counter };
  }

  async checkQuota(userId: string, feature: AiFeature, tier: UserTier): Promise<QuotaCheckResult> {
    const period = getCurrentPeriod();
    const limit = getLimit(tier, feature);
    const counter = await this.getCounter(userId, feature, period);
    const used = counter?.used ?? 0;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: used < limit,
      used,
      limit,
      remaining,
      feature,
      period,
    };
  }

  /** Test helper: reset all counters. */
  clear(): void {
    this.counters.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let singleton: AiUsageRepository | undefined;

export function getAiUsageRepository(): AiUsageRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosAiUsageRepository()
      : new InMemoryAiUsageRepository();
  }
  return singleton;
}
