// TrendStatsRow — Three compact statistics for the Progress overview.
//
// Calculates exact local-calendar averages and weekly change without API calls.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WeightEntry } from '@fittrack/shared';
import { calculateWeightTrendPerWeek } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { addLocalDays, getLocalIsoDate } from '../date/localDate';
import { formatKilograms } from '../weightFormatting';

interface TrendStatsRowProps {
  entries: WeightEntry[];
  embedded?: boolean;
}

interface Stats {
  avg7: number | null;
  avg30: number | null;
  weeklyChange: number | null;
}

function computeStats(entries: WeightEntry[]): Stats {
  if (entries.length === 0) return { avg7: null, avg30: null, weeklyChange: null };

  const now = new Date();
  const today = getLocalIsoDate(now);
  const last7Start = addLocalDays(today, -6);
  const last30Start = addLocalDays(today, -29);

  const last7 = entries.filter((entry) => entry.date >= last7Start && entry.date <= today);
  const last30 = entries.filter((entry) => entry.date >= last30Start && entry.date <= today);

  const avg = (arr: WeightEntry[]): number | null =>
    arr.length === 0
      ? null
      : arr.reduce((sum, entry) => sum + entry.value, 0) / arr.length;

  const weeklyChange = calculateWeightTrendPerWeek(last30, 'kg', now);

  return { avg7: avg(last7), avg30: avg(last30), weeklyChange };
}

function Stat({
  compact,
  label,
  sublabel,
  value,
  suffix,
}: {
  compact: boolean;
  label: string;
  sublabel?: string;
  value: string;
  suffix: string;
}) {
  return (
    <View
      style={[styles.stat, compact && styles.compactStat]}
      accessible
      accessibilityLabel={`${label}: ${value}${suffix ? ` ${suffix}` : ''}${sublabel ? `. ${sublabel}` : ''}`}
    >
      <Text style={styles.statValue}>
        {value}
        {suffix ? <Text style={styles.statSuffix}> {suffix}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sublabel && !compact ? <Text style={styles.statSublabel}>{sublabel}</Text> : null}
    </View>
  );
}

export function TrendStatsRow({ entries, embedded = false }: TrendStatsRowProps) {
  const stats = useMemo(() => computeStats(entries), [entries]);

  if (stats.avg7 === null && stats.avg30 === null) {
    return embedded
      ? <Text style={styles.emptyText}>Keine Messungen in den letzten 30 Tagen.</Text>
      : null;
  }

  const roundedWeeklyChange = stats.weeklyChange === null
    ? null
    : Number(stats.weeklyChange.toFixed(2));
  const changeStr = roundedWeeklyChange === null
    ? '—'
    : roundedWeeklyChange < 0
    ? `−${formatKilograms(Math.abs(roundedWeeklyChange), 2)}`
    : `${roundedWeeklyChange > 0 ? '+' : ''}${formatKilograms(roundedWeeklyChange, 2)}`;

  return (
    <View style={[styles.row, embedded && styles.embeddedRow]}>
      <Stat
        compact={embedded}
        label="Ø 7 Tage"
        value={stats.avg7 !== null ? formatKilograms(stats.avg7) : '—'}
        suffix={stats.avg7 !== null ? 'kg' : ''}
      />
      <View style={[styles.divider, embedded && styles.compactDivider]} />
      <Stat
        compact={embedded}
        label="Ø 30 Tage"
        value={stats.avg30 !== null ? formatKilograms(stats.avg30) : '—'}
        suffix={stats.avg30 !== null ? 'kg' : ''}
      />
      <View style={[styles.divider, embedded && styles.compactDivider]} />
      <Stat
        compact={embedded}
        label="Trend / Woche"
        sublabel="Basis: 30 Tage"
        value={changeStr}
        suffix={stats.weeklyChange !== null ? 'kg' : ''}
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
  embeddedRow: {
    backgroundColor: colors.surface,
    borderRadius: 0,
    borderWidth: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  emptyText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  compactStat: {
    paddingVertical: spacing.sm,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  statSuffix: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 0,
    marginTop: 2,
    textAlign: 'center',
  },
  statSublabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  compactDivider: {
    marginVertical: spacing.sm,
  },
});
