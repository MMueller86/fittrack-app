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
  const appConfigPath = require.resolve('../../app.config.js');
  type AppConfig = {
    name: string;
    scheme: string;
    plugins: unknown[];
    android: {
      package: string;
      softwareKeyboardLayoutMode: string;
      intentFilters: {
        action: string;
        autoVerify: boolean;
        data: { scheme: string; host: string; pathPrefix: string }[];
        category: string[];
      }[];
    };
    ios: { bundleIdentifier: string };
  };

  const loadConfig = (variant?: string): AppConfig => {
    const previousVariant = process.env.APP_VARIANT;
    if (variant) process.env.APP_VARIANT = variant;
    else delete process.env.APP_VARIANT;
    delete require.cache[appConfigPath];

    try {
      const config = require(appConfigPath) as (ctx: { config: Record<string, unknown> }) => AppConfig;
      return config({
        config: {
          name: 'FitTrack',
          scheme: 'fittrack',
          plugins: ['expo-dev-client'],
          android: {
            package: 'com.fittrack.app',
            softwareKeyboardLayoutMode: 'pan',
            intentFilters: [],
          },
          ios: { bundleIdentifier: 'com.fittrack.app' },
        },
      });
    } finally {
      delete require.cache[appConfigPath];
      if (previousVariant === undefined) delete process.env.APP_VARIANT;
      else process.env.APP_VARIANT = previousVariant;
    }
  };

  it.each([
    { variant: undefined, name: 'FitTrack', packageName: 'com.fittrack.app', callbackPath: '/auth/callback/alpha' },
    { variant: 'development', name: 'FitTrack (Dev)', packageName: 'com.fittrack.app.dev', callbackPath: '/auth/callback/dev' },
  ])('keeps the $name variant aligned with its native config and redirect', ({ variant, name, packageName, callbackPath }) => {
    const result = loadConfig(variant);
    expect(result.name).toBe(name);
    expect(result.scheme).toBe('fittrack');
    expect(result.android.package).toBe(packageName);
    expect(result.android.softwareKeyboardLayoutMode).toBe('resize');
    expect(result.ios.bundleIdentifier).toBe(packageName);

    const [filter] = result.android.intentFilters;
    expect(filter).toEqual({
      action: 'VIEW',
      autoVerify: true,
      data: [{ scheme: 'https', host: AUTH_CALLBACK_HOST, pathPrefix: callbackPath }],
      category: ['DEFAULT', 'BROWSABLE'],
    });
    expect(resolveAuthRedirect({ variant, schemeRedirectUri: scheme }).redirectUri)
      .toBe(`https://${AUTH_CALLBACK_HOST}${callbackPath}`);

    const pluginIds = result.plugins.map((plugin) => Array.isArray(plugin) ? plugin[0] : plugin);
    expect(pluginIds).toEqual(expect.arrayContaining([
      'expo-dev-client',
      'react-native-health-connect',
      'expo-media-library',
      'expo-camera',
    ]));
    expect(result.plugins.filter((plugin) => typeof plugin === 'function')).toHaveLength(2);
    expect(result.plugins).toContainEqual([
      'expo-media-library',
      expect.objectContaining({
        photosPermission: expect.any(String),
        savePhotosPermission: expect.any(String),
        granularPermissions: ['photo'],
      }),
    ]);
    expect(result.plugins).toContainEqual([
      'expo-camera',
      expect.objectContaining({
        cameraPermission: expect.any(String),
        microphonePermission: false,
        recordAudioAndroid: false,
      }),
    ]);
  });
});
