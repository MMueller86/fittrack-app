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

function MacroRow({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const pct = clamp(value, target);
  return (
    <View style={macroStyles.row}>
      <View style={macroStyles.labelCol}>
        <Text style={macroStyles.label}>{label}</Text>
        <Text style={macroStyles.values}>
          <Text style={{ color }}>{Math.round(value)} g</Text>
          <Text style={macroStyles.separator}> / </Text>
          <Text style={macroStyles.targetText}>{target} g</Text>
        </Text>
      </View>
      <View style={macroStyles.trackWrap}>
        <View style={macroStyles.track}>
          <View
            style={[
              macroStyles.fill,
              { width: `${Math.round(pct * 100)}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  labelCol: { width: 110 },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  values: { ...typography.caption, fontWeight: '600' },
  separator: { color: colors.textMuted },
  targetText: { color: colors.textSecondary },
  trackWrap: { flex: 1 },
  track: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
});

interface Props {
  summary: DiaryDayResponse['summary'];
  target: MacroTarget;
}

export function MacroSummaryCard({ summary, target }: Props) {
  const calConsumed = Math.round(summary.calories);
  const remaining = Math.max(0, target.calories - calConsumed);
  const over = calConsumed > target.calories;
  const calPct = clamp(summary.calories, target.calories);

  return (
    <View style={styles.card}>
      {/* ── Kalorien — dominante Hero-Anzeige ── */}
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroValue}>
            {over ? `+${calConsumed - target.calories}` : remaining}
          </Text>
          <Text style={styles.heroLabel}>
            {over ? 'kcal über Ziel' : 'kcal verfügbar'}
          </Text>
        </View>
        <View style={styles.heroRight}>
          <Text style={styles.heroConsumed}>{calConsumed} kcal</Text>
          <Text style={styles.heroTarget}>Ziel {target.calories} kcal</Text>
        </View>
      </View>

      {/* Kalorienbalken */}
      <View style={styles.calTrack}>
        <View
          style={[
            styles.calFill,
            {
              width: `${Math.round(calPct * 100)}%`,
              backgroundColor: over ? colors.negative : colors.primary,
            },
          ]}
        />
      </View>

      {/* ── Makros ── */}
      <View style={styles.macroSection}>
        <MacroRow label="Protein" value={summary.protein} target={target.proteinG} color="#3B82F6" />
        <MacroRow label="Kohlenhydrate" value={summary.carbs} target={target.carbsG} color={colors.primary} />
        <MacroRow label="Fett" value={summary.fat} target={target.fatG} color="#F59E0B" />
        <MacroRow label="Ballaststoffe" value={summary.fiber} target={target.fiberG} color="#8B5CF6" />
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
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  heroLeft: {},
  heroValue: { fontSize: 44, fontWeight: '800' as const, color: colors.text, lineHeight: 48 },
  heroLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  heroRight: { alignItems: 'flex-end', paddingBottom: 4 },
  heroConsumed: { ...typography.body2, color: colors.text, fontWeight: '600' },
  heroTarget: { ...typography.caption, color: colors.textMuted },
  calTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  calFill: { height: '100%', borderRadius: 3 },
  macroSection: {},
});
