import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: mocks.deleteItemAsync,
}));
vi.mock('./authConfig', () => ({ authConfig: {} }));

import { authService } from './authService';

describe('authService.clearTokens', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.deleteItemAsync.mockResolvedValue(undefined);
  });

  it.each([
    'fittrack_access_token',
    'fittrack_refresh_token',
  ])('reports failure when deleting %s fails and still attempts both tokens', async (failedKey) => {
    mocks.deleteItemAsync.mockImplementation(async (key: string) => {
      if (key === failedKey) throw new Error('SecureStore unavailable');
    });

    await expect(authService.clearTokens()).rejects.toThrow('Authentication tokens could not be cleared.');

    expect(mocks.deleteItemAsync).toHaveBeenCalledWith('fittrack_access_token');
    expect(mocks.deleteItemAsync).toHaveBeenCalledWith('fittrack_refresh_token');
    expect(mocks.deleteItemAsync).toHaveBeenCalledTimes(2);
  });
});