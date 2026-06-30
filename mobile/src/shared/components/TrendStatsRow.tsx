// TrendStatsRow — Three compact statistics displayed below the Progress chart.
//
// Calculates Ø 7-day average, Ø 30-day average, and weekly change via
// linear regression over the last 30 days. All memoised — no API calls.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WeightEntry, WeightUnit } from '@fittrack/shared';
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

function parseMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

interface Stats {
  avg7: number | null;
  avg30: number | null;
  weeklyChange: number | null;
}

function computeStats(entries: WeightEntry[], unit: WeightUnit): Stats {
  if (entries.length === 0) return { avg7: null, avg30: null, weeklyChange: null };

  const now = Date.now();
  const ms7 = 7 * 86_400_000;
  const ms30 = 30 * 86_400_000;

  const last7 = entries.filter((e) => now - parseMs(e.date) <= ms7);
  const last30 = entries.filter((e) => now - parseMs(e.date) <= ms30);

  const avg = (arr: WeightEntry[]): number | null =>
    arr.length === 0
      ? null
      : toUnit(arr.reduce((s, e) => s + toKg(e), 0) / arr.length, unit);

  // Linear regression slope over last 30 days, projected to 7-day change
  let weeklyChange: number | null = null;
  if (last30.length >= 2) {
    const sorted = [...last30].sort((a, b) => parseMs(a.date) - parseMs(b.date));
    const xs = sorted.map((e) => parseMs(e.date) / 86_400_000); // days as number
    const ys = sorted.map((e) => toKg(e));
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    if (den > 0) weeklyChange = toUnit((num / den) * 7, unit);
  }

  return { avg7: avg(last7), avg30: avg(last30), weeklyChange };
}

function Stat({
  label,
  value,
  suffix,
  valueColor = colors.text,
}: {
  label: string;
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
    </View>
  );
}

export function TrendStatsRow({ entries, unit }: TrendStatsRowProps) {
  const stats = useMemo(() => computeStats(entries, unit), [entries, unit]);

  if (stats.avg7 === null && stats.avg30 === null) return null;

  const changeColor =
    stats.weeklyChange === null
      ? colors.textSecondary
      : stats.weeklyChange < -0.01
      ? colors.positive
      : stats.weeklyChange > 0.01
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
        label="Ø / Woche"
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
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
});
