import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());
const getLocalDateContextMock = vi.hoisted(() => vi.fn());
const getLocalTimezoneOffsetMinutesMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  apiClient: { get: getMock },
}));

vi.mock('../date/localDate', () => ({
  getLocalDateContext: getLocalDateContextMock,
  getLocalTimezoneOffsetMinutes: getLocalTimezoneOffsetMinutesMock,
}));

import { aiApi } from './aiApi';

describe('aiApi.getDailyInsight', () => {
  beforeEach(() => {
    getMock.mockReset();
    getLocalDateContextMock.mockReset();
    getLocalTimezoneOffsetMinutesMock.mockReset();
    getMock.mockResolvedValue({ data: { status: 'fresh' } });
  });

  it('sends the requested local date with local hour and offset', async () => {
    getLocalDateContextMock.mockReturnValue({ currentLocalDate: '2026-08-20', currentHour: 7 });
    getLocalTimezoneOffsetMinutesMock.mockReturnValue(120);

    await aiApi.getDailyInsight('2026-08-20');

    expect(getMock).toHaveBeenCalledWith('/ai/daily-insight', {
      params: {
        date: '2026-08-20',
        localHour: 7,
        timezoneOffsetMinutes: 120,
      },
    });
  });

  it('omits unknown local time values instead of inventing defaults', async () => {
    getLocalDateContextMock.mockReturnValue({ currentLocalDate: '2026-08-20', currentHour: null });
    getLocalTimezoneOffsetMinutesMock.mockReturnValue(null);

    await aiApi.getDailyInsight();

    expect(getMock).toHaveBeenCalledWith('/ai/daily-insight', {
      params: { date: '2026-08-20' },
    });
  });
});