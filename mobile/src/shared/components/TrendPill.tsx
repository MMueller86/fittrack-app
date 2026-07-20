// Small pill that compares the latest weight to the previous entry.
// In a weight-tracking context, "down" reads as positive (green); "up"
// reads as negative (red). When there is no previous entry, we render
// a neutral "first entry" badge.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../app/theme';
import type { WeightEntry, GoalType } from '@fittrack/shared';
import { evaluateWeightDelta } from '@fittrack/shared';

interface TrendPillProps {
  latest?: WeightEntry;
  previous?: WeightEntry;
  /**
   * When provided, arrow color is derived from the user's goal.
   * Defaults to lose_weight behaviour for backwards compatibility.
   */
  goalType?: GoalType;
}

export function TrendPill({ latest, previous, goalType = 'lose_weight' }: TrendPillProps) {
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
  if (parseFloat(Math.abs(delta).toFixed(2)) === 0) {
    return (
      <View style={[styles.pill, styles.neutralPill]}>
        <Text style={styles.neutralText}>● No change</Text>
      </View>
    );
  }
  const evaluation = evaluateWeightDelta(goalType, delta);
  const isPositive = evaluation === 'positive';
  const isNeutral = evaluation === 'neutral';
  const arrow = delta < 0 ? '↓' : '↑';
  const color = isNeutral
    ? colors.neutral
    : isPositive
    ? colors.positive
    : colors.negative;
  const bg = isNeutral
    ? colors.surfaceMuted
    : isPositive
    ? 'rgba(103, 178, 62, 0.15)'
    : 'rgba(226, 107, 107, 0.15)';
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>
        {arrow} {Math.abs(delta).toFixed(2)} {latest.unit}
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
