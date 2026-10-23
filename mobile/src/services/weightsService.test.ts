import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const getLocalIsoDateMock = vi.hoisted(() => vi.fn());

vi.mock('../shared/api/client', () => ({
  apiClient: { get: getMock, post: postMock, put: putMock },
}));

vi.mock('../shared/date/localDate', () => ({
  getLocalIsoDate: getLocalIsoDateMock,
}));

import { addWeight, getWeightChanges, updateWeight } from './weightsService';

describe('addWeight', () => {
  beforeEach(() => {
    postMock.mockReset();
    putMock.mockReset();
    getMock.mockReset();
    getLocalIsoDateMock.mockReset();
    postMock.mockResolvedValue({ data: { id: 'weight-1' } });
    putMock.mockResolvedValue({ data: { id: 'weight-1', value: 73.2 } });
    getLocalIsoDateMock.mockReturnValue('2026-08-20');
  });

  it('requests the authenticated weight delta with the canonical since query', async () => {
    const response = { entries: [], checkpointAt: '2026-10-23T12:00:00.000Z' };
    getMock.mockResolvedValue({ data: response });

    await expect(getWeightChanges('2026-10-23T11:00:00.000Z')).resolves.toEqual(response);
    expect(getMock).toHaveBeenCalledWith('/weights/changes', {
      params: { since: '2026-10-23T11:00:00.000Z' },
    });
  });

  it('uses the local date when date is undefined', async () => {
    await addWeight({ value: 72.4, date: undefined });

    expect(postMock).toHaveBeenCalledWith('/weights', {
      value: 72.4,
      date: '2026-08-20',
    });
  });

  it('preserves an explicitly selected date', async () => {
    await addWeight({ value: 72.4, date: '2026-08-19' });

    expect(postMock).toHaveBeenCalledWith('/weights', {
      value: 72.4,
      date: '2026-08-19',
    });
    expect(getLocalIsoDateMock).not.toHaveBeenCalled();
  });

  it('updates only the selected entry value by ID', async () => {
    const updatedEntry = { id: 'weight-1', value: 73.2 };

    await expect(updateWeight('weight-1', 73.2)).resolves.toEqual(updatedEntry);

    expect(putMock).toHaveBeenCalledWith('/weights/weight-1', { value: 73.2 });
  });
});