import type {
  ActivityCompletionStatus,
  ActivityStatusSource,
  DayMeta,
  InsightInputContext,
  InsightNutritionDay,
  InsightWeightContext,
  Meal,
  SpecialActivity,
} from '@fittrack/shared';
import {
  hasExplicitDayContext,
  resolveHistoricalTarget,
} from '../../../shared/lib/weeklyReviewCalculator';
import {
  calculateWeightTrendPerWeek,
  classifyWeightTrend,
} from '../../../shared/lib/weightTrend';
import { computeProgressIntelligence } from './progressIntelligence';
import { getDiaryRepository, type DiaryRepository, type DiaryDayResult } from './repositories/diaryRepository';
import { getDayMetaRepository, type DayMetaRepository } from './repositories/dayMetaRepository';
import {
  getInsightRepository,
  isCurrentDayForOffset,
  normalizeTimezoneOffsetMinutes,
  type InsightRepository,
} from './repositories/insightRepository';
import { getProfileRepository, type ProfileRepository } from './repositories/profileRepository';
import { getWeightsRepository, type WeightsRepository } from './repositories/weightsRepository';

export interface ActivityCompletionResolution {
  status: ActivityCompletionStatus | null;
  source: ActivityStatusSource | null;
}

export interface DailyInsightContextRepositories {
  diary: Pick<DiaryRepository, 'getDay'>;
  dayMeta: Pick<DayMetaRepository, 'get'>;
  insight: Pick<InsightRepository, 'listRecent'>;
  profile: Pick<ProfileRepository, 'get'>;
  weights: Pick<WeightsRepository, 'list'>;
}

export interface BuildDailyInsightContextInput {
  userId: string;
  date: string;
  localHour?: number | null;
  insightRepository?: Pick<InsightRepository, 'listRecent'>;
  repositories?: Partial<DailyInsightContextRepositories>;
  now?: Date;
  timezoneOffsetMinutes?: number | null;
  isCurrentDay?: boolean;
}

/** Derives activity completion without turning an invalid client hour into a fact. */
export function resolveActivityCompletionStatus(
  activity: SpecialActivity | null | undefined,
  localHour: number | null | undefined,
  isCurrentDay = true,
): ActivityCompletionResolution {
  if (activity == null) {
    return { status: null, source: null };
  }

  if (
    !isCurrentDay ||
    localHour == null ||
    !Number.isInteger(localHour) ||
    localHour < 0 ||
    localHour > 23
  ) {
    return { status: 'unknown', source: 'unavailable' };
  }

  return {
    status: localHour < 20 ? 'planned' : 'likely_completed',
    source: 'local_time_heuristic',
  };
}

/** Scalar convenience for callers that only need the status value. */
export function getActivityCompletionStatus(
  activity: SpecialActivity | null | undefined,
  localHour: number | null | undefined,
  isCurrentDay = true,
): ActivityCompletionStatus | null {
  return resolveActivityCompletionStatus(activity, localHour, isCurrentDay).status;
}

export function hasMealItem(meals: readonly Meal[]): boolean {
  return meals.some((meal) => (meal.items ?? []).length > 0);
}

function countMealItems(meals: readonly Meal[]): number {
  return meals.reduce((count, meal) => count + (meal.items ?? []).length, 0);
}

function getPreviousDate(date: string, daysAgo: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - daysAgo);
  return value.toISOString().slice(0, 10);
}

function getDefaultRepositories(
  input: BuildDailyInsightContextInput,
): DailyInsightContextRepositories {
  return {
    diary: input.repositories?.diary ?? getDiaryRepository(),
    dayMeta: input.repositories?.dayMeta ?? getDayMetaRepository(),
    insight: input.repositories?.insight ?? input.insightRepository ?? getInsightRepository(),
    profile: input.repositories?.profile ?? getProfileRepository(),
    weights: input.repositories?.weights ?? getWeightsRepository(),
  };
}

function toDayMetaInput(dayMeta: DayMeta | null) {
  if (dayMeta == null) return null;
  return {
    dayType: dayMeta.dayType,
    workoutType: dayMeta.workoutType ?? null,
    specialActivity: dayMeta.specialActivity ?? null,
    calorieTargetSnapshot: dayMeta.calorieTargetSnapshot ?? null,
  };
}

function toHistoricalNutritionDay(
  date: string,
  diary: DiaryDayResult,
  dayMeta: DayMeta | null,
  profileTargets: Parameters<typeof resolveHistoricalTarget>[1],
): InsightNutritionDay {
  const mealItemCount = countMealItems(diary.meals);
  const mealStats = resolveHistoricalTarget(toDayMetaInput(dayMeta), profileTargets);
  const explicitDayContext = hasExplicitDayContext(toDayMetaInput(dayMeta));

  return {
    date,
    calories: mealItemCount > 0 ? diary.summary.calories : null,
    protein: mealItemCount > 0 ? diary.summary.protein : null,
    carbs: mealItemCount > 0 ? diary.summary.carbs : null,
    fat: mealItemCount > 0 ? diary.summary.fat : null,
    hasMealItem: mealItemCount > 0,
    mealItemCount,
    baseTargetCalories: mealStats.baseTargetCalories,
    effectiveTargetCalories: mealStats.effectiveTargetCalories,
    activityBonusCalories: mealStats.activityBonusCalories,
    targetSource: mealStats.targetSource,
    dayType: explicitDayContext ? dayMeta?.dayType ?? null : null,
    workoutType: explicitDayContext ? dayMeta?.workoutType ?? null : null,
    specialActivity: dayMeta?.specialActivity ?? null,
  };
}

function isOutlier(candidate: number, values: number[]): boolean {
  if (values.length < 3) return false;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  if (standardDeviation < 0.01) return false;
  return Math.abs(candidate - mean) > 1.5 * standardDeviation;
}

export async function buildDailyInsightContext(
  input: BuildDailyInsightContextInput,
): Promise<InsightInputContext> {
  const repositories = getDefaultRepositories(input);
  const now = input.now ?? new Date();
  const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(input.timezoneOffsetMinutes);
  const isCurrentDay = timezoneOffsetMinutes == null
    ? false
    : input.isCurrentDay ?? isCurrentDayForOffset(input.date, now, timezoneOffsetMinutes);
  const localHour = input.localHour ?? null;

  const [dayMeta, diaryToday, weightEntries, profile, insightHistory] = await Promise.all([
    repositories.dayMeta.get(input.userId, input.date),
    repositories.diary.getDay(input.userId, input.date),
    repositories.weights.list(input.userId),
    repositories.profile.get(input.userId),
    repositories.insight.listRecent(input.userId, 7, input.date),
  ]);

  const historicalDays = [1, 2, 3].map((daysAgo) => getPreviousDate(input.date, daysAgo));
  const last3Days = await Promise.all(
    historicalDays.map(async (date) => {
      const [diary, historicalDayMeta] = await Promise.all([
        repositories.diary.getDay(input.userId, date),
        repositories.dayMeta.get(input.userId, date),
      ]);
      return toHistoricalNutritionDay(date, diary, historicalDayMeta, profile?.targets ?? null);
    }),
  );

  const last7Values = weightEntries.slice(0, 7).map((entry) => entry.value);
  const trendReferenceDate = new Date(`${input.date}T12:00:00.000Z`);
  const weeklyTrend30d = classifyWeightTrend(calculateWeightTrendPerWeek(
    weightEntries,
    'kg',
    trendReferenceDate,
  ));
  const lastWeightDate = weightEntries[0]?.date ?? null;
  const daysSinceLastMeasurement = lastWeightDate == null
    ? null
    : Math.floor(
        (new Date(input.date + 'T00:00:00Z').getTime() - new Date(lastWeightDate + 'T00:00:00Z').getTime())
        / (1000 * 60 * 60 * 24),
      );
  const isWeightStale = daysSinceLastMeasurement !== null && daysSinceLastMeasurement > 14;
  const hasTodayMealItem = hasMealItem(diaryToday.meals);
  const currentTarget = resolveHistoricalTarget(toDayMetaInput(dayMeta), profile?.targets ?? null);
  const activityStatus = resolveActivityCompletionStatus(
    dayMeta?.specialActivity,
    localHour,
    isCurrentDay,
  );

  const selectedProfileTarget = profile?.targets
    ? dayMeta?.dayType === 'training' ? profile.targets.trainingDay : profile.targets.restDay
    : null;
  const targets = selectedProfileTarget && currentTarget.effectiveTargetCalories != null
    ? {
        calories: currentTarget.effectiveTargetCalories,
        proteinG: selectedProfileTarget.proteinG,
        carbsG: selectedProfileTarget.carbsG,
        fatG: selectedProfileTarget.fatG,
        fiberG: selectedProfileTarget.fiberG,
        baseCalories: currentTarget.baseTargetCalories,
        activityBonusCalories: currentTarget.activityBonusCalories,
        targetSource: currentTarget.targetSource,
      }
    : null;

  const today = hasTodayMealItem
    ? {
        calories: Math.round(diaryToday.summary.calories),
        protein: Math.round(diaryToday.summary.protein),
        carbs: Math.round(diaryToday.summary.carbs),
        fat: Math.round(diaryToday.summary.fat),
        fiber: Math.round(diaryToday.summary.fiber),
        hasMealItem: true,
      }
    : null;
  const remainingCalories = targets && today
    ? Math.round(targets.calories - today.calories)
    : null;
  const remainingProteinG = targets && today
    ? Math.max(0, Math.round(targets.proteinG - today.protein))
    : null;

  return {
    date: input.date,
    dayType: dayMeta?.dayType ?? null,
    workoutType: dayMeta?.workoutType ?? null,
    weight: {
      latestKg: isWeightStale ? null : (last7Values[0] ?? null),
      previousKg: isWeightStale ? null : (last7Values[1] ?? null),
      targetKg: profile?.targetWeightKg ?? null,
      weeklyTrend30d: isWeightStale ? null : weeklyTrend30d,
      last7Values: isWeightStale ? [] : last7Values,
      isOutlierPrevious: isWeightStale || last7Values[1] == null
        ? false
        : isOutlier(last7Values[1], last7Values),
      isOutlierLatest: isWeightStale || last7Values[0] == null
        ? false
        : isOutlier(last7Values[0], last7Values),
      daysSinceLastMeasurement,
      lastMeasurementDate: lastWeightDate,
    },
    nutrition: {
      today,
      targets,
      remainingCalories,
      remainingProteinG,
      last3Days,
    },
    userGoal: profile?.goal ?? 'maintain',
    userGoalIntensity: profile?.goalIntensity ?? null,
    displayName: profile?.displayName ?? 'Sportler',
    progressIntelligence: computeProgressIntelligence({
      entries: weightEntries,
      targetWeightKg: profile?.targetWeightKg,
      goal: profile?.goal ?? 'maintain',
      todayIso: input.date,
      unit: (weightEntries[0]?.unit ?? 'kg') as 'kg' | 'lbs',
      hasWeightToday: weightEntries.some((entry) => entry.date === input.date),
      hasMealsToday: hasTodayMealItem,
      isTrainingDay: dayMeta?.dayType === 'training',
      hasTrainingLogged: dayMeta?.workoutType != null,
      insightHistory,
    }),
    currentHourLocal: localHour,
    timezoneOffsetMinutes,
    specialActivity: dayMeta?.specialActivity ?? null,
    activityCompletionStatus: activityStatus.status,
    activityStatusSource: activityStatus.source,
  };
}

export const buildInputContext = buildDailyInsightContext;