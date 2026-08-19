import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import {
  CosmosInsightRepository,
  makeWeeklyInsightId,
  type WeeklyInsightDocument,
} from './insightRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosInsightRepository;

const USER_A = 'contract-insight-a';
const USER_B = 'contract-insight-b';

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosInsightRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

async function clearInsights(userIds: string[]): Promise<void> {
  const container = ctx!.database.container('aiInsights');
  for (const userId of userIds) {
    const { resources } = await container.items
      .query<{ id: string }>(
        { query: 'SELECT c.id FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: userId }] },
        { partitionKey: userId },
      )
      .fetchAll();
    for (const document of resources) {
      await container.item(document.id, userId).delete();
    }
  }
}

function makeWeeklyDocument(
  userId = USER_A,
  periodEnd = '2026-08-13',
): WeeklyInsightDocument {
  return {
    id: makeWeeklyInsightId(userId, periodEnd),
    userId,
    _docType: 'weeklyInsight',
    referenceDate: '2026-08-14',
    periodStart: '2026-08-07',
    periodEnd,
    inputHash: `hash-${periodEnd}`,
    promptVersion: 'v1',
    model: 'gpt4o-mini',
    response: { status: 'fresh', text: 'Wochenbewertung.', generatedAt: '2026-08-14T10:00:00.000Z' },
    status: 'fresh',
    generatedAt: '2026-08-14T10:00:00.000Z',
    lastAttemptAt: '2026-08-14T10:00:00.000Z',
    expiresAt: '2026-08-21T10:00:00.000Z',
    ttl: 604800,
    tokensUsed: 12,
  };
}

beforeEach(async () => {
  await clearInsights([USER_A, USER_B]);
});

describe('CosmosInsightRepository weekly documents (contract)', () => {
  it('returns null for an unknown weekly period', async () => {
    await expect(repo.getWeekly(USER_A, '2026-08-13')).resolves.toBeNull();
  });

  it('persists and reads a weekly document with its own discriminator and key', async () => {
    const document = makeWeeklyDocument();
    await repo.upsertWeekly(document);

    await expect(repo.getWeekly(USER_A, '2026-08-13')).resolves.toEqual(document);
    await expect(repo.getWeekly(USER_A, '2026-08-12')).resolves.toBeNull();
    await expect(repo.get(USER_A, '2026-08-13')).resolves.toBeNull();
  });

  it('scopes weekly documents by user and period', async () => {
    await repo.upsertWeekly(makeWeeklyDocument(USER_A, '2026-08-13'));
    await repo.upsertWeekly(makeWeeklyDocument(USER_B, '2026-08-13'));
    await repo.upsertWeekly(makeWeeklyDocument(USER_A, '2026-08-12'));

    expect((await repo.getWeekly(USER_A, '2026-08-13'))?.userId).toBe(USER_A);
    expect((await repo.getWeekly(USER_B, '2026-08-13'))?.userId).toBe(USER_B);
    expect((await repo.getWeekly(USER_A, '2026-08-12'))?.periodEnd).toBe('2026-08-12');
  });
});