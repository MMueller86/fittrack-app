// CoachingHeroCard — persönlicher Begrüßungsbereich des HomeScreens.
// 2-Spalten-Layout: Links Greeting + Hint + Training-Chip, Rechts Gewicht + Mini-Sparkline.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { WeightEntry, WorkoutType } from '@fittrack/shared';

const WORKOUT_LABELS: Record<WorkoutType, string> = {
  gym: 'Gym',
  bouldering: 'Bouldern / Klettern',
  running: 'Laufen',
  cycling: 'Radfahren',
  other: 'Sonstiges',
};

const WORKOUT_ICONS: Record<WorkoutType, string> = {
  gym: '🏋️',
  bouldering: '🧗',
  running: '🏃',
  cycling: '🚴',
  other: '💡',
};

interface Props {
  displayName: string;
  greeting: string;
  hint: string;
  dayType: 'rest' | 'training' | null;
  workoutType: WorkoutType | null;
  onTrainingPress: () => void;
  // Gewichtsdaten für rechte Spalte
  latest: WeightEntry | undefined;
  previous: WeightEntry | undefined;
  entries: WeightEntry[];
}

// Sparkline: letzte 7 Gewichtseinträge, 88×36 px
const SPARK_W = 88;
const SPARK_H = 36;

function Sparkline({ entries }: { entries: WeightEntry[] }) {
  const data = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-7);
  }, [entries]);

  if (data.length < 2) return null;

  const values = data.map((e) => e.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const points = data.map((e, i) => {
    const x = (i / (data.length - 1)) * (SPARK_W - 4) + 2;
    const y = SPARK_H - 4 - ((e.value - minV) / range) * (SPARK_H - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastPt = points[points.length - 1].split(',');
  const lastX = parseFloat(lastPt[0]);
  const lastY = parseFloat(lastPt[1]);

  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Polyline
        points={points.join(' ')}
        fill="none"
        stroke={colors.primaryBright}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Leuchtender Endpunkt */}
      <Circle cx={lastX} cy={lastY} r={5} fill={colors.primaryBright} opacity={0.18} />
      <Circle cx={lastX} cy={lastY} r={2.5} fill={colors.primaryBright} />
    </Svg>
  );
}

export function CoachingHeroCard({
  displayName,
  greeting,
  hint,
  dayType,
  workoutType,
  onTrainingPress,
  latest,
  previous,
  entries,
}: Props) {
  const trainingLabel =
    dayType === 'rest'
      ? '😴  Ruhetag'
      : workoutType && dayType === 'training'
        ? `${WORKOUT_ICONS[workoutType]}  ${WORKOUT_LABELS[workoutType]}`
        : '💪  Training';

  const delta = latest && previous ? latest.value - previous.value : null;
  const deltaGood = delta !== null && delta <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {/* Linke Spalte: Greeting + Hint + Chip */}
        <View style={styles.left}>
          <Text style={styles.greeting}>
            {greeting},{' '}
            <Text style={styles.name}>{displayName}</Text>
            {'  👋'}
          </Text>
          <Text style={styles.hint}>{hint}</Text>
          <TouchableOpacity
            style={styles.trainingChip}
            onPress={onTrainingPress}
            activeOpacity={0.7}
          >
            <Text style={styles.trainingChipText}>{trainingLabel}</Text>
            <Text style={styles.trainingChipChevron}>  ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Rechte Spalte: Gewicht + Delta + Sparkline */}
        {latest ? (
          <View style={styles.right}>
            <Text style={styles.weightValue}>{latest.value.toFixed(1)}</Text>
            <Text style={styles.weightUnit}>kg</Text>
            {delta !== null ? (
              <Text style={[styles.weightDelta, deltaGood ? styles.deltaGood : styles.deltaBad]}>
                {delta < 0 ? '↓' : delta > 0 ? '↑' : '→'} {Math.abs(delta).toFixed(1)} kg
              </Text>
            ) : null}
            {previous ? (
              <Text style={styles.weightSince}>seit gestern</Text>
            ) : null}
            <View style={styles.sparkWrap}>
              <Sparkline entries={entries} />
            </View>
          </View>
        ) : null}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  // Linke Spalte
  left: {
    flex: 1,
    gap: spacing.xs,
  },
  greeting: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  name: {
    ...typography.h3,
    color: colors.text,
  },
  hint: {
    ...typography.body2,
    color: colors.primary,
    fontWeight: '500' as const,
  },
  trainingChip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  trainingChipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600' as const,
  },
  trainingChipChevron: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // Rechte Spalte
  right: {
    width: 110,
    alignItems: 'flex-end',
    gap: 1,
  },
  weightValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.text,
    lineHeight: 32,
  },
  weightUnit: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  weightDelta: {
    ...typography.caption,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  deltaGood: { color: colors.primary },
  deltaBad: { color: colors.negative },
  weightSince: {
    fontSize: 10,
    color: colors.textMuted,
  },
  sparkWrap: {
    marginTop: spacing.xs,
  },
});
