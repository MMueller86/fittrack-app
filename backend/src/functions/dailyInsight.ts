// Daily Insight endpoint — GET /api/ai/daily-insight
//
// Returns a once-daily AI-generated personal briefing for the authenticated user.
// Never returns a 4xx/5xx visible to the user for quota or AI failures —
// instead delivers a friendly InsightResponse with status 'quota_exceeded' or 'unavailable'.
//
// Cache strategy:
//   - One Cosmos document per user per calendar day (id = `${userId}:${date}`)
//   - Served from cache when input hash is unchanged or min interval not met
//   - Max 3 regenerations per day (non-admin), always regenerates for admin users

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireUser } from '../lib/auth';
import { withHandler } from '../lib/http';
import { trackUsage } from '../lib/quota';
import { logEvent } from '../lib/log';
import { generateDailyInsight, DAILY_INSIGHT_PROMPT_VERSION } from '../lib/openai';
import {
  getInsightRepository,
  computeInputHash,
  getNextLocalMidnightUtc,
  isCurrentDayForOffset,
  normalizeTimezoneOffsetMinutes,
  shouldRegenerate,
  computeTtlUntilMidnight,
} from '../lib/repositories/insightRepository';
import { getAiUsageRepository } from '../lib/repositories/aiUsageRepository';
import { buildDailyInsightContext } from '../lib/dailyInsightContext';
import { selectInsightIntent } from '../lib/dailyInsightIntent';
import {
  buildDailyInsightPrompt,
  computeDailyInsightSystemPromptHash,
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
} from '../lib/prompts/dailyInsightPrompt';
import { hasFeedbackSnapshot } from '../lib/insightFeedback';
import type {
  InsightDocument,
  InsightInputContext,
  InsightResponse,
} from '@fittrack/shared';
import { PROGRESS_INTELLIGENCE_VERSION } from '../../../shared/types/insight';

// ---------------------------------------------------------------------------
// Friendly copy — never exposes technical terms to the user
// ---------------------------------------------------------------------------

const QUOTA_RESPONSE: InsightResponse = {
  title: 'Persönliche Analyse verfügbar',
  summary:
    'Deine persönliche Tagesanalyse steht morgen wieder für dich bereit. Schau in der Zwischenzeit in deinen aktuellen Kalorienstand — da findest du alles, was du für heute brauchst.',
  generatedAt: new Date().toISOString(),
  promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
  status: 'quota_exceeded',
  feedbackAvailable: false,
};

const UNAVAILABLE_RESPONSE: InsightResponse = {
  title: 'Analyse nicht verfügbar',
  summary:
    'Sobald wieder eine Verbindung besteht, aktualisiere ich deine persönliche Analyse automatisch.',
  generatedAt: new Date().toISOString(),
  promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
  status: 'unavailable',
  feedbackAvailable: false,
};

export { buildDailyInsightContext as buildInputContext } from '../lib/dailyInsightContext';

// ---------------------------------------------------------------------------
// Handler — exported for tests
// ---------------------------------------------------------------------------

export const dailyInsightHandler = withHandler(
  'ai.daily-insight',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);
    const { userId, tier, isAdmin } = userContext;

    // Determine target date (default: today UTC)
    const url = new URL(request.url);
    const rawDate = url.searchParams.get('date');
    const date =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : new Date().toISOString().split('T')[0]!;

    // Local hour of the user's device (0–23), sent by the client to avoid
    // timezone issues. Used by the AI to determine whether the day is still
    // in progress. Null when not provided — treated as "unknown/end-of-day".
    const rawHour = url.searchParams.get('localHour');
    const parsedHour = rawHour !== null && /^\d+$/.test(rawHour) ? Number(rawHour) : null;
    const localHour = parsedHour != null && Number.isInteger(parsedHour) && parsedHour >= 0 && parsedHour <= 23
      ? parsedHour
      : null;
    const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(
      url.searchParams.get('timezoneOffsetMinutes'),
    );

    const insightRepo = getInsightRepository();
    const now = new Date();
    const isCurrentDay = isCurrentDayForOffset(date, now, timezoneOffsetMinutes);

    // Load cached document
    const cached = await insightRepo.get(userId, date);

    // Build current input context + hash
    let context: InsightInputContext;
    try {
      context = await buildDailyInsightContext({
        userId,
        date,
        localHour,
        timezoneOffsetMinutes,
        isCurrentDay,
        insightRepository: insightRepo,
        now,
      });
    } catch (err) {
      console.error('[daily-insight] Failed to build input context:', err);
      return {
        status: 200,
        jsonBody: { ...UNAVAILABLE_RESPONSE, generatedAt: now.toISOString() } satisfies InsightResponse,
      };
    }
    context = { ...context, timezoneOffsetMinutes };
    const intent = selectInsightIntent(context);
    const promptSnapshot = buildDailyInsightPrompt(intent, context);
    const systemPromptHash = computeDailyInsightSystemPromptHash(promptSnapshot.system);
    const newHash = computeInputHash(
      context,
      DAILY_INSIGHT_PROMPT_VERSION,
      intent,
      DAILY_INSIGHT_PROMPT_FINGERPRINT,
      systemPromptHash,
    );

    // Check whether we can/should regenerate
    const regen = shouldRegenerate(
      cached,
      newHash,
      now,
      isAdmin,
      DAILY_INSIGHT_PROMPT_VERSION,
      DAILY_INSIGHT_PROMPT_FINGERPRINT,
      systemPromptHash,
      intent,
      promptSnapshot,
    );

    if (!regen && cached) {
      // Return from cache
      return {
        status: 200,
        jsonBody: {
          ...cached.response,
          status: 'cached',
          feedbackAvailable: hasFeedbackSnapshot(cached),
        } satisfies InsightResponse,
      };
    }

    // --- Need a fresh generation ---

    // Quota check (manual — we return 200 with friendly message, not 429)
    if (!isAdmin) {
      const repo = getAiUsageRepository();
      const quotaResult = await repo.checkQuota(userId, 'daily-insight', tier);
      if (!quotaResult.allowed) {
        return {
          status: 200,
          jsonBody: { ...QUOTA_RESPONSE, generatedAt: now.toISOString() } satisfies InsightResponse,
        };
      }
    }

    // Generate new insight
    let generateResult;
    try {
      generateResult = await generateDailyInsight(context, intent, promptSnapshot);
    } catch (err) {
      // AI call failed — return unavailable message, do NOT throw (never expose errors)
      console.error('[daily-insight] AI generation failed:', err);
      return {
        status: 200,
        jsonBody: { ...UNAVAILABLE_RESPONSE, generatedAt: now.toISOString() } satisfies InsightResponse,
      };
    }

    const generatedAt = now.toISOString();
    const fullResponse: InsightResponse = {
      ...generateResult.response,
      generatedAt,
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      status: 'fresh',
      feedbackAvailable: true,
    };

    // Persist to Cosmos
    const expiresAt = getNextLocalMidnightUtc(now, timezoneOffsetMinutes).toISOString();
    const doc: InsightDocument = {
      _docType: 'dailyInsight',
      id: `${userId}:${date}`,
      userId,
      date,
      generatedAt,
      expiresAt,
      ttl: computeTtlUntilMidnight(now, timezoneOffsetMinutes),
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      promptFingerprint: DAILY_INSIGHT_PROMPT_FINGERPRINT,
      systemPromptHash,
      intent,
      promptSnapshot,
      model: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini',
      inputHash: newHash,
      inputContext: context,
      response: fullResponse,
      dailyGenerations: (cached?.dailyGenerations ?? 0) + 1,
      lastGeneratedAt: generatedAt,
      feedbackScore: null,
      tokensUsed: generateResult.tokensUsed,
      // goalAtCalculation is deprecated — canonical value lives in progressIntelligence.goalAtCalculation
      goalAtCalculation: context.userGoal,
      intelligenceVersion: PROGRESS_INTELLIGENCE_VERSION,
    };

    let persisted = false;
    try {
      await insightRepo.upsert(doc);
      persisted = true;
    } catch (err) {
      logEvent(ctx, 'warn', 'ai.daily-insight.cache_write_failed', {
        userId,
        date,
        errorClass: err instanceof Error ? err.name : 'unknown',
      });
    }

    // Track quota usage AFTER successful AI call
    await trackUsage(userContext, 'daily-insight');

    return {
      status: 200,
      jsonBody: persisted ? fullResponse : { ...fullResponse, feedbackAvailable: false },
    };
  },
);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

app.http('daily-insight', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ai/daily-insight',
  handler: dailyInsightHandler,
});
