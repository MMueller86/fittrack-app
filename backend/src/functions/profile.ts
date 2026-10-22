import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser, requireUserWithOptions, UnauthorizedError } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getProfileRepository } from '../lib/repositories/profileRepository';
import {
  ProfileDeletionInProgressError,
  ProfileDeletionStorageUnavailableError,
} from '../lib/repositories/profileDeletionRepository';
import { deleteUserProfileData, ProfileDeletionFailedError } from '../lib/profileDeletion';
import { calculateProfileTargets } from '../../../shared/lib/profileCalculator';
import type { UserProfile, ProfileInput } from '@fittrack/shared';

// GET    /api/profile/me                — return current profile (null if none)
// POST   /api/profile                   — create/replace profile + calculate targets
// PUT    /api/profile                   — update profile + recalculate targets
// POST   /api/profile/calculate-preview — calculate targets without saving

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ProfileInputSchema = z.object({
  gender: z.enum(['male', 'female', 'other']),
  age: z.number().int().min(10).max(120),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().positive().max(500),
  targetWeightKg: z.number().positive().max(500),
  stepsPerDay: z.number().int().min(0).max(100000).nullable(),
  activityLevel: z.enum(['sedentary', 'light', 'active', 'very_active']).nullable(),
  trainingFrequencyPerWeek: z.number().int().min(0).max(7),
  trainingDurationMinutes: z.number().int().min(0).max(600),
  sports: z.array(z.enum([
    'strength', 'bouldering', 'running', 'cycling',
    'swimming', 'hiking', 'teamsport', 'other',
  ])),
  goal: z.enum(['lose_weight', 'maintain', 'gain_muscle', 'recomposition']),
  goalIntensity: z.enum(['gentle', 'moderate', 'aggressive']).nullable(),
  displayName: z.string().max(50).optional(),
  healthSyncEnabled: z.boolean().optional(),
}).refine(
  (d) => d.stepsPerDay != null || d.activityLevel != null,
  { message: 'Either stepsPerDay or activityLevel must be provided', path: ['stepsPerDay'] },
);

const ProfileDeletionSchema = z.object({
  confirmation: z.literal('DELETE'),
  deleteCommunityRecipes: z.boolean(),
}).strict();

// ---------------------------------------------------------------------------
// Shared helper: build and upsert a profile document
// ---------------------------------------------------------------------------

async function buildAndSaveProfile(
  userId: string,
  input: ProfileInput,
  existingCreatedAt?: string,
  existingHealthSyncEnabled?: boolean,
): Promise<UserProfile> {
  const { targets, meta } = calculateProfileTargets(input);
  const now = new Date().toISOString();

  const profile: UserProfile = {
    id: 'profile',
    userId,
    gender: input.gender,
    age: input.age,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    targetWeightKg: input.targetWeightKg,
    stepsPerDay: input.stepsPerDay,
    activityLevel: input.activityLevel,
    trainingFrequencyPerWeek: input.trainingFrequencyPerWeek,
    trainingDurationMinutes: input.trainingDurationMinutes,
    sports: input.sports,
    goal: input.goal,
    goalIntensity: input.goalIntensity,
    ...(input.displayName !== undefined && { displayName: input.displayName }),
    ...(input.healthSyncEnabled !== undefined
      ? { healthSyncEnabled: input.healthSyncEnabled }
      : existingHealthSyncEnabled !== undefined
      ? { healthSyncEnabled: existingHealthSyncEnabled }
      : {}),
    targets,
    calculationMeta: meta,
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
  };

  const repo = getProfileRepository();
  return repo.upsert(profile);
}

// ---------------------------------------------------------------------------
// GET /api/profile/me
// ---------------------------------------------------------------------------

export const getProfileHandler = withHandler(
  'profile.get',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const repo = getProfileRepository();
    const profile = await repo.get(userId);

    logEvent(ctx, 'info', 'profile.get', { found: profile != null });

    return {
      status: 200,
      jsonBody: {
        profile,
        targets: profile?.targets ?? null,
      },
    };
  },
);

// ---------------------------------------------------------------------------
// POST /api/profile
// ---------------------------------------------------------------------------

export const createProfileHandler = withHandler(
  'profile.create',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const parsed = await parseBody(request, ProfileInputSchema);
    if (!parsed.ok) return parsed.response;

    const profile = await buildAndSaveProfile(userId, parsed.data);

    logEvent(ctx, 'info', 'profile.created', { goal: profile.goal });
    return { status: 201, jsonBody: { profile, targets: profile.targets } };
  },
);

// ---------------------------------------------------------------------------
// PUT /api/profile
// ---------------------------------------------------------------------------

export const updateProfileHandler = withHandler(
  'profile.update',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const parsed = await parseBody(request, ProfileInputSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getProfileRepository();
    const existing = await repo.get(userId);
    const profile = await buildAndSaveProfile(userId, parsed.data, existing?.createdAt, existing?.healthSyncEnabled);

    logEvent(ctx, 'info', 'profile.updated', { goal: profile.goal });
    return { status: 200, jsonBody: { profile, targets: profile.targets } };
  },
);

// ---------------------------------------------------------------------------
// POST /api/profile/calculate-preview
// ---------------------------------------------------------------------------

export const calculatePreviewHandler = withHandler(
  'profile.calculatePreview',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    await requireUser(request);
    const parsed = await parseBody(request, ProfileInputSchema);
    if (!parsed.ok) return parsed.response;

    const { targets, meta } = calculateProfileTargets(parsed.data);
    return { status: 200, jsonBody: { targets, calculationMeta: meta } };
  },
);

// ---------------------------------------------------------------------------
// Route registrations
// ---------------------------------------------------------------------------

app.http('profile-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'profile/me',
  handler: getProfileHandler,
});

app.http('profile-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'profile',
  handler: createProfileHandler,
});

app.http('profile-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'profile',
  handler: updateProfileHandler,
});

app.http('profile-calculate-preview', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'profile/calculate-preview',
  handler: calculatePreviewHandler,
});

// ---------------------------------------------------------------------------
// DELETE /api/profile
// ---------------------------------------------------------------------------

export const deleteProfileHandler = withHandler(
  'profile.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    let userId: string;
    try {
      ({ userId } = await requireUserWithOptions(request, { allowDuringProfileDeletion: true }));
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return {
          status: 401,
          jsonBody: { error: 'authentication_required', message: 'Bitte melde dich erneut an.' },
        };
      }
      throw error;
    }
    const parsed = await parseBody(request, ProfileDeletionSchema);
    if (!parsed.ok) {
      return {
        status: 400,
        jsonBody: {
          error: 'invalid_profile_deletion_request',
          message: 'Die Löschanfrage ist ungültig. Bitte prüfe die Bestätigung.',
        },
      };
    }
    try {
      await deleteUserProfileData(userId, parsed.data.deleteCommunityRecipes);
      logEvent(ctx, 'info', 'profile.deleted', {});
      return { status: 204 };
    } catch (error) {
      if (error instanceof ProfileDeletionInProgressError) {
        return {
          status: 409,
          jsonBody: {
            error: 'profile_deletion_in_progress',
            message: 'Eine Löschung läuft bereits. Bitte versuche es erneut.',
            retryable: true,
          },
        };
      }
      if (error instanceof ProfileDeletionStorageUnavailableError) {
        return {
          status: 503,
          jsonBody: {
            error: 'profile_deletion_unavailable',
            message: 'Der Löschdienst ist vorübergehend nicht verfügbar. Bitte versuche es erneut.',
            retryable: true,
          },
        };
      }
      if (error instanceof ProfileDeletionFailedError) {
        logEvent(ctx, 'error', 'profile.deletion.failed', {
          stage: error.stage,
          cause_type: error.causeType,
        });
      } else {
        logEvent(ctx, 'error', 'profile.deletion.failed', {
          stage: 'acquire-or-release-lock',
          cause_type: error instanceof Error ? error.name : typeof error,
        });
      }
      return {
        status: 503,
        jsonBody: {
          error: 'profile_deletion_failed',
          message: 'Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.',
          retryable: true,
        },
      };
    }
  },
);

app.http('profile-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'profile',
  handler: deleteProfileHandler,
});

