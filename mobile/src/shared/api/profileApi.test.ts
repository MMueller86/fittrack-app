import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDelete, mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('./client', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
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
describe('profileApi.getMe in-flight sharing', () => {
  const input = {} as Parameters<typeof profileApi.createProfile>[0];

  function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends one request for concurrent calls and resolves both with the same response', async () => {
    const d = deferred<{ data: unknown }>();
    mockGet.mockReturnValue(d.promise);

    const a = profileApi.getMe();
    const b = profileApi.getMe();
    d.resolve({ data: { profile: null, targets: null } });

    const [ra, rb] = await Promise.all([a, b]);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/profile/me');
    expect(ra).toBe(rb);
  });

  it('sends a new request after the previous one settled', async () => {
    mockGet.mockResolvedValueOnce({ data: { profile: null, targets: null } });
    mockGet.mockResolvedValueOnce({ data: { profile: null, targets: null } });

    await profileApi.getMe();
    await profileApi.getMe();

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a rejection', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'));
    mockGet.mockResolvedValueOnce({ data: { profile: null, targets: null } });

    const a = profileApi.getMe();
    const b = profileApi.getMe();
    await expect(a).rejects.toThrow('network');
    await expect(b).rejects.toThrow('network');
    await expect(profileApi.getMe()).resolves.toEqual({ profile: null, targets: null });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['createProfile', () => { mockPost.mockResolvedValue({ data: {} }); return profileApi.createProfile(input); }],
    ['updateProfile', () => { mockPut.mockResolvedValue({ data: {} }); return profileApi.updateProfile(input); }],
    ['deleteProfile', () => {
      mockDelete.mockResolvedValue({ status: 204 });
      return profileApi.deleteProfile({ confirmation: 'DELETE', deleteCommunityRecipes: false });
    }],
  ])('%s ends sharing so later getMe never receives the older response', async (_name, mutate) => {
    const old = deferred<{ data: unknown }>();
    const fresh = deferred<{ data: unknown }>();
    mockGet.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);

    const before = profileApi.getMe();
    const mutation = mutate();
    const after = profileApi.getMe();
    expect(mockGet).toHaveBeenCalledTimes(2);

    old.resolve({ data: { profile: null, targets: 'old' } });
    await before;
    // The old request settling must not clear the newer shared request.
    const shared = profileApi.getMe();
    expect(mockGet).toHaveBeenCalledTimes(2);

    fresh.resolve({ data: { profile: null, targets: 'fresh' } });
    await mutation;
    await expect(after).resolves.toEqual({ profile: null, targets: 'fresh' });
    await expect(shared).resolves.toEqual({ profile: null, targets: 'fresh' });
  });
});
