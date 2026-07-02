// DayStoryCard — Premium summary card with semi-circle gauge for calories,
// protein progress, meal completion chips, and contextual coaching text.
// Used in DiaryScreen only. MacroSummaryCard is unchanged for HomeScreen.

import React, { useRef, RefObject, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { DiaryDayResponse, MealType } from '@fittrack/shared';
import type { HintResult } from '../../../../shared/types/hint';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { MacroTarget } from './MacroSummaryCard';

// ─── Semi-Circle Gauge ────────────────────────────────────────────────────────
//  270° sweep centered at top, stroked arc using SVG Path
const GAUGE_SIZE = 140;
const STROKE = 12;
const R = (GAUGE_SIZE - STROKE) / 2;
const CX = GAUGE_SIZE / 2;
const CY = GAUGE_SIZE / 2;

// Arc from -225° to +45° (270° sweep, bottom gap at bottom)
// Start angle: 135°, End angle: 405° (=45°)
function polarToXY(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(startDeg: number, endDeg: number, r: number): string {
  // Clamp sweep to avoid SVG degenerate path
  const sweep = Math.min(endDeg - startDeg, 359.9);
  const s = polarToXY(startDeg, r);
  const e = polarToXY(startDeg + sweep, r);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

const TRACK_START = 135;
const TRACK_SWEEP = 270;

function gaugeColor(pct: number): string {
  if (pct >= 1.0) return colors.negative ?? '#E84040';
  if (pct >= 0.9) return '#C8A032';
  return colors.primary;
}

function SemiCircleGauge({ pct }: { pct: number }) {
  // Animate pct from 0 → target on mount and when pct changes
  const animPct = useSharedValue(0);
  useEffect(() => {
    animPct.value = withTiming(Math.min(pct, 1), {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  // We can't animate SVG path d attribute directly with Reanimated without AnimatedProps.
  // Instead, render the gauge using Animated.View scaling the fill arc container.
  // Simple approach: render both paths statically but use an animated opacity/mask layer.
  // Cleanest worklet-safe approach: use a JS-driven state for the fill path string.
  // We'll use React state updated via useEffect on animPct changes → not worklet-safe.
  // Best simple approach: use Animated.View with scaleX trick on the fill arc.
  // We render the fill arc at full sweep, then clip it with a white overlay that shrinks.

  const clampedPct = Math.min(pct, 1);
  const fillSweep = TRACK_SWEEP * clampedPct;
  const trackPath = arcPath(TRACK_START, TRACK_START + TRACK_SWEEP, R);
  const fillPath = fillSweep > 0.5
    ? arcPath(TRACK_START, TRACK_START + fillSweep, R)
    : arcPath(TRACK_START, TRACK_START + 0.5, R);

  // Animated container scales from 0→1 scaleX (pivot left) to reveal fill arc
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: animPct.value }],
    transformOrigin: 'left center',
  }));

  return (
    <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
      {/* Track */}
      <Path
        d={trackPath}
        fill="none"
        stroke={colors.border ?? '#2A3A2A'}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {/* Fill — pre-rendered at target, revealed via Animated.View scale */}
      {clampedPct > 0 && (
        <Path
          d={fillPath}
          fill="none"
          stroke={gaugeColor(pct)}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

// ─── Meal completion chip ─────────────────────────────────────────────────────
const MEAL_SHORT: Partial<Record<MealType, string>> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
};

function MealChip({
  label,
  filled,
  onPress,
}: {
  label: string;
  filled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, filled ? styles.chipFilled : styles.chipEmpty]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, filled ? styles.chipTextFilled : styles.chipTextEmpty]}>
        {filled ? '✓ ' : '— '}{label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface DayStoryCardProps {
  summary: DiaryDayResponse['summary'];
  target: MacroTarget;
  /** Meals present on the day (to determine meal completion) */
  meals: Array<{ type: MealType; items: unknown[] }>;
  /** Ref to the outer ScrollView so chips can scroll to meals */
  scrollRef: RefObject<ScrollView | null>;
  /** Y-offsets of each meal card, keyed by MealType — for scroll-to behavior */
  mealOffsets: Partial<Record<MealType, number>>;
  /** Rule-based hint from the backend hint engine */
  hint?: HintResult | null;
}

export function DayStoryCard({ summary, target, meals, scrollRef, mealOffsets, hint }: DayStoryCardProps) {
  const calConsumed = Math.round(summary.calories);
  const calTarget = target.calories;
  const calPct = Math.min(calConsumed / (calTarget || 1), 1.5); // allow overflow
  const calRemaining = Math.max(0, calTarget - calConsumed);
  const calOver = calConsumed > calTarget;

  const protein = summary.protein;
  const proteinTarget = target.proteinG;
  const proteinPct = Math.min(protein / (proteinTarget || 1), 1);

  const carbs = summary.carbs;
  const fat = summary.fat;

  // Meal completion: a meal is "filled" if it has ≥1 item
  const TRACKED_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];
  const mealMap = Object.fromEntries(meals.map((m) => [m.type, m.items.length > 0]));

  const scrollToMeal = (type: MealType) => {
    const offset = mealOffsets[type];
    if (offset != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: offset - 16, animated: true });
    }
  };

  return (
    <View style={styles.card}>
      {/* Main row: Gauge (left) + Protein (right) */}
      <View style={styles.mainRow}>
        {/* Left: Semi-circle gauge */}
        <View style={styles.gaugeWrapper}>
          <SemiCircleGauge pct={calPct} />
          {/* Centered label inside gauge */}
          <View style={styles.gaugeCenter} pointerEvents="none">
            <Text style={[styles.gaugeValue, calOver && styles.gaugeValueOver]}>
              {calOver ? `+${calConsumed - calTarget}` : calRemaining}
            </Text>
            <Text style={styles.gaugeLabel}>
              {calOver ? 'kcal drüber' : 'kcal übrig'}
            </Text>
          </View>
        </View>

        {/* Right: Protein + secondary macros */}
        <View style={styles.proteinCol}>
          <Text style={styles.proteinValue}>{Math.round(protein)}</Text>
          <Text style={styles.proteinUnit}>/ {proteinTarget} g Eiweiß</Text>

          {/* Mini protein bar */}
          <View style={styles.miniBarTrack}>
            <View
              style={[
                styles.miniBarFill,
                { width: `${Math.round(proteinPct * 100)}%` },
              ]}
            />
          </View>

          {/* Carbs + Fat secondary */}
          <View style={styles.secondaryMacros}>
            <Text style={styles.secondaryItem}>
              <Text style={styles.secondaryLabel}>K </Text>
              <Text style={styles.secondaryValue}>{Math.round(carbs)} g</Text>
            </Text>
            <Text style={styles.secondaryDot}>·</Text>
            <Text style={styles.secondaryItem}>
              <Text style={styles.secondaryLabel}>F </Text>
              <Text style={styles.secondaryValue}>{Math.round(fat)} g</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Meal completion row */}
      <View style={styles.chipRow}>
        {TRACKED_MEALS.map((type) => (
          <MealChip
            key={type}
            label={MEAL_SHORT[type] ?? type}
            filled={!!(mealMap[type])}
            onPress={() => scrollToMeal(type)}
          />
        ))}
      </View>

      {/* Context text — from hint engine */}
      {hint && (
        <Text style={styles.contextText}>
          {hint.emoji}{'  '}{hint.text}
        </Text>
      )}
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
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  // Gauge
  gaugeWrapper: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    // Nudge center label slightly upward to sit inside the arc visually
    top: GAUGE_SIZE * 0.38,
  },
  gaugeValue: {
    ...typography.display,
    color: colors.text,
    lineHeight: 36,
  },
  gaugeValueOver: {
    color: colors.negative ?? '#E84040',
  },
  gaugeLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  // Protein column
  proteinCol: {
    flex: 1,
    justifyContent: 'center',
  },
  proteinValue: {
    ...(typography.h1 ?? typography.h2),
    color: colors.text,
    lineHeight: 44,
    fontWeight: '700',
  },
  proteinUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  miniBarTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  miniBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  secondaryMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryItem: {
    ...typography.caption,
  },
  secondaryLabel: {
    color: colors.textMuted,
  },
  secondaryValue: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  secondaryDot: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // Meal chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  chip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  chipFilled: {
    backgroundColor: colors.primarySoft,
  },
  chipEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  chipTextFilled: {
    color: colors.primary,
  },
  chipTextEmpty: {
    color: colors.textMuted,
  },
  // Context text
  contextText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
});
