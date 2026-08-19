import type { WorkoutType } from '@fittrack/shared';
import type { MCIName } from '../../shared/components/Icon';

export type HomeTrainingKey = 'rest' | WorkoutType;

export interface HomeTrainingPresentation {
  readonly workoutType: WorkoutType | null;
  readonly label: string;
  readonly icon: MCIName;
}

export const HOME_TRAINING_PRESENTATION = {
  rest: { workoutType: null, label: 'Ruhetag', icon: 'sleep' },
  gym: { workoutType: 'gym', label: 'Gym', icon: 'weight-lifter' },
  bouldering: { workoutType: 'bouldering', label: 'Bouldern / Klettern', icon: 'human-handsup' },
  running: { workoutType: 'running', label: 'Laufen', icon: 'run' },
  cycling: { workoutType: 'cycling', label: 'Radfahren', icon: 'bike' },
  other: { workoutType: 'other', label: 'Sonstiges', icon: 'dots-horizontal' },
} as const satisfies Record<HomeTrainingKey, HomeTrainingPresentation>;

export const HOME_TRAINING_KEYS = [
  'rest',
  'gym',
  'bouldering',
  'running',
  'cycling',
  'other',
] as const satisfies readonly HomeTrainingKey[];