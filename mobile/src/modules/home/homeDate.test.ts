import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLocalDateContextMock = vi.hoisted(() => vi.fn());

vi.mock('../../shared/date/localDate', () => ({
  getLocalDateContext: getLocalDateContextMock,
}));

import { getHomeActionDate } from './homeDate';

describe('getHomeActionDate', () => {
  beforeEach(() => {
    getLocalDateContextMock.mockReset();
  });

  it('reads the local date again for an action after local midnight', () => {
    getLocalDateContextMock
      .mockReturnValueOnce({ currentLocalDate: '2026-08-14', currentHour: 23 })
      .mockReturnValueOnce({ currentLocalDate: '2026-08-15', currentHour: 0 });

    expect(getHomeActionDate()).toBe('2026-08-14');
    expect(getHomeActionDate()).toBe('2026-08-15');
    expect(getLocalDateContextMock).toHaveBeenCalledTimes(2);
  });
});