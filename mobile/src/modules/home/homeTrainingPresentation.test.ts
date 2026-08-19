import { describe, expect, it } from 'vitest';
import type { WorkoutType } from '@fittrack/shared';
import type { MCIName } from '../../shared/components/Icon';
import {
  HOME_TRAINING_KEYS,
  HOME_TRAINING_PRESENTATION,
  type HomeTrainingKey,
  type HomeTrainingPresentation,
} from './homeTrainingPresentation';

const EXPECTED_KEYS = ['rest', 'gym', 'bouldering', 'running', 'cycling', 'other'] as const;

describe('homeTrainingPresentation', () => {
  it('contains exactly the six shared home keys in picker order', () => {
    expect(Object.keys(HOME_TRAINING_PRESENTATION)).toEqual(EXPECTED_KEYS);
    expect(HOME_TRAINING_KEYS).toEqual(EXPECTED_KEYS);
  });

  it('keeps the workout values, German labels, and verified MCI icons stable', () => {
    expect(HOME_TRAINING_PRESENTATION).toEqual({
      rest: { workoutType: null, label: 'Ruhetag', icon: 'sleep' },
      gym: { workoutType: 'gym', label: 'Gym', icon: 'weight-lifter' },
      bouldering: {
        workoutType: 'bouldering',
        label: 'Bouldern / Klettern',
        icon: 'human-handsup',
      },
      running: { workoutType: 'running', label: 'Laufen', icon: 'run' },
      cycling: { workoutType: 'cycling', label: 'Radfahren', icon: 'bike' },
      other: { workoutType: 'other', label: 'Sonstiges', icon: 'dots-horizontal' },
    });
  });

  it('exposes a type-stable catalog for all workout contract values', () => {
    const catalog: Record<HomeTrainingKey, HomeTrainingPresentation> = HOME_TRAINING_PRESENTATION;
    const values: Array<WorkoutType | null> = HOME_TRAINING_KEYS.map(
      (key) => catalog[key].workoutType,
    );
    const icons: MCIName[] = HOME_TRAINING_KEYS.map((key) => catalog[key].icon);

    expect(values).toEqual([null, 'gym', 'bouldering', 'running', 'cycling', 'other']);
    expect(icons).toEqual([
      'sleep',
      'weight-lifter',
      'human-handsup',
      'run',
      'bike',
      'dots-horizontal',
    ]);
  });
});