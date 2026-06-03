/** Macro targets for a single day type (rest or training). */
export interface DayTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
}

/** Pair of targets stored inside UserProfile. */
export interface ProfileTargets {
  restDay: DayTargets;
  trainingDay: DayTargets;
}

/** Intermediate values stored so explanations can be reconstructed. */
export interface CalculationMeta {
  formulaVersion: 'profile-targets-v1-pal';
  bmr: number;
  pal: number;
  maintenanceRestDay: number;
  trainingDayBonus: number;
  goalAdjustment: number;
}
