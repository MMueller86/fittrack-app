// Brand logo. Uses the bundled `app_logo.png` asset (black background,
// green apple + dumbbell + ECG line, "GESUNDHEITS APP" wordmark).
//
// The source asset is a square with built-in black background — perfect
// for our dark theme; we render it as-is without tint.

import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOGO_SOURCE = require('../../../assets/app_logo.png');

interface LogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function Logo({ size = 120, style }: LogoProps) {
  return (
    <Image
      source={LOGO_SOURCE}
      style={[styles.image, { width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="Gesundheits App logo"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    alignSelf: 'center',
  },
});
