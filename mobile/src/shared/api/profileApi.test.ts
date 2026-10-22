import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDelete } = vi.hoisted(() => ({ mockDelete: vi.fn() }));

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: mockDelete,
  },
}));

import { profileApi } from './profileApi';

describe('profileApi.deleteProfile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends the exact typed request body and resolves only for HTTP 204', async () => {
    const request = { confirmation: 'DELETE' as const, deleteCommunityRecipes: true };
    mockDelete.mockResolvedValue({ status: 204, data: undefined });

    await expect(profileApi.deleteProfile(request)).resolves.toBeUndefined();

    expect(mockDelete).toHaveBeenCalledWith('/profile', { data: request });
  });

  it('does not treat another successful HTTP status as confirmed deletion', async () => {
    mockDelete.mockResolvedValue({ status: 200, data: undefined });

    await expect(profileApi.deleteProfile({
      confirmation: 'DELETE',
      deleteCommunityRecipes: false,
    })).rejects.toThrow('Profile deletion did not complete successfully.');
  });
});