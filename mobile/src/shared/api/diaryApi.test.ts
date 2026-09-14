import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());
const getLocalDateContextMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  apiClient: { get: getMock },
}));

vi.mock('../date/localDate', () => ({
  getLocalDateContext: getLocalDateContextMock,
}));

import { diaryApi } from './diaryApi';

describe('diaryApi.getDay', () => {
  beforeEach(() => {
    getMock.mockReset();
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