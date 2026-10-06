import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const getLocalDateContextMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  apiClient: { get: getMock, post: postMock },
}));

vi.mock('../date/localDate', () => ({
  getLocalDateContext: getLocalDateContextMock,
}));

import { diaryApi } from './diaryApi';

describe('diaryApi.getDay', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getLocalDateContextMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('sends the requested date with the current local date and hour', async () => {
    getLocalDateContextMock.mockReturnValue({
      currentLocalDate: '2026-08-14',
      currentHour: 0,
    });

    await diaryApi.getDay('2026-08-13');

    expect(getMock).toHaveBeenCalledWith('/diary', {
      params: {
        date: '2026-08-13',
        localDate: '2026-08-14',
        localHour: 0,
      },
    });
  });

  it('omits an unknown local hour instead of inventing one', async () => {
    getLocalDateContextMock.mockReturnValue({
      currentLocalDate: '2026-08-14',
      currentHour: null,
    });

    await diaryApi.getDay('2026-08-14');

    expect(getMock).toHaveBeenCalledWith('/diary', {
      params: {
        date: '2026-08-14',
        localDate: '2026-08-14',
      },
    });
  });
});

describe('diaryApi bulk item mutations', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('sends one bulk-delete request with the selected references', async () => {
    const input = {
      sourceDate: '2026-08-13',
      items: [
        { mealId: 'meal-1', itemId: 'item-1' },
        { mealId: 'meal-2', itemId: 'item-2' },
      ],
    };
    const response = { deletedCount: 2, deletedItemIds: ['item-1', 'item-2'] };
    postMock.mockResolvedValue({ data: response });

    await expect(diaryApi.bulkDeleteItems(input)).resolves.toEqual(response);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith('/diary/items/bulk-delete', input);
  });

  it('uses one bulk-move request for a single item and an in-transaction target meal', async () => {
    const input = {
      sourceDate: '2026-08-13',
      items: [{ mealId: 'source-meal', itemId: 'item-1' }],
      target: { newMealType: 'dinner' as const },
    };
    const response = {
      movedCount: 1,
      removedItemIds: ['item-1'],
      targetMeal: {
        id: 'target-meal',
        userId: 'user-1',
        date: input.sourceDate,
        type: 'dinner',
        name: 'Abendessen',
        items: [{ id: 'moved-item-1' }],
        createdAt: '2026-08-13T18:00:00.000Z',
      },
    };
    postMock.mockResolvedValue({ data: response });

    await expect(diaryApi.bulkMoveItems(input)).resolves.toEqual(response);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith('/diary/items/bulk-move', input);
  });

  it('sends selected snapshots and one explicit existing target in a single bulk-copy request', async () => {
    const input = {
      sourceDate: '2026-08-13',
      targetDate: '2026-08-14',
      items: [
        { mealId: 'source-1', itemId: 'item-1' },
        { mealId: 'source-2', itemId: 'item-2' },
      ],
      target: { mealId: 'target-meal' },
    };
    const response = {
      copiedCount: 2,
      targetMeal: {
        id: 'target-meal',
        userId: 'user-1',
        date: input.targetDate,
        type: 'dinner',
        name: 'Abendessen',
        items: [{ id: 'copy-1' }, { id: 'copy-2' }],
        createdAt: '2026-08-14T18:00:00.000Z',
      },
    };
    postMock.mockResolvedValue({ data: response });

    await expect(diaryApi.bulkCopyItems(input)).resolves.toEqual(response);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith('/diary/items/bulk-copy', input);
  });

  it('uses the same bulk-copy route for one reference and an atomically new meal type', async () => {
    const input = {
      sourceDate: '2026-08-13',
      targetDate: '2026-08-12',
      items: [{ mealId: 'source-meal', itemId: 'item-1' }],
      target: { newMealType: 'snack' as const },
    };
    const response = {
      copiedCount: 1,
      targetMeal: {
        id: 'new-target-meal',
        userId: 'user-1',
        date: input.targetDate,
        type: 'snack',
        name: 'Snack',
        items: [{ id: 'copy-1' }],
        createdAt: '2026-08-12T18:00:00.000Z',
      },
    };
    postMock.mockResolvedValue({ data: response });

    await expect(diaryApi.bulkCopyItems(input)).resolves.toEqual(response);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith('/diary/items/bulk-copy', input);
  });
});