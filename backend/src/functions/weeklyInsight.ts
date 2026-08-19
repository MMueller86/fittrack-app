import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';

import { requireUser } from '../lib/auth';
import { withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { enforceQuota, trackUsage } from '../lib/quota';
import {
  generateWeeklyInsight,
  WEEKLY_INSIGHT_PROMPT_VERSION,
} from '../lib/openai';
import {
  buildWeeklyInsightPromptContext,
  computeWeeklyInputHash,
  decideWeeklyCache,
  getWeeklyInsightTtl,
} from '../lib/weeklyInsight';
import {
  getWeeklyReviewPeriod,
  calculateWeeklyNutritionReview,
} from '../../../shared/lib/weeklyReviewCalculator';
import {
  getInsightRepository,
  makeWeeklyInsightId,
  type WeeklyInsightDocument,
} from '../lib/repositories/insightRepository';
import { getDiaryRepository } from '../lib/repositories/diaryRepository';
import { getDayMetaRepository } from '../lib/repositories/dayMetaRepository';
import { getProfileRepository } from '../lib/repositories/profileRepository';
import type {
  WeeklyEvaluation,
  WeeklyNutritionCalculationInput,
  WeeklyNutritionReviewResponse,
} from '@fittrack/shared';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidReferenceDate(value: string | null): value is string {
  if (value == null || !ISO_DATE_PATTERN.test(value)) return false;
  try {
    getWeeklyReviewPeriod(value);
    return true;
  } catch {
    return false;
  }
}

function responseWithEvaluation(
  review: ReturnType<typeof calculateWeeklyNutritionReview>,
  evaluation: WeeklyEvaluation,
): WeeklyNutritionReviewResponse {
  return { ...review, evaluation };
}

function makeWeeklyDocument(
  userId: string,
  review: ReturnType<typeof calculateWeeklyNutritionReview>,
  inputHash: string,
  evaluation: WeeklyEvaluation,
  lastAttemptAt: string,
  tokensUsed: number,
  now: Date,
): WeeklyInsightDocument {
  const { ttl, expiresAt } = getWeeklyInsightTtl(now);
  const storedStatus = evaluation.status === 'cached' ? 'unavailable' : evaluation.status;
  return {
    id: makeWeeklyInsightId(userId, review.periodEnd),
    userId,
    _docType: 'weeklyInsight',
    referenceDate: review.referenceDate,
    periodStart: review.periodStart,
    periodEnd: review.periodEnd,
    inputHash,
    promptVersion: WEEKLY_INSIGHT_PROMPT_VERSION,
    model: process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini',
    response: {
      status: storedStatus,
      text: evaluation.text,
      generatedAt: evaluation.generatedAt,
    },
    status: storedStatus,
    generatedAt: evaluation.generatedAt,
    lastAttemptAt,
    expiresAt,
    ttl,
    tokensUsed,
  };
}

async function persistWeeklyDocument(
  repo: ReturnType<typeof getInsightRepository>,
  document: WeeklyInsightDocument,
  ctx: InvocationContext,
): Promise<void> {
  try {
    await repo.upsertWeekly(document);
  } catch {
    // Cache writes are non-critical; never turn a usable weekly response into a 500.
    logEvent(ctx, 'warn', 'ai.weekly-insight.cache_write_failed', {
      periodStart: document.periodStart,
      periodEnd: document.periodEnd,
    });
  }
}

export const weeklyInsightHandler = withHandler(
  'ai.weekly-insight',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);
    const rawDate = request.query.get('date');
    if (!isValidReferenceDate(rawDate)) {
      return {
        status: 400,
        jsonBody: { error: 'Query param "date" must be a real YYYY-MM-DD calendar date' },
      };
    }

    const period = getWeeklyReviewPeriod(rawDate);
    const diaryRepo = getDiaryRepository();
    const dayMetaRepo = getDayMetaRepository();
    const [profile, days] = await Promise.all([
      getProfileRepository().get(userContext.userId),
      Promise.all(
        period.dates.map(async (date) => {
          const [diary, dayMeta] = await Promise.all([
            diaryRepo.getDay(userContext.userId, date),
            dayMetaRepo.get(userContext.userId, date),
          ]);
          return { date, meals: diary.meals, dayMeta };
        }),
      ),
    ]);

    const calculationInput: WeeklyNutritionCalculationInput = {
      referenceDate: rawDate,
      days,
      profileTargets: profile?.targets ?? null,
    };
    const review = calculateWeeklyNutritionReview(calculationInput);
    const promptContext = buildWeeklyInsightPromptContext(review);
    const inputHash = computeWeeklyInputHash(
      { referenceDate: rawDate, days, profileTargets: profile?.targets ?? null },
      WEEKLY_INSIGHT_PROMPT_VERSION,
    );
    const insightRepo = getInsightRepository();
    const now = new Date();
    const cached = await insightRepo.getWeekly(userContext.userId, review.periodEnd);
    const decision = decideWeeklyCache(cached, inputHash, now, userContext.isAdmin);

    logEvent(ctx, 'info', 'ai.weekly-insight.assembled', {
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      loadedDayCount: review.days.length,
      includedDayCount: review.totals.includedDayCount,
      cacheStatus: decision.kind,
    });

    if (decision.kind === 'cached') {
      return {
        status: 200,
        jsonBody: responseWithEvaluation(review, decision.evaluation),
      };
    }

    if (decision.kind === 'neutral') {
      if (decision.replaceCache) {
        await persistWeeklyDocument(
          insightRepo,
          makeWeeklyDocument(
            userContext.userId,
            review,
            inputHash,
            decision.evaluation,
            now.toISOString(),
            0,
            now,
          ),
          ctx,
        );
      }
      return {
        status: 200,
        jsonBody: responseWithEvaluation(review, decision.evaluation),
      };
    }

    const quotaResponse = await enforceQuota(userContext, 'daily-insight');
    if (quotaResponse) {
      const evaluation: WeeklyEvaluation = {
        status: 'quota_exceeded',
        text: null,
        generatedAt: null,
      };
      await persistWeeklyDocument(
        insightRepo,
        makeWeeklyDocument(
          userContext.userId,
          review,
          inputHash,
          evaluation,
          now.toISOString(),
          0,
          now,
        ),
        ctx,
      );
      return {
        status: 200,
        jsonBody: responseWithEvaluation(review, evaluation),
      };
    }

    let generated;
    try {
      generated = await generateWeeklyInsight(promptContext);
    } catch {
      const evaluation: WeeklyEvaluation = {
        status: 'unavailable',
        text: null,
        generatedAt: null,
      };
      await persistWeeklyDocument(
        insightRepo,
        makeWeeklyDocument(
          userContext.userId,
          review,
          inputHash,
          evaluation,
          now.toISOString(),
          0,
          now,
        ),
        ctx,
      );
      logEvent(ctx, 'warn', 'ai.weekly-insight.generation_failed', {
        periodStart: review.periodStart,
        periodEnd: review.periodEnd,
        errorClass: 'provider_or_schema',
      });
      return {
        status: 200,
        jsonBody: responseWithEvaluation(review, evaluation),
      };
    }

    const generatedAt = now.toISOString();
    const evaluation: WeeklyEvaluation = {
      status: 'fresh',
      text: generated.text,
      generatedAt,
    };
    await persistWeeklyDocument(
      insightRepo,
      makeWeeklyDocument(
        userContext.userId,
        review,
        inputHash,
        evaluation,
        generatedAt,
        generated.tokensUsed,
        now,
      ),
      ctx,
    );

    // Track only after the provider response passed the server-side schema checks.
    await trackUsage(userContext, 'daily-insight');

    return {
      status: 200,
      jsonBody: responseWithEvaluation(review, evaluation),
    };
  },
);

app.http('weekly-insight', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ai/weekly-insight',
  handler: weeklyInsightHandler,
});