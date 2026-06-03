// MacroSummaryCard — shared Fortschrittsanzeige für Kalorien + Makros.
// Wird im DiaryScreen (für jedes Datum) und im HomeScreen (heute) genutzt.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DiaryDayResponse } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface MacroTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

function clamp(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(value / max, 1);
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = clamp(value, target);
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={barStyles.value}>{Math.round(value)}g</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { ...typography.caption, color: colors.textSecondary, width: 52 },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: spacing.sm,
  },
  fill: { height: '100%', borderRadius: 3 },
  value: { ...typography.caption, color: colors.text, width: 44, textAlign: 'right' },
});

interface Props {
  summary: DiaryDayResponse['summary'];
  target: MacroTarget;
}

export function MacroSummaryCard({ summary, target }: Props) {
  const calPct = clamp(summary.calories, target.calories);
  const remaining = Math.max(0, target.calories - Math.round(summary.calories));

  return (
    <View style={styles.card}>
      {/* Kalorien-Hero */}
      <View style={styles.caloriesRow}>
        <View>
          <Text style={styles.calorieValue}>{Math.round(summary.calories)}</Text>
          <Text style={styles.calorieLabel}>kcal konsumiert</Text>
        </View>
        <View style={styles.calorieRight}>
          <Text style={styles.calorieTarget}>Ziel: {target.calories} kcal</Text>
          <Text style={[styles.calorieRemaining, remaining === 0 && styles.calorieOverflow]}>
            {remaining === 0
              ? `+${Math.round(summary.calories - target.calories)} kcal über Ziel`
              : `${remaining} kcal verbleibend`}
          </Text>
        </View>
      </View>

      {/* Kalorienbalken */}
      <View style={styles.calTrack}>
        <View
          style={[
            styles.calFill,
            {
              width: `${Math.round(calPct * 100)}%`,
              backgroundColor: calPct >= 1 ? colors.negative : colors.primary,
            },
          ]}
        />
      </View>

      {/* Makros */}
      <View style={styles.macroSection}>
        <MacroBar label="Protein" value={summary.protein} target={target.proteinG} color="#3B82F6" />
        <MacroBar label="Carbs" value={summary.carbs} target={target.carbsG} color={colors.primary} />
        <MacroBar label="Fett" value={summary.fat} target={target.fatG} color="#F59E0B" />
        <MacroBar label="Ballaststoffe" value={summary.fiber} target={target.fiberG} color="#8B5CF6" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  caloriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  calorieValue: { fontSize: 44, fontWeight: '800', color: colors.text, lineHeight: 48 },
  calorieLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  calorieRight: { alignItems: 'flex-end', paddingTop: 6 },
  calorieTarget: { ...typography.body2, color: colors.textSecondary },
  calorieRemaining: { ...typography.caption, color: colors.primary, marginTop: 2 },
  calorieOverflow: { color: colors.negative },
  calTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  calFill: { height: '100%', borderRadius: 4 },
  macroSection: { gap: 2 },
});
