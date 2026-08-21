// Insight repository abstraction.
//
// Stores and retrieves daily AI-generated insight documents.
// One document per user per calendar day.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set → CosmosInsightRepository
//   - Otherwise → InMemoryInsightRepository (process-local, lost on restart)

import { createHash } from 'node:crypto';
import type {
  InsightDocument,
  InsightFeedbackDocument,
  InsightFeedbackProcessingStatus,
  InsightIntent,
  InsightInputContext,
  InsightPromptSnapshot,
  WeeklyEvaluation,
  WeeklyEvaluationStatus,
} from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { getCosmos } from '../cosmos';

const COSMOS_SYSTEM_FIELDS = ['_attachments', '_etag', '_lsn', '_rid', '_self', '_ts'] as const;

function stripCosmosSystemFields<T extends object>(document: T): T {
  const cleanDocument = { ...document } as Record<string, unknown>;
  for (const field of COSMOS_SYSTEM_FIELDS) {
    delete cleanDocument[field];
  }
  return cleanDocument as T;
}

export const DEFAULT_FEEDBACK_PROCESSING_STATUS: InsightFeedbackProcessingStatus = 'Open';

export function getEffectiveFeedbackProcessingStatus(
  document: Pick<InsightFeedbackDocument, 'processingStatus'>,
): InsightFeedbackProcessingStatus {
  return document.processingStatus ?? DEFAULT_FEEDBACK_PROCESSING_STATUS;
}

function normalizeFeedbackDocument(document: InsightFeedbackDocument): InsightFeedbackDocument {
  return {
    ...document,
    processingStatus: getEffectiveFeedbackProcessingStatus(document),
  };
}

function canTransitionFeedbackProcessingStatus(
  current: InsightFeedbackProcessingStatus,
  next: InsightFeedbackProcessingStatus,
): boolean {
  if (current === next) return true;
  if (current !== 'Open') return false;
  return next === 'Done' || next === 'Rejected';
}

export type UpdateFeedbackProcessingStatusResult =
  | { outcome: 'updated'; status: InsightFeedbackProcessingStatus }
  | { outcome: 'noop'; status: InsightFeedbackProcessingStatus }
  | { outcome: 'invalid_transition'; status: InsightFeedbackProcessingStatus }
  | { outcome: 'not_found' };

// ---------------------------------------------------------------------------
// Cache constants
// ---------------------------------------------------------------------------

/** Maximum number of AI regenerations per calendar day for non-admin users. */
export const MAX_DAILY_GENERATIONS = 3;

/** Minimum time between regenerations in milliseconds (30 minutes). */
export const MIN_REGEN_INTERVAL_MS = 30 * 60 * 1000;

export type WeeklyInsightStoredStatus = Exclude<WeeklyEvaluationStatus, 'cached'>;

/** Persisted weekly insight document in the existing aiInsights container. */
export interface WeeklyInsightDocument {
  id: string;
  userId: string;
  _docType: 'weeklyInsight';
  referenceDate: string;
  periodStart: string;
  periodEnd: string;
  inputHash: string;
  promptVersion: string;
  model: string;
  response: WeeklyEvaluation;
  status?: WeeklyInsightStoredStatus;
  generatedAt?: string | null;
  lastAttemptAt: string;
  expiresAt: string;
  ttl: number;
  tokensUsed: number;
}

export function makeWeeklyInsightId(userId: string, periodEnd: string): string {
  return `${userId}:weekly:${periodEnd}`;
}

export function makeFeedbackId(userId: string, submissionId: string): string {
  return `${userId}:feedback:${submissionId}`;
}

/** Normalizes the client offset in local-minus-UTC minutes without clamping. */
export function normalizeTimezoneOffsetMinutes(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'string' && !/^-?\d+$/.test(value)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(parsed) || parsed < -840 || parsed > 840) return null;
  return parsed === 0 ? 0 : parsed;
}

/** Returns the date-only value at the backend instant in the supplied local offset. */
export function getCurrentLocalDate(now: Date, timezoneOffsetMinutes: unknown): string | null {
  const normalizedOffset = normalizeTimezoneOffsetMinutes(timezoneOffsetMinutes);
  if (normalizedOffset == null) return null;

  const localNow = new Date(now.getTime() + normalizedOffset * 60_000);
  return localNow.toISOString().slice(0, 10);
}

/** Checks a requested date against the offset-adjusted backend date. */
export function isCurrentDayForOffset(
  requestedDate: string,
  now: Date,
  timezoneOffsetMinutes: unknown,
): boolean {
  return getCurrentLocalDate(now, timezoneOffsetMinutes) === requestedDate;
}

/** Computes the next local midnight as a UTC instant; null/invalid uses UTC midnight. */
export function getNextLocalMidnightUtc(now: Date, timezoneOffsetMinutes: unknown): Date {
  const normalizedOffset = normalizeTimezoneOffsetMinutes(timezoneOffsetMinutes);
  if (normalizedOffset == null) {
    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    ));
  }

  const localNow = new Date(now.getTime() + normalizedOffset * 60_000);
  const nextLocalMidnightMs = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate() + 1,
  );
  return new Date(nextLocalMidnightMs - normalizedOffset * 60_000);
}

// ---------------------------------------------------------------------------
// Input hash — used to detect meaningful data changes
// ---------------------------------------------------------------------------

export function getLocalHourBucket(hour: number | null): string | null {
  if (hour == null || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (hour < 10) return 'morning';
  if (hour < 18) return 'day';
  if (hour <= 21) return 'evening';
  return 'late';
}

export type RemainingCaloriesBucket = 'unknown' | 'negative' | 'zero' | 'positive';
export type RemainingProteinBucket = 'unknown' | 'nearly_complete_below' | 'nearly_complete_at' | 'gap';

/** Preserve the semantic zero boundary that numeric rounding would otherwise erase. */
export function getRemainingCaloriesBucket(value: number | null | undefined): RemainingCaloriesBucket {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (value < 0) return 'negative';
  if (value > 0) return 'positive';
  return 'zero';
}

/** Preserve the prompt's 20 g protein boundary while retaining null as unknown. */
export function getRemainingProteinBucket(value: number | null | undefined): RemainingProteinBucket {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (value < 20) return 'nearly_complete_below';
  if (value === 20) return 'nearly_complete_at';
  return 'gap';
}

/**
 * Compute a stable hash of the insight input context.
 * Uses rounded values so minor fluctuations (< 100 kcal, < 10g protein,
 * < 0.5 kg weight) do NOT trigger a new AI call.
 *
 * @param promptVersion  Active prompt version (e.g. "v4"). Changes to the
 *   prompt invalidate all cached documents automatically.
 */
export function computeInputHash(
  ctx: InsightInputContext,
  promptVersion: string,
  intent: InsightIntent | null = null,
  promptFingerprint: string | null = null,
  systemPromptHash: string | null = null,
): string {
  const roundCalories = (value: number | null | undefined): number | null =>
    value == null ? null : Math.round(value / 100);
  const roundMacro = (value: number | null | undefined): number | null =>
    value == null ? null : Math.round(value / 10);
  const roundWeight = (value: number | null | undefined): number | null =>
    value == null ? null : Math.round(value * 2) / 2;

  const stable = {
    promptVersion,
    intent,
    promptFingerprint: promptFingerprint ?? null,
    systemPromptHash: systemPromptHash ?? null,
    date: ctx.date,
    timezoneOffsetMinutes: normalizeTimezoneOffsetMinutes(ctx.timezoneOffsetMinutes),
    dayType: ctx.dayType,
    workoutType: ctx.workoutType,
    currentHourLocal: ctx.currentHourLocal,
    localHourBucket: getLocalHourBucket(ctx.currentHourLocal),
    specialActivity: ctx.specialActivity ?? null,
    activityCompletionStatus: ctx.activityCompletionStatus ?? null,
    activityStatusSource: ctx.activityStatusSource ?? null,
    activityStatusBucket: ctx.activityCompletionStatus ?? 'none',
    userGoal: ctx.userGoal,
    userGoalIntensity: ctx.userGoalIntensity,
    displayName: ctx.displayName,
    weight: {
      latestKg: roundWeight(ctx.weight.latestKg),
      previousKg: roundWeight(ctx.weight.previousKg),
      targetKg: roundWeight(ctx.weight.targetKg),
      weeklyTrend30d: ctx.weight.weeklyTrend30d,
      last7Values: ctx.weight.last7Values.map(roundWeight),
      isOutlierPrevious: ctx.weight.isOutlierPrevious,
      isOutlierLatest: ctx.weight.isOutlierLatest,
      daysSinceLastMeasurement: ctx.weight.daysSinceLastMeasurement,
      lastMeasurementDate: ctx.weight.lastMeasurementDate,
    },
    nutrition: {
      today: ctx.nutrition.today
        ? {
            calories: roundCalories(ctx.nutrition.today.calories),
            protein: roundMacro(ctx.nutrition.today.protein),
            carbs: roundMacro(ctx.nutrition.today.carbs),
            fat: roundMacro(ctx.nutrition.today.fat),
            fiber: roundMacro(ctx.nutrition.today.fiber),
            hasMealItem: ctx.nutrition.today.hasMealItem ?? true,
          }
        : null,
      targets: ctx.nutrition.targets
        ? {
            calories: roundCalories(ctx.nutrition.targets.calories),
            proteinG: roundMacro(ctx.nutrition.targets.proteinG),
            carbsG: roundMacro(ctx.nutrition.targets.carbsG),
            fatG: roundMacro(ctx.nutrition.targets.fatG),
            fiberG: roundMacro(ctx.nutrition.targets.fiberG),
            baseCalories: roundCalories(ctx.nutrition.targets.baseCalories),
            activityBonusCalories: roundCalories(ctx.nutrition.targets.activityBonusCalories),
            targetSource: ctx.nutrition.targets.targetSource ?? null,
          }
        : null,
      remainingCalories: roundCalories(ctx.nutrition.remainingCalories),
      remainingProteinG: roundMacro(ctx.nutrition.remainingProteinG),
      remainingCaloriesBucket: getRemainingCaloriesBucket(ctx.nutrition.remainingCalories),
      remainingProteinBucket: getRemainingProteinBucket(ctx.nutrition.remainingProteinG),
      last3Days: ctx.nutrition.last3Days.map((day) => ({
        date: day.date,
        calories: roundCalories(day.calories),
        protein: roundMacro(day.protein),
        carbs: roundMacro(day.carbs),
        fat: roundMacro(day.fat),
        hasMealItem: day.hasMealItem ?? null,
        mealItemCount: day.mealItemCount ?? null,
        baseTargetCalories: roundCalories(day.baseTargetCalories),
        effectiveTargetCalories: roundCalories(day.effectiveTargetCalories),
        activityBonusCalories: roundCalories(day.activityBonusCalories),
        targetSource: day.targetSource ?? null,
        dayType: day.dayType ?? null,
        workoutType: day.workoutType ?? null,
        specialActivity: day.specialActivity ?? null,
      })),
    },
    progressIntelligence: ctx.progressIntelligence,
    weightStaleness: ctx.weight.daysSinceLastMeasurement === null
      ? 'none'
      : ctx.weight.daysSinceLastMeasurement > 14
        ? 'stale'
        : 'fresh',
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
  activePromptVersion?: string,
  activePromptFingerprint?: string,
  activeSystemPromptHash?: string,
  activeIntent?: InsightIntent,
  activePromptSnapshot?: InsightPromptSnapshot,
): boolean {
  if (!cached) return true;

  if (activePromptVersion != null && cached.promptVersion !== activePromptVersion) {
    return true;
  }
  if (activePromptVersion != null && (cached.intent == null || cached.promptSnapshot == null)) {
    return true;
  }

  // Prompt identities are hard invalidation gates. Missing legacy values are
  // intentionally treated as mismatches when the active identity is known.
  if (
    activePromptFingerprint != null
    && cached.promptFingerprint !== activePromptFingerprint
  ) {
    return true;
  }
  if (
    activeSystemPromptHash != null
    && cached.systemPromptHash !== activeSystemPromptHash
  ) {
    return true;
  }
  if (activeIntent != null && cached.intent !== activeIntent) {
    return true;
  }
  if (
    activePromptSnapshot != null
    && (
      cached.promptSnapshot == null
      || cached.promptSnapshot.system !== activePromptSnapshot.system
      || cached.promptSnapshot.user !== activePromptSnapshot.user
    )
  ) {
    return true;
  }
  // Hash unchanged → serve cache as-is
  if (cached.inputHash === newHash) return false;

  // Hash changed — check rate limits
  // Admin users bypass both the daily generation limit and the min interval
  if (isAdmin) return true;

  const lastGen = new Date(cached.lastGeneratedAt).getTime();
  if (now.getTime() - lastGen < MIN_REGEN_INTERVAL_MS) return false;

  if (cached.dailyGenerations >= MAX_DAILY_GENERATIONS) return false;

  return true;
}

// ---------------------------------------------------------------------------
// TTL helper — ensures document expires at the next local midnight boundary
// ---------------------------------------------------------------------------

/**
 * Compute the Cosmos TTL (seconds) so the document auto-deletes at the next
 * local midnight, or at the legacy UTC midnight when no valid offset exists.
 * Cosmos counts TTL from the document's _ts (last modification epoch).
 * We recalculate on every upsert so the TTL is always "midnight from now".
 */
export function computeTtlUntilMidnight(now: Date, timezoneOffsetMinutes: unknown = null): number {
  const nextMidnight = getNextLocalMidnightUtc(now, timezoneOffsetMinutes).getTime();
  return Math.max(1, Math.ceil((nextMidnight - now.getTime()) / 1000));
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface InsightRepository {
  /** Get today's insight document for the user, or null if none exists. */
  get(userId: string, date: string): Promise<InsightDocument | null>;
  /** Create or replace the insight document (upsert). */
  upsert(doc: InsightDocument): Promise<void>;
  /** Get the weekly insight document for the user and completed period. */
  getWeekly(userId: string, periodEnd: string): Promise<WeeklyInsightDocument | null>;
  /** Create or replace a weekly insight document. */
  upsertWeekly(doc: WeeklyInsightDocument): Promise<void>;
  /** Get a feedback document by its client-generated idempotency key. */
  getFeedbackBySubmissionId(userId: string, submissionId: string): Promise<InsightFeedbackDocument | null>;
  /** Atomically create a feedback document, or return the existing document. */
  createFeedbackIfAbsent(doc: InsightFeedbackDocument): Promise<{
    created: boolean;
    document: InsightFeedbackDocument;
  }>;
  /** Update processing status with exact partition/id + discriminator guard and terminal-state semantics. */
  updateFeedbackProcessingStatus(
    userId: string,
    feedbackId: string,
    nextStatus: InsightFeedbackProcessingStatus,
  ): Promise<UpdateFeedbackProcessingStatusResult>;
  /** Mark the exact Daily instance as negatively reviewed without changing its identity. */
  markNegativeFeedback(userId: string, date: string, insightGeneratedAt: string): Promise<boolean>;
  /** List recent insight documents (newest first) within the last N calendar days up to and including referenceDate. */
  listRecent(userId: string, days: number, referenceDate?: string): Promise<InsightDocument[]>;
}

// ---------------------------------------------------------------------------
// In-Memory implementation (local dev / tests)
// ---------------------------------------------------------------------------

export class InMemoryInsightRepository implements InsightRepository {
  private readonly docs = new Map<string, InsightDocument>();
  private readonly weeklyDocs = new Map<string, WeeklyInsightDocument>();
  private readonly feedbackDocs = new Map<string, InsightFeedbackDocument>();

  private makeKey(userId: string, date: string): string {
    return `${userId}:${date}`;
  }

  async get(userId: string, date: string): Promise<InsightDocument | null> {
    const document = this.docs.get(this.makeKey(userId, date));
    if (document?._docType != null && document._docType !== 'dailyInsight') return null;
    return document ?? null;
  }

  async upsert(doc: InsightDocument): Promise<void> {
    this.docs.set(this.makeKey(doc.userId, doc.date), doc);
  }

  async getWeekly(userId: string, periodEnd: string): Promise<WeeklyInsightDocument | null> {
    return this.weeklyDocs.get(makeWeeklyInsightId(userId, periodEnd)) ?? null;
  }

  async upsertWeekly(doc: WeeklyInsightDocument): Promise<void> {
    this.weeklyDocs.set(makeWeeklyInsightId(doc.userId, doc.periodEnd), doc);
  }

  async getFeedbackBySubmissionId(userId: string, submissionId: string): Promise<InsightFeedbackDocument | null> {
    const document = this.feedbackDocs.get(makeFeedbackId(userId, submissionId));
    return document?._docType === 'insightFeedback' ? normalizeFeedbackDocument(document) : null;
  }

  async createFeedbackIfAbsent(doc: InsightFeedbackDocument): Promise<{
    created: boolean;
    document: InsightFeedbackDocument;
  }> {
    const normalized = normalizeFeedbackDocument(doc);
    const key = makeFeedbackId(normalized.userId, normalized.submissionId);
    const existing = this.feedbackDocs.get(key);
    if (existing) return { created: false, document: normalizeFeedbackDocument(existing) };
    this.feedbackDocs.set(key, normalized);
    return { created: true, document: normalized };
  }

  async updateFeedbackProcessingStatus(
    userId: string,
    feedbackId: string,
    nextStatus: InsightFeedbackProcessingStatus,
  ): Promise<UpdateFeedbackProcessingStatusResult> {
    const existing = this.feedbackDocs.get(feedbackId);
    if (!existing || existing.userId !== userId || existing._docType !== 'insightFeedback') {
      return { outcome: 'not_found' };
    }

    const currentStatus = getEffectiveFeedbackProcessingStatus(existing);
    if (!canTransitionFeedbackProcessingStatus(currentStatus, nextStatus)) {
      return { outcome: 'invalid_transition', status: currentStatus };
    }
    if (currentStatus === nextStatus) {
      return { outcome: 'noop', status: currentStatus };
    }

    existing.processingStatus = nextStatus;
    return { outcome: 'updated', status: nextStatus };
  }

  async markNegativeFeedback(userId: string, date: string, insightGeneratedAt: string): Promise<boolean> {
    const document = this.docs.get(this.makeKey(userId, date));
    if (
      !document
      || (document._docType != null && document._docType !== 'dailyInsight')
      || document.generatedAt !== insightGeneratedAt
    ) {
      return false;
    }
    document.feedbackScore = 'negative';
    return true;
  }

  async listRecent(userId: string, days: number, referenceDate?: string): Promise<InsightDocument[]> {
    const ref = referenceDate ?? new Date().toISOString().split('T')[0]!;
    const cutoff = new Date(ref + 'T00:00:00Z');
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffIso = cutoff.toISOString().split('T')[0]!;
    return Array.from(this.docs.values())
      .filter((doc) => (
        doc.userId === userId
        && doc.date >= cutoffIso
        && doc.date <= ref
        && (doc._docType == null || doc._docType === 'dailyInsight')
      ))
      .sort((a, b) => b.date.localeCompare(a.date));
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
      if (!resource || (resource._docType != null && resource._docType !== 'dailyInsight')) return null;
      return stripCosmosSystemFields(resource);
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

  async getWeekly(userId: string, periodEnd: string): Promise<WeeklyInsightDocument | null> {
    const { containers } = await getCosmos();
    const id = makeWeeklyInsightId(userId, periodEnd);
    try {
      const { resource } = await containers.aiInsights.item(id, userId).read<WeeklyInsightDocument>();
      return resource?._docType === 'weeklyInsight' ? stripCosmosSystemFields(resource) : null;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return null;
      }
      throw e;
    }
  }

  async upsertWeekly(doc: WeeklyInsightDocument): Promise<void> {
    const { containers } = await getCosmos();
    await containers.aiInsights.items.upsert<WeeklyInsightDocument>(doc);
  }

  async getFeedbackBySubmissionId(userId: string, submissionId: string): Promise<InsightFeedbackDocument | null> {
    const { containers } = await getCosmos();
    const id = makeFeedbackId(userId, submissionId);
    try {
      const { resource } = await containers.aiInsights.item(id, userId).read<InsightFeedbackDocument>();
      return resource?._docType === 'insightFeedback'
        ? normalizeFeedbackDocument(stripCosmosSystemFields(resource))
        : null;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return null;
      }
      throw e;
    }
  }

  async createFeedbackIfAbsent(doc: InsightFeedbackDocument): Promise<{
    created: boolean;
    document: InsightFeedbackDocument;
  }> {
    const { containers } = await getCosmos();
    const normalized = normalizeFeedbackDocument(doc);
    try {
      const { resource } = await containers.aiInsights.items.create<InsightFeedbackDocument>(normalized);
      return { created: true, document: normalizeFeedbackDocument(stripCosmosSystemFields(resource ?? normalized)) };
    } catch (e) {
      if (!(typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 409)) {
        throw e;
      }
      const existing = await this.getFeedbackBySubmissionId(normalized.userId, normalized.submissionId);
      if (!existing) throw e;
      return { created: false, document: existing };
    }
  }

  async updateFeedbackProcessingStatus(
    userId: string,
    feedbackId: string,
    nextStatus: InsightFeedbackProcessingStatus,
  ): Promise<UpdateFeedbackProcessingStatusResult> {
    const { containers } = await getCosmos();
    const item = containers.aiInsights.item(feedbackId, userId);

    const readFeedback = async (): Promise<InsightFeedbackDocument | null> => {
      try {
        const { resource } = await item.read<InsightFeedbackDocument>();
        if (!resource || resource._docType !== 'insightFeedback') return null;
        return normalizeFeedbackDocument(stripCosmosSystemFields(resource));
      } catch (e) {
        if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
          return null;
        }
        throw e;
      }
    };

    const current = await readFeedback();
    if (!current) return { outcome: 'not_found' };

    const currentStatus = getEffectiveFeedbackProcessingStatus(current);
    if (!canTransitionFeedbackProcessingStatus(currentStatus, nextStatus)) {
      return { outcome: 'invalid_transition', status: currentStatus };
    }
    if (currentStatus === nextStatus) {
      return { outcome: 'noop', status: currentStatus };
    }

    const expectedStatusCondition = currentStatus === 'Open'
      ? "(NOT IS_DEFINED(c.processingStatus) OR c.processingStatus = 'Open')"
      : `c.processingStatus = ${JSON.stringify(currentStatus)}`;
    const condition = `FROM c WHERE c._docType = 'insightFeedback' AND ${expectedStatusCondition}`;

    try {
      await item.patch({
        operations: [{ op: 'set', path: '/processingStatus', value: nextStatus }],
        condition,
      });
      return { outcome: 'updated', status: nextStatus };
    } catch (e) {
      if (
        typeof e === 'object'
        && e !== null
        && 'code' in e
        && [404, 412].includes((e as { code?: number }).code ?? 0)
      ) {
        const refreshed = await readFeedback();
        if (!refreshed) return { outcome: 'not_found' };
        const refreshedStatus = getEffectiveFeedbackProcessingStatus(refreshed);
        if (refreshedStatus === nextStatus) return { outcome: 'noop', status: refreshedStatus };
        if (!canTransitionFeedbackProcessingStatus(refreshedStatus, nextStatus)) {
          return { outcome: 'invalid_transition', status: refreshedStatus };
        }
      }
      throw e;
    }
  }

  async markNegativeFeedback(userId: string, date: string, insightGeneratedAt: string): Promise<boolean> {
    const { containers } = await getCosmos();
    const item = containers.aiInsights.item(`${userId}:${date}`, userId);
    let existing: InsightDocument | undefined;
    try {
      const result = await item.read<InsightDocument>();
      existing = result.resource;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return false;
      }
      throw e;
    }

    if (
      !existing
      || (existing._docType != null && existing._docType !== 'dailyInsight')
      || existing.generatedAt !== insightGeneratedAt
    ) {
      return false;
    }

    const operations: Array<{
      op: 'set';
      path: string;
      value: string | number;
    }> = [{ op: 'set', path: '/feedbackScore', value: 'negative' }];
    const expirationMs = existing.expiresAt ? Date.parse(existing.expiresAt) : Number.NaN;
    if (Number.isFinite(expirationMs) && typeof existing.ttl === 'number') {
      operations.push({
        op: 'set',
        path: '/ttl',
        value: Math.max(1, Math.ceil((expirationMs - Date.now()) / 1000)),
      });
    }

    try {
      await item.patch({
        operations,
        condition: `FROM c WHERE c.generatedAt = ${JSON.stringify(insightGeneratedAt)} AND (NOT IS_DEFINED(c._docType) OR c._docType = 'dailyInsight')`,
      });
      return true;
    } catch (e) {
      if (
        typeof e === 'object'
        && e !== null
        && 'code' in e
        && [404, 412].includes((e as { code?: number }).code ?? 0)
      ) {
        return false;
      }
      throw e;
    }
  }

  async listRecent(userId: string, days: number, referenceDate?: string): Promise<InsightDocument[]> {
    const ref = referenceDate ?? new Date().toISOString().split('T')[0]!;
    const cutoff = new Date(ref + 'T00:00:00Z');
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffIso = cutoff.toISOString().split('T')[0]!;
    const { containers } = await getCosmos();
    const { resources } = await containers.aiInsights.items
      .query<InsightDocument>({
        query:
          "SELECT * FROM c WHERE c.userId = @userId AND c.date >= @cutoffDate AND c.date <= @refDate AND (NOT IS_DEFINED(c._docType) OR c._docType = 'dailyInsight') ORDER BY c.date DESC",
        parameters: [
          { name: '@userId', value: userId },
          { name: '@cutoffDate', value: cutoffIso },
          { name: '@refDate', value: ref },
        ],
      })
      .fetchAll();
    return resources.map((resource) => stripCosmosSystemFields(resource));
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
