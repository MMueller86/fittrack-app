// DayNutritionCard — HomeScreen-spezifische Kalorien + Makro-Karte.
// Bewusst NICHT shared: andere Hierarchie als MacroSummaryCard im DiaryScreen.
// Kalorien: animierter Donut-Ring (SVG + Animated API).
// Makros: Label | Wert/Ziel | Rest | % + farbiger Balken darunter.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { DiaryDayResponse } from '@fittrack/shared';
import type { MacroTarget } from '../../shared/components/MacroSummaryCard';

// ── Donut-Konstanten ──
const RING_SIZE = 96;
const STROKE_W = 9;
const RING_RADIUS = (RING_SIZE - STROKE_W) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// AnimatedCircle: SVG Circle mit Animated-fähigem strokeDashoffset
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(value / max, 1);
}

// ── Animierter Donut ──
function DonutRing({ pct, isOver }: { pct: number; isOver: boolean }) {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animVal.setValue(0);
    Animated.timing(animVal, {
      toValue: pct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const strokeDashoffset = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, CIRCUMFERENCE * (1 - pct)],
  });

  const strokeColor = isOver ? colors.negative : colors.primary;
  const center = RING_SIZE / 2;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      {/* Hintergrund-Ring */}
      <Circle
        cx={center}
        cy={center}
        r={RING_RADIUS}
        fill="none"
        stroke={colors.border}
        strokeWidth={STROKE_W}
      />
      {/* Animierter Fortschritts-Ring, ab 12-Uhr-Position */}
      <G rotation={-90} origin={`${center}, ${center}`}>
        <AnimatedCircle
          cx={center}
          cy={center}
          r={RING_RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE_W}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

// ── Makro-Zeile ──
interface MacroRowProps {
  label: string;
  value: number;
  target: number;
  color: string;
}

function MacroRow({ label, value, target, color }: MacroRowProps) {
  const pct = clamp(value, target);
  const pctDisplay = Math.round(pct * 100);
  const remaining = Math.max(0, Math.round(target - value));
  const isOver = value > target;

  return (
    <View style={rowStyles.wrap}>
      <View style={rowStyles.infoRow}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={rowStyles.valueText}>
          <Text style={{ color }}>{Math.round(value)}</Text>
          <Text style={rowStyles.sep}> / {target} g</Text>
        </Text>
        <Text style={rowStyles.remaining}>
          {isOver
            ? `+${Math.round(value - target)} g`
            : `noch ${remaining} g`}
        </Text>
        <Text style={[rowStyles.pct, { color }]}>{pctDisplay} %</Text>
      </View>
      <View style={rowStyles.track}>
        <View
          style={[
            rowStyles.fill,
            {
              width: `${pctDisplay}%`,
              backgroundColor: isOver ? colors.negative : color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    width: 104,
  },
  valueText: {
    ...typography.caption,
    fontWeight: '600' as const,
    flex: 1,
  },
  sep: { color: colors.textSecondary },
  remaining: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 72,
    textAlign: 'right',
  },
  pct: {
    ...typography.caption,
    fontWeight: '700' as const,
    width: 34,
    textAlign: 'right',
  },
  track: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
});

// ── Haupt-Component ──
interface Props {
  summary: DiaryDayResponse['summary'] | null;
  target: MacroTarget | null;
  onPress: () => void;
}

export function DayNutritionCard({ summary, target, onPress }: Props) {
  if (!target) return null;

  const isEmpty = !summary || summary.calories === 0;

  if (isEmpty) {
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.emptyRow}>
          {/* Leerer Ring */}
          <DonutRing pct={0} isOver={false} />
          <View style={styles.emptyText}>
            <Text style={styles.emptyTitle}>Noch kein Eintrag.</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={onPress} activeOpacity={0.75}>
              <Text style={styles.ctaBtnText}>➕  Essen hinzufügen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const calConsumed = Math.round(summary!.calories);
  const remaining = Math.max(0, target.calories - calConsumed);
  const isOver = calConsumed > target.calories;
  const calPct = clamp(summary!.calories, target.calories);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* ── Kalorien-Bereich: Donut links, Zahlen rechts ── */}
      <View style={styles.calRow}>
        {/* Donut mit Text in der Mitte */}
        <View style={styles.donutWrap}>
          <DonutRing pct={calPct} isOver={isOver} />
          <View style={styles.donutCenter}>
            <Text style={styles.donutValue}>
              {isOver ? `+${calConsumed - target.calories}` : remaining}
            </Text>
            <Text style={styles.donutLabel}>
              {isOver ? 'über' : 'kcal\nverfügbar'}
            </Text>
          </View>
        </View>

        {/* Zahlen rechts */}
        <View style={styles.calInfo}>
          <Text style={styles.calConsumed}>{calConsumed} kcal</Text>
          <Text style={styles.calTarget}>Ziel {target.calories} kcal</Text>
        </View>
      </View>

      {/* ── Makros ── */}
      <View style={styles.divider} />
      <MacroRow label="Protein" value={summary!.protein} target={target.proteinG} color="#3B82F6" />
      <MacroRow label="Kohlenhydrate" value={summary!.carbs} target={target.carbsG} color={colors.primary} />
      <MacroRow label="Fett" value={summary!.fat} target={target.fatG} color="#F59E0B" />
      <MacroRow label="Ballaststoffe" value={summary!.fiber} target={target.fiberG} color="#8B5CF6" />
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
  },
  // Kalorien-Bereich
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  donutWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: RING_SIZE - STROKE_W * 2 - 8,
  },
  donutValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: colors.text,
    lineHeight: 20,
    textAlign: 'center',
  },
  donutLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 11,
    marginTop: 1,
  },
  calInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  calConsumed: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700' as const,
  },
  calTarget: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  // Empty State
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    flex: 1,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  ctaBtnText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '600' as const,
  },
});
