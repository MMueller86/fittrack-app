import { createHash } from 'node:crypto';
import type {
  DayMeta,
  Meal,
  ProfileTargets,
  WeeklyEvaluation,
  WeeklyNutritionReviewData,
} from '@fittrack/shared';

import {
  MIN_REGEN_INTERVAL_MS,
  type WeeklyInsightDocument,
} from './repositories/insightRepository';
import type {
  WeeklyInsightPromptContext,
  WeeklyInsightPromptDay,
} from './prompts/weeklyInsightV1';

export const WEEKLY_INSIGHT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

type WeeklyNeutralStatus = 'quota_exceeded' | 'unavailable';

export type WeeklyCacheDecision =
  | { kind: 'generate' }
  | { kind: 'cached'; evaluation: WeeklyEvaluation }
  | { kind: 'neutral'; evaluation: WeeklyEvaluation; replaceCache: boolean };

export interface WeeklyInsightHashInput {
  referenceDate: string;
  days: readonly {
    date: string;
    meals: readonly Meal[];
    dayMeta: DayMeta | null;
  }[];
  profileTargets?: ProfileTargets | null;
}

function canonicalizeInput(input: WeeklyInsightHashInput): unknown {
  return {
    referenceDate: input.referenceDate,
    profileTargets: input.profileTargets
      ? {
          restDayCalories: input.profileTargets.restDay?.calories ?? null,
          trainingDayCalories: input.profileTargets.trainingDay?.calories ?? null,
        }
      : null,
    days: [...input.days]
      .map((day) => ({
        date: day.date,
        meals: [...(day.meals ?? [])]
          .map((meal) => ({
            id: meal.id,
            date: meal.date,
            type: meal.type,
            items: [...(meal.items ?? [])]
              .map((item) => ({
                id: item.id,
                quantity: item.quantity,
                unit: item.unit,
                macros: {
                  calories: item.macros.calories,
                  protein: item.macros.protein,
                  carbs: item.macros.carbs,
                  fat: item.macros.fat,
                  fiber: item.macros.fiber,
                },
              }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        dayMeta: day.dayMeta
          ? {
              dayType: day.dayMeta.dayType ?? null,
              workoutType: day.dayMeta.workoutType ?? null,
              calorieTargetSnapshot: day.dayMeta.calorieTargetSnapshot ?? null,
              specialActivity: day.dayMeta.specialActivity ?? null,
            }
          : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Hashes all server-owned weekly inputs that can affect the AI evaluation. */
export function computeWeeklyInputHash(
  input: WeeklyInsightHashInput,
  promptVersion: string,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ promptVersion, input: canonicalizeInput(input) }))
    .digest('hex');
}

function toPromptDay(day: WeeklyNutritionReviewData['days'][number]): WeeklyInsightPromptDay {
  return {
    date: day.date,
    consumedCalories: day.consumedCalories,
    baseTargetCalories: day.baseTargetCalories,
    effectiveTargetCalories: day.effectiveTargetCalories,
    activityBonusCalories: day.activityBonusCalories,
    targetPercent: day.targetPercent,
    dayType: day.dayType,
    activity: day.activity,
    hasNutritionData: day.hasMealItem,
  };
}

/** Reduces the review to aggregate values safe for the weekly prompt. */
export function buildWeeklyInsightPromptContext(
  review: WeeklyNutritionReviewData,
): WeeklyInsightPromptContext {
  return {
    periodStart: review.periodStart,
    periodEnd: review.periodEnd,
    days: review.days.map(toPromptDay),
    totals: review.totals,
  };
}

function isRecentAttempt(cached: WeeklyInsightDocument, now: Date): boolean {
  const lastAttempt = Date.parse(cached.lastAttemptAt);
  return Number.isFinite(lastAttempt) && now.getTime() - lastAttempt < MIN_REGEN_INTERVAL_MS;
}

function neutralEvaluation(status: WeeklyNeutralStatus): WeeklyEvaluation {
  return { status, text: null, generatedAt: null };
}

/**
 * Decides whether a weekly cache entry can be returned, replaced neutrally,
 * or regenerated. A changed hash never returns the previous text.
 */
export function decideWeeklyCache(
  cached: WeeklyInsightDocument | null,
  inputHash: string,
  now: Date,
  isAdmin: boolean,
): WeeklyCacheDecision {
  if (!cached) return { kind: 'generate' };

  const recent = !isAdmin && isRecentAttempt(cached, now);
  if (cached.inputHash !== inputHash) {
    if (recent) {
      return {
        kind: 'neutral',
        evaluation: neutralEvaluation('unavailable'),
        replaceCache: true,
      };
    }
    return { kind: 'generate' };
  }

  if (cached.status === 'fresh' && cached.response.text != null) {
    return {
      kind: 'cached',
      evaluation: {
        status: 'cached',
        text: cached.response.text,
        generatedAt: cached.generatedAt,
      },
    };
  }

  if (recent) {
    const status = cached.status === 'quota_exceeded' ? 'quota_exceeded' : 'unavailable';
    return { kind: 'neutral', evaluation: neutralEvaluation(status), replaceCache: false };
  }

  return { kind: 'generate' };
}

export function getWeeklyInsightTtl(now: Date): { ttl: number; expiresAt: string } {
  const ttl = WEEKLY_INSIGHT_CACHE_TTL_SECONDS;
  return {
    ttl,
    expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
  };
}