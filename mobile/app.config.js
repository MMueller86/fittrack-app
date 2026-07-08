// app.config.js — dynamic Expo config
// Allows DEV and Alpha/Preview builds to coexist on the same device by using
// different Android applicationIds and app names.
//
// APP_VARIANT is set via eas.json `env` block:
//   development → com.fittrack.app.dev  /  "FitTrack (Dev)"
//   (default)   → com.fittrack.app      /  "FitTrack"

const IS_DEV = process.env.APP_VARIANT === 'development';

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'FitTrack (Dev)' : 'FitTrack',
  plugins: [
    ...(config.plugins ?? []),
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
