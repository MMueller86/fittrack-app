import type { InsightInputContext, InsightIntent, InsightNutritionDay, MacroRanges } from '@fittrack/shared';

export interface DailyInsightEvalFixture {
  id: string;
  description: string;
  input: InsightInputContext;
  intent: InsightIntent;
  expectNullActionFields?: boolean;
}

// Derived from the approved 80 kg, 2000 kcal, 70 g fat profile-day example.
const BASE_MACRO_RANGES: MacroRanges = {
  proteinG: { minG: 120, maxG: 160 },
  carbsG: { minG: 183, maxG: 223 },
};
const ACTIVITY_PROFILE_DAY_MACRO_RANGES: MacroRanges = {
  proteinG: { minG: 120, maxG: 160 },
  carbsG: { minG: 224, maxG: 264 },
};
const ENDURANCE_PROFILE_DAY_MACRO_RANGES: MacroRanges = {
  proteinG: { minG: 120, maxG: 160 },
  carbsG: { minG: 213, maxG: 253 },
};

const historicalDay: InsightNutritionDay = {
  date: '2026-08-19',
  calories: 1980,
  protein: 145,
  carbs: 210,
  fat: 65,
  hasMealItem: true,
  mealItemCount: 3,
  baseTargetCalories: 2100,
  effectiveTargetCalories: 2100,
  activityBonusCalories: 0,
  targetSource: 'profile_fallback',
  dayType: 'rest',
  workoutType: null,
  specialActivity: null,
};

function baseContext(overrides: Partial<InsightInputContext> = {}): InsightInputContext {
  return {
    date: '2026-08-20',
    dayType: 'rest',
    workoutType: null,
    weight: {
      latestKg: 80,
      previousKg: 80.2,
      targetKg: 78,
      weeklyTrend30d: 'losing',
      last7Values: [80, 80.2, 80.4],
      isOutlierPrevious: false,
      isOutlierLatest: false,
      daysSinceLastMeasurement: 0,
      lastMeasurementDate: '2026-08-20',
    },
    nutrition: {
      today: { calories: 1500, protein: 100, carbs: 150, fat: 50, fiber: 20, hasMealItem: true },
      targets: {
        calories: 2000,
        proteinG: 140,
        carbsG: 220,
        fatG: 70,
        fiberG: 30,
        macroRanges: BASE_MACRO_RANGES,
      },
      remainingCalories: 500,
      dailyInsightProteinStatus: 'below_range',
      mealAdviceAllowed: true,
      last3Days: [historicalDay, { ...historicalDay, date: '2026-08-18' }, { ...historicalDay, date: '2026-08-17' }],
    },
    userGoal: 'lose_weight',
    userGoalIntensity: 'moderate',
    displayName: 'Sportler',
    progressIntelligence: {
      version: 'v1',
      primarySignal: { type: 'daily_context', confidence: 0.5, freshnessScore: 0 },
      contextSignals: [],
      progress: null,
      phase: null,
      plateau: null,
      milestone: null,
      monthlyTrend: null,
      dayCompleteness: 1,
      goalAtCalculation: 'lose_weight',
    },
    currentHourLocal: 18,
    dailyActivityStatus: overrides.specialActivity == null ? null : 'unknown',
    specialActivity: null,
    ...overrides,
  };
}

const hikingActivity = {
  type: 'hiking' as const,
  movementTimeMinutes: 300,
  distanceKm: 24,
  elevationGainM: 1200,
  bodyWeightKg: 80,
  dailyCalorieTarget: 2300,
  calculatedAt: '2026-08-20T08:00:00.000Z',
  estimatedMet: 7,
  activityCalories: 1800,
  alreadyAccountedCalories: 300,
  activityBonus: 1200,
  terrainType: 'alpine' as const,
  packCategory: 'medium' as const,
};

const historicalHikingActivity = {
  ...hikingActivity,
  dailyCalorieTarget: 3200,
  activityBonus: 900,
  calculatedAt: '2026-08-19T20:00:00.000Z',
};

function activityNutrition(
  specialActivity: NonNullable<InsightInputContext['specialActivity']>,
  overrides: Partial<InsightInputContext['nutrition']> = {},
): InsightInputContext['nutrition'] {
  const defaults = baseContext().nutrition;
  const baseTargets = defaults.targets;
  if (baseTargets == null) throw new Error('Activity fixture requires calorie targets');

  const today = overrides.today === undefined ? defaults.today : overrides.today;
  const baseCalories = specialActivity.dailyCalorieTarget;
  const activityBonusCalories = specialActivity.activityBonus;
  const effectiveCalories = baseCalories + activityBonusCalories;

  return {
    ...defaults,
    ...overrides,
    today,
    targets: {
      ...baseTargets,
      ...(overrides.targets ?? {}),
      calories: effectiveCalories,
      baseCalories,
      activityBonusCalories,
      targetSource: 'special_activity_snapshot',
    },
    remainingCalories: today == null ? null : effectiveCalories - today.calories,
  };
}

const currentEffectiveBudgetActivity = {
  ...hikingActivity,
  movementTimeMinutes: 180,
  distanceKm: 16,
  dailyCalorieTarget: 2300,
  activityBonus: 700,
};
const currentEffectiveBudgetNutrition = activityNutrition(currentEffectiveBudgetActivity, {
  today: { calories: 2800, protein: 130, carbs: 340, fat: 80, fiber: 28, hasMealItem: true },
  targets: {
    ...baseContext().nutrition.targets!,
    proteinG: 140,
    carbsG: 360,
    fatG: 85,
    fiberG: 30,
    macroRanges: ACTIVITY_PROFILE_DAY_MACRO_RANGES,
  },
  dailyInsightProteinStatus: 'in_range',
  mealAdviceAllowed: false,
});
const intensiveEnduranceActivity = {
  ...hikingActivity,
  movementTimeMinutes: 360,
  distanceKm: 30,
  elevationGainM: 1600,
  dailyCalorieTarget: 2300,
  activityBonus: 1100,
};
const intensiveEnduranceNutrition = activityNutrition(intensiveEnduranceActivity, {
  today: { calories: 2700, protein: 90, carbs: 280, fat: 75, fiber: 25, hasMealItem: true },
  targets: {
    ...baseContext().nutrition.targets!,
    proteinG: 150,
    carbsG: 420,
    fatG: 90,
    fiberG: 30,
    macroRanges: ENDURANCE_PROFILE_DAY_MACRO_RANGES,
  },
  mealAdviceAllowed: true,
  dailyInsightProteinStatus: 'below_range',
});

export const DAILY_INSIGHT_EVAL_FIXTURES: DailyInsightEvalFixture[] = [
  {
    id: 'personal-neutral-greeting',
    description: 'US-03 AC-1/AC-2: the server name is preserved in a time-neutral greeting and the short sentence agrees with the full text.',
    input: baseContext({ displayName: 'Mia-Luise', currentHourLocal: 22 }),
    intent: 'nutrition_guidance',
  },
  {
    id: 'long-name-neutral-greeting',
    description: 'US-03 AC-1: a long name and emoji fit without truncating the name.',
    input: baseContext({ displayName: 'Alexandra-Christiane Maximiliane von Beispielhausen', currentHourLocal: 12 }),
    intent: 'nutrition_guidance',
  },
  {
    id: 'sparse-data-name-fallback',
    description: 'US-03 AC-2: the existing Sportler fallback and missing nutrition/weight data do not create facts.',
    input: baseContext({
      currentHourLocal: null,
      dayType: null,
      weight: { latestKg: null, previousKg: null, targetKg: null, weeklyTrend30d: null, last7Values: [], isOutlierPrevious: false, isOutlierLatest: false, daysSinceLastMeasurement: null, lastMeasurementDate: null },
      nutrition: { today: null, targets: null, remainingCalories: null, dailyInsightProteinStatus: 'unknown', mealAdviceAllowed: false, last3Days: [] },
    }),
    intent: 'general',
  },
  {
    id: 'phase-progress-open-day',
    description: 'An open target budget is not presented as an achieved energy deficit or a weight-phase explanation.',
    input: baseContext({
      currentHourLocal: 12,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1300, protein: 100, carbs: 130, fat: 45, fiber: 18, hasMealItem: true },
        remainingCalories: 700,
      },
      weight: {
        ...baseContext().weight,
        latestKg: 80.4,
        previousKg: 82,
        weeklyTrend30d: 'losing',
        last7Values: [80.4, 82, 80.8, 80.7, 80.6, 80.5, 80.4],
        isOutlierPrevious: true,
        isOutlierLatest: false,
      },
      progressIntelligence: {
        ...baseContext().progressIntelligence,
        primarySignal: { type: 'phase_context', confidence: 0.9, freshnessScore: 0 },
        phase: { type: 'progressing' },
      },
    }),
    intent: 'phase_progress',
    // AC: open-day target remainder is not an achieved energy balance; use the long-term weight signal.
  },
  {
    id: 'current-effective-activity-budget',
    description: 'An elevated current activity target prevents a high absolute intake from being judged in isolation.',
    input: baseContext({
      currentHourLocal: 22,
      specialActivity: currentEffectiveBudgetActivity,
      dailyActivityStatus: 'completed',
      nutrition: currentEffectiveBudgetNutrition,
    }),
    intent: 'activity_focus',
    // AC-2/AC-3 and KB domain/01: the effective target, not absolute calories, controls the assessment.
  },
  {
    id: 'historical-target-source-priority',
    description: 'Morning orientation uses only today\'s context even when historical targets and activity data exist.',
    input: baseContext({
      currentHourLocal: 8,
      nutrition: {
        ...baseContext().nutrition,
        today: null,
        targets: {
          calories: 2000,
          proteinG: 140,
          carbsG: 220,
          fatG: 70,
          fiberG: 30,
          macroRanges: BASE_MACRO_RANGES,
          baseCalories: 2000,
          activityBonusCalories: 0,
          targetSource: 'profile_fallback',
        },
        remainingCalories: null,
        dailyInsightProteinStatus: 'unknown',
        mealAdviceAllowed: false,
        last3Days: [
          {
            date: '2026-08-19',
            calories: 2100,
            protein: 150,
            carbs: 220,
            fat: 65,
            hasMealItem: true,
            mealItemCount: 3,
            baseTargetCalories: 2250,
            effectiveTargetCalories: 2250,
            activityBonusCalories: 0,
            targetSource: 'day_target_snapshot',
            dayType: 'training',
            workoutType: null,
            specialActivity: {
              ...historicalHikingActivity,
              dailyCalorieTarget: 1400,
              activityBonus: 0,
            },
          },
        ],
      },
    }),
    intent: 'morning_orientation',
  },
  {
    id: 'historical-target-unavailable',
    description: 'Unavailable historical targets are ignored; the empty current day is described without a past-day claim.',
    input: baseContext({
      currentHourLocal: 8,
      nutrition: {
        ...baseContext().nutrition,
        today: null,
        remainingCalories: null,
        dailyInsightProteinStatus: 'unknown',
        mealAdviceAllowed: false,
        last3Days: [
          {
            date: '2026-08-19',
            calories: 2100,
            protein: 150,
            hasMealItem: true,
            baseTargetCalories: null,
            effectiveTargetCalories: null,
            activityBonusCalories: 700,
            targetSource: 'unavailable',
            dayType: 'training',
            workoutType: null,
            specialActivity: {
              ...historicalHikingActivity,
              dailyCalorieTarget: 0,
            },
          },
        ],
      },
    }),
    intent: 'morning_orientation',
  },
  {
    id: 'historical-target-ambiguous-source',
    description: 'Ambiguous historical data does not affect a current-moment insight.',
    input: baseContext({
      currentHourLocal: 8,
      nutrition: {
        ...baseContext().nutrition,
        today: null,
        remainingCalories: null,
        dailyInsightProteinStatus: 'unknown',
        mealAdviceAllowed: false,
        last3Days: [
          {
            ...historicalDay,
            date: '2026-08-19',
            calories: 2100,
            baseTargetCalories: 2000,
            effectiveTargetCalories: 2000,
            targetSource: 'profile_fallback',
            specialActivity: {
              ...historicalHikingActivity,
              dailyCalorieTarget: 1400,
              activityBonus: 0,
            },
          },
        ],
      },
    }),
    intent: 'morning_orientation',
  },
  {
    id: 'completed-activity',
    description: 'A server-confirmed completed activity may be described as completed.',
    input: baseContext({
      currentHourLocal: 23,
      specialActivity: hikingActivity,
      nutrition: activityNutrition(hikingActivity),
      dailyActivityStatus: 'completed',
    }),
    intent: 'activity_focus',
  },
  {
    id: 'unknown-activity',
    description: 'An activity without a usable local hour stays neutral.',
    input: baseContext({
      currentHourLocal: null,
      specialActivity: hikingActivity,
      nutrition: activityNutrition(hikingActivity),
      dailyActivityStatus: 'unknown',
    }),
    intent: 'activity_focus',
    // US Insight F4: missing or invalid time must not create a completion fact.
  },
  {
    id: 'intensive-endurance-fueling',
    description: 'A long alpine endurance activity receives fueling and recovery guidance beyond a generic protein snack.',
    input: baseContext({
      currentHourLocal: 23,
      specialActivity: intensiveEnduranceActivity,
      dailyActivityStatus: 'completed',
      nutrition: intensiveEnduranceNutrition,
    }),
    intent: 'activity_focus',
    // AC-8 and DV-2: qualitative endurance guidance must cover fuel, fluids, and recovery without invented thresholds.
  },
  {
    id: 'budget-lock',
    description: 'A negative remaining budget blocks another meal recommendation today without rejecting future-oriented outlook language.',
    input: baseContext({
      currentHourLocal: 22,
      nutrition: {
        ...baseContext().nutrition,
        remainingCalories: -120,
        mealAdviceAllowed: false,
      },
    }),
    intent: 'nutrition_guidance',
    // US Insight F6 and KB domain/07: the budget lock has priority over a protein gap.
  },
  {
    id: 'target-relative-overage-not-achieved-surplus',
    description: 'A negative target remainder supports above-target wording, not an achieved energy surplus or deficit.',
    input: baseContext({
      currentHourLocal: 21,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 2180, protein: 105, carbs: 230, fat: 72, fiber: 24, hasMealItem: true },
        targets: {
          calories: 2000,
          proteinG: 140,
          carbsG: 220,
          fatG: 70,
          fiberG: 30,
          macroRanges: BASE_MACRO_RANGES,
        },
        remainingCalories: -180,
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: false,
      },
    }),
    intent: 'nutrition_guidance',
    // WS-2 / AC-3: only the synthetic intake-to-target relation is supported by this context.
  },
  {
    id: 'protein-gap-with-budget',
    description: 'A below-range server protein status and permitted meal advice may support one relevant suggestion.',
    input: baseContext({
      currentHourLocal: 18,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1600, protein: 70, carbs: 160, fat: 50, fiber: 20, hasMealItem: true },
        remainingCalories: 600,
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: true,
        last3Days: [],
      },
    }),
    intent: 'nutrition_guidance',
    // B1.1: a below-range server status and mealAdviceAllowed=true permit, but do not require, meal advice.
  },
  {
    id: 'meal-advice-denied',
    description: 'Meal advice is denied by the server even though the protein status is below range.',
    input: baseContext({
      currentHourLocal: 18,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1600, protein: 110, carbs: 160, fat: 50, fiber: 20, hasMealItem: true },
        remainingCalories: 600,
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: false,
        last3Days: [],
      },
    }),
    intent: 'nutrition_guidance',
    // B1.1: meal permission is independent of the protein status.
  },
  {
    id: 'protein-above-range-no-warning',
    description: 'Protein above 2.0 and below 2.5 g/kg is not described as a problem.',
    input: baseContext({
      currentHourLocal: 18,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1600, protein: 170, carbs: 140, fat: 50, fiber: 20, hasMealItem: true },
        remainingCalories: 400,
        dailyInsightProteinStatus: 'above_range',
        mealAdviceAllowed: false,
        last3Days: [],
      },
    }),
    intent: 'nutrition_guidance',
    // Story 4.3: above the range but below 2.5 g/kg needs no special protein warning.
  },
  {
    id: 'protein-high-with-calories-over-target',
    description: 'Protein at or above 2.5 g/kg with calories over target allows a calm optional food-choice note.',
    input: baseContext({
      currentHourLocal: 20,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 2250, protein: 210, carbs: 160, fat: 60, fiber: 20, hasMealItem: true },
        remainingCalories: -250,
        dailyInsightProteinStatus: 'at_or_above_2_5_g_per_kg',
        mealAdviceAllowed: false,
        last3Days: [],
      },
    }),
    intent: 'nutrition_guidance',
    // Story 4.3: an optional, non-alarmist note is allowed; it is not required.
  },
  {
    id: 'carbohydrates-below-range-neutral',
    description: 'Carbohydrate intake below its advisory range is not described as inadequate.',
    input: baseContext({
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1420, protein: 90, carbs: 100, fat: 60, fiber: 20, hasMealItem: true },
        remainingCalories: 580,
        dailyInsightProteinStatus: 'below_range',
        last3Days: [],
      },
    }),
    intent: 'nutrition_guidance',
    // AC-7 / PO-4: an intake below the carbohydrate range is not a negative assessment.
  },
  {
    id: 'carbohydrates-above-range-neutral',
    description: 'Carbohydrate intake above its advisory range is not described as excessive.',
    input: baseContext({
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1840, protein: 90, carbs: 250, fat: 40, fiber: 20, hasMealItem: true },
        remainingCalories: 160,
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: false,
      },
    }),
    intent: 'nutrition_guidance',
    // AC-7 / PO-4: an intake above the carbohydrate range is not a strict-limit violation.
  },
  {
    id: 'empty-morning',
    description: 'An empty early morning uses only today\'s context without judging the unlogged day.',
    input: baseContext({
      currentHourLocal: 8,
      nutrition: {
        ...baseContext().nutrition,
        today: null,
        remainingCalories: null,
        dailyInsightProteinStatus: 'unknown',
        mealAdviceAllowed: false,
      },
    }),
    intent: 'morning_orientation',
    // US Insight F7 and the zero-versus-missing contract: no current MealItem is not a deficit.
  },
  {
    id: 'morning-unlogged-prior-day',
    description: 'An unlogged current day remains missing data; prior-day entries are ignored.',
    input: baseContext({
      currentHourLocal: 8,
      nutrition: {
        ...baseContext().nutrition,
        today: null,
        remainingCalories: null,
        dailyInsightProteinStatus: 'unknown',
        mealAdviceAllowed: false,
        last3Days: [
          {
            ...historicalDay,
            date: '2026-08-19',
            calories: null,
            protein: null,
            hasMealItem: false,
            mealItemCount: 0,
            baseTargetCalories: 2000,
            effectiveTargetCalories: 2000,
            targetSource: 'profile_fallback',
          },
          { ...historicalDay, date: '2026-08-18' },
          { ...historicalDay, date: '2026-08-17' },
        ],
      },
    }),
    intent: 'morning_orientation',
    // KB domain/01: no current MealItem is not zero intake.
  },
  {
    id: 'midday-empty-day-not-morning',
    description: 'At local hour 12, an empty current diary does not activate the morning intent.',
    input: baseContext({
      currentHourLocal: 12,
      nutrition: {
        ...baseContext().nutrition,
        today: null,
        remainingCalories: null,
        dailyInsightProteinStatus: 'unknown',
        mealAdviceAllowed: false,
      },
    }),
    intent: 'general',
    // The deterministic intent selector only enables morning_orientation before 10:00.
  },
  {
    id: 'stale-weight',
    description: 'Stale weight data is not presented as a current trend.',
    input: baseContext({
      weight: {
        ...baseContext().weight,
        latestKg: null,
        previousKg: null,
        weeklyTrend30d: null,
        last7Values: [],
        daysSinceLastMeasurement: 20,
        lastMeasurementDate: '2026-07-31',
      },
      progressIntelligence: {
        ...baseContext().progressIntelligence,
        primarySignal: { type: 'phase_context', confidence: 0.6, freshnessScore: 0 },
      },
    }),
    intent: 'phase_progress',
    // US Insight F2 and KB domain/07: old measurements are not current evidence.
  },
];