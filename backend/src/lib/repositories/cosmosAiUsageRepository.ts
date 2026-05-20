// Cosmos-backed implementation of AiUsageRepository.
// Uses the `aiUsage` container (partition key /userId).
// Documents are upserted — one per user/feature/period.

import type { AiFeature, AiUsageCounter, QuotaCheckResult } from '@fittrack/shared';
import type { UserTier } from '../auth';
import { getCosmos } from '../cosmos';
import { getLimit, getCurrentPeriod } from '../quotaConfig';
import type { AiUsageRepository } from './aiUsageRepository';

export class CosmosAiUsageRepository implements AiUsageRepository {
  private makeId(userId: string, feature: AiFeature, period: string): string {
    return `${userId}:${feature}:${period}`;
  }

  async getCounter(userId: string, feature: AiFeature, period: string): Promise<AiUsageCounter | null> {
    const { containers } = await getCosmos();
    const id = this.makeId(userId, feature, period);
    try {
      const { resource } = await containers.aiUsage.item(id, userId).read<AiUsageCounter>();
      return resource ?? null;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return null;
      }
      throw e;
    }
  }

  async incrementUsage(userId: string, feature: AiFeature, tier: UserTier): Promise<AiUsageCounter> {
    const { containers } = await getCosmos();
    const period = getCurrentPeriod();
    const id = this.makeId(userId, feature, period);
    const now = new Date().toISOString();

    const existing = await this.getCounter(userId, feature, period);

    if (existing) {
      const updated: AiUsageCounter = {
        ...existing,
        used: existing.used + 1,
        lastUsedAt: now,
      };
      const { resource } = await containers.aiUsage.item(id, userId).replace<AiUsageCounter>(updated);
      return resource ?? updated;
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
    const { resource } = await containers.aiUsage.items.create<AiUsageCounter>(counter);
    return resource ?? counter;
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
}
