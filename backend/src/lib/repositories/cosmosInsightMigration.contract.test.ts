import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  EMULATOR_ENDPOINT,
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = resolve(
  __dirname,
  '../../../scripts/migrate-insight-weight-trend.mjs',
);
const USER_A = 'contract-insight-migration-a';

let ctx: EmulatorContext | undefined;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
});

beforeEach(async () => {
  const container = ctx!.database.container('aiInsights');
  const { resources } = await container.items
    .query<{ id: string }>(
      { query: 'SELECT c.id FROM c WHERE c.userId = @userId', parameters: [{ name: '@userId', value: USER_A }] },
      { partitionKey: USER_A },
    )
    .fetchAll();
  for (const document of resources) {
    await container.item(document.id, USER_A).delete();
  }
});

function makeWeightContext(trend: Record<string, unknown>): Record<string, unknown> {
  return {
    date: '2026-08-20',
    weight: {
      latestKg: 80,
      previousKg: 81,
      targetKg: 75,
      last7Values: [80, 80.5],
      isOutlierPrevious: false,
      isOutlierLatest: false,
      daysSinceLastMeasurement: 0,
      lastMeasurementDate: '2026-08-20',
      ...trend,
    },
    marker: 'preserve-me',
  };
}

async function seed(document: Record<string, unknown>): Promise<void> {
  await ctx!.database.container('aiInsights').items.upsert(document);
}

async function read(documentId: string): Promise<Record<string, unknown>> {
  const { resource } = await ctx!.database
    .container('aiInsights')
    .item(documentId, USER_A)
    .read<Record<string, unknown>>();
  return resource!;
}

function getWeight(document: Record<string, unknown>): Record<string, unknown> {
  const inputContext = document.inputContext as Record<string, unknown>;
  return inputContext.weight as Record<string, unknown>;
}

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

async function runMigration(): Promise<{ code: number; output: string }> {
  const environment = {
    ...process.env,
    COSMOS_ENDPOINT: EMULATOR_ENDPOINT,
    COSMOS_KEY: process.env.COSMOS_KEY,
    COSMOS_DATABASE_ID: ctx!.databaseId,
  };
  try {
    const result = await execFileAsync(process.execPath, [SCRIPT_PATH], {
      cwd: resolve(__dirname, '../../../'),
      env: environment,
    });
    return { code: 0, output: `${result.stdout}\n${result.stderr}` };
  } catch (error) {
    const result = error as Error & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: typeof result.code === 'number' ? result.code : 1,
      output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    };
  }
}

describe('insight weight trend migration (contract)', () => {
  it('migrates Daily and feedback snapshots, preserves data, excludes Weekly, and is idempotent', async () => {
    const legacyDaily = {
      id: `${USER_A}:legacy-daily`,
      userId: USER_A,
      date: '2026-08-18',
      inputContext: makeWeightContext({ trend7d: 'losing' }),
      ttl: 3600,
      expiresAt: '2026-08-19T00:00:00.000Z',
      response: { title: 'Legacy Daily' },
    };
    const daily = {
      id: `${USER_A}:daily`,
      userId: USER_A,
      _docType: 'dailyInsight',
      date: '2026-08-19',
      inputContext: makeWeightContext({ trend7d: 'stable' }),
      ttl: 7200,
      expiresAt: '2026-08-20T00:00:00.000Z',
      response: { title: 'Daily' },
    };
    const feedback = {
      id: `${USER_A}:feedback`,
      userId: USER_A,
      _docType: 'insightFeedback',
      date: '2026-08-17',
      inputContext: makeWeightContext({ trend7d: 'gaining' }),
      response: { title: 'Feedback snapshot' },
      userComment: 'Keep this feedback.',
    };
    const alreadyMigrated = {
      id: `${USER_A}:already-migrated`,
      userId: USER_A,
      _docType: 'dailyInsight',
      date: '2026-08-16',
      inputContext: makeWeightContext({ weeklyTrend30d: 'stable' }),
      ttl: 1800,
    };
    const equalDualKey = {
      id: `${USER_A}:equal-dual-key`,
      userId: USER_A,
      _docType: 'insightFeedback',
      date: '2026-08-15',
      inputContext: makeWeightContext({ trend7d: 'losing', weeklyTrend30d: 'losing' }),
      userComment: 'Leave equal dual keys untouched.',
    };
    const weekly = {
      id: `${USER_A}:weekly:2026-08-14`,
      userId: USER_A,
      _docType: 'weeklyInsight',
      periodEnd: '2026-08-14',
      inputContext: makeWeightContext({ trend7d: 'gaining' }),
      response: { title: 'Weekly' },
    };

    await Promise.all([
      seed(legacyDaily),
      seed(daily),
      seed(feedback),
      seed(alreadyMigrated),
      seed(equalDualKey),
      seed(weekly),
    ]);
    const weeklyBefore = await read(weekly.id as string);

    const firstRun = await runMigration();

    expect(firstRun.code).toBe(0);
    expect(firstRun.output).toContain(
      'Migration counts: scanned=5 migrated=3 skipped=2 conflict=0 failed=0',
    );

    const migratedLegacy = await read(legacyDaily.id as string);
    expect(getWeight(migratedLegacy)).toMatchObject({ weeklyTrend30d: 'losing', last7Values: [80, 80.5] });
    expect(hasOwn(getWeight(migratedLegacy), 'trend7d')).toBe(false);
    expect(migratedLegacy).toMatchObject({
      id: legacyDaily.id,
      ttl: legacyDaily.ttl,
      expiresAt: legacyDaily.expiresAt,
      response: legacyDaily.response,
    });
    expect(hasOwn(migratedLegacy, '_docType')).toBe(false);

    const migratedDaily = await read(daily.id as string);
    expect(getWeight(migratedDaily)).toMatchObject({ weeklyTrend30d: 'stable' });
    expect(hasOwn(getWeight(migratedDaily), 'trend7d')).toBe(false);
    expect(migratedDaily).toMatchObject({ _docType: 'dailyInsight', ttl: daily.ttl, expiresAt: daily.expiresAt });

    const migratedFeedback = await read(feedback.id as string);
    expect(getWeight(migratedFeedback)).toMatchObject({ weeklyTrend30d: 'gaining' });
    expect(hasOwn(getWeight(migratedFeedback), 'trend7d')).toBe(false);
    expect(migratedFeedback).toMatchObject({
      _docType: 'insightFeedback',
      userComment: feedback.userComment,
    });
    expect(hasOwn(migratedFeedback, 'ttl')).toBe(false);
    expect(hasOwn(migratedFeedback, 'expiresAt')).toBe(false);

    expect(await read(alreadyMigrated.id as string)).toMatchObject(alreadyMigrated);
    expect(await read(equalDualKey.id as string)).toMatchObject(equalDualKey);
    expect(await read(weekly.id as string)).toMatchObject(weeklyBefore);

    const secondRun = await runMigration();
    expect(secondRun.code).toBe(0);
    expect(secondRun.output).toContain(
      'Migration counts: scanned=5 migrated=0 skipped=5 conflict=0 failed=0',
    );
    expect(await read(equalDualKey.id as string)).toMatchObject(equalDualKey);
    expect(await read(weekly.id as string)).toMatchObject(weeklyBefore);
  });

  it('refuses a conflicting dual-key document and exits non-zero', async () => {
    const conflict = {
      id: `${USER_A}:conflict`,
      userId: USER_A,
      _docType: 'dailyInsight',
      date: '2026-08-20',
      inputContext: makeWeightContext({ trend7d: 'losing', weeklyTrend30d: 'gaining' }),
      ttl: 3600,
      expiresAt: '2026-08-21T00:00:00.000Z',
      marker: 'must-remain-unchanged',
    };
    await seed(conflict);

    const result = await runMigration();

    expect(result.code).not.toBe(0);
    expect(result.output).toContain(
      'Migration counts: scanned=1 migrated=0 skipped=0 conflict=1 failed=0',
    );
    expect(result.output).toContain(`Conflict: ${conflict.id}`);
    expect(await read(conflict.id as string)).toMatchObject(conflict);
  });
});