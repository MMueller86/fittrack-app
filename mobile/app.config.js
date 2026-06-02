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
  android: {
    ...config.android,
    package: IS_DEV ? 'com.fittrack.app.dev' : 'com.fittrack.app',
  },
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.fittrack.app.dev' : 'com.fittrack.app',
  },
});
