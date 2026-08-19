import type {
  CalorieTargetSnapshot,
  DayType,
  Meal,
  SpecialActivity,
  WorkoutType,
} from './diary';
import type { ProfileTargets } from './nutrition';

export const WEEKLY_TARGET_MIN_PERCENT = 95;
export const WEEKLY_TARGET_MAX_PERCENT = 105;

export type WeeklyTargetBand = 'in_range' | 'outside_range';

export type WeeklyDayDataStatus =
  | 'available'
  | 'missing_nutrition'
  | 'missing_target'
  | 'missing_nutrition_and_target';

export type WeeklyTargetSource =
  | 'day_target_snapshot'
  | 'special_activity_snapshot'
  | 'profile_fallback'
  | 'unavailable';

export interface WeeklyActivityLabel {
  type: 'hiking' | 'cycling';
  label: string;
}

export interface WeeklyConsumedMacros {
  protein: number;
  carbs: number;
  fat: number;
}

export interface WeeklyNutritionDay {
  date: string;
  consumedCalories: number | null;
  consumedMacros: WeeklyConsumedMacros | null;
  baseTargetCalories: number | null;
  effectiveTargetCalories: number | null;
  activityBonusCalories: number | null;
  targetPercent: number | null;
  targetBand: WeeklyTargetBand | null;
  dataStatus: WeeklyDayDataStatus;
  targetSource: WeeklyTargetSource;
  dayType: DayType | null;
  workoutType: WorkoutType | null;
  activity: WeeklyActivityLabel | null;
  hasMealItem: boolean;
  mealItemCount: number;
}

export interface WeeklyNutritionTotals {
  includedDayCount: number;
  totalConsumedCalories: number | null;
  totalTargetCalories: number | null;
  averageConsumedCalories: number | null;
  averageTargetCalories: number | null;
  overallTargetPercent: number | null;
}

export type WeeklyEvaluationStatus =
  | 'fresh'
  | 'cached'
  | 'quota_exceeded'
  | 'unavailable';

export interface WeeklyEvaluation {
  status: WeeklyEvaluationStatus;
  text: string | null;
  generatedAt: string | null;
}

export interface WeeklyNutritionReviewData {
  referenceDate: string;
  periodStart: string;
  periodEnd: string;
  days: WeeklyNutritionDay[];
  totals: WeeklyNutritionTotals;
}

export interface WeeklyNutritionReviewResponse extends WeeklyNutritionReviewData {
  evaluation: WeeklyEvaluation;
}

export interface WeeklyNutritionMealInput {
  items?: Meal['items'] | null;
}

export interface WeeklyNutritionDayMetaInput {
  dayType?: DayType | null;
  workoutType?: WorkoutType | null;
  specialActivity?: SpecialActivity | null;
  calorieTargetSnapshot?: CalorieTargetSnapshot | null;
}

export interface WeeklyNutritionDayInput {
  date: string;
  meals?: readonly WeeklyNutritionMealInput[] | null;
  dayMeta?: WeeklyNutritionDayMetaInput | null;
}

export interface WeeklyNutritionCalculationInput {
  referenceDate: string;
  days: readonly WeeklyNutritionDayInput[];
  profileTargets?: ProfileTargets | null;
}