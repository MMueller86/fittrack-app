// WeightCoachCard — kompakte Gewichtskarte mit 14-Tage-Chart und lokaler Trendanalyse.
// Ersetzt den inline Weight-Block in HomeScreen.

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import { WeightChart } from '../../shared/components/WeightChart';
import type { WeightEntry } from '@fittrack/shared';
import { computeWeightTrend } from './computeWeightTrend';

interface Props {
  entries: WeightEntry[];
  targetWeightKg: number | undefined;
  loading: boolean;
  onPress: () => void;
}

const ASSESSMENT_ICON: Record<string, string> = {
  on_track: '✓',
  too_fast: '⚠',
  stagnating: '→',
  wrong_direction: '✕',
  gaining_correctly: '✓',
  no_target: '→',
  insufficient: '·',
};

export function WeightCoachCard({ entries, targetWeightKg, loading, onPress }: Props) {
  const latest = entries[0];
  const chartWidth = useMemo(
    () => Dimensions.get('window').width - spacing.md * 2 - spacing.md * 2,
    [],
  );

  const trend = useMemo(
    () => computeWeightTrend(entries, targetWeightKg),
    [entries, targetWeightKg],
  );

  const trendColor =
    trend.messageColor === 'positive'
      ? colors.positive
      : trend.messageColor === 'negative'
        ? colors.negative
        : colors.textSecondary;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>GEWICHT</Text>
          {latest ? (
            <View style={styles.valueRow}>
              <Text style={styles.value}>{latest.value.toFixed(2)}</Text>
              <Text style={styles.unit}> kg</Text>
            </View>
          ) : null}
          {targetWeightKg ? (
            <Text style={styles.goal}>Ziel {targetWeightKg.toFixed(1)} kg</Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>

      {/* Chart oder Loading oder Empty */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : entries.length >= 2 ? (
        <WeightChart
          entries={entries}
          width={chartWidth}
          height={110}
          windowDays={14}
          targetWeightKg={targetWeightKg}
          showLegend={false}
        />
      ) : (
        <Text style={styles.emptyText}>
          {entries.length === 0
            ? 'Starte mit deiner ersten Messung.'
            : 'Einen weiteren Eintrag hinzufügen für den Trend.'}
        </Text>
      )}

      {/* Trend-Assessment */}
      {trend.assessment !== 'insufficient' && entries.length >= 2 ? (
        <View style={styles.trendRow}>
          <Text style={[styles.trendIcon, { color: trendColor }]}>
            {ASSESSMENT_ICON[trend.assessment] ?? '·'}
          </Text>
          <View style={styles.trendText}>
            {trend.rateLabel ? (
              <Text style={[styles.trendRate, { color: trendColor }]}>{trend.rateLabel}</Text>
            ) : null}
            <Text style={styles.trendMessage}>{trend.message}</Text>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: { flex: 1 },
  eyebrow: { ...typography.overline, color: colors.primaryBright, marginBottom: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 32, fontWeight: '800' as const, color: colors.text, lineHeight: 36 },
  unit: { ...typography.h3, color: colors.textSecondary },
  goal: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted, fontWeight: '600' as const },
  emptyText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  trendIcon: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 1,
  },
  trendText: { flex: 1 },
  trendRate: {
    ...typography.caption,
    fontWeight: '700' as const,
    marginBottom: 1,
  },
  trendMessage: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
