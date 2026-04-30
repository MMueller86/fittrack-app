import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub the Cosmos repository module so the factory can resolve it without
// pulling in the real @azure/cosmos client. Selection is what we test here;
// real Cosmos behaviour is covered by the contract tests in Step 2.
vi.mock('./cosmosWeightsRepository', () => ({
  CosmosWeightsRepository: class CosmosWeightsRepository {
    async list() { return []; }
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
});
