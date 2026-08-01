// Activity Bonus Calculator — V3 Final
// Piecewise-linear MET model for hiking activities.
// Scientific basis: Ainsworth Compendium 2024, Pandolf et al. (1977), Minetti et al. (2002).

import type { HikingActivityInputs, ActivityBonusResult } from '../types/diary';
import type { PackCategory, TerrainType } from '../types/diary';

const MET_MIN = 2.0;
const MET_MAX = 9.5;

// ---------------------------------------------------------------------------
// Piecewise-linear interpolation helper
// ---------------------------------------------------------------------------
function lerp(x: number, anchors: ReadonlyArray<readonly [number, number]>): number {
  if (anchors.length === 0) return 0;
  if (x <= anchors[0]![0]) return anchors[0]![1];
  if (x >= anchors[anchors.length - 1]![0]) return anchors[anchors.length - 1]![1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1]!;
    const [x1, y1] = anchors[i]!;
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return anchors[anchors.length - 1]![1];
}

// ---------------------------------------------------------------------------
// Anchor tables
// ---------------------------------------------------------------------------

// Speed (km/h) → metBase. Walking-calibrated, floor 2.0, cap 4.5.
const SPEED_ANCHORS = [
  [1.5, 2.0], [2.5, 2.8], [3.5, 3.3], [4.5, 3.8], [5.5, 4.5],
] as const;

// gainPerKm (m/km) → Δ_asc. Floor 0.0, cap 4.5.
// CRITICAL: anchor (94, 1.4) — calibrated to Ainsworth 17080 at 8% grade.
const ASCENT_ANCHORS = [
  [50, 0.0], [69, 0.5], [94, 1.4], [138, 2.0], [169, 2.5],
  [213, 3.0], [282, 3.5], [375, 4.0], [500, 4.5],
] as const;

// lossPerKm (m/km) → Δ_desc_base. Non-monotone: minimum at 100 m/km.
const DESCENT_ANCHORS = [
  [50, 0.0], [100, -0.5], [150, -0.3], [200, 0.0], [350, 0.3], [500, 0.5],
] as const;

// PackCategory → Δ_pack (added AFTER terrain multiplication)
const PACK_DELTA: Record<PackCategory, number> = {
  none:   0.0,
  small:  0.5,
  medium: 1.0,
  heavy:  1.5,
};

// TerrainType → terrainFactor (multiplicative)
// [FitTrack model parameters — calibrated against Ainsworth references]
const TERRAIN_FACTOR: Record<TerrainType, number> = {
  path:     1.00,  // Weg / Forststraße — Ainsworth walking baseline
  trail:    1.35,  // Bergweg
  alpine:   1.45,  // Alpiner Steig
  scramble: 1.60,  // Sehr anspruchsvoll / Kraxeln
};

function speedToMetBase(speedKmh: number): number {
  return lerp(speedKmh, SPEED_ANCHORS);
}

function ascentDelta(gainPerKm: number): number {
  return lerp(gainPerKm, ASCENT_ANCHORS);
}

function descentDeltaBase(lossPerKm: number): number {
  return lerp(lossPerKm, DESCENT_ANCHORS);
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

export function calculateActivityBonus(
  inputs: HikingActivityInputs,
  weightKg: number,
  dailyCalorieTarget: number,
): ActivityBonusResult {
  // Guard: invalid inputs → zero result
  if (!inputs.distanceKm || !inputs.movementTimeMinutes) {
    return {
      estimatedMet: MET_MIN,
      activityCalories: 0,
      alreadyAccountedCalories: 0,
      activityBonus: 0,
    };
  }

  // Backward-compatibility mapping
  const resolvedPack: PackCategory =
    inputs.packCategory ?? (inputs.hasBackpack ? 'medium' : 'none');
  const resolvedTerrain: TerrainType = inputs.terrainType ?? 'path';
  const gainM = inputs.elevationGainM;
  const lossM = inputs.elevationLossM ?? 0;

  // Phase split (Naismith weighting: ascent 1.0, descent 0.5)
  const naisTotal = gainM * 1.0 + lossM * 0.5;
  const f_asc  = naisTotal > 0 ? gainM / naisTotal : 1.0;
  const f_desc = naisTotal > 0 ? (lossM * 0.5) / naisTotal : 0.0;
  const d_asc  = (gainM + lossM) > 0
    ? inputs.distanceKm * gainM / (gainM + lossM)
    : inputs.distanceKm;
  const d_desc = (gainM + lossM) > 0
    ? inputs.distanceKm * lossM / (gainM + lossM)
    : 0;

  // Speed and base MET
  const movementTimeH = inputs.movementTimeMinutes / 60;
  const speedKmh = inputs.distanceKm / movementTimeH;
  const metBase = speedToMetBase(speedKmh);

  // Elevation deltas
  const gainPerKm = d_asc > 0 ? gainM / d_asc : 0;
  const lossPerKm = d_desc > 0 ? lossM / d_desc : 0;
  const deltaAsc     = ascentDelta(gainPerKm) * f_asc;
  const deltaDescent = descentDeltaBase(lossPerKm) * f_desc;

  // Pack and terrain
  const deltaPack  = PACK_DELTA[resolvedPack];
  const terrainF   = TERRAIN_FACTOR[resolvedTerrain];

  // MET calculation: pack added AFTER terrain multiplication
  const metLocomotion = metBase + deltaAsc + deltaDescent;
  const estimatedMet  = Math.min(MET_MAX, Math.max(MET_MIN,
    metLocomotion * terrainF + deltaPack,
  ));

  // Calorie calculations (unchanged formula)
  const activityCalories         = estimatedMet * weightKg * movementTimeH;
  const alreadyAccountedCalories = dailyCalorieTarget * (movementTimeH / 24);
  const rawBonus      = Math.max(0, activityCalories - alreadyAccountedCalories);
  const activityBonus = Math.round(rawBonus / 50) * 50;

  return {
    estimatedMet,
    activityCalories,
    alreadyAccountedCalories,
    activityBonus,
    metBase,
    metLocomotion,
    terrainFactor: terrainF,
    deltaPack,
  };
}

