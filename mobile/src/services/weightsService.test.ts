import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.hoisted(() => vi.fn());
const getLocalIsoDateMock = vi.hoisted(() => vi.fn());

vi.mock('../shared/api/client', () => ({
  apiClient: { post: postMock },
}));

vi.mock('../shared/date/localDate', () => ({
  getLocalIsoDate: getLocalIsoDateMock,
}));

import { addWeight } from './weightsService';

describe('addWeight', () => {
  beforeEach(() => {
    postMock.mockReset();
    getLocalIsoDateMock.mockReset();
    postMock.mockResolvedValue({ data: { id: 'weight-1' } });
    getLocalIsoDateMock.mockReturnValue('2026-08-20');
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
});