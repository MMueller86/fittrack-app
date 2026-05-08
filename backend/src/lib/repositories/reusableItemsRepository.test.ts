import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./cosmosReusableItemsRepository', () => ({
  CosmosReusableItemsRepository: class {
    async search() { return []; }
    async create(i: unknown) {
      const input = i as { userId: string; name: string; nutritionBasis: string; isComplete: boolean; sourceType: string };
      return {
        id: 'mock-id',
        userId: input.userId,
        name: input.name,
        nutritionBasis: input.nutritionBasis,
        isComplete: input.isComplete,
        sourceType: input.sourceType,
        usageCount: 0,
        createdAt: new Date().toISOString(),
      };
    }
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
      userId: 'u', name: 'Oats', nutritionBasis: 'perPortion',
      portion: { label: '1 serving', nutrition: { calories: 300, protein: 10, carbs: 55, fat: 5, fiber: 4 } },
      isComplete: true, sourceType: 'manual',
    });
    expect(item.id).toBeTruthy();
    expect(item.name).toBe('Oats');
    expect(item.usageCount).toBe(0);
  });

  it('search returns items that start with query (case-insensitive)', async () => {
    const repo = getReusableItemsRepository();
    await repo.create({ userId: 'u', name: 'Oats', nutritionBasis: 'perPortion', isComplete: true, sourceType: 'manual' });
    await repo.create({ userId: 'u', name: 'Orange Juice', nutritionBasis: 'perPortion', isComplete: true, sourceType: 'manual' });
    await repo.create({ userId: 'u', name: 'Apple', nutritionBasis: 'perPortion', isComplete: true, sourceType: 'manual' });
    const results = await repo.search('u', 'o');
    expect(results.map((r) => r.name)).toEqual(expect.arrayContaining(['Oats', 'Orange Juice']));
    expect(results.find((r) => r.name === 'Apple')).toBeUndefined();
  });

  it('search with empty query returns all items (up to 20)', async () => {
    const repo = getReusableItemsRepository();
    await repo.create({ userId: 'u', name: 'Item A', nutritionBasis: 'perPortion', isComplete: true, sourceType: 'manual' });
    await repo.create({ userId: 'u', name: 'Item B', nutritionBasis: 'perPortion', isComplete: true, sourceType: 'manual' });
    const results = await repo.search('u', '');
    expect(results).toHaveLength(2);
  });

  it('isolates items per user', async () => {
    const repo = getReusableItemsRepository();
    await repo.create({ userId: 'user-A', name: 'Bread', nutritionBasis: 'perPortion', isComplete: true, sourceType: 'manual' });
    expect(await repo.search('user-B', '')).toHaveLength(0);
  });
});
