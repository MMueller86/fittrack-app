// Insight repository abstraction.
//
// Stores and retrieves daily AI-generated insight documents.
// One document per user per calendar day.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set → CosmosInsightRepository
//   - Otherwise → InMemoryInsightRepository (process-local, lost on restart)

import { createHash } from 'node:crypto';
import type { InsightDocument, InsightInputContext } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { getCosmos } from '../cosmos';

// ---------------------------------------------------------------------------
// Cache constants
// ---------------------------------------------------------------------------

/** Maximum number of AI regenerations per calendar day for non-admin users. */
export const MAX_DAILY_GENERATIONS = 3;

/** Minimum time between regenerations in milliseconds (30 minutes). */
export const MIN_REGEN_INTERVAL_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Input hash — used to detect meaningful data changes
// ---------------------------------------------------------------------------

/**
 * Compute a stable hash of the insight input context.
 * Uses rounded values so minor fluctuations (< 100 kcal, < 10g protein,
 * < 0.5 kg weight) do NOT trigger a new AI call.
 */
export function computeInputHash(ctx: InsightInputContext): string {
  const stable = {
    date: ctx.date,
    dayType: ctx.dayType,
    workoutType: ctx.workoutType,
    // Round calories to nearest 100, protein to nearest 10
    calories:
      ctx.nutrition.today !== null
        ? Math.round(ctx.nutrition.today.calories / 100)
        : null,
    protein:
      ctx.nutrition.today !== null
        ? Math.round(ctx.nutrition.today.protein / 10)
        : null,
    // Round weight to nearest 0.5 kg
    latestWeight:
      ctx.weight.latestKg !== null
        ? Math.round(ctx.weight.latestKg * 2) / 2
        : null,
    trend7d: ctx.weight.trend7d,
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

// ---------------------------------------------------------------------------
// Regeneration decision logic
// ---------------------------------------------------------------------------

/**
 * Determine whether a new AI call should be made.
 *
 * Returns true (regenerate) when:
 * - No cached document exists yet for today
 * - Input hash changed AND min interval has passed AND daily limit not reached
 *
 * Admin users (isAdmin=true) bypass the daily generation limit.
 */
export function shouldRegenerate(
  cached: InsightDocument | null,
  newHash: string,
  now: Date,
  isAdmin: boolean,
): boolean {
  if (!cached) return true;

  // Hash unchanged → serve cache as-is
  if (cached.inputHash === newHash) return false;

  // Hash changed — check rate limits
  const lastGen = new Date(cached.lastGeneratedAt).getTime();
  if (now.getTime() - lastGen < MIN_REGEN_INTERVAL_MS) return false;

  if (!isAdmin && cached.dailyGenerations >= MAX_DAILY_GENERATIONS) return false;

  return true;
}

// ---------------------------------------------------------------------------
// TTL helper — ensures document expires at next midnight UTC
// ---------------------------------------------------------------------------

/**
 * Compute the Cosmos TTL (seconds) so the document auto-deletes at next midnight UTC.
 * Cosmos counts TTL from the document's _ts (last modification epoch).
 * We recalculate on every upsert so the TTL is always "midnight from now".
 */
export function computeTtlUntilMidnight(now: Date): number {
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return Math.max(1, Math.floor((nextMidnight - now.getTime()) / 1000));
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface InsightRepository {
  /** Get today's insight document for the user, or null if none exists. */
  get(userId: string, date: string): Promise<InsightDocument | null>;
  /** Create or replace the insight document (upsert). */
  upsert(doc: InsightDocument): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-Memory implementation (local dev / tests)
// ---------------------------------------------------------------------------

export class InMemoryInsightRepository implements InsightRepository {
  private readonly docs = new Map<string, InsightDocument>();

  private makeKey(userId: string, date: string): string {
    return `${userId}:${date}`;
  }

  async get(userId: string, date: string): Promise<InsightDocument | null> {
    return this.docs.get(this.makeKey(userId, date)) ?? null;
  }

  async upsert(doc: InsightDocument): Promise<void> {
    this.docs.set(this.makeKey(doc.userId, doc.date), doc);
  }
}

// ---------------------------------------------------------------------------
// Cosmos implementation
// ---------------------------------------------------------------------------

export class CosmosInsightRepository implements InsightRepository {
  async get(userId: string, date: string): Promise<InsightDocument | null> {
    const { containers } = await getCosmos();
    const id = `${userId}:${date}`;
    try {
      const { resource } = await containers.aiInsights.item(id, userId).read<InsightDocument>();
      return resource ?? null;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return null;
      }
      throw e;
    }
  }

  async upsert(doc: InsightDocument): Promise<void> {
    const { containers } = await getCosmos();
    await containers.aiInsights.items.upsert<InsightDocument>(doc);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let singleton: InsightRepository | undefined;

export function getInsightRepository(): InsightRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosInsightRepository()
      : new InMemoryInsightRepository();
  }
  return singleton;
}

/** Reset singleton — used in tests. */
export function _resetInsightRepositoryForTests(): void {
  singleton = undefined;
}
