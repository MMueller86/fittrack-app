// Build-time selection of the OAuth redirect URI and optional domain_hint.
// Default is the HTTPS App Link; EXPO_PUBLIC_AUTH_REDIRECT_MODE=scheme is the rollback to fittrack://auth.

import callbackHost from '../../auth-callback-host.json';

// Same file is read by app.config.js for the Android intent filter.
export const AUTH_CALLBACK_HOST: string = callbackHost.host;

export type AuthRedirectMode = 'scheme' | 'https';

interface AuthRedirectInput {
  mode?: string;
  variant?: string;
  domainHint?: string;
  schemeRedirectUri: string;
}

export interface AuthRedirectConfig {
  mode: AuthRedirectMode;
  redirectUri: string;
  /** Passed as `domain_hint` extra param; undefined = off (D6). */
  domainHint: string | undefined;
}

const DOMAIN_HINT_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function resolveAuthRedirect(input: AuthRedirectInput): AuthRedirectConfig {
  const mode: AuthRedirectMode = input.mode?.trim() === 'scheme' ? 'scheme' : 'https';
  const callbackVariant = input.variant === 'development' ? 'dev' : 'alpha';
  const redirectUri =
    mode === 'https'
      ? `https://${AUTH_CALLBACK_HOST}/auth/callback/${callbackVariant}`
      : input.schemeRedirectUri;
  const hint = input.domainHint?.trim();
  return {
    mode,
    redirectUri,
    domainHint: hint && DOMAIN_HINT_PATTERN.test(hint) ? hint : undefined,
  };
}

export function buildAuthExtraParams(domainHint: string | undefined): Record<string, string> | undefined {
  return domainHint ? { domain_hint: domainHint } : undefined;
}
