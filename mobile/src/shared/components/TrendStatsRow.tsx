// TrendStatsRow — Three compact statistics displayed below the Progress chart.
//
// Calculates Ø 7-day average, Ø 30-day average, and weekly change via
// linear regression over the last 30 days. All memoised — no API calls.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WeightEntry, WeightUnit } from '@fittrack/shared';
import {
  calculateWeightTrendPerWeek,
  classifyWeightTrend,
  getWeightEntriesInLastDays,
} from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';

interface TrendStatsRowProps {
  entries: WeightEntry[];
  unit: WeightUnit;
}

function toKg(e: WeightEntry): number {
  return e.unit === 'lbs' ? e.value / 2.20462 : e.value;
}

function toUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? kg * 2.20462 : kg;
}

interface Stats {
  avg7: number | null;
  avg30: number | null;
  weeklyChange: number | null;
}

function computeStats(entries: WeightEntry[], unit: WeightUnit): Stats {
  if (entries.length === 0) return { avg7: null, avg30: null, weeklyChange: null };

  const now = new Date();

  const last7 = getWeightEntriesInLastDays(entries, 7, now);
  const last30 = getWeightEntriesInLastDays(entries, 30, now);

  const avg = (arr: WeightEntry[]): number | null =>
    arr.length === 0
      ? null
      : toUnit(arr.reduce((s, e) => s + toKg(e), 0) / arr.length, unit);

  const weeklyChange = calculateWeightTrendPerWeek(entries, unit, now);

  return { avg7: avg(last7), avg30: avg(last30), weeklyChange };
}

function Stat({
  label,
  sublabel,
  value,
  suffix,
  valueColor = colors.text,
}: {
  label: string;
  sublabel?: string;
  value: string;
  suffix: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: valueColor }]}>
        {value}
        {suffix ? <Text style={styles.statSuffix}> {suffix}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sublabel ? <Text style={styles.statSublabel}>{sublabel}</Text> : null}
    </View>
  );
}

export function TrendStatsRow({ entries, unit }: TrendStatsRowProps) {
  const stats = useMemo(() => computeStats(entries, unit), [entries, unit]);

  if (stats.avg7 === null && stats.avg30 === null) return null;

  const trendDirection = classifyWeightTrend(stats.weeklyChange);
  const changeColor =
    trendDirection === 'losing'
      ? colors.positive
      : trendDirection === 'gaining'
      ? colors.negative
      : colors.textSecondary;

  const changeStr =
    stats.weeklyChange !== null
      ? (stats.weeklyChange > 0 ? '+' : '') + stats.weeklyChange.toFixed(2)
      : '—';

  return (
    <View style={styles.row}>
      <Stat
        label="Ø 7 Tage"
        value={stats.avg7 !== null ? stats.avg7.toFixed(1) : '—'}
        suffix={stats.avg7 !== null ? unit : ''}
      />
      <View style={styles.divider} />
      <Stat
        label="Ø 30 Tage"
        value={stats.avg30 !== null ? stats.avg30.toFixed(1) : '—'}
        suffix={stats.avg30 !== null ? unit : ''}
      />
      <View style={styles.divider} />
      <Stat
        label="Trend / Woche"
        sublabel="BASIS: 30 TAGE"
        value={changeStr}
        suffix={stats.weeklyChange !== null ? unit : ''}
        valueColor={changeColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
    lineHeight: 24,
  },
  statSuffix: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statSublabel: {
    ...typography.overline,
    color: colors.textDisabled,
    marginTop: 1,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
});
