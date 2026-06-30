// InsightCard — täglich einmalig generiertes KI-Briefing.
// Zeigt Skeleton während geladen wird, Fade-In nach Ankunft.
// Keine Chatblasen, keine Konversation — strukturiertes Briefing.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { InsightResponse, InsightCtaTarget } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Skeleton (Lade-Zustand)
// ---------------------------------------------------------------------------

function SkeletonBlock({ width, height, style }: { width: string | number; height: number; style?: object }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        skeletonStyles.block,
        { width, height, opacity: pulse },
        style,
      ]}
    />
  );
}

const skeletonStyles = StyleSheet.create({
  block: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
  },
});

function InsightSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <SkeletonBlock width={16} height={16} />
        <SkeletonBlock width={160} height={14} style={{ marginLeft: spacing.sm }} />
      </View>
      <View style={styles.bodyRows}>
        <SkeletonBlock width="100%" height={12} />
        <SkeletonBlock width="88%" height={12} style={{ marginTop: 6 }} />
        <SkeletonBlock width="72%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CTA navigation target mapping
// ---------------------------------------------------------------------------

interface Props {
  insight: InsightResponse | null;
  onCtaPress?: (target: InsightCtaTarget) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InsightCard({ insight, onCtaPress }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  // Fade in when insight arrives
  useEffect(() => {
    if (insight) {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [insight?.generatedAt]);

  if (!insight) {
    return <InsightSkeleton />;
  }

  // Quota / unavailable states: render a minimal informational card
  if (insight.status === 'quota_exceeded' || insight.status === 'unavailable') {
    return (
      <Animated.View style={[styles.card, styles.muted, { opacity }]}>
        <Text style={styles.mutedText}>{insight.summary}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.badge}>🧠</Text>
        <Text style={styles.badgeLabel}>FitTrack Insight</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>{insight.title}</Text>

      {/* Summary */}
      <Text style={styles.summary}>{insight.summary}</Text>

      {/* Recommendation */}
      {insight.recommendation ? (
        <Text style={styles.recommendation}>{insight.recommendation}</Text>
      ) : null}

      {/* CTA */}
      {insight.cta && insight.ctaTarget && onCtaPress ? (
        <TouchableOpacity
          style={styles.cta}
          onPress={() => onCtaPress(insight.ctaTarget!)}
          activeOpacity={0.75}
        >
          <Text style={styles.ctaText}>{insight.cta}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  muted: {
    borderColor: colors.border,
  },
  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    fontSize: 14,
  },
  badgeLabel: {
    ...typography.overline,
    color: colors.primary,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  // Content
  title: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700' as const,
  },
  summary: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recommendation: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '500' as const,
    fontStyle: 'italic',
  },
  // CTA
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  ctaText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '600' as const,
  },
  // Muted text (quota / unavailable)
  mutedText: {
    ...typography.body2,
    color: colors.textMuted,
    lineHeight: 20,
  },
  // Body skeleton rows
  bodyRows: {
    gap: 0,
    paddingTop: spacing.xs,
  },
});
