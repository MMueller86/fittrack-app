import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDailyInsightMock = vi.hoisted(() => vi.fn());

vi.mock('../shared/api/aiApi', () => ({
  aiApi: { getDailyInsight: getDailyInsightMock },
}));

import { getInsight } from './insightService';

describe('getInsight', () => {
  beforeEach(() => {
    getDailyInsightMock.mockReset();
    getDailyInsightMock.mockResolvedValue({ status: 'fresh' });
  });

  it('forwards the local reference date to the typed AI client', async () => {
    await getInsight('2026-08-20');

    expect(getDailyInsightMock).toHaveBeenCalledWith('2026-08-20');
  });

  it('returns null when the typed AI client fails', async () => {
    getDailyInsightMock.mockRejectedValue(new Error('network'));

    await expect(getInsight('2026-08-20')).resolves.toBeNull();
  });
});
