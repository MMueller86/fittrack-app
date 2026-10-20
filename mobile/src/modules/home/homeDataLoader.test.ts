import { describe, expect, it } from 'vitest';
import { loadHomeData } from './homeDataLoader';

describe('loadHomeData', () => {
  it('keeps a successful diary response when profile and weight requests fail', async () => {
    const diary = { meals: [{ id: 'meal-1' }] };

    const result = await loadHomeData({
      weights: Promise.reject(new Error('weights unavailable')),
      profile: Promise.reject(new Error('profile unavailable')),
      diary: Promise.resolve(diary),
    });

    expect(result.weights.status).toBe('rejected');
    expect(result.profile.status).toBe('rejected');
    expect(result.diary).toEqual({ status: 'fulfilled', value: diary });
  });
});