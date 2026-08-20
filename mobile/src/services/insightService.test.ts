import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());

vi.mock('../shared/api/client', () => ({
  apiClient: { get: getMock },
}));

import { getInsight } from './insightService';

describe('getInsight', () => {
  beforeEach(() => {
    getMock.mockReset();
    vi.restoreAllMocks();
  });

  it('sends the local date, local hour, and normalized timezone offset', async () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(7);
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(120);
    getMock.mockResolvedValue({ data: { status: 'fresh' } });

    await getInsight('2026-08-20');

    expect(getMock).toHaveBeenCalledWith(
      '/ai/daily-insight?date=2026-08-20&localHour=7&timezoneOffsetMinutes=-120',
    );
  });

  it('omits invalid local time values instead of clamping them', async () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(24);
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(900);
    getMock.mockResolvedValue({ data: { status: 'fresh' } });

    await getInsight('2026-08-20');

    expect(getMock).toHaveBeenCalledWith('/ai/daily-insight?date=2026-08-20');
  });
});
