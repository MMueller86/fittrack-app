import { beforeAll, beforeEach, describe, expect, it, afterAll } from 'vitest';

import { setDayTypeHandler } from './diary';
import { updateProfileHandler } from './profile';
import {
  __resetDayMetaRepositoryForTests,
  getDayMetaRepository,
} from '../lib/repositories/dayMetaRepository';
import { __resetProfileRepositoryForTests, getProfileRepository } from '../lib/repositories/profileRepository';
import {
  makeAuthRequest,
  makeContext,
  setupTestAuth,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';
import type { UserProfile } from '@fittrack/shared';

const originalEnv = { ...process.env };

const profileInput = {
  gender: 'male',
  age: 35,
  heightCm: 178,
  weightKg: 70,
  targetWeightKg: 68,
  stepsPerDay: 8000,
  activityLevel: null,
  trainingFrequencyPerWeek: 3,
  trainingDurationMinutes: 60,
  sports: ['hiking'],
  goal: 'lose_weight',
  goalIntensity: 'gentle',
};

function makeProfile(): UserProfile {
  return {
    id: 'profile',
    userId: TEST_USER_ID,
    gender: 'male',
    age: 35,
    heightCm: 178,
    weightKg: 70,
    targetWeightKg: 68,
    stepsPerDay: 8000,
    activityLevel: null,
    trainingFrequencyPerWeek: 3,
    trainingDurationMinutes: 60,
    sports: ['hiking'],
    goal: 'lose_weight',
    goalIntensity: 'gentle',
    targets: {
      restDay: { calories: 2000, proteinG: 150, carbsG: 200, fatG: 70, fiberG: 25 },
      trainingDay: { calories: 2400, proteinG: 160, carbsG: 250, fatG: 75, fiberG: 28 },
    },
    calculationMeta: {
      formulaVersion: 'profile-targets-v1-pal',
      bmr: 1700,
      pal: 1.4,
      maintenanceRestDay: 2380,
      trainingDayBonus: 300,
      goalAdjustment: -380,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  __resetDayMetaRepositoryForTests();
  __resetProfileRepositoryForTests();
});

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

describe('explicit historical day context snapshots', () => {
  it('captures the selected profile target and updates it on an explicit day-type change', async () => {
    await getProfileRepository().upsert(makeProfile());

    await setDayTypeHandler(
      await makeAuthRequest({ params: { date: '2026-08-13' }, body: { dayType: 'rest' } }),
      makeContext(),
    );
    expect((await getDayMetaRepository().get(TEST_USER_ID, '2026-08-13'))?.calorieTargetSnapshot?.calories)
      .toBe(2000);

    await setDayTypeHandler(
      await makeAuthRequest({ params: { date: '2026-08-13' }, body: { dayType: 'training', workoutType: 'gym' } }),
      makeContext(),
    );
    const updated = await getDayMetaRepository().get(TEST_USER_ID, '2026-08-13');
    expect(updated?.calorieTargetSnapshot?.calories).toBe(2400);
    expect(updated?.dayType).toBe('training');
  });

  it('does not rewrite an old snapshot when the current profile changes', async () => {
    await getProfileRepository().upsert(makeProfile());
    await setDayTypeHandler(
      await makeAuthRequest({ params: { date: '2026-08-13' }, body: { dayType: 'rest' } }),
      makeContext(),
    );

    const before = await getDayMetaRepository().get(TEST_USER_ID, '2026-08-13');
    await updateProfileHandler(await makeAuthRequest({ body: { ...profileInput, weightKg: 110 } }), makeContext());

    const after = await getDayMetaRepository().get(TEST_USER_ID, '2026-08-13');
    expect(after?.calorieTargetSnapshot).toEqual(before?.calorieTargetSnapshot);
  });

  it('keeps the existing day-type contract usable without a profile and records no invented target', async () => {
    const response = await setDayTypeHandler(
      await makeAuthRequest({ params: { date: '2026-08-13' }, body: { dayType: 'rest' } }),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect((response.jsonBody as { dayMeta: UserProfile }).dayMeta).toBeDefined();
    expect((await getDayMetaRepository().get(TEST_USER_ID, '2026-08-13'))?.calorieTargetSnapshot).toBeUndefined();
  });
});