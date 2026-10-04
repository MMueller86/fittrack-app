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
    const fetchNext = vi.fn().mockResolvedValue({ continuationToken: 'next-page' });
    const query = vi.fn().mockReturnValue({ fetchNext });
    getCosmosMock.mockResolvedValue({
      containers: {
        recipes: { items: { query } },
      },
    });

    await expect(new CosmosRecipesRepository().listCommunity()).resolves.toEqual({
      recipes: [],
      continuationToken: 'next-page',
    });
  });
});