// Cycling Activity Bonus Calculator — cycling-met-estimator@1.1.0
// Deterministic piecewise-linear MET model for cycling activities.
// Spec: docs/kb/Specs/specialActivityBike/

import type { CyclingActivityInputs, ActivityBonusResult, EbikeSupport } from '../types/diary';

const ACTIVITY_FLOOR_MET = 2.3;
const GRAVITY_SCALE = 350.0;
const DOWNHILL_MOTOR_REDUCTION = 0.75;

// ---------------------------------------------------------------------------
// Piecewise-linear interpolation
// belowMinimum: RETURN_FIRST_VALUE, aboveMaximum: RETURN_LAST_VALUE
// ---------------------------------------------------------------------------
function lerp(x: number, anchors: ReadonlyArray<readonly [number, number]>): number {
  if (anchors.length === 0) return 0;
  if (x <= anchors[0]![0]) return anchors[0]![1];
  if (x >= anchors[anchors.length - 1]![0]) return anchors[anchors.length - 1]![1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1]!;
    const [x1, y1] = anchors[i]!;
    if (x <= x1) {
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return anchors[anchors.length - 1]![1];
}

// ---------------------------------------------------------------------------
// Lookup tables — spec 02-tables.yaml
// ---------------------------------------------------------------------------

const SPEED_MET_TABLE: ReadonlyArray<readonly [number, number]> = [
  [0, 2.3], [4, 2.5], [8, 3.0], [12, 3.5], [16, 4.0], [19.2, 6.8],
  [20, 8.0], [22.4, 8.0], [25.6, 10.0], [32.2, 12.0], [35, 16.8],
];

const UPHILL_BONUS_MET_TABLE: ReadonlyArray<readonly [number, number]> = [
  [0, 0.0], [50, 0.3], [100, 0.7], [200, 1.5], [300, 2.3],
  [400, 3.2], [500, 4.1], [600, 5.0], [700, 6.0],
];

const SPEED_MOTOR_FACTOR_TABLE: ReadonlyArray<readonly [number, number]> = [
  [20, 1.0], [22, 0.9], [24, 0.75], [25, 0.6], [26, 0.45], [28, 0.2], [30, 0.1],
];

const SUPPORT_REDUCTION: Record<EbikeSupport, number> = {
  NONE: 0.0,
  LIGHT: 0.35,
  HIGH: 0.75,
};

const UPHILL_REDUCTION: Record<EbikeSupport, number> = {
  NONE: 0.0,
  LIGHT: 0.4,
  HIGH: 0.75,
};

// ---------------------------------------------------------------------------
// Round half-up to N decimal places (spec: HALF_UP mode for finalMetDisplayed)
// ---------------------------------------------------------------------------
function roundHalfUp(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

export function calculateCyclingActivityBonus(
  inputs: CyclingActivityInputs,
  weightKg: number,
  dailyCalorieTarget: number,
): ActivityBonusResult {
  // Guard: invalid inputs → zero result
  if (!inputs.movementTimeMinutes || !inputs.distanceKm) {
    return {
      estimatedMet: ACTIVITY_FLOOR_MET,
      activityCalories: 0,
      alreadyAccountedCalories: 0,
      activityBonus: 0,
    };
  }

  const movingTimeHours = inputs.movementTimeMinutes / 60;
  const uphillMeters = inputs.elevationGainM;
  const downhillMeters = inputs.elevationLossM ?? 0;

  // Formulas 1-3: speed and elevation rates
  const averageSpeedKmh = inputs.distanceKm / movingTimeHours;
  const uphillMetersPerHour = uphillMeters / movingTimeHours;
  const downhillMetersPerHour = downhillMeters / movingTimeHours;

  // Formulas 4-6: MET components
  const speedMet = lerp(averageSpeedKmh, SPEED_MET_TABLE);
  const uphillBonusMet = lerp(uphillMetersPerHour, UPHILL_BONUS_MET_TABLE);
  const terrainBonusMet =
    inputs.asphaltShare * 0.0 + inputs.gravelShare * 0.5 + inputs.trailShare * 1.5;

  // Formulas 7-10: gravity / downhill effect on speed MET
  const elevationTotalMeters = uphillMeters + downhillMeters;
  const downhillRatio = elevationTotalMeters === 0 ? 0 : downhillMeters / elevationTotalMeters;
  const gravityFactor =
    1 - downhillRatio * (1 - 1 / (1 + downhillMetersPerHour / GRAVITY_SCALE));
  const profileSpeedMet =
    ACTIVITY_FLOOR_MET + (speedMet - ACTIVITY_FLOOR_MET) * gravityFactor;

  // Formulas 11-12: downhill motor factor
  const downhillDominance =
    elevationTotalMeters === 0
      ? 0
      : Math.max(0, (downhillMeters - uphillMeters) / elevationTotalMeters);
  const downhillMotorFactor = 1 - DOWNHILL_MOTOR_REDUCTION * downhillDominance;

  // Formulas 13-16: eBike support
  const speedMotorFactor = lerp(averageSpeedKmh, SPEED_MOTOR_FACTOR_TABLE);
  const supportReduction = SUPPORT_REDUCTION[inputs.ebikeSupport];
  const uphillReduction = UPHILL_REDUCTION[inputs.ebikeSupport];
  const effectiveSupport = supportReduction * speedMotorFactor * downhillMotorFactor;

  // Formulas 17-19: final MET (no rounding on intermediates)
  const speedMetWithMotor =
    ACTIVITY_FLOOR_MET + (profileSpeedMet - ACTIVITY_FLOOR_MET) * (1 - effectiveSupport);
  const uphillBonusWithMotor = uphillBonusMet * (1 - uphillReduction);
  const finalMetRaw = speedMetWithMotor + uphillBonusWithMotor + terrainBonusMet;

  // Formula 20: round for display only
  const finalMetDisplayed = roundHalfUp(finalMetRaw, 1);

  // Formulas 21-24: calorie calculations (use finalMetRaw, not displayed)
  const activityCalories = finalMetRaw * weightKg * movingTimeHours;
  const normalCalories = dailyCalorieTarget * (movingTimeHours / 24);
  const extraCalories = Math.max(0, activityCalories - normalCalories);
  const activityBonus = Math.round(extraCalories / 50) * 50;

  return {
    estimatedMet: finalMetDisplayed,
    activityCalories,
    alreadyAccountedCalories: normalCalories,
    activityBonus,
    speedMet,
    uphillBonusMet,
    terrainBonusMet,
    effectiveSupport,
  };
}
