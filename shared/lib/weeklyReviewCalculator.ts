import type { MealItem } from '../types/diary';
import type {
  WeeklyActivityLabel,
  WeeklyConsumedMacros,
  WeeklyDayDataStatus,
  WeeklyNutritionCalculationInput,
  WeeklyNutritionDay,
  WeeklyNutritionDayInput,
  WeeklyNutritionMealInput,
  WeeklyNutritionReviewData,
  WeeklyNutritionTotals,
  WeeklyTargetBand,
  WeeklyTargetSource,
} from '../types/weeklyReview';
import {
  WEEKLY_TARGET_MAX_PERCENT,
  WEEKLY_TARGET_MIN_PERCENT,
} from '../types/weeklyReview';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ResolvedWeeklyTarget {
  baseTargetCalories: number | null;
  effectiveTargetCalories: number | null;
  activityBonusCalories: number | null;
  targetSource: WeeklyTargetSource;
  activity: WeeklyActivityLabel | null;
}

/** Returns true only for a finite, strictly positive calorie target. */
function isValidTarget(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function isValidActivityBonus(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

function parseDateOnly(value: string): Date {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }

  const date = new Date(`${value}T00:00:00Z`);
  const [year, month, day] = value.split('-').map(Number);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDateOnly(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

export function getWeeklyReviewPeriod(referenceDate: string): {
  periodStart: string;
  periodEnd: string;
  dates: string[];
} {
  parseDateOnly(referenceDate);
  const dates = Array.from({ length: 7 }, (_, index) => shiftDateOnly(referenceDate, index - 7));
  return {
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    dates,
  };
}

function getActivityLabel(type: 'hiking' | 'cycling'): WeeklyActivityLabel {
  return type === 'cycling'
    ? { type, label: 'Radtour' }
    : { type, label: 'Wanderung' };
}

export function resolveWeeklyTarget(
  day: WeeklyNutritionDayInput['dayMeta'],
  profileTargets: WeeklyNutritionCalculationInput['profileTargets'],
): ResolvedWeeklyTarget {
  const activity = day?.specialActivity;
  const activityLabel = activity && (activity.type === 'hiking' || activity.type === 'cycling')
    ? getActivityLabel(activity.type)
    : null;

  const snapshotTarget = day?.calorieTargetSnapshot?.calories;
  const activitySnapshotTarget = activity?.dailyCalorieTarget;

  let baseTargetCalories: number | null = null;
  let targetSource: WeeklyTargetSource = 'unavailable';
  if (isValidTarget(snapshotTarget)) {
    baseTargetCalories = snapshotTarget;
    targetSource = 'day_target_snapshot';
  } else if (isValidTarget(activitySnapshotTarget)) {
    baseTargetCalories = activitySnapshotTarget;
    targetSource = 'special_activity_snapshot';
  } else if (activity == null) {
    const profileTarget = day?.dayType === 'training'
      ? profileTargets?.trainingDay?.calories
      : profileTargets?.restDay?.calories;
    if (isValidTarget(profileTarget)) {
      baseTargetCalories = profileTarget;
      targetSource = 'profile_fallback';
    }
  }

  const activityBonusCalories = activity == null
    ? 0
    : isValidActivityBonus(activity.activityBonus)
      ? activity.activityBonus
      : null;
  const effectiveTargetCalories =
    baseTargetCalories != null && activityBonusCalories != null
      ? baseTargetCalories + activityBonusCalories
      : null;

  return {
    baseTargetCalories,
    effectiveTargetCalories,
    activityBonusCalories,
    targetSource,
    activity: activityLabel,
  };
}

export function hasExplicitDayContext(day: WeeklyNutritionDayInput['dayMeta']): boolean {
  if (day?.dayType == null) return false;
  return day.specialActivity == null || day.dayType === 'training' || day.workoutType != null;
}

/** Shared alias for non-weekly consumers that resolve a historical day target. */
export const resolveHistoricalTarget = resolveWeeklyTarget;

function getMealStats(meals: readonly WeeklyNutritionMealInput[]): {
  hasMealItem: boolean;
  mealItemCount: number;
  consumedCalories: number | null;
  consumedMacros: WeeklyConsumedMacros | null;
} {
  let mealItemCount = 0;
  let consumedCalories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const meal of meals) {
    const items = meal?.items ?? [];
    mealItemCount += items.length;
    for (const item of items) {
      const macros = (item as MealItem).macros;
      consumedCalories += macros.calories;
      protein += macros.protein;
      carbs += macros.carbs;
      fat += macros.fat;
    }
  }

  return {
    hasMealItem: mealItemCount > 0,
    mealItemCount,
    consumedCalories: mealItemCount > 0 ? consumedCalories : null,
    consumedMacros: mealItemCount > 0 ? { protein, carbs, fat } : null,
  };
}

export function getWeeklyTargetBand(targetPercent: number | null): WeeklyTargetBand | null {
  if (targetPercent == null || !Number.isFinite(targetPercent)) return null;
  return targetPercent >= WEEKLY_TARGET_MIN_PERCENT && targetPercent <= WEEKLY_TARGET_MAX_PERCENT
    ? 'in_range'
    : 'outside_range';
}

function getDataStatus(hasMealItem: boolean, hasTarget: boolean): WeeklyDayDataStatus {
  if (hasMealItem && hasTarget) return 'available';
  if (hasMealItem) return 'missing_target';
  if (hasTarget) return 'missing_nutrition';
  return 'missing_nutrition_and_target';
}

function calculateTotals(days: readonly WeeklyNutritionDay[]): WeeklyNutritionTotals {
  const includedDays = days.filter(
    (day) => day.hasMealItem && day.effectiveTargetCalories != null && day.effectiveTargetCalories > 0,
  );
  if (includedDays.length === 0) {
    return {
      includedDayCount: 0,
      totalConsumedCalories: null,
      totalTargetCalories: null,
      averageConsumedCalories: null,
      averageTargetCalories: null,
      overallTargetPercent: null,
    };
  }

  const totalConsumedCalories = includedDays.reduce(
    (sum, day) => sum + (day.consumedCalories ?? 0),
    0,
  );
  const totalTargetCalories = includedDays.reduce(
    (sum, day) => sum + day.effectiveTargetCalories!,
    0,
  );

  return {
    includedDayCount: includedDays.length,
    totalConsumedCalories,
    totalTargetCalories,
    averageConsumedCalories: totalConsumedCalories / includedDays.length,
    averageTargetCalories: totalTargetCalories / includedDays.length,
    overallTargetPercent: totalTargetCalories > 0
      ? (totalConsumedCalories / totalTargetCalories) * 100
      : null,
  };
}

export function calculateWeeklyNutritionReview(
  input: WeeklyNutritionCalculationInput,
): WeeklyNutritionReviewData {
  const { periodStart, periodEnd, dates } = getWeeklyReviewPeriod(input.referenceDate);
  const inputByDate = new Map(input.days.map((day) => [day.date, day]));

  const days: WeeklyNutritionDay[] = dates.map((date) => {
    const source = inputByDate.get(date);
    const meals = source?.meals ?? [];
    const mealStats = getMealStats(meals);
    const target = resolveWeeklyTarget(source?.dayMeta, input.profileTargets);
    const hasDayContext = hasExplicitDayContext(source?.dayMeta);
    const targetPercent =
      mealStats.consumedCalories != null &&
      target.effectiveTargetCalories != null &&
      target.effectiveTargetCalories > 0
        ? (mealStats.consumedCalories / target.effectiveTargetCalories) * 100
        : null;

    return {
      date,
      consumedCalories: mealStats.consumedCalories,
      consumedMacros: mealStats.consumedMacros,
      baseTargetCalories: target.baseTargetCalories,
      effectiveTargetCalories: target.effectiveTargetCalories,
      activityBonusCalories: target.activityBonusCalories,
      targetPercent,
      targetBand: getWeeklyTargetBand(targetPercent),
      dataStatus: getDataStatus(
        mealStats.hasMealItem,
        target.effectiveTargetCalories != null && target.effectiveTargetCalories > 0,
      ),
      targetSource: target.targetSource,
      dayType: hasDayContext ? source!.dayMeta!.dayType! : null,
      workoutType: hasDayContext ? source!.dayMeta!.workoutType ?? null : null,
      activity: target.activity,
      hasMealItem: mealStats.hasMealItem,
      mealItemCount: mealStats.mealItemCount,
    };
  });

  return {
    referenceDate: input.referenceDate,
    periodStart,
    periodEnd,
    days,
    totals: calculateTotals(days),
  };
}

export const calculateWeeklyReview = calculateWeeklyNutritionReview;