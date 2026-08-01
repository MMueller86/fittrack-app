// ActivityCard — displays a logged special activity with stats and action buttons.
// Shown in DiaryScreen when a special activity exists for the current day.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SpecialActivity } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { Icon } from '../../../shared/components/Icon';

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

const ACTIVITY_TITLE: Record<string, string> = {
  hiking:  'Wanderung',
  cycling: 'Radfahrt',
  running: 'Lauf',
  other:   'Aktivität',
};

const ACTIVITY_ICON: Record<string, string> = {
  hiking:  'hiking',
  cycling: 'bike',
  running: 'run',
  other:   'lightning-bolt',
};

export interface ActivityCardProps {
  activity: SpecialActivity;
  onShowBreakdown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  consumedCalories?: number;
}

export function ActivityCard({ activity, onShowBreakdown, onEdit, onDelete, consumedCalories }: ActivityCardProps) {
  const bonus = Math.round(activity.activityBonus);
  const base = Math.round(activity.dailyCalorieTarget);
  const consumed = consumedCalories ?? 0;
  const consumedBonus = Math.max(0, consumed - base);
  const bonusPct = bonus > 0 ? Math.min(1, consumedBonus / bonus) : 0;
  const consumedBonusDisplay = Math.min(Math.round(consumedBonus), bonus);

  return (
    <View style={styles.card}>
      {/* Header row: type label + bonus badge */}
      <View style={styles.header}>
        <Icon lib="mci" name={(ACTIVITY_ICON[activity.type] ?? 'lightning-bolt') as any} size="lg" color={colors.primary} />
        <Text style={styles.title}>{ACTIVITY_TITLE[activity.type] ?? 'Aktivität'}</Text>
        <View style={styles.bonus}>
          <Text style={styles.bonusText}>+{Math.round(activity.activityBonus)} kcal</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(activity.movementTimeMinutes)}</Text>
          <Text style={styles.statLabel}>Dauer</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{activity.distanceKm} km</Text>
          <Text style={styles.statLabel}>Strecke</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{activity.elevationGainM} m</Text>
          <Text style={styles.statLabel}>Höhenmeter</Text>
        </View>
      </View>

      {/* Bonus progress bar */}
      {bonus > 0 && (
        <View style={styles.bonusProgress}>
          <View style={styles.bonusProgressHeader}>
            <Text style={styles.bonusProgressLabel}>Zusatzbudget genutzt</Text>
            <Text style={styles.bonusProgressValue}>
              {consumedBonusDisplay} / {bonus} kcal
            </Text>
          </View>
          <View style={styles.bonusProgressTrack}>
            <View style={[styles.bonusProgressFill, { width: `${Math.round(bonusPct * 100)}%` }]} />
          </View>
        </View>
      )}

      {/* Action row */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={onShowBreakdown} style={styles.actionBtn} activeOpacity={0.7}>
          <Text style={styles.actionText}>Berechnung ansehen</Text>
        </TouchableOpacity>
        <View style={styles.actionSep} />
        <TouchableOpacity onPress={onEdit} style={styles.actionBtn} activeOpacity={0.7}>
          <Text style={styles.actionText}>Bearbeiten</Text>
        </TouchableOpacity>
        <View style={styles.actionSep} />
        <TouchableOpacity onPress={onDelete} style={styles.actionBtn} activeOpacity={0.7}>
          <Text style={[styles.actionText, styles.actionDestructive]}>Löschen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.body1,
    fontWeight: '700' as const,
    color: colors.text,
    flex: 1,
  },
  bonus: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bonusText: {
    ...typography.caption,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center' as const,
  },
  statValue: {
    ...typography.body2,
    fontWeight: '700' as const,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  actions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  actionDestructive: {
    color: colors.negative,
  },
  bonusProgress: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  bonusProgressHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  bonusProgressLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bonusProgressValue: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },
  bonusProgressTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  bonusProgressFill: {
    height: '100%' as const,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  actionSep: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },
});
