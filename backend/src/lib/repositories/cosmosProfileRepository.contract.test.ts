import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { UserProfile } from '@fittrack/shared';
import { calculateMacroRanges } from '../../../../shared/lib/macroRanges';
import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosProfileRepository } from './cosmosProfileRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosProfileRepository;

const USER_ID = 'contract-profile-legacy';

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosProfileRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

describe('CosmosProfileRepository (contract)', () => {
  it('derives missing macro ranges from a legacy profile without writing them back', async () => {
    const legacyProfile: UserProfile = {
      id: 'profile',
      userId: USER_ID,
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
      targets: {
        restDay: { calories: 2450, proteinG: 160, fatG: 75, carbsG: 285, fiberG: 34 },
        trainingDay: { calories: 2700, proteinG: 160, fatG: 75, carbsG: 345, fiberG: 38 },
      },
      calculationMeta: {
        formulaVersion: 'profile-targets-v1-pal',
        bmr: 1701,
        pal: 1.6,
        maintenanceRestDay: 2722,
        trainingDayBonus: 250,
        goalAdjustment: -250,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const profiles = ctx!.database.container('profiles');
    await profiles.items.create(legacyProfile);

    const profile = await repo.get(USER_ID);

    expect(profile?.targets.restDay.macroRanges).toEqual(
      calculateMacroRanges(legacyProfile.weightKg, 2450, 75),
    );
    expect(profile?.targets.trainingDay.macroRanges).toEqual(
      calculateMacroRanges(legacyProfile.weightKg, 2700, 75),
    );
    expect(profile?.calculationMeta.formulaVersion).toBe('profile-targets-v1-pal');

    const { resource } = await profiles.item('profile', USER_ID).read<Record<string, unknown>>();
    const storedTargets = resource!.targets as {
      restDay: Record<string, unknown>;
      trainingDay: Record<string, unknown>;
    };
    expect(storedTargets.restDay).not.toHaveProperty('macroRanges');
    expect(storedTargets.trainingDay).not.toHaveProperty('macroRanges');
  });
});