import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub the Cosmos repository module so the factory can resolve it without
// pulling in the real @azure/cosmos client. Selection is what we test here;
// real Cosmos behaviour is covered by the contract tests in Step 2.
vi.mock('./cosmosWeightsRepository', () => ({
  CosmosWeightsRepository: class CosmosWeightsRepository {
    async list() { return []; }
    async listUpdatedSince() { return []; }
    async add(e: unknown) { return e; }
    async delete() { return false; }
  },
}));

import {
  getWeightsRepository,
  __resetWeightsRepositoryForTests,
} from './weightsRepository';

// The repository factory must:
//   - return an in-memory implementation when Cosmos env vars are missing
//   - return the Cosmos implementation when both COSMOS_ENDPOINT and
//     COSMOS_KEY are set (we only check the class name here so we don't
//     actually connect to anything)
//
// We snapshot env at suite start to avoid leaking state into other tests.

const originalEnv = { ...process.env };

beforeEach(() => {
  __resetWeightsRepositoryForTests();
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
  __resetWeightsRepositoryForTests();
});

describe('getWeightsRepository (factory)', () => {
  it('returns the in-memory repository when Cosmos is not configured', () => {
    const repo = getWeightsRepository();
    expect(repo.constructor.name).toBe('InMemoryWeightsRepository');
  });

  it('returns the in-memory repository when only COSMOS_ENDPOINT is set', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';
    const repo = getWeightsRepository();
    expect(repo.constructor.name).toBe('InMemoryWeightsRepository');
  });

  it('returns the in-memory repository when only COSMOS_KEY is set', () => {
    process.env.COSMOS_KEY = 'fake-key';
    const repo = getWeightsRepository();
    expect(repo.constructor.name).toBe('InMemoryWeightsRepository');
  });

  it('returns the Cosmos repository when both env vars are set', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';
    process.env.COSMOS_KEY = 'fake-key';
    const repo = getWeightsRepository();
    // We do not attempt any I/O — selection is what we test here. Real
    // behaviour against Cosmos is covered by contract tests in Step 2.
    expect(repo.constructor.name).toBe('CosmosWeightsRepository');
  });

  it('caches the instance across calls', () => {
    const a = getWeightsRepository();
    const b = getWeightsRepository();
    expect(a).toBe(b);
  });
});

describe('InMemoryWeightsRepository (via factory)', () => {
  it('starts empty for a new user', async () => {
    const repo = getWeightsRepository();
    expect(await repo.list('user-1')).toEqual([]);
  });

  it('persists added entries scoped per user and returns newest first', async () => {
    const repo = getWeightsRepository();
    await repo.add({
      id: 'a',
      userId: 'user-1',
      date: '2026-04-28',
      value: 80,
      unit: 'kg',
      createdAt: '2026-04-28T08:00:00.000Z',
    });
    await repo.add({
      id: 'b',
      userId: 'user-1',
      date: '2026-04-30',
      value: 81,
      unit: 'kg',
      createdAt: '2026-04-30T08:00:00.000Z',
    });
    await repo.add({
      id: 'c',
      userId: 'user-2',
      date: '2026-04-30',
      value: 70,
      unit: 'kg',
      createdAt: '2026-04-30T08:00:00.000Z',
    });

    const u1 = await repo.list('user-1');
    expect(u1.map((e) => e.id)).toEqual(['b', 'a']);

    const u2 = await repo.list('user-2');
    expect(u2.map((e) => e.id)).toEqual(['c']);
  });

  it('lists updates inclusively, falls back to createdAt for legacy entries, and stays user-scoped', async () => {
    const repo = getWeightsRepository();
    const since = '2026-04-30T08:00:00.000Z';
    const old = await repo.add({
      id: 'old', userId: 'user-1', date: '2026-04-28', value: 80, unit: 'kg',
      createdAt: '2026-04-28T08:00:00.000Z',
    });
    delete old.updatedAt;
    const legacyBoundary = await repo.add({
      id: 'legacy-boundary', userId: 'user-1', date: '2026-04-30', value: 81, unit: 'kg',
      createdAt: since,
    });
    delete legacyBoundary.updatedAt;
    await repo.add({
      id: 'updated-boundary', userId: 'user-1', date: '2026-04-29', value: 82, unit: 'kg',
      createdAt: '2026-04-29T08:00:00.000Z', updatedAt: since,
    });
    await repo.add({
      id: 'foreign-boundary', userId: 'user-2', date: '2026-04-30', value: 70, unit: 'kg',
      createdAt: since,
    });

    const delta = await repo.listUpdatedSince('user-1', since);

    expect(delta.map((entry) => entry.id)).toEqual(['legacy-boundary', 'updated-boundary']);
  });

  it('delete returns true when removed and false when missing', async () => {
    const repo = getWeightsRepository();
    await repo.add({
      id: 'a',
      userId: 'user-1',
      date: '2026-04-30',
      value: 80,
      unit: 'kg',
      createdAt: '2026-04-30T08:00:00.000Z',
    });

    expect(await repo.delete('user-1', 'a')).toBe(true);
    expect(await repo.delete('user-1', 'a')).toBe(false);
    expect(await repo.delete('user-1', 'never-existed')).toBe(false);
  });

  it('updates only the value of the matching user-owned entry', async () => {
    const repo = getWeightsRepository();
    const userOneEntry = {
      id: 'shared-id',
      userId: 'user-1',
      date: '2026-04-30',
      value: 80,
      unit: 'kg' as const,
      createdAt: '2026-04-30T08:00:00.000Z',
    };
    const userTwoEntry = {
      ...userOneEntry,
      userId: 'user-2',
      value: 70,
      unit: 'lbs' as const,
    };
    await repo.add(userOneEntry);
    await repo.add(userTwoEntry);

    const updated = await repo.updateValue('user-1', 'shared-id', 82.5);
    expect(updated).toMatchObject({
      ...userOneEntry,
      value: 82.5,
      updatedAt: expect.any(String),
    });
    expect(updated?.updatedAt).not.toBe(userOneEntry.createdAt);
    expect(await repo.list('user-1')).toEqual([updated]);
    expect(await repo.list('user-2')).toEqual([{ ...userTwoEntry, updatedAt: userTwoEntry.createdAt }]);
  });

  it('leaves a same-date sibling entry completely unchanged when updating one ID', async () => {
    const repo = getWeightsRepository();
    const targetEntry = {
      id: 'entry-to-update',
      userId: 'user-1',
      date: '2026-04-30',
      value: 80,
      unit: 'kg' as const,
      createdAt: '2026-04-30T08:00:00.000Z',
    };
    const siblingEntry = {
      id: 'same-day-sibling',
      userId: 'user-1',
      date: '2026-04-30',
      value: 175,
      unit: 'lbs' as const,
      createdAt: '2026-04-30T09:00:00.000Z',
    };
    await repo.add(targetEntry);
    await repo.add(siblingEntry);

    const updated = await repo.updateValue('user-1', targetEntry.id, 82.5);

    expect(updated).toMatchObject({
      ...targetEntry,
      value: 82.5,
      updatedAt: expect.any(String),
    });
    expect(await repo.list('user-1')).toMatchObject([
      { ...siblingEntry, updatedAt: siblingEntry.createdAt },
      updated,
    ]);
  });

  it('returns null when the ID is not owned by the requested user', async () => {
    const repo = getWeightsRepository();
    await repo.add({
      id: 'owned-by-one',
      userId: 'user-1',
      date: '2026-04-30',
      value: 80,
      unit: 'kg',
      createdAt: '2026-04-30T08:00:00.000Z',
    });

    expect(await repo.updateValue('user-2', 'owned-by-one', 82)).toBeNull();
    expect(await repo.updateValue('user-1', 'missing', 82)).toBeNull();
    expect(await repo.list('user-1')).toMatchObject([{ value: 80 }]);
  });
});
