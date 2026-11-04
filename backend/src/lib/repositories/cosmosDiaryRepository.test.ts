import { describe, expect, it, vi } from 'vitest';

const { getCosmosMock } = vi.hoisted(() => ({
  getCosmosMock: vi.fn(),
}));

vi.mock('../cosmos', () => ({
  getCosmos: getCosmosMock,
}));

import { CosmosDiaryRepository } from './cosmosDiaryRepository';

describe('CosmosDiaryRepository', () => {
  it('does not expose Cosmos system properties when reading a meal', async () => {
    const meal = {
      id: 'meal-1',
      userId: 'user-1',
      date: '2026-05-04',
      type: 'breakfast',
      name: 'Breakfast',
      items: [],
      createdAt: '2026-05-04T08:00:00.000Z',
      _etag: 'cosmos-etag',
      _rid: 'cosmos-rid',
    };
    const read = vi.fn().mockResolvedValue({ resource: meal });
    const item = vi.fn().mockReturnValue({ read });
    getCosmosMock.mockResolvedValue({
      containers: { nutritionDiaryMeals: { item } },
    });

    const result = await new CosmosDiaryRepository().getMealById('user-1', 'meal-1');

    expect(result).toEqual({
      id: 'meal-1',
      userId: 'user-1',
      date: '2026-05-04',
      type: 'breakfast',
      name: 'Breakfast',
      items: [],
      createdAt: '2026-05-04T08:00:00.000Z',
    });
    expect(item).toHaveBeenCalledWith('meal-1', 'user-1');
  });
});