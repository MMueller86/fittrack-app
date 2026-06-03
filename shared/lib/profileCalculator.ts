import type { Gender, ActivityLevel, GoalType, GoalIntensity } from '../types/profile';
import type { DayTargets, ProfileTargets, CalculationMeta } from '../types/nutrition';
import type { ProfileInput } from '../types/profile';

// ---------------------------------------------------------------------------
// Step–PAL lookup table
// ---------------------------------------------------------------------------

const STEP_PAL_TABLE: Array<[steps: number, pal: number]> = [
  [4000, 1.35],
  [5000, 1.40],
  [7500, 1.50],
  [10000, 1.60],
  [12500, 1.70],
  [15000, 1.80],
  [17500, 1.90],
];

const MIN_PAL = 1.35;
const MAX_PAL = 1.90;

// ---------------------------------------------------------------------------
// Training duration → bonus kcal lookup table (exact minutes are anchor points)
// ---------------------------------------------------------------------------

const TRAINING_BONUS_TABLE: Array<[minutes: number, bonus: number]> = [
  [0, 0],
  [30, 150],
  [60, 250],
  [90, 350],
  [120, 450],
  [150, 550],
];

// ---------------------------------------------------------------------------
// Minimum calorie guardrails
// ---------------------------------------------------------------------------

const MIN_CALORIES: Record<Gender, number> = {
  male: 1800,
  female: 1500,
  other: 1650,
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Linear interpolation between two points. */
function lerp(x0: number, y0: number, x1: number, y1: number, x: number): number {
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

/** Round value to the nearest multiple of `step`. */
export function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Clamp value between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linearly interpolate a value from a sorted lookup table.
 * Clamps below first entry and above last entry.
 */
function interpolateTable(table: Array<[number, number]>, x: number): number {
  if (x <= table[0][0]) return table[0][1];
  if (x >= table[table.length - 1][0]) return table[table.length - 1][1];

  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (x >= x0 && x <= x1) {
      return lerp(x0, y0, x1, y1, x);
    }
  }
  // Should never reach here given above guards.
  return table[table.length - 1][1];
}

// ---------------------------------------------------------------------------
// BMR
// ---------------------------------------------------------------------------

/**
 * Mifflin–St Jeor BMR in kcal/day.
 * - male: 10w + 6.25h − 5a + 5
 * - female: 10w + 6.25h − 5a − 161
 * - other: average of male and female
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'male') return base + 5;
  if (gender === 'female') return base - 161;
  // 'other': average
  return base + (5 + -161) / 2; // base - 78
}

// ---------------------------------------------------------------------------
// PAL
// ---------------------------------------------------------------------------

/**
 * Derive PAL from average daily steps (excluding training).
 * Interpolates the STEP_PAL_TABLE and clamps to [MIN_PAL, MAX_PAL].
 */
export function stepsTopal(steps: number): number {
  return clamp(interpolateTable(STEP_PAL_TABLE, steps), MIN_PAL, MAX_PAL);
}

/**
 * Fallback PAL when step count is unknown.
 */
export function activityLevelToPAL(level: ActivityLevel): number {
  switch (level) {
    case 'sedentary': return 1.40;
    case 'light': return 1.55;
    case 'active': return 1.70;
    case 'very_active': return 1.90;
  }
}

// ---------------------------------------------------------------------------
// Training bonus
// ---------------------------------------------------------------------------

/**
 * Training day bonus kcal based on typical session duration.
 * Interpolates between anchor points; clamps at 0 and 550.
 */
export function trainingBonusKcal(durationMinutes: number): number {
  return interpolateTable(TRAINING_BONUS_TABLE, clamp(durationMinutes, 0, 150));
}

// ---------------------------------------------------------------------------
// Goal adjustment
// ---------------------------------------------------------------------------

/**
 * Net kcal adjustment for the user's goal and intensity.
 */
export function goalAdjustmentKcal(goal: GoalType, intensity: GoalIntensity | null): number {
  switch (goal) {
    case 'lose_weight': {
      switch (intensity) {
        case 'gentle': return -250;
        case 'aggressive': return -750;
        default: return -500; // moderate or null → moderate default
      }
    }
    case 'maintain':
      return 0;
    case 'gain_muscle': {
      switch (intensity) {
        case 'gentle': return 200;
        case 'aggressive': return 500;
        default: return 350; // moderate or null → moderate default
      }
    }
    case 'recomposition':
      return -100;
  }
}

// ---------------------------------------------------------------------------
// Macro calculation
// ---------------------------------------------------------------------------

/** Protein g/kg lookup by goal. */
function proteinGPerKg(goal: GoalType): number {
  if (goal === 'maintain') return 1.8;
  return 2.0;
}

/**
 * Derive macros from calorie target and body weight.
 * Returns values rounded to nearest 5 g (fiber: nearest 1 g).
 */
export function calculateMacros(
  calories: number,
  weightKg: number,
  goal: GoalType,
): Pick<DayTargets, 'proteinG' | 'fatG' | 'carbsG' | 'fiberG'> {
  const proteinG = roundToNearest(proteinGPerKg(goal) * weightKg, 5);
  const fatG = roundToNearest(0.9 * weightKg, 5);

  const proteinCal = proteinG * 4;
  const fatCal = fatG * 9;
  const remaining = calories - proteinCal - fatCal;
  const carbsG = roundToNearest(Math.max(remaining, 0) / 4, 5);
  const fiberG = Math.round((calories / 1000) * 14);

  return { proteinG, fatG, carbsG, fiberG };
}

// ---------------------------------------------------------------------------
// Guardrails
// ---------------------------------------------------------------------------

/**
 * Apply minimum calorie guardrails.
 * Returns the (possibly capped) value and whether capping was applied.
 */
export function applyGuardrails(
  calories: number,
  gender: Gender,
): { calories: number; capped: boolean } {
  const min = MIN_CALORIES[gender];
  if (calories < min) return { calories: min, capped: true };
  return { calories, capped: false };
}

// ---------------------------------------------------------------------------
// Main calculation entry point
// ---------------------------------------------------------------------------

export interface ProfileCalculationResult {
  targets: ProfileTargets;
  meta: CalculationMeta;
  restDayCapped: boolean;
  trainingDayCapped: boolean;
}

/**
 * Full deterministic calculation for rest-day and training-day targets.
 * No I/O — pure function suitable for both backend and test.
 */
export function calculateProfileTargets(input: ProfileInput): ProfileCalculationResult {
  const bmr = calculateBMR(input.weightKg, input.heightCm, input.age, input.gender);

  const pal =
    input.stepsPerDay != null
      ? stepsTopal(input.stepsPerDay)
      : activityLevelToPAL(input.activityLevel ?? 'sedentary');

  const maintenanceRestDay = bmr * pal;
  const trainingDayBonus = trainingBonusKcal(input.trainingDurationMinutes);
  const goalAdj = goalAdjustmentKcal(input.goal, input.goalIntensity);

  const rawRestDay = maintenanceRestDay + goalAdj;
  const rawTrainingDay = maintenanceRestDay + trainingDayBonus + goalAdj;

  const roundedRest = roundToNearest(rawRestDay, 50);
  const roundedTraining = roundToNearest(rawTrainingDay, 50);

  const { calories: restCalories, capped: restDayCapped } = applyGuardrails(
    roundedRest,
    input.gender,
  );
  const { calories: trainingCalories, capped: trainingDayCapped } = applyGuardrails(
    roundedTraining,
    input.gender,
  );

  const restMacros = calculateMacros(restCalories, input.weightKg, input.goal);
  const trainingMacros = calculateMacros(trainingCalories, input.weightKg, input.goal);

  const meta: CalculationMeta = {
    formulaVersion: 'profile-targets-v1-pal',
    bmr: Math.round(bmr),
    pal: Math.round(pal * 100) / 100,
    maintenanceRestDay: Math.round(maintenanceRestDay),
    trainingDayBonus,
    goalAdjustment: goalAdj,
  };

  return {
    targets: {
      restDay: { calories: restCalories, ...restMacros },
      trainingDay: { calories: trainingCalories, ...trainingMacros },
    },
    meta,
    restDayCapped,
    trainingDayCapped,
  };
}
