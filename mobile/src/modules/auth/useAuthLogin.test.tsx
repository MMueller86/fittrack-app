import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  linkingListeners: [] as ((e: { url: string }) => void)[],
  appStateListeners: [] as ((s: string) => void)[],
  initialUrl: null as string | null,
  promptAsync: vi.fn(),
  exchange: vi.fn(),
  saveTokens: vi.fn(),
  request: { state: 'S', codeVerifier: 'V', redirectUri: '' } as { state: string; codeVerifier?: string; redirectUri: string },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (k: string) => h.store.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => void h.store.set(k, v)),
  deleteItemAsync: vi.fn(async (k: string) => void h.store.delete(k)),
}));
vi.mock('react-native', () => ({
  Linking: {
    addEventListener: (_: string, cb: (e: { url: string }) => void) => {
      h.linkingListeners.push(cb);
      return { remove: () => void h.linkingListeners.splice(h.linkingListeners.indexOf(cb), 1) };
    },
    getInitialURL: () => Promise.resolve(h.initialUrl),
  },
  AppState: {
    addEventListener: (_: string, cb: (s: string) => void) => {
      h.appStateListeners.push(cb);
      return { remove: () => void h.appStateListeners.splice(h.appStateListeners.indexOf(cb), 1) };
    },
  },
}));
vi.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'fittrack://auth',
  useAuthRequest: () => [h.request, null, h.promptAsync],
  exchangeCodeAsync: h.exchange,
}));
vi.mock('../../services/authConfig', () => ({
  authConfig: { clientId: 'c', scopes: [], authorizationEndpoint: 'a', tokenEndpoint: 't' },
}));
vi.mock('../../services/authService', () => ({ authService: { saveTokens: h.saveTokens } }));

import { resetRedirectClaimsForTests } from './loginFlow';
import { PENDING_LOGIN_KEY, savePendingLogin } from './pendingLogin';
import { RETURN_GRACE_MS, useAuthLogin } from './useAuthLogin';

const redirect = 'https://blue-hill-03fb3c103.1.azurestaticapps.net/auth/callback/alpha';
type Api = ReturnType<typeof useAuthLogin>;
const mounted: ReturnType<typeof create>[] = [];

function mount(onSuccess = vi.fn()) {
  const api = { current: undefined as unknown as Api };
  function Harness() {
    api.current = useAuthLogin(onSuccess);
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<Harness />);
  });
  mounted.push(renderer);
  return { api, renderer, onSuccess };
}

const flush = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0);
});
const deliver = (url: string) => act(async () => {
  h.linkingListeners.forEach((l) => l({ url }));
  for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(0);
});
const appState = (s: string) => act(async () => {
  h.appStateListeners.forEach((l) => l(s));
  await vi.advanceTimersByTimeAsync(0);
});

describe('useAuthLogin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.store.clear();
    h.initialUrl = null;
    h.request = { state: 'S', codeVerifier: 'V', redirectUri: redirect };
    h.promptAsync.mockReset().mockImplementation(() => new Promise(() => undefined));
    h.exchange.mockReset().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    h.saveTokens.mockReset().mockResolvedValue(undefined);
    resetRedirectClaimsForTests();
  });
  afterEach(() => {
    act(() => mounted.splice(0).forEach((r) => r.unmount()));
    vi.useRealTimers();
  });

  it('stores the pending login on start and exchanges once with the pending redirect URI', async () => {
    const { api, onSuccess } = mount();
    await flush();
    await act(async () => {
      void api.current.startLogin();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(JSON.parse(h.store.get(PENDING_LOGIN_KEY)!)).toMatchObject({ state: 'S', codeVerifier: 'V', redirectUri: redirect });
    expect(api.current.loading).toBe(true);

    await deliver(`${redirect}?code=C&state=S`);
    expect(h.exchange).toHaveBeenCalledTimes(1);
    expect(h.exchange.mock.calls[0]![0]).toMatchObject({ code: 'C', redirectUri: redirect, extraParams: { code_verifier: 'V' } });
    expect(h.saveTokens).toHaveBeenCalledWith('a', 'r');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(h.store.has(PENDING_LOGIN_KEY)).toBe(false);
  });

  it('ignores a double delivery of the same URL', async () => {
    const { api, onSuccess } = mount();
    await flush();
    await act(async () => {
      void api.current.startLogin();
      await vi.advanceTimersByTimeAsync(0);
    });
    await deliver(`${redirect}?code=C&state=S`);
    await deliver(`${redirect}?code=C&state=S`);
    expect(h.exchange).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(api.current.error).toBeNull();
  });

  it('does not start a second request while one is running', async () => {
    const { api } = mount();
    await flush();
    await act(async () => {
      void api.current.startLogin();
      void api.current.startLogin();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(h.promptAsync).toHaveBeenCalledTimes(1);
  });

  it('completes a cold start from the initial URL', async () => {
    await savePendingLogin({ state: 'S', codeVerifier: 'V', redirectUri: redirect });
    h.initialUrl = `${redirect}?code=C&state=S`;
    const { onSuccess } = mount();
    await flush();
    expect(h.exchange).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(h.store.has(PENDING_LOGIN_KEY)).toBe(false);
  });

  it('survives a remount with the same initial URL without a second exchange', async () => {
    await savePendingLogin({ state: 'S', codeVerifier: 'V', redirectUri: redirect });
    h.initialUrl = `${redirect}?code=C&state=S`;
    mount();
    await flush();
    mount();
    await flush();
    expect(h.exchange).toHaveBeenCalledTimes(1);
  });

  it('ignores a stray redirect without a pending login silently', async () => {
    h.initialUrl = `${redirect}?code=C&state=S`;
    const { api, onSuccess } = mount();
    await flush();
    expect(api.current.error).toBeNull();
    expect(api.current.loading).toBe(false);
    expect(h.exchange).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(api.current.canStart).toBe(true);
  });

  it('shows a retryable error on cold start with an expired pending login', async () => {
    await savePendingLogin({ state: 'S', codeVerifier: 'V', redirectUri: redirect }, Date.now() - 11 * 60 * 1000);
    h.initialUrl = `${redirect}?code=C&state=S`;
    const { api } = mount();
    await flush();
    expect(api.current.error).toBe('pending');
    expect(api.current.loading).toBe(false);
    expect(h.exchange).not.toHaveBeenCalled();
    expect(h.store.has(PENDING_LOGIN_KEY)).toBe(false);
    expect(api.current.canStart).toBe(true);
  });

  it('reports a token exchange failure and allows a new attempt', async () => {
    h.exchange.mockRejectedValueOnce(new Error('boom'));
    const { api } = mount();
    await flush();
    await act(async () => {
      void api.current.startLogin();
      await vi.advanceTimersByTimeAsync(0);
    });
    await deliver(`${redirect}?code=C&state=S`);
    expect(api.current.error).toBe('exchange');
    expect(api.current.loading).toBe(false);
    expect(h.store.has(PENDING_LOGIN_KEY)).toBe(false);

    await act(async () => {
      void api.current.startLogin();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.current.error).toBeNull();
    expect(api.current.loading).toBe(true);
  });

  it('maps an auth session error and a dismiss result', async () => {
    const { api } = mount();
    await flush();
    h.promptAsync.mockResolvedValueOnce({ type: 'error', params: { error: 'server_error', error_description: 'AADSTS raw' } });
    await act(async () => {
      await api.current.startLogin();
    });
    expect(api.current.error).toBe('provider');

    h.promptAsync.mockResolvedValueOnce({ type: 'dismiss' });
    await act(async () => {
      await api.current.startLogin();
    });
    expect(api.current.error).toBe('cancelled');
    expect(api.current.loading).toBe(false);
  });

  it('resets the loading state when the app returns to the foreground without a redirect', async () => {
    const { api } = mount();
    await flush();
    await act(async () => {
      void api.current.startLogin();
      await vi.advanceTimersByTimeAsync(0);
    });
    await appState('background');
    await appState('active');
    expect(api.current.loading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETURN_GRACE_MS);
    });
    expect(api.current.loading).toBe(false);
    expect(api.current.error).toBe('noReturn');
    expect(h.store.has(PENDING_LOGIN_KEY)).toBe(false);
  });

  it('does not reset when the redirect arrives right after the foreground return', async () => {
    const { api, onSuccess } = mount();
    await flush();
    await act(async () => {
      void api.current.startLogin();
      await vi.advanceTimersByTimeAsync(0);
    });
    await appState('background');
    await appState('active');
    await deliver(`${redirect}?code=C&state=S`);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETURN_GRACE_MS * 2);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(api.current.error).toBeNull();
  });
});
