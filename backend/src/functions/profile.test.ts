import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

import {
  getProfileHandler,
  createProfileHandler,
  updateProfileHandler,
  calculatePreviewHandler,
} from './profile';
import { __resetProfileRepositoryForTests } from '../lib/repositories/profileRepository';
import {
  makeContext,
  makeAuthRequest,
  makeRequest,
  setupTestAuth,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';
import type { UserProfile, ProfileTargets } from '@fittrack/shared';

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
  __resetProfileRepositoryForTests();
});

// ---------------------------------------------------------------------------
// Shared valid input fixture
// ---------------------------------------------------------------------------

const validInput = {
  gender: 'male',
  age: 39,
  heightCm: 173,
  weightKg: 81,
  targetWeightKg: 75,
  stepsPerDay: 10000,
  activityLevel: null,
  trainingFrequencyPerWeek: 4,
  trainingDurationMinutes: 60,
  sports: ['strength'],
  goal: 'lose_weight',
  goalIntensity: 'gentle',
} as const;

// ---------------------------------------------------------------------------
// GET /api/profile/me
// ---------------------------------------------------------------------------

describe('GET /api/profile/me', () => {
  it('returns {profile: null, targets: null} when no profile exists', async () => {
    const res = await getProfileHandler(await makeAuthRequest(), makeContext());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({ profile: null, targets: null });
  });

  it('returns the profile after it has been created', async () => {
    await createProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );

    const res = await getProfileHandler(await makeAuthRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { profile: UserProfile; targets: ProfileTargets };
    expect(body.profile.userId).toBe(TEST_USER_ID);
    expect(body.profile.targetWeightKg).toBe(75);
    expect(body.profile.goal).toBe('lose_weight');
    expect(body.targets.restDay.calories).toBeGreaterThan(0);
  });

  it('returns 401 without token', async () => {
    const res = await getProfileHandler(await makeRequest(), makeContext());
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/profile
// ---------------------------------------------------------------------------

describe('POST /api/profile', () => {
  it('creates profile and returns 201 with targets', async () => {
    const res = await createProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { profile: UserProfile; targets: ProfileTargets };
    expect(body.profile.id).toBe('profile');
    expect(body.profile.userId).toBe(TEST_USER_ID);
    expect(body.profile.gender).toBe('male');
    expect(body.profile.targetWeightKg).toBe(75);
    expect(body.profile.sports).toEqual(['strength']);
    expect(body.targets.restDay.calories).toBeGreaterThan(0);
    expect(body.targets.trainingDay.calories).toBeGreaterThan(body.targets.restDay.calories);
  });

  it('stores calculationMeta with formulaVersion', async () => {
    const res = await createProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );
    const body = res.jsonBody as { profile: UserProfile };
    expect(body.profile.calculationMeta.formulaVersion).toBe('profile-targets-v1-pal');
    expect(body.profile.calculationMeta.bmr).toBeGreaterThan(0);
    expect(body.profile.calculationMeta.pal).toBeCloseTo(1.60, 1);
  });

  it('returns 400 when targetWeightKg is missing', async () => {
    const { targetWeightKg: _, ...withoutTarget } = validInput;
    const res = await createProfileHandler(
      await makeAuthRequest({ body: withoutTarget }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when both stepsPerDay and activityLevel are null', async () => {
    const res = await createProfileHandler(
      await makeAuthRequest({
        body: { ...validInput, stepsPerDay: null, activityLevel: null },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid gender', async () => {
    const res = await createProfileHandler(
      await makeAuthRequest({ body: { ...validInput, gender: 'alien' } }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await createProfileHandler(
      await makeRequest({ body: validInput }),
      makeContext(),
    );
    expect(res.status).toBe(401);
  });

  it('accepts activityLevel fallback when stepsPerDay is null', async () => {
    const res = await createProfileHandler(
      await makeAuthRequest({
        body: { ...validInput, stepsPerDay: null, activityLevel: 'light' },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { profile: UserProfile };
    expect(body.profile.calculationMeta.pal).toBeCloseTo(1.55, 2);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/profile
// ---------------------------------------------------------------------------

describe('PUT /api/profile', () => {
  it('updates profile and recalculates targets', async () => {
    await createProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );

    const updatedInput = { ...validInput, goal: 'maintain', goalIntensity: null } as const;
    const res = await updateProfileHandler(
      await makeAuthRequest({ body: updatedInput }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { profile: UserProfile; targets: ProfileTargets };
    expect(body.profile.goal).toBe('maintain');
    // maintain: rest == training (no bonus net change in goal adj but training bonus applies)
    expect(body.targets.restDay.calories).toBeGreaterThan(0);
  });

  it('preserves createdAt when updating', async () => {
    const createRes = await createProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );
    const created = (createRes.jsonBody as { profile: UserProfile }).profile.createdAt;

    const updateRes = await updateProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );
    const updated = (updateRes.jsonBody as { profile: UserProfile }).profile.createdAt;

    expect(updated).toBe(created);
  });

  it('returns 401 without token', async () => {
    const res = await updateProfileHandler(
      await makeRequest({ body: validInput }),
      makeContext(),
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/profile/calculate-preview
// ---------------------------------------------------------------------------

describe('POST /api/profile/calculate-preview', () => {
  it('returns targets without saving', async () => {
    const res = await calculatePreviewHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { targets: ProfileTargets };
    expect(body.targets.restDay.calories).toBeGreaterThan(0);
    expect(body.targets.trainingDay.calories).toBeGreaterThan(body.targets.restDay.calories);

    // Must NOT save to repository
    const getRes = await getProfileHandler(await makeAuthRequest(), makeContext());
    expect((getRes.jsonBody as { profile: null }).profile).toBeNull();
  });

  it('returns calculationMeta in preview', async () => {
    const res = await calculatePreviewHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );
    const body = res.jsonBody as { calculationMeta: { formulaVersion: string } };
    expect(body.calculationMeta.formulaVersion).toBe('profile-targets-v1-pal');
  });

  it('returns 401 without token', async () => {
    const res = await calculatePreviewHandler(
      await makeRequest({ body: validInput }),
      makeContext(),
    );
    expect(res.status).toBe(401);
  });
});
