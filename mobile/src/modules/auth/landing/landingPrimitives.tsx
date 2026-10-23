// Bausteine der Landingpage: scrollgesteuerte Parallax-Ebenen, skalierende Bühne, Glas-Karten.

import React, { createContext, useContext, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../../../app/theme';

export const STAGE_WIDTH = 340;
export const STAGE_HEIGHT = 410;
const STAGE_MAX_SCALE = 1.15;
// Lässt rotierten Karten Luft zu Header und Text.
const STAGE_FIT = 0.92;

interface SlideContextValue {
  scrollX: SharedValue<number>;
  pageWidth: number;
  index: number;
}

export const SlideContext = createContext<SlideContextValue | null>(null);

function useSlide(): SlideContextValue {
  const ctx = useContext(SlideContext);
  if (!ctx) throw new Error('SlideContext fehlt');
  return ctx;
}

interface LayerProps {
  /** Parallax-Stärke relativ zur Seitenbreite; größer = näher am Betrachter. */
  depth?: number;
  /** Im Layout-Fluss statt absolut positioniert (z. B. Textblock). */
  flow?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Layer({ depth = 0, flow = false, style, children }: LayerProps) {
  const { scrollX, pageWidth, index } = useSlide();
  const animated = useAnimatedStyle(() => {
    const offset = index - scrollX.value / pageWidth;
    const visibility = 1 - Math.min(1, Math.abs(offset));
    return {
      opacity: Math.min(1, visibility * 1.6),
      transform: [
        { translateX: offset * pageWidth * depth },
        { scale: interpolate(visibility, [0, 1], [0.94, 1], Extrapolation.CLAMP) },
      ],
    };
  });
  return <Animated.View style={[flow ? undefined : styles.absolute, style, animated]}>{children}</Animated.View>;
}

interface ScaledStageProps {
  children: React.ReactNode;
}

/** Zeichnet die Illustration auf festem Designraster und skaliert sie auf den verfügbaren Platz. */
export function ScaledStage({ children }: ScaledStageProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }

  const scale = size ? Math.min((size.w / STAGE_WIDTH) * STAGE_FIT, (size.h / STAGE_HEIGHT) * STAGE_FIT, STAGE_MAX_SCALE) : 1;

  return (
    <View
      style={styles.stageArea}
      onLayout={onLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {size && (
        <View
          style={{
            position: 'absolute',
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            left: (size.w - STAGE_WIDTH) / 2,
            top: (size.h - STAGE_HEIGHT) / 2,
            transform: [{ scale }],
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

interface GlowProps {
  color: string;
  size: number;
  opacity?: number;
}

export function Glow({ color, size, opacity = 0.3 }: GlowProps) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill="url(#glow)" />
    </Svg>
  );
}

export function GlassCard({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export const landingCardStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { ...typography.h3, color: colors.text, fontWeight: '800' },
  body: { ...typography.body2, color: colors.textSecondary },
  link: { ...typography.body2, color: colors.primaryBright, fontWeight: '700' },
  hint: { ...typography.caption, color: colors.textMuted },
});

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
  stageArea: { flex: 1, alignSelf: 'stretch' },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    shadowColor: colors.background,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
