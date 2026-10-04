import { describe, expect, it, vi } from 'vitest';

const { getCosmosMock } = vi.hoisted(() => ({
  getCosmosMock: vi.fn(),
}));

vi.mock('../cosmos', () => ({
  getCosmos: getCosmosMock,
}));

import { CosmosRecipesRepository } from './cosmosRecipesRepository';

describe('CosmosRecipesRepository', () => {
  it('returns an empty community page when Cosmos omits page resources', async () => {
    const fetchAll = vi.fn().mockResolvedValue({});
    const query = vi.fn().mockReturnValue({ fetchAll });
    getCosmosMock.mockResolvedValue({
      containers: {
        recipes: { items: { query } },
      },
    });

    await expect(new CosmosRecipesRepository().listCommunity()).resolves.toEqual({
      recipes: [],
    });
  });

  it('bounds community queries and continues from a validated offset', async () => {
    const fetchAll = vi.fn().mockResolvedValue({ resources: [] });
    const query = vi.fn().mockReturnValue({ fetchAll });
    getCosmosMock.mockResolvedValue({
      containers: {
        recipes: { items: { query } },
      },
    });

    await new CosmosRecipesRepository().listCommunity({ limit: 2, continuationToken: '4' });

    expect(query).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.stringContaining('OFFSET @offset LIMIT @limit'),
      parameters: [
        { name: '@offset', value: 4 },
        { name: '@limit', value: 2 },
      ],
    }));
    await expect(new CosmosRecipesRepository().listCommunity({ continuationToken: 'not-a-token' }))
      .rejects.toThrow('Invalid community continuation token');
  });
});