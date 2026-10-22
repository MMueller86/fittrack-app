import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearTokens: vi.fn(),
  getAccessToken: vi.fn(),
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
  apiGet: vi.fn(),
  authOn: vi.fn(),
}));

vi.mock('../../services/authService', () => ({
  authService: {
    clearTokens: mocks.clearTokens,
    getAccessToken: mocks.getAccessToken,
    isTokenExpired: mocks.isTokenExpired,
    refreshAccessToken: mocks.refreshAccessToken,
  },
}));
vi.mock('../../shared/api/client', () => ({
  apiClient: { get: mocks.apiGet },
  authEvents: { on: mocks.authOn },
}));

import { useAuthStore } from './useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAccessToken.mockResolvedValue('valid-access-token');
    mocks.isTokenExpired.mockReturnValue(false);
    mocks.refreshAccessToken.mockResolvedValue(null);
    mocks.apiGet.mockResolvedValue(undefined);
    useAuthStore.setState({
      isAuthenticated: true,
      accountDeletionCleanupNotice: false,
    });
  });

  it('hydrates a surviving token on restart without a persistent cleanup gate', async () => {
    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(mocks.getAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(mocks.apiGet).toHaveBeenCalledWith('/health');
  });

  it('keeps the cleanup notice transient in memory', () => {
    useAuthStore.getState().showAccountDeletionCleanupNotice();
    expect(useAuthStore.getState().accountDeletionCleanupNotice).toBe(true);

    useAuthStore.getState().dismissAccountDeletionCleanupNotice();
    expect(useAuthStore.getState().accountDeletionCleanupNotice).toBe(false);
  });

  it('closes the authenticated shell even when SecureStore token cleanup rejects', async () => {
    mocks.clearTokens.mockRejectedValue(new Error('SecureStore unavailable'));

    await expect(useAuthStore.getState().logout()).rejects.toThrow('SecureStore unavailable');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});