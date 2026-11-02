import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CalorieTargetSnapshot, DayMeta, SpecialActivity } from '@fittrack/shared';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosDayMetaRepository } from './cosmosDayMetaRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosDayMetaRepository;

const USER_ID = 'contract-day-meta-user';
const DATE = '2026-08-13';
const snapshot: CalorieTargetSnapshot = {
  calories: 2400,
  capturedAt: '2026-08-13T10:00:00.000Z',
  source: 'profile',
};
const activity: SpecialActivity = {
  type: 'hiking',
  movementTimeMinutes: 60,
  distanceKm: 4,
  elevationGainM: 100,
  bodyWeightKg: 70,
  dailyCalorieTarget: 2200,
  calculatedAt: '2026-08-13T09:00:00.000Z',
  estimatedMet: 4,
  activityCalories: 280,
  alreadyAccountedCalories: 91.67,
  activityBonus: 200,
};

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosDayMetaRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

beforeEach(async () => {
  const container = ctx!.database.container('nutritionDiaryMeals');
  const { resources } = await container.items.query<{ id: string }>(
    {
      query: 'SELECT c.id FROM c WHERE c.userId = @userId',
      parameters: [{ name: '@userId', value: USER_ID }],
    },
    { partitionKey: USER_ID },
  ).fetchAll();
  for (const resource of resources) {
    await container.item(resource.id, USER_ID).delete();
  }
});

describe('CosmosDayMetaRepository.ensureCalorieTargetSnapshot (contract)', () => {
  it('creates a missing current-day document and returns it idempotently', async () => {
    const first = await repo.ensureCalorieTargetSnapshot(USER_ID, DATE, 'rest', snapshot);
    const second = await repo.ensureCalorieTargetSnapshot(
      USER_ID,
      DATE,
      'training',
      { ...snapshot, calories: 2600 },
    );

    expect(first).toMatchObject({
      id: `day:${DATE}`,
      dayType: 'rest',
      calorieTargetSnapshot: snapshot,
    });
    expect(second.calorieTargetSnapshot).toEqual(snapshot);
    expect(await repo.get(USER_ID, DATE)).toEqual(second);
  });

  it('adds only the missing snapshot field to existing DayMeta', async () => {
    const container = ctx!.database.container('nutritionDiaryMeals');
    await container.items.create({
      id: `day:${DATE}`,
      userId: USER_ID,
      date: DATE,
      dayType: 'training',
      workoutType: 'gym',
      specialActivity: activity,
      updatedAt: '2026-08-13T09:00:00.000Z',
      _docType: 'dayMeta',
      retainedExtension: 'keep',
    });

    const ensured = await repo.ensureCalorieTargetSnapshot(USER_ID, DATE, 'rest', snapshot);
    const persisted = await container.item(`day:${DATE}`, USER_ID).read<DayMeta & { retainedExtension: string }>();

    expect(ensured).toMatchObject({
      dayType: 'training',
      workoutType: 'gym',
      specialActivity: activity,
      calorieTargetSnapshot: snapshot,
    });
    expect(persisted.resource).toMatchObject({
      dayType: 'training',
      workoutType: 'gym',
      specialActivity: activity,
      calorieTargetSnapshot: snapshot,
      retainedExtension: 'keep',
    });
  });
});