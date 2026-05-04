import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./cosmosReusableItemsRepository', () => ({
  CosmosReusableItemsRepository: class {
    async search() { return []; }
    async create(i: unknown) { return { id: 'mock-id', usageCount: 0, createdAt: new Date().toISOString(), ...i as object }; }
  },
}));

import {
  getReusableItemsRepository,
  __resetReusableItemsRepositoryForTests,
} from './reusableItemsRepository';

const originalEnv = { ...process.env };

beforeEach(() => {
  __resetReusableItemsRepositoryForTests();
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
  __resetReusableItemsRepositoryForTests();
});

describe('getReusableItemsRepository (factory)', () => {
  it('returns in-memory repo when Cosmos is not configured', () => {
    expect(getReusableItemsRepository().constructor.name).toBe('InMemoryReusableItemsRepository');
  });

  it('returns Cosmos repo when both env vars are set', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';
    process.env.COSMOS_KEY = 'fake-key';
    expect(getReusableItemsRepository().constructor.name).toBe('CosmosReusableItemsRepository');
  });

  it('caches the instance', () => {
    expect(getReusableItemsRepository()).toBe(getReusableItemsRepository());
  });
});

describe('InMemoryReusableItemsRepository (via factory)', () => {
  it('starts empty', async () => {
    const repo = getReusableItemsRepository();
    expect(await repo.search('u', '')).toEqual([]);
  });

  it('create returns item with correct fields', async () => {
    const repo = getReusableItemsRepository();
    const item = await repo.create({
      userId: 'u', name: 'Oats', calories: 300, proteinG: 10, carbsG: 55, fatG: 5, fiberG: 4,
    });
    expect(item.id).toBeTruthy();
    expect(item.name).toBe('Oats');
    expect(item.usageCount).toBe(0);
  });

  it('search returns items that start with query (case-insensitive)', async () => {
    const repo = getReusableItemsRepository();
    await repo.create({ userId: 'u', name: 'Oats', calories: 300, proteinG: 10, carbsG: 55, fatG: 5, fiberG: 4 });
    await repo.create({ userId: 'u', name: 'Orange Juice', calories: 110, proteinG: 1, carbsG: 26, fatG: 0, fiberG: 0 });
    await repo.create({ userId: 'u', name: 'Apple', calories: 80, proteinG: 0, carbsG: 21, fatG: 0, fiberG: 3 });
    const results = await repo.search('u', 'o');
    expect(results.map((r) => r.name)).toEqual(expect.arrayContaining(['Oats', 'Orange Juice']));
    expect(results.find((r) => r.name === 'Apple')).toBeUndefined();
  });

  it('search with empty query returns all items (up to 20)', async () => {
    const repo = getReusableItemsRepository();
    await repo.create({ userId: 'u', name: 'Item A', calories: 100, proteinG: 5, carbsG: 10, fatG: 2, fiberG: 1 });
    await repo.create({ userId: 'u', name: 'Item B', calories: 200, proteinG: 8, carbsG: 20, fatG: 4, fiberG: 2 });
    const results = await repo.search('u', '');
    expect(results).toHaveLength(2);
  });

  it('isolates items per user', async () => {
    const repo = getReusableItemsRepository();
    await repo.create({ userId: 'user-A', name: 'Bread', calories: 80, proteinG: 3, carbsG: 15, fatG: 1, fiberG: 1 });
    expect(await repo.search('user-B', '')).toHaveLength(0);
  });
});
