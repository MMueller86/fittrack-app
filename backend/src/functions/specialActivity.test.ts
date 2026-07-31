import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';

import { setSpecialActivityHandler, removeSpecialActivityHandler } from './specialActivity';
import { getDayMetaRepository, __resetDayMetaRepositoryForTests } from '../lib/repositories/dayMetaRepository';
import { __resetProfileRepositoryForTests, getProfileRepository } from '../lib/repositories/profileRepository';
import { __resetWeightsRepositoryForTests, getWeightsRepository } from '../lib/repositories/weightsRepository';
import {
  makeContext,
  makeAuthRequest,
  makeRequest,
  setupTestAuth,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';
import type { SpecialActivity, WeightEntry, UserProfile } from '@fittrack/shared';

const originalEnv = { ...process.env };

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
  __resetWeightsRepositoryForTests();
});

afterEach(() => {
  Object.assign(process.env, originalEnv);
  __resetDayMetaRepositoryForTests();
  __resetProfileRepositoryForTests();
  __resetWeightsRepositoryForTests();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_HIKING_BODY = {
  type: 'hiking',
  movementTimeMinutes: 240,
  distanceKm: 12,
  elevationGainM: 1000,
  elevationLossM: 1000,
  packCategory: 'none',
  terrainType: 'alpine',
};

const VALID_DATE = '2026-07-21';

/** Minimal valid profile with weightKg and targets. */
async function createProfile(overrides: Partial<UserProfile> = {}): Promise<void> {
  const profile: UserProfile = {
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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
  await getProfileRepository().upsert(profile);
}

async function addWeightEntry(value: number): Promise<void> {
  const entry: WeightEntry = {
    id: 'w1',
    userId: TEST_USER_ID,
    date: '2026-07-20',
    value,
    unit: 'kg',
    createdAt: '2026-07-20T08:00:00Z',
  };
  await getWeightsRepository().add(entry);
}

// ---------------------------------------------------------------------------
// PUT /api/diary/day/{date}/special-activity
// ---------------------------------------------------------------------------

describe('PUT /api/diary/day/{date}/special-activity', () => {
  it('AC-4 / AC-13: returns 200 with specialActivity and activityBonus > 0 when profile exists', async () => {
    await createProfile();

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { specialActivity: SpecialActivity; activityBonus: number; effectiveCalorieTarget: number };
    expect(body.activityBonus).toBeGreaterThan(0);
    // AC-13: 70 kg, 240 min, 12 km, gainM=1000, lossM=1000, none, alpine, 2000 kcal → bonus = 1550
    // estimatedMet ≈ 6.705, hikingCal ≈ 1877, alreadyAccounted ≈ 333, rawBonus ≈ 1544 → rounded to 1550
    expect(body.activityBonus).toBe(1550);
    expect(body.specialActivity.type).toBe('hiking');
    expect(body.specialActivity.bodyWeightKg).toBe(70);
    expect(body.specialActivity.dailyCalorieTarget).toBe(2000);
    expect(body.effectiveCalorieTarget).toBe(2000 + 1550);
  });

  it('AC-10: training day uses training day calorie target', async () => {
    await createProfile();
    // Set the day as a training day
    await getDayMetaRepository().upsert(TEST_USER_ID, VALID_DATE, 'training');

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { specialActivity: SpecialActivity };
    // Training target is 2400 kcal
    expect(body.specialActivity.dailyCalorieTarget).toBe(2400);
  });

  it('AC-14: weight fallback — no profile.weightKg → uses WeightEntry', async () => {
    // Profile without explicit weightKg (0 is treated as missing)
    await createProfile({ weightKg: 0 });
    await addWeightEntry(75);

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { specialActivity: SpecialActivity };
    expect(body.specialActivity.bodyWeightKg).toBe(75);
  });

  it('AC-16: returns 422 with German message when no weight available', async () => {
    // No profile, no weight entries
    const res = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    expect(res.status).toBe(422);
    const body = res.jsonBody as { error: string };
    expect(body.error).toContain('Kein Körpergewicht');
  });

  it('AC-17: movementTimeMinutes < 30 → 400', async () => {
    await createProfile();

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({
        params: { date: VALID_DATE },
        body: { ...VALID_HIKING_BODY, movementTimeMinutes: 20 },
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
  });

  it('AC-18: distanceKm = 200 → 400 (exceeds max 100)', async () => {
    await createProfile();

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({
        params: { date: VALID_DATE },
        body: { ...VALID_HIKING_BODY, distanceKm: 200 },
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
  });

  it('AC-19: 60 min, 20 km → 422 (speed 20 km/h > 10 km/h)', async () => {
    await createProfile();

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({
        params: { date: VALID_DATE },
        body: { movementTimeMinutes: 60, distanceKm: 20, elevationGainM: 0, hasBackpack: false },
      }),
      makeContext(),
    );

    expect(res.status).toBe(422);
    const body = res.jsonBody as { error: string };
    expect(body.error).toContain('plausibel');
  });

  it('AC-20: very short activity → activityBonus >= 0 (never negative)', async () => {
    await createProfile({ weightKg: 60 });

    // Minimal valid inputs — slow walk, short duration
    const res = await setSpecialActivityHandler(
      await makeAuthRequest({
        params: { date: VALID_DATE },
        body: { movementTimeMinutes: 30, distanceKm: 1, elevationGainM: 0, hasBackpack: false },
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { activityBonus: number };
    expect(body.activityBonus).toBeGreaterThanOrEqual(0);
  });

  it('packCategory heavy liefert höheren Bonus als none', async () => {
    await createProfile();

    const baseBody = { movementTimeMinutes: 240, distanceKm: 12, elevationGainM: 1000, elevationLossM: 1000, terrainType: 'alpine' };

    const resNone = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: { ...baseBody, packCategory: 'none' } }),
      makeContext(),
    );
    const resHeavy = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: { ...baseBody, packCategory: 'heavy' } }),
      makeContext(),
    );

    const bonusNone  = (resNone.jsonBody  as { activityBonus: number }).activityBonus;
    const bonusHeavy = (resHeavy.jsonBody as { activityBonus: number }).activityBonus;
    expect(bonusHeavy).toBeGreaterThan(bonusNone);
  });

  it('terrainType alpine liefert höheren Bonus als path', async () => {
    await createProfile();

    const baseBody = { movementTimeMinutes: 240, distanceKm: 12, elevationGainM: 1000, elevationLossM: 1000, packCategory: 'none' };

    const resPath   = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: { ...baseBody, terrainType: 'path' } }),
      makeContext(),
    );
    const resAlpine = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: { ...baseBody, terrainType: 'alpine' } }),
      makeContext(),
    );

    const bonusPath   = (resPath.jsonBody   as { activityBonus: number }).activityBonus;
    const bonusAlpine = (resAlpine.jsonBody as { activityBonus: number }).activityBonus;
    expect(bonusAlpine).toBeGreaterThan(bonusPath);
  });

  it('elevationLossM 500 erscheint im Response-Dokument', async () => {
    await createProfile();

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({
        params: { date: VALID_DATE },
        body: { movementTimeMinutes: 240, distanceKm: 12, elevationGainM: 600, elevationLossM: 500, packCategory: 'none', terrainType: 'trail' },
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { specialActivity: SpecialActivity };
    expect(body.specialActivity.elevationLossM).toBe(500);
  });

  it('Response enthält metBase, metLocomotion, terrainFactor, deltaPack und diese sind plausibel', async () => {
    await createProfile();

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { metBase: number; metLocomotion: number; terrainFactor: number; deltaPack: number };
    expect(body.metBase).toBeGreaterThan(0);
    expect(body.metLocomotion).toBeGreaterThanOrEqual(body.metBase);
    expect(body.terrainFactor).toBeGreaterThanOrEqual(1.0);
    expect(body.deltaPack).toBe(0); // packCategory 'none'
  });

  it('Legacy hasBackpack:true ohne packCategory → HTTP 200 und activityBonus > 0', async () => {
    await createProfile();

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({
        params: { date: VALID_DATE },
        body: { movementTimeMinutes: 240, distanceKm: 12, elevationGainM: 600, hasBackpack: true },
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { activityBonus: number };
    expect(body.activityBonus).toBeGreaterThan(0);
  });

  it('AC-15: returns 401 without auth token', async () => {
    const res = await setSpecialActivityHandler(
      await makeRequest({ params: { date: VALID_DATE }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid date format', async () => {
    await createProfile();

    const res = await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: 'not-a-date' }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    expect(res.status).toBe(400);
  });

  it('persists the specialActivity to the repository', async () => {
    await createProfile();

    await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    const dayMeta = await getDayMetaRepository().get(TEST_USER_ID, VALID_DATE);
    expect(dayMeta?.specialActivity).toBeDefined();
    expect(dayMeta?.specialActivity?.type).toBe('hiking');
    expect(dayMeta?.specialActivity?.activityBonus).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/diary/day/{date}/special-activity
// ---------------------------------------------------------------------------

describe('DELETE /api/diary/day/{date}/special-activity', () => {
  it('returns 200 { success: true } when activity exists', async () => {
    await createProfile();

    // First add an activity
    await setSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE }, body: VALID_HIKING_BODY }),
      makeContext(),
    );

    const res = await removeSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE } }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect((res.jsonBody as { success: boolean }).success).toBe(true);

    // Verify it was removed
    const dayMeta = await getDayMetaRepository().get(TEST_USER_ID, VALID_DATE);
    expect(dayMeta?.specialActivity).toBeUndefined();
  });

  it('is idempotent — returns 200 even when no activity exists for the date', async () => {
    const res = await removeSpecialActivityHandler(
      await makeAuthRequest({ params: { date: VALID_DATE } }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect((res.jsonBody as { success: boolean }).success).toBe(true);
  });

  it('AC-15: returns 401 without auth token', async () => {
    const res = await removeSpecialActivityHandler(
      await makeRequest({ params: { date: VALID_DATE } }),
      makeContext(),
    );

    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid date', async () => {
    const res = await removeSpecialActivityHandler(
      await makeAuthRequest({ params: { date: '2026-13-99' } }),
      makeContext(),
    );

    expect(res.status).toBe(400);
  });
});
