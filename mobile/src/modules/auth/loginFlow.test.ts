import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}));

import {
  claimRedirect,
  consumeRedirect,
  isAuthRedirectUrl,
  mapProviderError,
  parseRedirectParams,
  resetRedirectClaimsForTests,
} from './loginFlow';
import { PENDING_LOGIN_TTL_MS, savePendingLogin } from './pendingLogin';

const redirectUri = 'https://h/auth/callback/alpha';

describe('redirect url helpers', () => {
  it('parses and decodes query params', () => {
    expect(parseRedirectParams(`${redirectUri}?code=a%2Bb&state=s&error_description=x+y#frag`)).toEqual({
      code: 'a+b',
      state: 's',
      error_description: 'x y',
    });
  });

  it('recognises only the configured redirect', () => {
    expect(isAuthRedirectUrl(`${redirectUri}?code=1`, redirectUri)).toBe(true);
    expect(isAuthRedirectUrl(redirectUri, redirectUri)).toBe(true);
    expect(isAuthRedirectUrl(`${redirectUri}x?code=1`, redirectUri)).toBe(false);
    expect(isAuthRedirectUrl('https://h/auth/callback/dev?code=1', redirectUri)).toBe(false);
  });
});

describe('mapProviderError', () => {
  it('maps access_denied to abort and everything else to a generic provider error', () => {
    expect(mapProviderError('access_denied')).toBe('cancelled');
    expect(mapProviderError('server_error')).toBe('provider');
    expect(mapProviderError(undefined)).toBe('provider');
  });
});

describe('consumeRedirect', () => {
  beforeEach(() => {
    store.clear();
  });

  const pending = { state: 'S', codeVerifier: 'V', redirectUri };

  it('returns the code with the verifier and the pending redirect URI, and consumes the entry', async () => {
    await savePendingLogin(pending);
    expect(await consumeRedirect(`${redirectUri}?code=C&state=S`)).toEqual({
      kind: 'code', code: 'C', codeVerifier: 'V', redirectUri,
    });
    expect(await consumeRedirect(`${redirectUri}?code=C&state=S`)).toEqual({ kind: 'ignore' });
  });

  it('ignores a stray redirect when no pending login exists', async () => {
    expect(await consumeRedirect(`${redirectUri}?code=C&state=S`)).toEqual({ kind: 'ignore' });
  });

  it('fails when the pending login is expired', async () => {
    await savePendingLogin(pending, 1000);
    expect(await consumeRedirect(`${redirectUri}?code=C&state=S`, 1000 + PENDING_LOGIN_TTL_MS + 1)).toEqual({
      kind: 'error', error: 'pending',
    });
  });

  it('fails on state mismatch and does not keep the entry', async () => {
    await savePendingLogin(pending);
    expect(await consumeRedirect(`${redirectUri}?code=C&state=OTHER`)).toEqual({ kind: 'error', error: 'pending' });
    expect(await consumeRedirect(`${redirectUri}?code=C&state=S`)).toEqual({ kind: 'ignore' });
  });

  it('maps provider errors without exposing error_description', async () => {
    await savePendingLogin(pending);
    const out = await consumeRedirect(`${redirectUri}?error=server_error&error_description=AADSTS1234+boom&state=S`);
    expect(out).toEqual({ kind: 'error', error: 'provider' });
    await savePendingLogin(pending);
    expect(await consumeRedirect(`${redirectUri}?error=access_denied&state=S`)).toEqual({ kind: 'error', error: 'cancelled' });
  });

  it('fails when the code is missing', async () => {
    await savePendingLogin(pending);
    expect(await consumeRedirect(`${redirectUri}?state=S`)).toEqual({ kind: 'error', error: 'provider' });
  });
});

describe('claimRedirect', () => {
  beforeEach(() => resetRedirectClaimsForTests());

  it('accepts a redirect once and ignores re-delivery of the same code', () => {
    expect(claimRedirect(`${redirectUri}?code=C&state=S`)).toBe(true);
    expect(claimRedirect(`${redirectUri}?code=C&state=S`)).toBe(false);
    expect(claimRedirect(`${redirectUri}?code=C2&state=S`)).toBe(true);
  });
});
