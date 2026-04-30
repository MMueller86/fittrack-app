// Small pill that compares the latest weight to the previous entry.
// In a weight-tracking context, "down" reads as positive (green); "up"
// reads as negative (red). When there is no previous entry, we render
// a neutral "first entry" badge.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../app/theme';
import type { WeightEntry } from '@fittrack/shared';

interface TrendPillProps {
  latest?: WeightEntry;
  previous?: WeightEntry;
}

export function TrendPill({ latest, previous }: TrendPillProps) {
  if (!latest) {
    return null;
  }
  if (!previous) {
    return (
      <View style={[styles.pill, styles.neutralPill]}>
        <Text style={styles.neutralText}>First entry</Text>
      </View>
    );
  }
  const delta = latest.value - previous.value;
  if (Math.abs(delta) < 0.05) {
    return (
      <View style={[styles.pill, styles.neutralPill]}>
        <Text style={styles.neutralText}>● No change</Text>
      </View>
    );
  }
  const isDown = delta < 0;
  const arrow = isDown ? '↓' : '↑';
  const color = isDown ? colors.positive : colors.negative;
  const bg = isDown ? 'rgba(103, 178, 62, 0.15)' : 'rgba(226, 107, 107, 0.15)';
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>
        {arrow} {Math.abs(delta).toFixed(1)} {latest.unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  neutralPill: {
    backgroundColor: colors.surfaceMuted,
  },
  pillText: {
    ...typography.caption,
    fontWeight: '700',
  },
  neutralText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
