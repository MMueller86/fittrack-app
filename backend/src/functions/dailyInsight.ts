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
import { generateDailyInsight, DAILY_INSIGHT_PROMPT_VERSION } from '../lib/openai';
import {
  getInsightRepository,
  computeInputHash,
  shouldRegenerate,
  computeTtlUntilMidnight,
} from '../lib/repositories/insightRepository';
import { getDiaryRepository } from '../lib/repositories/diaryRepository';
import { getWeightsRepository } from '../lib/repositories/weightsRepository';
import { getProfileRepository } from '../lib/repositories/profileRepository';
import { getDayMetaRepository } from '../lib/repositories/dayMetaRepository';
import { getAiUsageRepository } from '../lib/repositories/aiUsageRepository';
import { getLimit, getCurrentPeriod } from '../lib/quotaConfig';
import type {
  InsightDocument,
  InsightInputContext,
  InsightNutritionDay,
  InsightResponse,
  InsightWeightContext,
} from '@fittrack/shared';

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
};

const UNAVAILABLE_RESPONSE: InsightResponse = {
  title: 'Analyse nicht verfügbar',
  summary:
    'Sobald wieder eine Verbindung besteht, aktualisiere ich deine persönliche Analyse automatisch.',
  generatedAt: new Date().toISOString(),
  promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
  status: 'unavailable',
};

// ---------------------------------------------------------------------------
// Context builder helpers
// ---------------------------------------------------------------------------

function computeWeightTrend7d(values: number[]): InsightWeightContext['trend7d'] {
  if (values.length < 3) return null;
  // Compare average of oldest 3 vs newest 3
  const recent = values.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
  const older = values.slice(-3).reduce((s, v) => s + v, 0) / 3;
  const diff = recent - older;
  if (diff > 0.3) return 'gaining';
  if (diff < -0.3) return 'losing';
  return 'stable';
}

async function buildInputContext(
  userId: string,
  date: string,
): Promise<InsightInputContext> {
  const diaryRepo = getDiaryRepository();
  const weightsRepo = getWeightsRepository();
  const profileRepo = getProfileRepository();
  const dayMetaRepo = getDayMetaRepository();

  // Load in parallel
  const [dayMeta, diaryToday, weightEntries, profile] = await Promise.all([
    dayMetaRepo.get(userId, date),
    diaryRepo.getDay(userId, date),
    weightsRepo.list(userId),
    profileRepo.get(userId),
  ]);

  // Last 3 completed diary days (excluding today)
  const last3Days: InsightNutritionDay[] = [];
  const today = new Date(date + 'T00:00:00Z');
  for (let i = 1; i <= 3; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split('T')[0]!;
    try {
      const day = await diaryRepo.getDay(userId, dateStr);
      if (day.summary.calories > 0) {
        last3Days.push({
          date: dateStr,
          calories: Math.round(day.summary.calories),
          protein: Math.round(day.summary.protein),
        });
      }
    } catch {
      // Missing diary day is not an error — just skip
    }
  }

  // Weight context
  const last7Values = weightEntries.slice(0, 7).map((e) => e.value);

  // Nutrition targets from profile
  const targets = profile?.targets
    ? dayMeta?.dayType === 'training'
      ? profile.targets.trainingDay
      : profile.targets.restDay
    : null;

  const context: InsightInputContext = {
    date,
    dayType: dayMeta?.dayType ?? null,
    workoutType: dayMeta?.workoutType ?? null,
    weight: {
      latestKg: last7Values[0] ?? null,
      previousKg: last7Values[1] ?? null,
      targetKg: profile?.targetWeightKg ?? null,
      trend7d: computeWeightTrend7d(last7Values),
      last7Values,
    },
    nutrition: {
      today:
        diaryToday.summary.calories > 0
          ? {
              calories: Math.round(diaryToday.summary.calories),
              protein: Math.round(diaryToday.summary.protein),
              carbs: Math.round(diaryToday.summary.carbs),
              fat: Math.round(diaryToday.summary.fat),
              fiber: Math.round(diaryToday.summary.fiber),
            }
          : null,
      targets: targets
        ? {
            calories: targets.calories,
            proteinG: targets.proteinG,
            carbsG: targets.carbsG,
            fatG: targets.fatG,
            fiberG: targets.fiberG,
          }
        : null,
      last3Days,
    },
  };

  return context;
}

// ---------------------------------------------------------------------------
// Handler — exported for tests
// ---------------------------------------------------------------------------

export const dailyInsightHandler = withHandler(
  'ai.daily-insight',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);
    const { userId, tier, isAdmin } = userContext;

    // Determine target date (default: today UTC)
    const url = new URL(request.url);
    const rawDate = url.searchParams.get('date');
    const date =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : new Date().toISOString().split('T')[0]!;

    const insightRepo = getInsightRepository();
    const now = new Date();

    // Load cached document
    const cached = await insightRepo.get(userId, date);

    // Build current input context + hash
    const context = await buildInputContext(userId, date);
    const newHash = computeInputHash(context);

    // Check whether we can/should regenerate
    const regen = shouldRegenerate(cached, newHash, now, isAdmin);

    if (!regen && cached) {
      // Return from cache
      return {
        status: 200,
        jsonBody: { ...cached.response, status: 'cached' } satisfies InsightResponse,
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
      generateResult = await generateDailyInsight(context);
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
    };

    // Persist to Cosmos
    const doc: InsightDocument = {
      id: `${userId}:${date}`,
      userId,
      date,
      generatedAt,
      expiresAt: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      ).toISOString(),
      ttl: computeTtlUntilMidnight(now),
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
      model: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini',
      inputHash: newHash,
      inputContext: context,
      response: fullResponse,
      dailyGenerations: (cached?.dailyGenerations ?? 0) + 1,
      lastGeneratedAt: generatedAt,
      feedbackScore: null,
      tokensUsed: generateResult.tokensUsed,
    };

    try {
      await insightRepo.upsert(doc);
    } catch (err) {
      // Storage failure is non-fatal — still return the response
      console.error('[daily-insight] Failed to persist insight document:', err);
    }

    // Track quota usage AFTER successful AI call
    await trackUsage(userContext, 'daily-insight');

    return {
      status: 200,
      jsonBody: fullResponse,
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
