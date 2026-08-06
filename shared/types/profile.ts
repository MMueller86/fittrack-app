import type { ProfileTargets, CalculationMeta } from './nutrition';

export type Gender = 'male' | 'female' | 'other';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'active'
  | 'very_active';

export type Sport =
  | 'strength'
  | 'bouldering'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'hiking'
  | 'teamsport'
  | 'other';

export type GoalType =
  | 'lose_weight'
  | 'maintain'
  | 'gain_muscle'
  | 'recomposition';

export type GoalIntensity = 'gentle' | 'moderate' | 'aggressive';

export interface UserProfile {
  /** Fixed doc id — always "profile" */
  id: 'profile';
  userId: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  /** Required: used for weight chart target line and distance indicator */
  targetWeightKg: number;
  /** Average daily steps excluding training. null when activityLevel fallback is used. */
  stepsPerDay: number | null;
  /** Used when stepsPerDay is null */
  activityLevel: ActivityLevel | null;
  trainingFrequencyPerWeek: number;
  /** 0 when trainingFrequencyPerWeek === 0 */
  trainingDurationMinutes: number;
  sports: Sport[];
  goal: GoalType;
  /** null for maintain and recomposition */
  goalIntensity: GoalIntensity | null;
  /** Optional display name chosen by the user. Falls back to "Sportler" when absent. */
  displayName?: string;
  /** Whether the user has enabled Health Connect weight sync. undefined = never configured. */
  healthSyncEnabled?: boolean;
  targets: ProfileTargets;
  calculationMeta: CalculationMeta;
  createdAt: string;
  updatedAt: string;
}

/** Input shape for POST /profile and PUT /profile */
export interface ProfileInput {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  stepsPerDay: number | null;
  activityLevel: ActivityLevel | null;
  trainingFrequencyPerWeek: number;
  trainingDurationMinutes: number;
  sports: Sport[];
  goal: GoalType;
  goalIntensity: GoalIntensity | null;
  /** Optional display name chosen by the user. */
  displayName?: string;
  healthSyncEnabled?: boolean;
}
