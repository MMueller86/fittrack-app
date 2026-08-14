// AI usage tracking and quota types.

export type AiFeature = 'meal-parser' | 'food-estimate' | 'label-scan' | 'meal-estimate' | 'recipe-analyze' | 'recipe-scale' | 'daily-insight';
export type UserTier = 'free' | 'premium' | 'internal';

/** Persisted in Cosmos `aiUsage` container. One document per user/feature/period. */
export interface AiUsageCounter {
  /** Composite key: `${userId}:${feature}:${period}` */
  id: string;
  /** Partition key */
  userId: string;
  /** Which AI feature this counter tracks */
  feature: AiFeature;
  /** Monthly period in YYYY-MM format */
  period: string;
  /** Number of calls used in this period */
  used: number;
  /** Limit for this period (snapshot from tier config at creation) */
  limit: number;
  /** User tier at time of counter creation */
  tier: UserTier;
  /** ISO timestamp of the first call in this period */
  firstUsedAt: string;
  /** ISO timestamp of the most recent call */
  lastUsedAt: string;
}

/** Returned by quota check — tells caller whether to proceed or block. */
export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  feature: AiFeature;
  period: string;
}

/** Error response body returned to client on 429 */
export interface QuotaExceededResponse {
  error: 'quota_exceeded';
  feature: AiFeature;
  used: number;
  limit: number;
  resetsAt: string;
}
