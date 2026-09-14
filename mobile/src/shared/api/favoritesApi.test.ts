import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  apiClient: { get: getMock },
}));

import { favoritesApi } from './favoritesApi';

describe('favoritesApi.listFavoritesRanked', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: { items: [], context: 'lunch' } });
  });

  it('sends the local reference date for ranked favorites', async () => {
    await favoritesApi.listFavoritesRanked('lunch', '2026-08-20');

    expect(getMock).toHaveBeenCalledWith('/favorites', {
      params: { context: 'lunch', localDate: '2026-08-20' },
    });
  });
});