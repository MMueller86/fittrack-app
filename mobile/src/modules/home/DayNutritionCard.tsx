// DayNutritionCard — HomeScreen-spezifische Kalorien + Makro-Karte.
// Bewusst NICHT shared: andere Hierarchie als MacroSummaryCard im DiaryScreen.
// Kalorien: animierter Donut-Ring (SVG + Animated API).
// Makros: Ist-Wert/Zielbereich + 150%-Track mit einheitlicher Referenz.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { DiaryDayResponse, MacroRange } from '@fittrack/shared';
import { Icon } from '../../shared/components/Icon';
import {
  formatMacroTargetValue,
  type MacroTarget,
} from '../../shared/components/MacroSummaryCard';
import {
  formatMacroAmount,
  getActivityBonusTrackValues,
  getMacroTrackGeometry,
  MACRO_TRACK_HEIGHT,
  type ActivityBonusTrackValues,
  type MacroTrackGeometry,
} from './dayNutritionTrackGeometry';

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

interface MacroRowProps {
  label: string;
  value: number;
  target: number | MacroRange | null;
  color: string;
  showTargetFlag?: boolean;
}

function MacroTrack({
  geometry,
  color,
  testID,
}: {
  geometry: MacroTrackGeometry;
  color: string;
  testID: string;
}) {
  return (
    <View style={rowStyles.macroTrack} testID={testID}>
      <View style={rowStyles.rail} />
      {geometry.rangePosition && (
        <View
          testID={`${testID}-range`}
          style={[
            rowStyles.rangeBand,
            {
              left: `${geometry.rangePosition.start * 100}%`,
              width: `${(geometry.rangePosition.end - geometry.rangePosition.start) * 100}%`,
              borderColor: color,
            },
          ]}
        >
          <View style={[rowStyles.rangeTint, { backgroundColor: color }]} />
        </View>
      )}
      <View
        testID={`${testID}-fill`}
        style={[
          rowStyles.macroFill,
          { width: `${geometry.fillRatio * 100}%`, backgroundColor: color },
        ]}
      />
      {geometry.rangePosition && (
        <View
          testID={`${testID}-range-start`}
          style={[
            rowStyles.rangeStart,
            { left: `${geometry.rangePosition.start * 100}%`, backgroundColor: color },
          ]}
        />
      )}
      {geometry.referencePosition != null && (
        <View
          testID={`${testID}-reference`}
          style={[
            rowStyles.referenceMarker,
            { left: `${geometry.referencePosition * 100}%` },
          ]}
        />
      )}
    </View>
  );
}

function MacroRow({ label, value, target, color, showTargetFlag = false }: MacroRowProps) {
  const geometry = getMacroTrackGeometry(value, target);
  const targetLabel = formatMacroTargetValue(target);
  const accessibilityTarget = target == null
    ? 'Ziel nicht verfügbar'
    : typeof target === 'number'
      ? `Ziel ${formatMacroAmount(target)} g`
      : `Zielbereich ${formatMacroAmount(target.minG)} bis ${formatMacroAmount(target.maxG)} g`;
  const accessibilityLabel = `${label}: ${formatMacroAmount(value)} g; ${accessibilityTarget}`;

  return (
    <View
      style={rowStyles.wrap}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={rowStyles.infoRow}>
        <Text style={rowStyles.label}>{label}</Text>
        <View style={rowStyles.valueGroup} testID={`macro-values-${label}`}>
          {showTargetFlag && geometry.referencePosition != null && (
            <View
              style={rowStyles.targetFlag}
              testID="macro-target-flag"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon lib="mci" name="flag-checkered" size="sm" color={colors.textSecondary} />
            </View>
          )}
          <Text style={[rowStyles.valueText, rowStyles.macroValueText]}>
            <Text style={{ color }}>{formatMacroAmount(value)}</Text>
            {targetLabel == null ? (
              <Text style={rowStyles.targetText}> g</Text>
            ) : (
              <Text style={rowStyles.targetText}> / {targetLabel} g</Text>
            )}
          </Text>
        </View>
      </View>
      <MacroTrack
        geometry={geometry}
        color={color}
        testID={`macro-track-${label}`}
      />
    </View>
  );
}

function ActivityBonusRow({ values }: { values: ActivityBonusTrackValues }) {
  const accessibilityLabel = `Aktivitätsbonus: ${formatMacroAmount(values.valueKcal)} kcal von ${formatMacroAmount(values.targetKcal)} kcal`;

  return (
    <View
      style={rowStyles.activityWrap}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={rowStyles.infoRow}>
        <Text style={rowStyles.activityLabel}>Aktivitätsbonus</Text>
        <Text style={rowStyles.valueText}>
          <Text style={{ color: colors.chart.specialActivityOutline }}>
            {formatMacroAmount(values.valueKcal)}
          </Text>
          <Text style={rowStyles.targetText}> / {formatMacroAmount(values.targetKcal)} kcal</Text>
        </Text>
      </View>
      <View style={rowStyles.track} testID="activity-bonus-track">
        <View
          style={[
            rowStyles.fill,
            {
              width: `${values.fillRatio * 100}%`,
              backgroundColor: colors.chart.specialActivityOutline,
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
  activityWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
    maxWidth: '50%',
  },
  activityLabel: {
    ...typography.caption,
    color: colors.chart.specialActivityOutline,
    width: 104,
  },
  valueText: {
    ...typography.caption,
    letterSpacing: 0,
    fontWeight: '600' as const,
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  targetText: { color: colors.textSecondary },
  valueGroup: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  macroValueText: {
    flex: 0,
    marginLeft: 0,
  },
  targetFlag: {
    width: spacing.md,
    height: spacing.md,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  track: {
    height: MACRO_TRACK_HEIGHT,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full },
  macroTrack: {
    height: spacing.md,
    justifyContent: 'center',
  },
  rail: {
    height: MACRO_TRACK_HEIGHT,
    backgroundColor: colors.border,
    borderRadius: radius.full,
  },
  macroFill: {
    position: 'absolute',
    height: MACRO_TRACK_HEIGHT,
    borderRadius: radius.full,
  },
  rangeBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  rangeTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  rangeStart: {
    position: 'absolute',
    top: spacing.xs,
    bottom: spacing.xs,
    width: 1,
  },
  referenceMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: spacing.xs,
    marginLeft: -spacing.xs / 2,
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: radius.full,
  },
});

// ── Haupt-Component ──
interface Props {
  summary: DiaryDayResponse['summary'] | null;
  target: MacroTarget | null;
  onPress: () => void;
  activityBonus?: number;
}

export function DayNutritionCard({ summary, target, onPress, activityBonus }: Props) {
  if (!target) return null;

  const isEmpty = !summary || summary.calories === 0;
  const bonus = activityBonus ?? 0;
  const calConsumed = Math.round(summary?.calories ?? 0);
  const activityBonusValues = bonus > 0
    ? getActivityBonusTrackValues(calConsumed, target.calories, bonus)
    : null;

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
        {activityBonusValues && <ActivityBonusRow values={activityBonusValues} />}
      </TouchableOpacity>
    );
  }

  const effectiveCalorieTarget = Math.round(target.calories + bonus);
  const remaining = Math.round(Math.max(0, effectiveCalorieTarget - calConsumed));
  const isOver = calConsumed > effectiveCalorieTarget;
  const calPct = clamp(summary!.calories, effectiveCalorieTarget);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* ── Kalorien-Bereich: Donut links, Zahlen rechts ── */}
      <View style={styles.calRow}>
        {/* Donut mit Text in der Mitte */}
        <View style={styles.donutWrap}>
          <DonutRing pct={calPct} isOver={isOver} />
          <View style={styles.donutCenter}>
            <Text style={styles.donutValue}>
              {isOver ? `+${calConsumed - effectiveCalorieTarget}` : remaining}
            </Text>
            <Text style={styles.donutLabel}>
              {isOver ? 'über' : 'kcal\nverfügbar'}
            </Text>
          </View>
        </View>

        {/* Zahlen rechts */}
        <View style={styles.calInfo}>
          <Text style={styles.calConsumed}>{calConsumed} kcal</Text>
          <Text style={styles.calTarget}>
            Ziel {effectiveCalorieTarget} kcal
            {bonus > 0 && <Text style={styles.bonusBadge}> +{bonus}</Text>}
          </Text>
        </View>
      </View>

      {/* ── Makros ── */}
      <View style={styles.divider} />
      <MacroRow
        label="Protein"
        value={summary!.protein}
        target={target.macroRanges?.proteinG ?? null}
        color={colors.macro.protein}
        showTargetFlag
      />
      <MacroRow
        label="Kohlenhydrate"
        value={summary!.carbs}
        target={target.macroRanges?.carbsG ?? null}
        color={colors.macro.carbohydrates}
      />
      <MacroRow label="Fett" value={summary!.fat} target={target.fatG} color={colors.macro.fat} />
      <MacroRow
        label="Ballaststoffe"
        value={summary!.fiber}
        target={target.fiberG}
        color={colors.macro.fiber}
      />
      {activityBonusValues && <ActivityBonusRow values={activityBonusValues} />}
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
  bonusBadge: {
    color: colors.primary,
    fontWeight: '700' as const,
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
