import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { AUTH_CALLBACK_HOST, buildAuthExtraParams, resolveAuthRedirect } from './authRedirect';

const scheme = 'fittrack://auth';
const host = 'https://red-mushroom-07229ab10.3.azurestaticapps.net';

describe('resolveAuthRedirect', () => {
  it('defaults to the https callback of the alpha variant', () => {
    expect(resolveAuthRedirect({ schemeRedirectUri: scheme })).toEqual({
      mode: 'https',
      redirectUri: `${host}/auth/callback/alpha`,
      domainHint: undefined,
    });
    expect(resolveAuthRedirect({ mode: 'bogus', variant: 'preview', schemeRedirectUri: scheme }).redirectUri).toBe(`${host}/auth/callback/alpha`);
  });

  it('selects the https callback per variant', () => {
    expect(resolveAuthRedirect({ variant: 'development', schemeRedirectUri: scheme }).redirectUri).toBe(`${host}/auth/callback/dev`);
    expect(resolveAuthRedirect({ variant: 'preview', schemeRedirectUri: scheme }).redirectUri).toBe(`${host}/auth/callback/alpha`);
  });

  it('rolls back to fittrack://auth with mode=scheme', () => {
    expect(resolveAuthRedirect({ mode: 'scheme', variant: 'development', schemeRedirectUri: scheme })).toEqual({
      mode: 'scheme',
      redirectUri: scheme,
      domainHint: undefined,
    });
  });

  it('passes through a valid domain hint and drops empty or invalid values', () => {
    expect(resolveAuthRedirect({ domainHint: 'google', schemeRedirectUri: scheme }).domainHint).toBe('google');
    expect(resolveAuthRedirect({ domainHint: '', schemeRedirectUri: scheme }).domainHint).toBeUndefined();
    expect(resolveAuthRedirect({ domainHint: 'a&prompt=x', schemeRedirectUri: scheme }).domainHint).toBeUndefined();
  });
});

describe('buildAuthExtraParams', () => {
  it('is off by default and sends domain_hint when set', () => {
    expect(buildAuthExtraParams(undefined)).toBeUndefined();
    expect(buildAuthExtraParams('google')).toEqual({ domain_hint: 'google' });
  });
});

describe('app.config.js consistency', () => {
  const require = createRequire(import.meta.url);
  const config = require('../../app.config.js') as (ctx: { config: Record<string, unknown> }) => {
    android: { intentFilters: { data: { host: string; pathPrefix: string }[] }[] };
  };

  it('uses the same host and per-variant path as the redirect URI', () => {
    const result = config({ config: {} });
    const data = result.android.intentFilters.flatMap((f) => f.data);
    expect(data).toHaveLength(1);
    expect(data[0]!.host).toBe(AUTH_CALLBACK_HOST);
    const redirect = resolveAuthRedirect({ variant: undefined, schemeRedirectUri: scheme }).redirectUri;
    expect(redirect).toBe(`https://${data[0]!.host}${data[0]!.pathPrefix}`);
  });
});
