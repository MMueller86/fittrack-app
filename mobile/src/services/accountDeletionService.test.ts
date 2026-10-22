import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  removeItem: vi.fn(),
  resetWeightSync: vi.fn(),
  resetNutritionSync: vi.fn(),
  clearSyncLogger: vi.fn(),
  logout: vi.fn(),
  showCleanupNotice: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { removeItem: mocks.removeItem },
}));
vi.mock('../modules/profile/ProfileWizardScreen', () => ({
  SKIP_WIZARD_KEY: 'fittrack:skip_wizard',
}));
vi.mock('../modules/auth/useAuthStore', () => ({
  useAuthStore: { getState: () => ({
    logout: mocks.logout,
    showAccountDeletionCleanupNotice: mocks.showCleanupNotice,
  }) },
}));
vi.mock('./health/healthSyncService', () => ({
  healthSyncService: { resetForAccountDeletion: mocks.resetWeightSync },
}));
vi.mock('./health/nutritionSyncService', () => ({
  nutritionSyncService: { resetForAccountDeletion: mocks.resetNutritionSync },
}));
vi.mock('./health/syncLogger', () => ({
  syncLogger: { clear: mocks.clearSyncLogger },
}));

import { completeAccountDeletionLocally } from './accountDeletionService';

describe('completeAccountDeletionLocally', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.removeItem.mockResolvedValue(undefined);
    mocks.resetWeightSync.mockImplementation(() => mocks.removeItem('hc:weight:sync'));
    mocks.resetNutritionSync.mockImplementation(() => mocks.removeItem('hc:nutrition:sync'));
    mocks.clearSyncLogger.mockImplementation(() => mocks.removeItem('hc:sync:log'));
    mocks.logout.mockResolvedValue(undefined);
    mocks.showCleanupNotice.mockReset();
  });

  it('attempts each FitTrack-local cleanup and logs out', async () => {
    const order: string[] = [];
    mocks.removeItem.mockImplementation(async (key: string) => { order.push(`remove:${key}`); });
    mocks.resetWeightSync.mockImplementation(async () => { order.push('weight'); });
    mocks.resetNutritionSync.mockImplementation(async () => { order.push('nutrition'); });
    mocks.clearSyncLogger.mockImplementation(async () => { order.push('logger'); });
    mocks.logout.mockImplementation(async () => { order.push('logout'); });

    await expect(completeAccountDeletionLocally()).resolves.toBe(false);

    expect(order).toEqual([
      'remove:fittrack:skip_wizard',
      'weight',
      'nutrition',
      'logger',
      'logout',
    ]);
    expect(mocks.showCleanupNotice).not.toHaveBeenCalled();
  });

  it.each([
    'fittrack:skip_wizard',
    'hc:weight:sync',
    'hc:nutrition:sync',
    'hc:sync:log',
  ])('reports a failure removing %s after attempting every persisted key', async (failedKey) => {
    mocks.removeItem.mockImplementation(async (key: string) => {
      if (key === failedKey) throw new Error('storage unavailable');
    });

    await expect(completeAccountDeletionLocally()).resolves.toBe(true);

    expect(mocks.removeItem).toHaveBeenCalledWith('fittrack:skip_wizard');
    expect(mocks.removeItem).toHaveBeenCalledWith('hc:weight:sync');
    expect(mocks.removeItem).toHaveBeenCalledWith('hc:nutrition:sync');
    expect(mocks.removeItem).toHaveBeenCalledWith('hc:sync:log');
    expect(mocks.removeItem).toHaveBeenCalledTimes(4);
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.showCleanupNotice).toHaveBeenCalledTimes(1);
  });

  it('still logs out and shows one notice when token cleanup rejects', async () => {
    mocks.logout.mockRejectedValue(new Error('secure storage unavailable'));

    await expect(completeAccountDeletionLocally()).resolves.toBe(true);

    expect(mocks.removeItem).toHaveBeenCalledTimes(4);
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.showCleanupNotice).toHaveBeenCalledTimes(1);
  });
});