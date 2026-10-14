export interface MacroRange {
  minG: number;
  maxG: number;
}

export interface MacroRanges {
  proteinG: MacroRange;
  carbsG: MacroRange;
}

export type ProteinCoachingBand =
  | 'below_range'
  | 'in_range'
  | 'above_range'
  | 'above_coaching_threshold'
  | 'unknown';

/** Macro targets for a single day type (rest or training). */
export interface DayTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  /** Absent on legacy profiles; resolved from the profile's current targets on read. */
  macroRanges?: MacroRanges;
}

/** Pair of targets stored inside UserProfile. */
export interface ProfileTargets {
  restDay: DayTargets;
  trainingDay: DayTargets;
}

/** Intermediate values stored so explanations can be reconstructed. */
export interface CalculationMeta {
  formulaVersion: 'profile-targets-v1-pal' | 'profile-targets-v2-macro-ranges';
  bmr: number;
  pal: number;
  maintenanceRestDay: number;
  trainingDayBonus: number;
  goalAdjustment: number;
}
