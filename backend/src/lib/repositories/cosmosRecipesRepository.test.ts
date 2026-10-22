import { describe, expect, it, vi } from 'vitest';

const { getCosmosMock } = vi.hoisted(() => ({
  getCosmosMock: vi.fn(),
}));

vi.mock('../cosmos', () => ({
  getCosmos: getCosmosMock,
}));

import { CosmosRecipesRepository } from './cosmosRecipesRepository';

describe('CosmosRecipesRepository', () => {
  it('reads ownerless community documents without owner or Cosmos metadata', async () => {
    const ownerless = {
      id: 'ownerless-1',
      name: 'Community recipe',
      portions: 1,
      ingredients: [],
      steps: [],
      images: [],
      nutritionTotal: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      nutritionPerPortion: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      visibility: 'community',
      tags: [],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      _rid: 'cosmos-system-metadata',
    };
    const query = vi.fn().mockReturnValue({ fetchAll: vi.fn().mockResolvedValue({ resources: [ownerless] }) });
    getCosmosMock.mockResolvedValue({
      containers: { communityRecipes: { items: { query } } },
    });

    const recipe = await new CosmosRecipesRepository().getCommunityById('ownerless-1');

    expect(recipe).toMatchObject({ id: 'ownerless-1', visibility: 'community' });
    expect(recipe).not.toHaveProperty('ownerUserId');
    expect(recipe).not.toHaveProperty('_rid');
    expect(query).toHaveBeenCalledWith(expect.any(Object), { partitionKey: 'ownerless-1' });
  });

  it('returns an empty community page when Cosmos omits page resources', async () => {
    const fetchAll = vi.fn().mockResolvedValue({});
    const query = vi.fn().mockReturnValue({ fetchAll });
    getCosmosMock.mockResolvedValue({
      containers: {
        recipes: { items: { query } },
        communityRecipes: { items: { query } },
      },
    });

    await expect(new CosmosRecipesRepository().listCommunity()).resolves.toEqual({
      recipes: [],
    });
  });

  it('uses merged community reads and continues from a validated offset', async () => {
    const fetchAll = vi.fn().mockResolvedValue({ resources: [] });
    const query = vi.fn().mockReturnValue({ fetchAll });
    getCosmosMock.mockResolvedValue({
      containers: {
        recipes: { items: { query } },
        communityRecipes: { items: { query } },
      },
    });

    await new CosmosRecipesRepository().listCommunity({ limit: 2, continuationToken: '4' });

    expect(query).toHaveBeenCalledWith(expect.objectContaining({
      query: "SELECT TOP @take * FROM c WHERE c.visibility = 'community' ORDER BY c.updatedAt DESC, c.id ASC",
      parameters: [{ name: '@take', value: 7 }],
    }));
    expect(query).toHaveBeenCalledTimes(2);
    await expect(new CosmosRecipesRepository().listCommunity({ continuationToken: 'not-a-token' }))
      .rejects.toThrow('Invalid community continuation token');
  });
});