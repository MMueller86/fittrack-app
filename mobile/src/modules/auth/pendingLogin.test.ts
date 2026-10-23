import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}));

import {
  PENDING_LOGIN_KEY,
  PENDING_LOGIN_TTL_MS,
  consumePendingLogin,
  loadPendingLogin,
  savePendingLogin,
} from './pendingLogin';

const login = { state: 's1', codeVerifier: 'v1', redirectUri: 'https://h/auth/callback/alpha' };

describe('pendingLogin', () => {
  beforeEach(() => store.clear());

  it('returns a valid entry within 10 minutes', async () => {
    await savePendingLogin(login, 1000);
    expect(await loadPendingLogin(1000 + PENDING_LOGIN_TTL_MS)).toEqual({ ...login, createdAt: 1000 });
  });

  it('deletes and rejects an expired entry', async () => {
    await savePendingLogin(login, 1000);
    expect(await loadPendingLogin(1000 + PENDING_LOGIN_TTL_MS + 1)).toBeNull();
    expect(store.has(PENDING_LOGIN_KEY)).toBe(false);
  });

  it('returns null when missing', async () => {
    expect(await loadPendingLogin()).toBeNull();
    expect(await consumePendingLogin()).toBeNull();
  });

  it('is single-use', async () => {
    await savePendingLogin(login, 1000);
    expect(await consumePendingLogin(2000)).not.toBeNull();
    expect(store.has(PENDING_LOGIN_KEY)).toBe(false);
    expect(await consumePendingLogin(2000)).toBeNull();
  });

  it('deletes malformed entries', async () => {
    store.set(PENDING_LOGIN_KEY, '{"state":1}');
    expect(await loadPendingLogin()).toBeNull();
    expect(store.has(PENDING_LOGIN_KEY)).toBe(false);
  });
});
