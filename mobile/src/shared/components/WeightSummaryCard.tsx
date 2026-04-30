// Home-screen card summarising the user's latest weight entry.
// Tapping the card navigates to the full Weight detail screen.

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, radius, spacing, typography } from '../../app/theme';
import type { WeightEntry } from '@fittrack/shared';
import { TrendPill } from './TrendPill';

interface WeightSummaryCardProps {
  latest?: WeightEntry;
  previous?: WeightEntry;
  loading?: boolean;
  onPress: () => void;
}

function formatLongDate(iso: string): string {
  // Parse YYYY-MM-DD as local date (no UTC drift).
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function WeightSummaryCard({
  latest,
  previous,
  loading,
  onPress,
}: WeightSummaryCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel="Open weight tracking"
    >
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>Weight</Text>
        <Text style={styles.chevron}>›</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : latest ? (
        <>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{latest.value.toFixed(1)}</Text>
            <Text style={styles.unit}>{latest.unit}</Text>
          </View>
          <Text style={styles.date}>{formatLongDate(latest.date)}</Text>
          <View style={styles.pillRow}>
            <TrendPill latest={latest} previous={previous} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.placeholder}>No entries yet</Text>
          <Text style={styles.helper}>Tap to log your first weight.</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.primaryBright,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  value: {
    ...typography.display,
    color: colors.text,
  },
  unit: {
    ...typography.h2,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    marginBottom: 6,
  },
  date: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pillRow: {
    marginTop: spacing.md,
  },
  placeholder: {
    ...typography.h2,
    color: colors.textSecondary,
  },
  helper: {
    ...typography.body2,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  loader: {
    marginVertical: spacing.lg,
  },
});
