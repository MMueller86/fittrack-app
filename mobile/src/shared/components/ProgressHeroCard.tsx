// ProgressHeroCard — Hero card for the Progress screen.
//
// Shows current weight, delta vs previous, and goal progress bar.
// Designed to be reusable for any future metric (body measurements,
// body fat, etc.) — all domain logic lives in the parent screen.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WeightEntry, WeightUnit, GoalType } from '@fittrack/shared';
import { progressGrowsOnDecrease, goalLabel } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { TrendPill } from './TrendPill';

export interface ProgressHeroCardProps {
  latest: WeightEntry | undefined;
  previous: WeightEntry | undefined;
  /** Oldest recorded entry — used to compute total delta since start. */
  startEntry: WeightEntry | undefined;
  targetWeightKg: number | undefined;
  unit: WeightUnit;
  /** User's primary goal — drives all evaluations. Defaults to lose_weight. */
  goalType?: GoalType;
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysSince(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86_400_000);
}

function toKg(entry: WeightEntry): number {
  return entry.unit === 'lbs' ? entry.value / 2.20462 : entry.value;
}

export function ProgressHeroCard({
  latest,
  previous,
  startEntry,
  targetWeightKg,
  unit,
  goalType = 'lose_weight',
}: ProgressHeroCardProps) {
  if (!latest) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>AKTUELL</Text>
        <Text style={styles.placeholder}>—</Text>
        <Text style={styles.hint}>
          Trage deine erste Messung ein, um deinen Fortschritt zu sehen.
        </Text>
      </View>
    );
  }

  // Goal progress — direction determined by goalContext, not hardcoded
  const currentKg = toKg(latest);
  const startKg = startEntry ? toKg(startEntry) : currentKg;
  const hasGoal = targetWeightKg !== undefined;
  const growsOnDecrease = progressGrowsOnDecrease(goalType);
  const hasDirectionalGoal = growsOnDecrease !== null;

  let progressPct = 0;
  let remainingDisplay: number | null = null;

  if (hasGoal && hasDirectionalGoal) {
    const targetKg = targetWeightKg!;
    const totalChange = Math.abs(startKg - targetKg);
    const achievedChange = growsOnDecrease
      ? Math.max(0, startKg - currentKg)
      : Math.max(0, currentKg - startKg);
    progressPct = totalChange > 0 ? Math.min(1, achievedChange / totalChange) : 1;
    const remainingKg = growsOnDecrease
      ? Math.max(0, currentKg - targetKg)
      : Math.max(0, targetKg - currentKg);
    remainingDisplay = unit === 'lbs' ? remainingKg * 2.20462 : remainingKg;
  }

  const hasStart = startEntry && startEntry.id !== latest.id;
  const startDays = hasStart ? daysSince(startEntry!.date) : null;
  const fillWidth = `${Math.round(progressPct * 100)}%`;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>AKTUELL</Text>

      <View style={styles.valueRow}>
        <View style={styles.valueLeft}>
          <View style={styles.numberRow}>
            <Text style={styles.valueText}>{latest.value.toFixed(1)}</Text>
            <Text style={styles.unitText}>{latest.unit}</Text>
          </View>
          <Text style={styles.dateText}>{formatLongDate(latest.date)}</Text>
        </View>
        <View style={styles.pillContainer}>
          <TrendPill latest={latest} previous={previous} goalType={goalType} />
        </View>
      </View>

      {hasGoal && hasDirectionalGoal && (
        <View style={styles.goalSection}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalLabel}>
              {remainingDisplay !== null && remainingDisplay > 0.05
                ? `Noch ${remainingDisplay.toFixed(1)} ${unit} bis zum Ziel (${goalLabel(goalType)})`
                : '🎯 Ziel erreicht!'}
            </Text>
            <Text style={styles.goalPct}>{Math.round(progressPct * 100)} %</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: fillWidth as `${number}%` }]} />
          </View>
          {hasStart && startDays !== null && (
            <Text style={styles.startHint}>
              Gestartet bei {startEntry!.value.toFixed(1)} {startEntry!.unit}
              {startDays > 0
                ? ` · vor ${startDays} ${startDays === 1 ? 'Tag' : 'Tagen'}`
                : ''}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.primaryBright,
    marginBottom: spacing.sm,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  valueLeft: {
    flex: 1,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  valueText: {
    ...typography.display,
    color: colors.text,
  },
  unitText: {
    ...typography.h2,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    marginBottom: 6,
  },
  dateText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pillContainer: {
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  placeholder: {
    ...typography.display,
    color: colors.textMuted,
  },
  hint: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  goalSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalLabel: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  goalPct: {
    ...typography.caption,
    color: colors.primaryBright,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  startHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
