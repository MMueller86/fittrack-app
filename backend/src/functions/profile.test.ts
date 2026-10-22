import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';

vi.mock('../lib/profileDeletion', async () => {
  const actual = await vi.importActual<typeof import('../lib/profileDeletion')>('../lib/profileDeletion');
  return { ...actual, deleteUserProfileData: vi.fn() };
});

import {
  getProfileHandler,
  createProfileHandler,
  updateProfileHandler,
  calculatePreviewHandler,
  deleteProfileHandler,
} from './profile';
import { __resetProfileRepositoryForTests } from '../lib/repositories/profileRepository';
import { getProfileRepository } from '../lib/repositories/profileRepository';
import { calculateMacroRanges } from '../../../shared/lib/macroRanges';
import { deleteUserProfileData, ProfileDeletionFailedError } from '../lib/profileDeletion';
import {
  ProfileDeletionInProgressError,
  ProfileDeletionStorageUnavailableError,
} from '../lib/repositories/profileDeletionRepository';
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

afterEach(() => {
  vi.mocked(deleteUserProfileData).mockReset();
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
    expect(body.targets.restDay.macroRanges).toEqual(body.profile.targets.restDay.macroRanges);
    expect(body.targets.trainingDay.macroRanges).toEqual(body.profile.targets.trainingDay.macroRanges);
  });

  it('leaves display-name-only profile projections readable', async () => {
    await getProfileRepository().upsert({
      id: 'profile',
      userId: TEST_USER_ID,
      displayName: 'Sportler',
    } as unknown as UserProfile);

    const res = await getProfileHandler(await makeAuthRequest(), makeContext());

    expect(res.status).toBe(200);
    expect((res.jsonBody as { profile: UserProfile }).profile.displayName).toBe('Sportler');
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
    expect(body.targets.restDay.macroRanges).toBeDefined();
    expect(body.targets.trainingDay.macroRanges).toBeDefined();
  });

  it('stores calculationMeta with formulaVersion', async () => {
    const res = await createProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );
    const body = res.jsonBody as { profile: UserProfile };
    expect(body.profile.calculationMeta.formulaVersion).toBe('profile-targets-v2-macro-ranges');
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

  it('resolves missing ranges for a legacy profile without changing its scalar targets', async () => {
    const createRes = await createProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );
    const created = (createRes.jsonBody as { profile: UserProfile }).profile;
    const restDay = { ...created.targets.restDay };
    const trainingDay = { ...created.targets.trainingDay };
    delete restDay.macroRanges;
    delete trainingDay.macroRanges;

    await getProfileRepository().upsert({
      ...created,
      targets: { restDay, trainingDay },
      calculationMeta: {
        ...created.calculationMeta,
        formulaVersion: 'profile-targets-v1-pal',
      },
    });

    const res = await getProfileHandler(await makeAuthRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { profile: UserProfile; targets: ProfileTargets };

    expect(body.profile.calculationMeta.formulaVersion).toBe('profile-targets-v1-pal');
    expect(body.targets.restDay.macroRanges).toEqual(
      calculateMacroRanges(body.profile.weightKg, body.targets.restDay.calories, body.targets.restDay.fatG),
    );
    expect(body.targets.trainingDay.macroRanges).toEqual(
      calculateMacroRanges(body.profile.weightKg, body.targets.trainingDay.calories, body.targets.trainingDay.fatG),
    );
    expect(body.targets.restDay.proteinG).toBe(restDay.proteinG);
    expect(body.targets.restDay.carbsG).toBe(restDay.carbsG);
    expect(body.targets.restDay.fatG).toBe(restDay.fatG);
    expect(body.targets.restDay.fiberG).toBe(restDay.fiberG);
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
    expect(body.targets.restDay.macroRanges).toBeDefined();
    expect(body.targets.trainingDay.macroRanges).toBeDefined();
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

  it('persists healthSyncEnabled: true', async () => {
    await createProfileHandler(await makeAuthRequest({ body: validInput }), makeContext());

    const res = await updateProfileHandler(
      await makeAuthRequest({ body: { ...validInput, healthSyncEnabled: true } }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { profile: UserProfile };
    expect(body.profile.healthSyncEnabled).toBe(true);
  });

  it('persists healthSyncEnabled: false', async () => {
    await createProfileHandler(await makeAuthRequest({ body: validInput }), makeContext());

    const res = await updateProfileHandler(
      await makeAuthRequest({ body: { ...validInput, healthSyncEnabled: false } }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { profile: UserProfile };
    expect(body.profile.healthSyncEnabled).toBe(false);
  });

  it('preserves existing healthSyncEnabled when field is absent from body', async () => {
    await createProfileHandler(await makeAuthRequest({ body: validInput }), makeContext());
    await updateProfileHandler(
      await makeAuthRequest({ body: { ...validInput, healthSyncEnabled: true } }),
      makeContext(),
    );

    const res = await updateProfileHandler(
      await makeAuthRequest({ body: validInput }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const body = res.jsonBody as { profile: UserProfile };
    expect(body.profile.healthSyncEnabled).toBe(true);
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
    expect(body.targets.restDay.macroRanges).toBeDefined();
    expect(body.targets.trainingDay.macroRanges).toBeDefined();

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
    expect(body.calculationMeta.formulaVersion).toBe('profile-targets-v2-macro-ranges');
  });

  it('returns 401 without token', async () => {
    const res = await calculatePreviewHandler(
      await makeRequest({ body: validInput }),
      makeContext(),
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/profile
// ---------------------------------------------------------------------------

describe('DELETE /api/profile', () => {
  it('requires the exact confirmation and community-recipe choice', async () => {
    const res = await deleteProfileHandler(await makeAuthRequest({
      body: { confirmation: 'DELETE' },
    }), makeContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({
      error: 'invalid_profile_deletion_request',
      message: 'Die Löschanfrage ist ungültig. Bitte prüfe die Bestätigung.',
    });
  });

  it('requires the case-sensitive DELETE confirmation', async () => {
    const res = await deleteProfileHandler(await makeAuthRequest({
      body: { confirmation: 'delete', deleteCommunityRecipes: false },
    }), makeContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual(expect.objectContaining({ error: 'invalid_profile_deletion_request' }));
    expect(deleteUserProfileData).not.toHaveBeenCalled();
  });

  it('rejects unknown request fields', async () => {
    const res = await deleteProfileHandler(await makeAuthRequest({
      body: { confirmation: 'DELETE', deleteCommunityRecipes: false, extra: true },
    }), makeContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({
      error: 'invalid_profile_deletion_request',
      message: 'Die Löschanfrage ist ungültig. Bitte prüfe die Bestätigung.',
    });
    expect(deleteUserProfileData).not.toHaveBeenCalled();
  });

  it('rejects the legacy community-recipe field name', async () => {
    const res = await deleteProfileHandler(await makeAuthRequest({
      body: { confirmation: 'DELETE', deletePublishedCommunityRecipes: false },
    }), makeContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual(expect.objectContaining({ error: 'invalid_profile_deletion_request' }));
    expect(deleteUserProfileData).not.toHaveBeenCalled();
  });

  it('requires a valid authenticated session and returns a stable 401 code', async () => {
    const res = await deleteProfileHandler(await makeRequest({
      body: { confirmation: 'DELETE', deleteCommunityRecipes: false },
    }), makeContext());

    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({
      error: 'authentication_required',
      message: 'Bitte melde dich erneut an.',
    });
  });

  it('returns 204 only after the full service resolves', async () => {
    vi.mocked(deleteUserProfileData).mockResolvedValue(undefined);
    const res = await deleteProfileHandler(await makeAuthRequest({
      body: { confirmation: 'DELETE', deleteCommunityRecipes: false },
    }), makeContext());

    expect(res.status).toBe(204);
    expect(deleteUserProfileData).toHaveBeenCalledWith(TEST_USER_ID, false);
  });

  it('returns retryable conflict while another deletion owns the lease', async () => {
    vi.mocked(deleteUserProfileData).mockRejectedValue(new ProfileDeletionInProgressError());
    const res = await deleteProfileHandler(await makeAuthRequest({
      body: { confirmation: 'DELETE', deleteCommunityRecipes: true },
    }), makeContext());

    expect(res.status).toBe(409);
    expect(res.jsonBody).toEqual({
      error: 'profile_deletion_in_progress',
      message: 'Eine Löschung läuft bereits. Bitte versuche es erneut.',
      retryable: true,
    });
  });

  it('returns a retryable stable error when storage is unavailable', async () => {
    vi.mocked(deleteUserProfileData).mockRejectedValue(new ProfileDeletionStorageUnavailableError());
    const res = await deleteProfileHandler(await makeAuthRequest({
      body: { confirmation: 'DELETE', deleteCommunityRecipes: false },
    }), makeContext());

    expect(res.status).toBe(503);
    expect(res.jsonBody).toEqual({
      error: 'profile_deletion_unavailable',
      message: 'Der Löschdienst ist vorübergehend nicht verfügbar. Bitte versuche es erneut.',
      retryable: true,
    });
  });

  it('returns a retryable stable error after a partial failure', async () => {
    vi.mocked(deleteUserProfileData).mockRejectedValue(new ProfileDeletionFailedError('delete-user-documents', 'Error'));
    const res = await deleteProfileHandler(await makeAuthRequest({
      body: { confirmation: 'DELETE', deleteCommunityRecipes: true },
    }), makeContext());

    expect(res.status).toBe(503);
    expect(res.jsonBody).toEqual({
      error: 'profile_deletion_failed',
      message: 'Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.',
      retryable: true,
    });
  });
});
