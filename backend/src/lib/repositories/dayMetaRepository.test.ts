import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cosmosDayMetaRepository', () => ({
  CosmosDayMetaRepository: class {},
}));

import {
  __resetDayMetaRepositoryForTests,
  getDayMetaRepository,
} from './dayMetaRepository';

const snapshot = {
  calories: 2200,
  capturedAt: '2026-08-01T10:00:00.000Z',
  source: 'profile' as const,
};

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  __resetDayMetaRepositoryForTests();
});

describe('DayMeta calorieTargetSnapshot', () => {
  it('creates a snapshot for a missing day without replacing an explicit day type', async () => {
    const repo = getDayMetaRepository();
    const activity = {
      type: 'hiking' as const,
      movementTimeMinutes: 60,
      distanceKm: 4,
      elevationGainM: 100,
      bodyWeightKg: 70,
      dailyCalorieTarget: 2200,
      calculatedAt: '2026-08-13T10:00:00.000Z',
      estimatedMet: 4,
      activityCalories: 280,
      alreadyAccountedCalories: 91.67,
      activityBonus: 200,
    };
    await repo.upsert('user-1', '2026-08-13', 'training', 'gym');
    await repo.setSpecialActivity('user-1', '2026-08-13', activity);

    const meta = await repo.ensureCalorieTargetSnapshot(
      'user-1',
      '2026-08-13',
      'rest',
      snapshot,
    );

    expect(meta).toMatchObject({
      dayType: 'training',
      workoutType: 'gym',
      specialActivity: activity,
      calorieTargetSnapshot: snapshot,
    });
  });

  it('does not replace a valid snapshot when ensuring it again', async () => {
    const repo = getDayMetaRepository();
    const originalSnapshot = { ...snapshot, calories: 2300 };
    await repo.upsert('user-1', '2026-08-13', 'training', 'gym', originalSnapshot);

    const meta = await repo.ensureCalorieTargetSnapshot(
      'user-1',
      '2026-08-13',
      'rest',
      snapshot,
    );

    expect(meta.calorieTargetSnapshot).toEqual(originalSnapshot);
    expect(meta).toMatchObject({ dayType: 'training', workoutType: 'gym' });
  });

  it('replaces an invalid snapshot but preserves the rest of the DayMeta', async () => {
    const repo = getDayMetaRepository();
    const activity = {
      type: 'hiking' as const,
      movementTimeMinutes: 60,
      distanceKm: 4,
      elevationGainM: 100,
      bodyWeightKg: 70,
      dailyCalorieTarget: 2200,
      calculatedAt: '2026-08-13T10:00:00.000Z',
      estimatedMet: 4,
      activityCalories: 280,
      alreadyAccountedCalories: 91.67,
      activityBonus: 200,
    };
    await repo.upsert('user-1', '2026-08-13', 'training', 'gym', { ...snapshot, calories: 0 });
    await repo.setSpecialActivity('user-1', '2026-08-13', activity);

    const meta = await repo.ensureCalorieTargetSnapshot(
      'user-1',
      '2026-08-13',
      'rest',
      snapshot,
    );

    expect(meta.calorieTargetSnapshot).toEqual(snapshot);
    expect(meta).toMatchObject({ dayType: 'training', workoutType: 'gym', specialActivity: activity });
  });

  it('stores a snapshot on explicit day-context writes', async () => {
    const repo = getDayMetaRepository();

    const meta = await repo.upsert('user-1', '2026-08-13', 'rest', null, snapshot);

    expect(meta.calorieTargetSnapshot).toEqual(snapshot);
    expect((await repo.get('user-1', '2026-08-13'))?.calorieTargetSnapshot).toEqual(snapshot);
  });

  it('preserves the snapshot when the optional argument is omitted', async () => {
    const repo = getDayMetaRepository();
    await repo.upsert('user-1', '2026-08-13', 'rest', null, snapshot);

    const updated = await repo.upsert('user-1', '2026-08-13', 'training', 'gym');

    expect(updated.dayType).toBe('training');
    expect(updated.calorieTargetSnapshot).toEqual(snapshot);
  });

  it('clears a snapshot when an explicit context write cannot resolve a target', async () => {
    const repo = getDayMetaRepository();
    await repo.upsert('user-1', '2026-08-13', 'rest', null, snapshot);

    const updated = await repo.upsert('user-1', '2026-08-13', 'training', null, null);

    expect(updated.calorieTargetSnapshot).toBeUndefined();
  });

  it('keeps legacy DayMeta documents readable without a snapshot', async () => {
    const repo = getDayMetaRepository();

    const meta = await repo.upsert('user-1', '2026-08-12', 'rest');

    expect(meta.calorieTargetSnapshot).toBeUndefined();
    expect((await repo.get('user-1', '2026-08-12'))?.dayType).toBe('rest');
  });

  it('preserves a day snapshot when the special activity is changed or removed', async () => {
    const repo = getDayMetaRepository();
    await repo.upsert('user-1', '2026-08-13', 'rest', null, snapshot);
    const activity = {
      type: 'hiking' as const,
      movementTimeMinutes: 60,
      distanceKm: 4,
      elevationGainM: 100,
      bodyWeightKg: 70,
      dailyCalorieTarget: 2200,
      calculatedAt: '2026-08-13T10:00:00.000Z',
      estimatedMet: 4,
      activityCalories: 280,
      alreadyAccountedCalories: 91.67,
      activityBonus: 200,
    };

    await repo.setSpecialActivity('user-1', '2026-08-13', activity);
    expect((await repo.get('user-1', '2026-08-13'))?.calorieTargetSnapshot).toEqual(snapshot);

    await repo.removeSpecialActivity('user-1', '2026-08-13');
    expect((await repo.get('user-1', '2026-08-13'))?.calorieTargetSnapshot).toEqual(snapshot);
  });
});