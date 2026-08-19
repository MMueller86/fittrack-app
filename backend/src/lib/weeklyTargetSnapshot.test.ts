import { describe, expect, it } from 'vitest';

import { resolveCalorieTargetSnapshot } from './weeklyTargetSnapshot';

const profile = {
  updatedAt: '2026-08-01T00:00:00.000Z',
  targets: {
    restDay: { calories: 2000 },
    trainingDay: { calories: 2400 },
  },
};

describe('resolveCalorieTargetSnapshot', () => {
  it('captures the target for the explicitly selected day type', () => {
    expect(resolveCalorieTargetSnapshot(profile as never, 'training', '2026-08-13T10:00:00.000Z')).toEqual({
      calories: 2400,
      capturedAt: '2026-08-13T10:00:00.000Z',
      source: 'profile',
      profileUpdatedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('returns null without a usable current profile target', () => {
    expect(resolveCalorieTargetSnapshot(null, 'rest', '2026-08-13T10:00:00.000Z')).toBeNull();
    expect(resolveCalorieTargetSnapshot({
      updatedAt: '2026-08-01T00:00:00.000Z',
      targets: { restDay: { calories: 0 }, trainingDay: { calories: 2400 } },
    } as never, 'rest', '2026-08-13T10:00:00.000Z')).toBeNull();
  });
});