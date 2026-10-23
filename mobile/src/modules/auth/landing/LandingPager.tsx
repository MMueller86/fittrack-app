// LandingPager — horizontale, scrollgesteuerte Funktionsvorstellung für den Login-Screen.

import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, spacing, typography } from '../../../app/theme';
import { LANDING_SLIDES } from './landingContent';
import { SlideContext, Layer, ScaledStage } from './landingPrimitives';
import { CaptureStage, InsightsStage, ProgressStage, RecipesStage } from './LandingStages';

const STAGES = [CaptureStage, RecipesStage, ProgressStage, InsightsStage] as const;

const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 28;
const HEADLINE_MIN = 24;
const HEADLINE_MAX = 34;
// Längste Headline-Zeile hat 21 Zeichen; Breite/12 hält sie sicher einzeilig.
const HEADLINE_WIDTH_DIVISOR = 12;

function AmbientBackground({ scrollX, pageWidth }: { scrollX: SharedValue<number>; pageWidth: number }) {
  const size = pageWidth * 1.8;
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -scrollX.value * 0.15 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.ambient, { width: size, height: size, left: -pageWidth * 0.4 }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="ambient" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.16} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#ambient)" />
      </Svg>
    </Animated.View>
  );
}

function Dot({ index, scrollX, pageWidth }: { index: number; scrollX: SharedValue<number>; pageWidth: number }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * pageWidth, index * pageWidth, (index + 1) * pageWidth];
    return {
      width: interpolate(scrollX.value, input, [DOT_SIZE, DOT_ACTIVE_WIDTH, DOT_SIZE], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(scrollX.value, input, [colors.surfaceMuted, colors.primaryBright, colors.surfaceMuted]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export function LandingPager() {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  const headlineSize = Math.round(
    Math.min(HEADLINE_MAX, Math.max(HEADLINE_MIN, (width - spacing.lg * 2) / HEADLINE_WIDTH_DIVISOR)),
  );

  return (
    <View style={styles.root}>
      <AmbientBackground scrollX={scrollX} pageWidth={width} />

      <View style={styles.header}>
        <Text style={styles.wordmark} accessibilityRole="header">
          <Text style={styles.wordmarkFit}>Fit</Text>
          Track
        </Text>
        <Text style={styles.overline}>ENTDECKE FITTRACK</Text>
      </View>

      <Animated.ScrollView
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={styles.pager}
      >
        {LANDING_SLIDES.map((slide, index) => {
          const Stage = STAGES[index]!;
          return (
            <SlideContext.Provider key={slide.id} value={{ scrollX, pageWidth: width, index }}>
              <View style={[styles.page, { width }]}>
                <ScaledStage>
                  <Stage />
                </ScaledStage>
                <Layer flow depth={0.05} style={styles.textBlock}>
                  <Text style={[styles.headline, { fontSize: headlineSize, lineHeight: Math.round(headlineSize * 1.2) }]} numberOfLines={1} adjustsFontSizeToFit>
                    {slide.lead}
                  </Text>
                  <Text
                    style={[styles.headline, styles.headlineAccent, { fontSize: headlineSize, lineHeight: Math.round(headlineSize * 1.2) }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {slide.accent}
                  </Text>
                  <Text style={styles.body}>{slide.body}</Text>
                </Layer>
              </View>
            </SlideContext.Provider>
          );
        })}
      </Animated.ScrollView>

      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {LANDING_SLIDES.map((slide, index) => (
          <Dot key={slide.id} index={index} scrollX={scrollX} pageWidth={width} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  ambient: { position: 'absolute', top: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  wordmark: { fontSize: 32, fontWeight: '800', letterSpacing: -1, color: colors.text },
  wordmarkFit: { color: colors.primaryBright },
  overline: { ...typography.overline, color: colors.textSecondary, letterSpacing: 2 },
  pager: { flex: 1 },
  page: { flex: 1 },
  textBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headline: { fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  headlineAccent: { color: colors.primaryBright },
  body: { ...typography.body1, color: colors.textSecondary, marginTop: spacing.sm + spacing.xs, lineHeight: 24 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  dot: { height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
