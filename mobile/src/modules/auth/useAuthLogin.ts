// useAuthLogin — Entra login via expo-auth-session with a persisted pending login.
// The redirect can arrive via the auth session result, a runtime Linking event or (cold start) the
// initial URL; all paths end in handleRedirect(), which exchanges the code at most once.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { authConfig } from '../../services/authConfig';
import { authService } from '../../services/authService';
import { buildAuthExtraParams, resolveAuthRedirect } from '../../services/authRedirect';
import type { AuthErrorKind } from './authTexts';
import { claimRedirect, consumeRedirect, isAuthRedirectUrl, mapProviderError } from './loginFlow';
import { PENDING_LOGIN_TTL_MS, clearPendingLogin, loadPendingLogin, savePendingLogin } from './pendingLogin';

/** Grace period after returning to the foreground for a redirect to arrive before the attempt is reset. */
export const RETURN_GRACE_MS = 4000;

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: authConfig.authorizationEndpoint,
  tokenEndpoint: authConfig.tokenEndpoint,
};

// Default: HTTPS App Link per variant. EXPO_PUBLIC_AUTH_REDIRECT_MODE=scheme rolls back to fittrack://auth.
const { redirectUri, domainHint } = resolveAuthRedirect({
  mode: process.env['EXPO_PUBLIC_AUTH_REDIRECT_MODE'],
  variant: process.env['EXPO_PUBLIC_APP_VARIANT'],
  domainHint: process.env['EXPO_PUBLIC_AUTH_DOMAIN_HINT'],
  schemeRedirectUri: AuthSession.makeRedirectUri({ scheme: 'fittrack', path: 'auth' }),
});
const authExtraParams = buildAuthExtraParams(domainHint);

type Phase = 'idle' | 'waiting' | 'exchanging';

export function useAuthLogin(onLoginSuccess: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthErrorKind | null>(null);
  const phase = useRef<Phase>('idle');
  const leftApp = useRef(false);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successRef = useRef(onLoginSuccess);
  successRef.current = onLoginSuccess;

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: authConfig.clientId,
      scopes: authConfig.scopes,
      redirectUri,
      usePKCE: true,
      extraParams: authExtraParams,
    },
    discovery,
  );

  const clearTimers = useCallback(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    if (hardTimer.current) clearTimeout(hardTimer.current);
    returnTimer.current = null;
    hardTimer.current = null;
  }, []);

  const fail = useCallback((kind: AuthErrorKind) => {
    clearTimers();
    phase.current = 'idle';
    void clearPendingLogin();
    setError(kind);
    setLoading(false);
  }, [clearTimers]);

  const handleRedirect = useCallback(async (url: string) => {
    if (!isAuthRedirectUrl(url, redirectUri)) return;
    if (phase.current === 'exchanging' || !claimRedirect(url)) return;
    clearTimers();
    phase.current = 'exchanging';
    setError(null);
    setLoading(true);
    try {
      const outcome = await consumeRedirect(url);
      if (outcome.kind === 'ignore') {
        phase.current = 'idle';
        setLoading(false);
        return;
      }
      if (outcome.kind === 'error') {
        fail(outcome.error);
        return;
      }
      const tokens = await AuthSession.exchangeCodeAsync(
        {
          clientId: authConfig.clientId,
          code: outcome.code,
          // Exactly the redirect URI of the authorize request, independent of the delivery path.
          redirectUri: outcome.redirectUri,
          extraParams: { code_verifier: outcome.codeVerifier },
        },
        discovery,
      );
      if (!tokens.accessToken || !tokens.refreshToken) {
        fail('exchange');
        return;
      }
      await authService.saveTokens(tokens.accessToken, tokens.refreshToken);
      phase.current = 'idle';
      successRef.current();
    } catch {
      fail('exchange');
    }
  }, [clearTimers, fail]);

  // Runtime Linking events and the cold-start initial URL.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => void handleRedirect(url));
    // Purge an expired entry only after the initial URL was evaluated, so it can still report 'pending'.
    Linking.getInitialURL().then(async (url) => {
      if (url) await handleRedirect(url);
    }).catch(() => undefined).finally(() => void loadPendingLogin());
    return () => sub.remove();
  }, [handleRedirect]);

  // No dismiss/cancel event is guaranteed: reset when the app returns without a received redirect.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (phase.current !== 'waiting') return;
      if (state !== 'active') {
        leftApp.current = true;
        return;
      }
      if (leftApp.current && !returnTimer.current) {
        returnTimer.current = setTimeout(() => {
          if (phase.current === 'waiting') fail('noReturn');
        }, RETURN_GRACE_MS);
      }
    });
    return () => sub.remove();
  }, [fail]);

  useEffect(() => clearTimers, [clearTimers]);

  const startLogin = useCallback(async () => {
    if (phase.current !== 'idle' || !request) return;
    if (!request.codeVerifier) {
      setError('pending');
      return;
    }
    phase.current = 'waiting';
    leftApp.current = false;
    setError(null);
    setLoading(true);
    try {
      await savePendingLogin({ state: request.state, codeVerifier: request.codeVerifier, redirectUri });
    } catch {
      fail('pending');
      return;
    }
    hardTimer.current = setTimeout(() => {
      if (phase.current === 'waiting') fail('noReturn');
    }, PENDING_LOGIN_TTL_MS);
    try {
      const result = await promptAsync();
      if (phase.current !== 'waiting') return;
      if (result?.type === 'success') {
        await handleRedirect(result.url);
      } else if (result?.type === 'error') {
        fail(mapProviderError(result.params?.['error']));
      } else if (result?.type === 'dismiss' || result?.type === 'cancel') {
        fail('cancelled');
      }
    } catch {
      if (phase.current === 'waiting') fail('provider');
    }
  }, [request, promptAsync, fail, handleRedirect]);

  return { loading, error, canStart: !!request && !loading, startLogin };
}
