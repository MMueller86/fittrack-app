import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: mocks.deleteItemAsync,
  getItemAsync: mocks.getItemAsync,
}));
vi.mock('./authConfig', () => ({ authConfig: {} }));

import { authService } from './authService';

describe('authService.clearTokens', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.deleteItemAsync.mockResolvedValue(undefined);
    mocks.getItemAsync.mockResolvedValue(null);
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

  it('reads the authenticated subject from the current access token', async () => {
    const payload = btoa(JSON.stringify({ sub: 'user-123', exp: Math.floor(Date.now() / 1000) + 3600 }));
    mocks.getItemAsync.mockResolvedValue(`header.${payload}.signature`);

    await expect(authService.getAuthenticatedUserId()).resolves.toBe('user-123');
    expect(mocks.getItemAsync).toHaveBeenCalledWith('fittrack_access_token');
  });

  it('returns null when the access token has no subject', async () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    mocks.getItemAsync.mockResolvedValue(`header.${payload}.signature`);

    await expect(authService.getAuthenticatedUserId()).resolves.toBeNull();
  });
});