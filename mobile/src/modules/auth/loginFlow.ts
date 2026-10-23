// Pure login-flow logic: redirect URL evaluation, error mapping, double-delivery guard.
// Never logs codes, state, verifiers or tokens.

import type { AuthErrorKind } from './authTexts';
import { consumePendingLoginDetailed } from './pendingLogin';

export function parseRedirectParams(url: string): Record<string, string> {
  const query = url.split('#')[0]!.split('?')[1] ?? '';
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const idx = pair.indexOf('=');
    const rawKey = idx === -1 ? pair : pair.slice(0, idx);
    const rawValue = idx === -1 ? '' : pair.slice(idx + 1);
    try {
      params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      // Skip malformed pairs.
    }
  }
  return params;
}

/** True if `url` is the configured redirect URI, optionally followed by a path suffix, query or fragment. */
export function isAuthRedirectUrl(url: string, redirectUri: string): boolean {
  if (!url.startsWith(redirectUri)) return false;
  const next = url.charAt(redirectUri.length);
  return next === '' || next === '?' || next === '#' || next === '/';
}

/** Entra `error` -> user-facing kind; the raw error text is never shown. */
export function mapProviderError(error: string | undefined): AuthErrorKind {
  return error === 'access_denied' ? 'cancelled' : 'provider';
}

export type RedirectOutcome =
  | { kind: 'code'; code: string; codeVerifier: string; redirectUri: string }
  | { kind: 'error'; error: AuthErrorKind }
  /** No login was started (no pending entry): a stray redirect, nothing to show or exchange. */
  | { kind: 'ignore' };

/** Evaluates a received redirect against the pending login (consumed, so it is single-use). */
export async function consumeRedirect(url: string, now: number = Date.now()): Promise<RedirectOutcome> {
  const result = await consumePendingLoginDetailed(now);
  if (result.status === 'missing') return { kind: 'ignore' };
  if (result.status === 'invalid') return { kind: 'error', error: 'pending' };
  const pending = result.login;

  const params = parseRedirectParams(url);
  if (!params['state'] || params['state'] !== pending.state) return { kind: 'error', error: 'pending' };
  if (params['error']) return { kind: 'error', error: mapProviderError(params['error']) };
  if (!params['code']) return { kind: 'error', error: 'provider' };

  return { kind: 'code', code: params['code'], codeVerifier: pending.codeVerifier, redirectUri: pending.redirectUri };
}

const claimed = new Set<string>();

/** Module-level so remounted screens share it: true only for the first delivery of a redirect. */
export function claimRedirect(url: string): boolean {
  const params = parseRedirectParams(url);
  const key = params['code'] ?? params['error'] ?? url;
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}

export function resetRedirectClaimsForTests(): void {
  claimed.clear();
}
