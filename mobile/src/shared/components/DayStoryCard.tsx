// DayStoryCard — Premium summary card with semi-circle gauge for calories,
// protein progress, meal completion chips, and contextual coaching text.
// Used in DiaryScreen only. MacroSummaryCard is unchanged for HomeScreen.

import React, { RefObject, useState } from 'react';
import { Icon } from './Icon';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import type { DiaryDayResponse, MealType } from '@fittrack/shared';
import type { HintResult } from '../../../../shared/types/hint';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { MacroTarget } from './MacroSummaryCard';
import { MealChip } from './MealChip';

// ─── Public types ─────────────────────────────────────────────────────────────
export type MacroKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber';
export type MealMacroItem = {
  name: string;
  macros: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
};
export type MealMacroSummary = {
  type: MealType;
  name: string;
  macros: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  items: MealMacroItem[];
};

// ─── Semi-Circle Gauge ────────────────────────────────────────────────────────
//  270° sweep. Inner ring = calories (12 px). Outer ring = protein (8 px).
const GAUGE_SIZE = 168;
const STROKE_CAL = 12;   // calorie ring stroke width
const STROKE_PRO = 8;    // protein ring stroke width
const GAP = 5;           // gap between rings
const R_CAL = 64;        // calorie ring radius (= (old 140 − 12) / 2)
const R_PRO = R_CAL + STROKE_CAL / 2 + GAP + STROKE_PRO / 2; // 64+6+5+4 = 79
const CX = GAUGE_SIZE / 2; // 84
const CY = GAUGE_SIZE / 2; // 84
const PROTEIN_COLOR = '#3B82F6';
const CARBS_COLOR   = '#F97316'; // orange — warm energy, distinct from primary
const FAT_COLOR     = '#F59E0B'; // amber — golden, distinct from orange
const FIBER_COLOR   = '#8B5CF6'; // violet — cool, plant-associated
// Ambient ring sits just outside the protein ring
const R_AMBIENT = R_PRO + STROKE_PRO / 2 + 3;

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

function SemiCircleGauge({ calPct, proteinPct }: { calPct: number; proteinPct: number }) {
  const clampedCal = Math.min(calPct, 1);
  const clampedPro = Math.min(proteinPct, 1);

  const calTrack = arcPath(TRACK_START, TRACK_START + TRACK_SWEEP, R_CAL);
  const calFill = clampedCal > 0
    ? arcPath(TRACK_START, TRACK_START + Math.max(TRACK_SWEEP * clampedCal, 0.5), R_CAL)
    : null;

  const proTrack = arcPath(TRACK_START, TRACK_START + TRACK_SWEEP, R_PRO);
  const proFill = clampedPro > 0
    ? arcPath(TRACK_START, TRACK_START + Math.max(TRACK_SWEEP * clampedPro, 0.5), R_PRO)
    : null;

  // Tick marks at 25 %, 50 %, 75 % of the calorie ring sweep
  const tickAngles = [0.25, 0.5, 0.75].map((f) => TRACK_START + TRACK_SWEEP * f);
  const tickInner = R_CAL - 5;
  const tickOuter = R_CAL + 5;

  return (
    <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
      {/* Ambient ring — full circle, very subtle */}
      <Circle
        cx={CX} cy={CY} r={R_AMBIENT}
        fill="none"
        stroke={colors.border ?? '#2A3A2A'}
        strokeWidth={1}
        opacity={0.4}
      />
      {/* Protein ring — outer track */}
      <Path d={proTrack} fill="none" stroke={colors.border ?? '#2A3A2A'} strokeWidth={STROKE_PRO} strokeLinecap="round" />
      {/* Protein ring — outer fill */}
      {proFill && (
        <Path d={proFill} fill="none" stroke={PROTEIN_COLOR} strokeWidth={STROKE_PRO} strokeLinecap="round" />
      )}
      {/* Calorie ring — inner track */}
      <Path d={calTrack} fill="none" stroke={colors.border ?? '#2A3A2A'} strokeWidth={STROKE_CAL} strokeLinecap="round" />
      {/* Calorie ring — inner fill */}
      {calFill && (
        <Path d={calFill} fill="none" stroke={gaugeColor(calPct)} strokeWidth={STROKE_CAL} strokeLinecap="round" />
      )}
      {/* Tick marks at 25 % / 50 % / 75 % */}
      {tickAngles.map((angle) => {
        const inner = polarToXY(angle, tickInner);
        const outer = polarToXY(angle, tickOuter);
        return (
          <Line
            key={angle}
            x1={inner.x} y1={inner.y}
            x2={outer.x} y2={outer.y}
            stroke={colors.border ?? '#2A3A2A'}
            strokeWidth={1.5}
            opacity={0.7}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

// ─── Meal completion chip ─────────────────────────────────────────────────────
const MEAL_SHORT: Partial<Record<MealType, string>> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
};

// ─── Macro line ───────────────────────────────────────────────────────────────
// isCalorie: kcal row keeps its ring-colour on the value; all others use colors.text
function MacroLine({
  color, label, value, target, unit, isCalorie, onPress,
}: {
  color: string; label: string; value: number; target: number; unit: string;
  isCalorie?: boolean; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.macroLine}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[styles.macroPill, { backgroundColor: color }]} />
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroValues}>
        <Text style={[styles.macroValue, isCalorie ? { color } : null]}>
          {Math.round(value)}
        </Text>
        <Text style={styles.macroTarget}>
          {' / '}{target}{unit ? ` ${unit}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}


// ─── Macro meta (labels, units, colors) ───────────────────────────────────────
const MACRO_META = {
  calories: { label: 'kcal',  unit: '',  color: '#22c55e' },
  protein:  { label: 'EW',    unit: 'g', color: '#3B82F6' },
  carbs:    { label: 'KH',    unit: 'g', color: '#F97316' },
  fat:      { label: 'Fett',  unit: 'g', color: '#F59E0B' },
  fiber:    { label: 'Bst',   unit: 'g', color: '#8B5CF6' },
} as const satisfies Record<MacroKey, { label: string; unit: string; color: string }>;

const MEAL_ICON: Partial<Record<MealType, string>> = {
  breakfast:   '☀️',
  lunch:       '🌞',
  dinner:      '🌙',
  snack:       '🍎',
  preworkout:  '⚡',
  postworkout: '💪',
};

// ─── MacroBreakdownSheet ───────────────────────────────────────────────────────
// Slide-up modal showing per-meal contribution bars for a selected macro.
// Tap a meal row to expand an accordion with individual items, sorted by macro.
function MacroBreakdownSheet({
  visible, macroKey, mealSummaries, totalConsumed, target, onClose,
}: {
  visible: boolean;
  macroKey: MacroKey;
  mealSummaries: MealMacroSummary[];
  totalConsumed: number;
  target: number;
  onClose: () => void;
}) {
  const [expandedMeal, setExpandedMeal] = useState<MealType | null>(null);
  const meta = MACRO_META[macroKey];
  const unit = meta.unit ? ` ${meta.unit}` : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={bsStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={bsStyles.sheet}>
        {/* Header */}
        <View style={bsStyles.header}>
          <Text style={bsStyles.title}>{meta.label} · Aufschlüsselung</Text>
          <TouchableOpacity
            onPress={onClose}
            style={bsStyles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={bsStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Per-meal rows */}
        {mealSummaries.length === 0 ? (
          <Text style={bsStyles.empty}>Noch keine Einträge für heute</Text>
        ) : (
          mealSummaries.map((ms) => {
            const value = ms.macros[macroKey];
            const pct = totalConsumed > 0 ? Math.min(value / totalConsumed, 1) : 0;
            const icon = MEAL_ICON[ms.type] ?? '🍽️';
            const isExpanded = expandedMeal === ms.type;
            const sortedItems = [...ms.items].sort(
              (a, b) => b.macros[macroKey] - a.macros[macroKey],
            );
            return (
              <View key={ms.type}>
                {/* Meal header row — tappable */}
                <TouchableOpacity
                  style={[bsStyles.mealRow, isExpanded && bsStyles.mealRowExpanded]}
                  onPress={() => setExpandedMeal(isExpanded ? null : ms.type)}
                  activeOpacity={0.6}
                >
                  <Text style={bsStyles.mealIcon}>{icon}</Text>
                  <View style={bsStyles.mealInfo}>
                    <View style={bsStyles.mealRowHeader}>
                      <View style={bsStyles.mealNameRow}>
                        <Text style={bsStyles.mealName}>{ms.name}</Text>
                        {/* Item count badge */}
                        <View style={bsStyles.countBadge}>
                          <Text style={bsStyles.countBadgeText}>{ms.items.length}</Text>
                        </View>
                      </View>
                      <View style={bsStyles.mealValueRow}>
                        <Text style={bsStyles.mealValue}>
                          {Math.round(value)}{unit}
                          <Text style={bsStyles.mealPct}> ({Math.round(pct * 100)} %)</Text>
                        </Text>
                        <Text style={[bsStyles.chevron, isExpanded && bsStyles.chevronOpen]}>
                          ▾
                        </Text>
                      </View>
                    </View>
                    <View style={bsStyles.barTrack}>
                      <View
                        style={[
                          bsStyles.barFill,
                          { width: `${Math.round(pct * 100)}%`, backgroundColor: meta.color },
                        ]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Accordion: sorted items */}
                {isExpanded && (
                  <View style={[bsStyles.accordion, { borderLeftWidth: 2, borderLeftColor: meta.color }]}>
                    {sortedItems.map((item, idx) => {
                      const itemVal = item.macros[macroKey];
                      const itemPct = value > 0 ? Math.min(itemVal / value, 1) : 0;
                      return (
                        <View key={idx} style={bsStyles.itemRow}>
                          <View style={bsStyles.itemDot} />
                          <Text style={bsStyles.itemName} numberOfLines={1}>{item.name}</Text>
                          <Text style={bsStyles.itemValue}>
                            {Math.round(itemVal)}{unit}
                            <Text style={bsStyles.itemPct}> · {Math.round(itemPct * 100)} %</Text>
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Footer: total / target */}
        <View style={bsStyles.footer}>
          <Text style={bsStyles.footerText}>
            {'Gesamt: '}
            <Text style={{ color: meta.color, fontWeight: '700' as const }}>
              {Math.round(totalConsumed)}{unit}
            </Text>
            {'  /  Ziel: '}{Math.round(target)}{unit}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const bsStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingBottom: 32,
    paddingTop: spacing.sm,
    maxHeight: '70%' as const,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.body1,
    fontWeight: '700' as const,
    color: colors.text,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  empty: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center' as const,
    paddingVertical: spacing.lg,
  },
  mealRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
    gap: 10,
  },
  mealRowExpanded: {
    // No background — chevron + badge are sufficient expanded signals
  },
  mealNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  countBadge: {
    backgroundColor: colors.border,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: colors.textMuted,
    lineHeight: 13,
  },
  mealIcon: {
    fontSize: 20,
    lineHeight: 24,
    width: 28,
    textAlign: 'center' as const,
  },
  mealInfo: {
    flex: 1,
  },
  mealRowHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 5,
  },
  mealValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  mealName: {
    ...typography.body2,
    fontWeight: '600' as const,
    color: colors.text,
  },
  mealValue: {
    ...typography.caption,
    fontWeight: '700' as const,
    color: colors.text,
    fontVariant: ['tabular-nums'] as const,
  },
  mealPct: {
    fontWeight: '400' as const,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
    lineHeight: 20,
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  // ─── Accordion items ───
  accordion: {
    marginLeft: 38,
    marginTop: 2,
    marginBottom: 6,
    borderRadius: 8,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  itemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    flexShrink: 0,
  },
  itemName: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  itemValue: {
    ...typography.caption,
    fontWeight: '600' as const,
    color: colors.text,
    fontVariant: ['tabular-nums'] as const,
  },
  itemPct: {
    fontWeight: '400' as const,
    color: colors.textMuted,
  },
  footer: {
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center' as const,
  },
  footerText: {
    ...typography.body2,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'] as const,
  },
});

// ─── ActivityBonusLines ──────────────────────────────────────────────────────
// Three-line calorie breakdown shown in the macro panel when activityBonus > 0.
function ActivityBonusLines({
  baseTarget,
  bonus,
  onShowBreakdown,
}: {
  baseTarget: number;
  bonus: number;
  onShowBreakdown: () => void;
}) {
  const effectiveTarget = baseTarget + bonus;
  return (
    <View style={bonusStyles.container}>
      {/* Row: Basisziel */}
      <View style={bonusStyles.line}>
        <Text style={bonusStyles.label}>Basisziel</Text>
        <Text style={bonusStyles.value}>{Math.round(baseTarget)} kcal</Text>
      </View>
      {/* Row: Aktivitätsbonus — tappable */}
      <TouchableOpacity style={bonusStyles.line} onPress={onShowBreakdown} activeOpacity={0.7}>
        <Text style={[bonusStyles.label, bonusStyles.bonusLabel]}>+ Bonus</Text>
        <View style={bonusStyles.bonusValueRow}>
          <Text style={[bonusStyles.value, bonusStyles.bonusValue]}>+{Math.round(bonus)} kcal</Text>
          <Icon lib="feather" name="chevron-right" size={12} color={colors.primary} />
        </View>
      </TouchableOpacity>
      {/* Divider */}
      <View style={bonusStyles.divider} />
      {/* Row: Gesamtes Ziel */}
      <View style={bonusStyles.line}>
        <Text style={[bonusStyles.label, bonusStyles.totalLabel]}>Gesamt</Text>
        <Text style={[bonusStyles.value, bonusStyles.totalValue]}>{Math.round(effectiveTarget)} kcal</Text>
      </View>
    </View>
  );
}

const bonusStyles = StyleSheet.create({
  container: {
    gap: 3,
  },
  line: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  bonusLabel: {
    color: colors.primary,
  },
  totalLabel: {
    color: colors.text,
    fontWeight: '600' as const,
  },
  value: {
    ...typography.caption,
    fontWeight: '700' as const,
    color: colors.text,
    fontVariant: ['tabular-nums'] as const,
  },
  bonusValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  bonusValue: {
    color: colors.primary,
  },
  totalValue: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────
interface DayStoryCardProps {
  summary: DiaryDayResponse['summary'];
  target: MacroTarget;
  meals: Array<{ type: MealType; items: unknown[] }>;
  mealSummaries: MealMacroSummary[];
  scrollRef: RefObject<ScrollView | null>;
  mealOffsets: Partial<Record<MealType, number>>;
  hint?: HintResult | null;
  /** When present and bonus > 0, shows the 3-line calorie breakdown in the macro panel. */
  activityBonusInfo?: {
    bonus: number;
    onShowBreakdown: () => void;
  };
}

export function DayStoryCard({ summary, target, meals, mealSummaries, scrollRef, mealOffsets, hint, activityBonusInfo }: DayStoryCardProps) {
  const [activeMacro, setActiveMacro] = useState<MacroKey | null>(null);

  const calConsumed = Math.round(summary.calories);
  const baseCalTarget = target.calories;
  const hasBonus = !!(activityBonusInfo && activityBonusInfo.bonus > 0);
  const calTarget = Math.round(hasBonus ? baseCalTarget + activityBonusInfo!.bonus : baseCalTarget);
  const calPct = Math.min(calConsumed / (calTarget || 1), 1.5);
  const calRemaining = Math.round(Math.max(0, calTarget - calConsumed));
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
        {/* Left: Semi-circle gauge — tappable for calorie breakdown */}
        <TouchableOpacity
          style={styles.gaugeWrapper}
          onPress={() => setActiveMacro('calories')}
          activeOpacity={0.8}
        >
          <SemiCircleGauge calPct={calPct} proteinPct={proteinPct} />
          {/* Centered label inside gauge — 3-level hierarchy */}
          <View style={styles.gaugeCenter} pointerEvents="none">
            <Text style={[styles.gaugeValue, { color: gaugeColor(calPct) }]}>
              {calOver ? `+${calConsumed - calTarget}` : calRemaining}
            </Text>
            <Text style={styles.gaugeUnit}>kcal</Text>
            <Text style={styles.gaugeLabel}>{calOver ? 'drüber' : 'übrig'}</Text>
          </View>
        </TouchableOpacity>

        {/* Right: Macro panel */}
        <View style={styles.macroPanel}>
          {hasBonus ? (
            <ActivityBonusLines
              baseTarget={baseCalTarget}
              bonus={activityBonusInfo!.bonus}
              onShowBreakdown={activityBonusInfo!.onShowBreakdown}
            />
          ) : (
            <MacroLine isCalorie color={gaugeColor(calPct)} label="kcal" value={calConsumed} target={calTarget} unit="" onPress={() => setActiveMacro('calories')} />
          )}
          <MacroLine color={PROTEIN_COLOR}  label="EW"   value={protein}        target={proteinTarget}   unit="g" onPress={() => setActiveMacro('protein')} />
          <MacroLine color={CARBS_COLOR}    label="KH"   value={carbs}          target={target.carbsG}  unit="g" onPress={() => setActiveMacro('carbs')} />
          <MacroLine color={FAT_COLOR}      label="Fett" value={fat}            target={target.fatG}    unit="g" onPress={() => setActiveMacro('fat')} />
          <MacroLine color={FIBER_COLOR}    label="Bst"  value={summary.fiber}  target={target.fiberG}  unit="g" onPress={() => setActiveMacro('fiber')} />
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

      {/* Macro Breakdown Sheet */}
      {activeMacro && (
        <MacroBreakdownSheet
          visible={!!activeMacro}
          macroKey={activeMacro}
          mealSummaries={mealSummaries}
          totalConsumed={
            activeMacro === 'calories' ? summary.calories
            : activeMacro === 'protein' ? summary.protein
            : activeMacro === 'carbs'   ? summary.carbs
            : activeMacro === 'fat'     ? summary.fat
            : summary.fiber
          }
          target={
            activeMacro === 'calories' ? target.calories
            : activeMacro === 'protein' ? target.proteinG
            : activeMacro === 'carbs'   ? target.carbsG
            : activeMacro === 'fat'     ? target.fatG
            : target.fiberG
          }
          onClose={() => setActiveMacro(null)}
        />
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
    // Nudge center label to sit inside the arc visually
    top: GAUGE_SIZE * 0.35,
  },
  gaugeValue: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: colors.text,
    lineHeight: 38,
    fontVariant: ['tabular-nums'] as const,
    textAlign: 'center' as const,
  },
  gaugeUnit: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.5,
    color: colors.primary,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    marginTop: 1,
  },
  gaugeLabel: {
    fontSize: 10,
    fontWeight: '400' as const,
    color: colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 1,
  },
  // Macro panel (right of gauge)
  macroPanel: {
    flex: 1,
    justifyContent: 'center',
    gap: 7,
  },
  macroLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // Vertical pill indicator replaces circular dot
  macroPill: {
    width: 3,
    height: 14,
    borderRadius: 2,
    flexShrink: 0,
  },
  macroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 32,
  },
  macroValues: {
    flex: 1,
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    alignItems: 'baseline' as const,
  },
  macroValue: {
    ...typography.caption,
    fontWeight: '700' as const,
    color: colors.text,
    fontVariant: ['tabular-nums'] as const,
  },
  macroTarget: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'] as const,
  },
  // Meal chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
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
