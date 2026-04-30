// Contract tests for CosmosWeightsRepository.
//
// These tests run against the local Azure Cosmos DB Linux Emulator (Docker)
// and exercise the same code path that runs in production. They MUST NOT be
// pointed at real Azure Cosmos DB — see vitest.contract.config.mts and
// scripts/start-cosmos-emulator.ps1.
//
// What this catches that unit tests cannot:
//   - Cosmos SQL syntax (e.g. `value` is a reserved word).
//   - Indexing requirements (composite indexes for multi-property ORDER BY).
//   - Partition-key handling on read/delete.
//   - 404 behaviour from `container.item().delete()`.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WeightEntry } from '@fittrack/shared';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosWeightsRepository } from './cosmosWeightsRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosWeightsRepository;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosWeightsRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

// Each test starts from an empty `weights` container. We only delete docs
// for users this suite uses, leaving the container itself in place.
async function clearWeights(userIds: string[]): Promise<void> {
  const container = ctx.database.container('weights');
  for (const userId of userIds) {
    const { resources } = await container.items
      .query<{ id: string }>(
        { query: 'SELECT c.id FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: userId }] },
        { partitionKey: userId },
      )
      .fetchAll();
    for (const r of resources) {
      await container.item(r.id, userId).delete();
    }
  }
}

const USER_A = 'contract-user-a';
const USER_B = 'contract-user-b';

beforeEach(async () => {
  await clearWeights([USER_A, USER_B]);
});

function makeEntry(overrides: Partial<WeightEntry> = {}): WeightEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    userId: overrides.userId ?? USER_A,
    date: overrides.date ?? '2026-04-30',
    value: overrides.value ?? 80,
    unit: overrides.unit ?? 'kg',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

describe('CosmosWeightsRepository (contract)', () => {
  it('add stores the entry and round-trips it via list', async () => {
    const entry = makeEntry({ value: 82.5, date: '2026-04-30' });
    const saved = await repo.add(entry);

    expect(saved.id).toBe(entry.id);
    expect(saved.value).toBe(82.5);
    expect(saved.unit).toBe('kg');

    const list = await repo.list(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: entry.id,
      userId: USER_A,
      value: 82.5,
      unit: 'kg',
      date: '2026-04-30',
    });
  });

  it('list returns an empty array when the user has no entries', async () => {
    const list = await repo.list('user-with-no-data');
    expect(list).toEqual([]);
  });

  it('list returns entries newest first by date, then by createdAt', async () => {
    await repo.add(makeEntry({ id: '1', date: '2026-04-28', createdAt: '2026-04-28T08:00:00.000Z' }));
    await repo.add(makeEntry({ id: '2', date: '2026-04-30', createdAt: '2026-04-30T07:00:00.000Z' }));
    await repo.add(makeEntry({ id: '3', date: '2026-04-30', createdAt: '2026-04-30T09:00:00.000Z' }));

    const list = await repo.list(USER_A);
    expect(list.map((e) => e.id)).toEqual(['3', '2', '1']);
  });

  it('list is partitioned by userId — different users do not see each other', async () => {
    await repo.add(makeEntry({ userId: USER_A, id: 'a1', value: 80 }));
    await repo.add(makeEntry({ userId: USER_B, id: 'b1', value: 70 }));

    const aList = await repo.list(USER_A);
    const bList = await repo.list(USER_B);

    expect(aList.map((e) => e.id)).toEqual(['a1']);
    expect(bList.map((e) => e.id)).toEqual(['b1']);
  });

  it('selects with the reserved word "value" — must not throw a Cosmos SQL syntax error', async () => {
    // Regression test: an earlier version used `SELECT c.value` which fails
    // with `Syntax error, incorrect syntax near 'value'`. The current repo
    // uses `SELECT *` and sorts client-side; this asserts that path stays.
    await repo.add(makeEntry({ value: 81.7 }));
    const list = await repo.list(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0].value).toBe(81.7);
  });

  it('delete removes an existing entry and returns true', async () => {
    const entry = await repo.add(makeEntry({ id: 'to-delete' }));
    const deleted = await repo.delete(USER_A, entry.id);
    expect(deleted).toBe(true);

    const list = await repo.list(USER_A);
    expect(list).toEqual([]);
  });

  it('delete returns false (404 mapped) when the entry does not exist', async () => {
    const deleted = await repo.delete(USER_A, 'never-existed');
    expect(deleted).toBe(false);
  });

  it('delete is partition-key aware — wrong userId cannot delete another user\'s row', async () => {
    const entry = await repo.add(makeEntry({ userId: USER_A, id: 'owned-by-a' }));

    // Calling with USER_B as partition key targets a different logical
    // partition where this id does not exist → 404 → false.
    const wrong = await repo.delete(USER_B, entry.id);
    expect(wrong).toBe(false);

    const aList = await repo.list(USER_A);
    expect(aList.map((e) => e.id)).toEqual(['owned-by-a']);
  });
});
