// app.config.js — dynamic Expo config
// Allows DEV and Alpha/Preview builds to coexist on the same device by using
// different Android applicationIds and app names.
//
// APP_VARIANT is set via eas.json `env` block:
//   development → com.fittrack.app.dev  /  "FitTrack (Dev)"
//   (default)   → com.fittrack.app      /  "FitTrack"

const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');
const IS_DEV = process.env.APP_VARIANT === 'development';

// Health Connect requires Android 8.0 (API 26). The Expo Gradle plugin reads the
// `android.minSdkVersion` Gradle property to override the version catalog minSdk entry.
const withMinSdkVersion26 = (config) =>
  withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter(
      (e) => !(e.type === 'property' && e.key === 'android.minSdkVersion'),
    );
    c.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: '26' });
    return c;
  });

// The react-native-health-connect plugin only adds the intent-filter for the
// rationale UI — not <uses-permission> tags or the <queries> block for package
// visibility (required on Android 11+ to resolve the HC permissions intent).
const withHealthConnectPermissions = (config) =>
  withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;

    // <uses-permission> for HC data types
    const permissions = manifest['uses-permission'] ?? [];
    const HC_PERMISSIONS = [
      'android.permission.health.WRITE_WEIGHT',
      'android.permission.health.READ_WEIGHT',
      'android.permission.health.WRITE_NUTRITION',
    ];
    for (const name of HC_PERMISSIONS) {
      if (!permissions.find((p) => p.$?.['android:name'] === name)) {
        permissions.push({ $: { 'android:name': name } });
      }
    }
    manifest['uses-permission'] = permissions;

    // <queries> block — without this Android 11–13 cannot resolve the HC
    // permissions activity intent and the dialog never appears.
    const queries = manifest['queries'] ?? [];
    const HC_PACKAGE = 'com.google.android.apps.healthdata';
    const alreadyDeclared = queries.some((q) =>
      q.package?.some((p) => p.$?.['android:name'] === HC_PACKAGE),
    );
    if (!alreadyDeclared) {
      queries.push({ package: [{ $: { 'android:name': HC_PACKAGE } }] });
    }
    manifest['queries'] = queries;

    return c;
  });

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'FitTrack (Dev)' : 'FitTrack',
  plugins: [
    ...(config.plugins ?? []),
    'react-native-health-connect',
    withHealthConnectPermissions,
    withMinSdkVersion26,
    [
      'expo-camera',
      {
        cameraPermission: 'FitTrack benötigt Kamerazugriff für den Barcode-Scanner und KI-Analyse.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
  ],
  android: {
    ...config.android,
    package: IS_DEV ? 'com.fittrack.app.dev' : 'com.fittrack.app',
    // Required for @gorhom/bottom-sheet keyboard handling on Android.
    // Without this, the keyboard overlaps sheet content instead of resizing the layout.
    softwareKeyboardLayoutMode: 'resize',
  },
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.fittrack.app.dev' : 'com.fittrack.app',
  },
});
