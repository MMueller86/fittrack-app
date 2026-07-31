// ActivityBonusSheet — premium bottom sheet explaining the activity bonus calculation.
// Swipe-to-close via react-native-gesture-handler + react-native-reanimated.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SpecialActivity } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { Icon } from '../../../shared/components/Icon';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

const ACTIVITY_LABELS: Record<string, string> = {
  hiking: 'Wanderung',
  running: 'Lauf',
  cycling: 'Radfahrt',
  other: 'Aktivität',
};

const ACTIVITY_ICONS: Record<string, string> = {
  hiking: '🥾',
  running: '🏃',
  cycling: '🚴',
  other: '⚡',
};

function useCountUp(target: number, active: boolean): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!active) {
      setCurrent(0);
      return;
    }
    const steps = 40;
    const duration = 600;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const t = step / steps;
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCurrent(Math.round(target * eased));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, active]);
  return current;
}

function metIntensityLabel(met: number): string {
  if (met < 3.5) return 'leichtem Spazierengehen';
  if (met < 5.0) return 'leichtem Wandern';
  if (met < 6.5) return 'moderatem Wandern';
  if (met < 8.0) return 'anstrengendem Bergwandern';
  return 'sehr anstrengendem Bergwandern im alpinen Gelände';
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ActivityBonusSheetProps {
  visible: boolean;
  onClose: () => void;
  activity: SpecialActivity;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ActivityBonusSheet({ visible, onClose, activity }: ActivityBonusSheetProps) {
  const insets = useSafeAreaInsets();

  // Swipe-to-close
  const dragY = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const handleSwipeDismiss = () => {
    dragY.value = 0;
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 0.5) {
        dragY.value = withTiming(600, { duration: 200 }, () =>
          runOnJS(handleSwipeDismiss)(),
        );
      } else {
        dragY.value = withSpring(0, { damping: 18, stiffness: 140 });
      }
    });

  // Animated count-up values
  const activityBonusRounded = Math.round(activity.activityBonus);
  const effectiveTarget = activity.dailyCalorieTarget + activityBonusRounded;

  const animBasis = useCountUp(activity.dailyCalorieTarget, visible);
  const animBonus = useCountUp(activityBonusRounded, visible);
  const animTotal = useCountUp(effectiveTarget, visible);

  // Header meta
  const activityLabel = ACTIVITY_LABELS[activity.type] ?? 'Aktivität';
  const activityIcon = ACTIVITY_ICONS[activity.type] ?? '⚡';
  const durationStr = formatDuration(activity.movementTimeMinutes);

  const subtitleParts: string[] = [durationStr];
  if (activity.distanceKm > 0)
    subtitleParts.push(`${activity.distanceKm.toFixed(0)} km`);
  if (activity.elevationGainM > 0)
    subtitleParts.push(`\u2191 ${activity.elevationGainM} hm`);
  if (activity.elevationLossM != null && activity.elevationLossM > 0)
    subtitleParts.push(`\u2193 ${activity.elevationLossM} hm`);
  const TERRAIN_LABELS: Record<string, string> = {
    trail: 'Wanderweg',
    alpine: 'Alpin',
    scramble: 'Klettersteig',
  };
  if (activity.terrainType && TERRAIN_LABELS[activity.terrainType])
    subtitleParts.push(TERRAIN_LABELS[activity.terrainType]);
  const PACK_LABELS: Record<string, string> = {
    small: 'Rucksack (klein)',
    medium: 'Rucksack (mittel)',
    heavy: 'Rucksack (schwer)',
  };
  if (activity.packCategory && activity.packCategory !== 'none' && PACK_LABELS[activity.packCategory])
    subtitleParts.push(PACK_LABELS[activity.packCategory]);
  const subtitle = subtitleParts.join(' \u00b7 ');

  // Energy bar fraction
  const bonusFraction = Math.min(
    Math.max(activityBonusRounded / effectiveTarget, 0),
    1,
  );

  // Calculation card data
  const hikingCalRounded = Math.round(activity.hikingCalories);
  const alreadyAccountedRounded = Math.round(activity.alreadyAccountedCalories);
  const durationHours = (activity.movementTimeMinutes / 60).toFixed(1).replace('.0', '');
  const metEquation = `MET ${activity.estimatedMet.toFixed(1)} × ${activity.bodyWeightKg} kg × ${durationHours} h`;
  const fractionLabel = `${durationHours} von 24 Stunden`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            animStyle,
          ]}
        >
          {/* ① Handle + Swipe Zone */}
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleZone}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* ② Activity Header */}
            <View style={styles.headerRow}>
              <Text style={styles.headerIcon}>{activityIcon}</Text>
              <View style={styles.headerText}>
                <Text style={styles.headerOverline}>{activityLabel.toUpperCase()}</Text>
                <Text style={styles.headerSubtitle}>{subtitle}</Text>
              </View>
            </View>

            {/* Schätzungs-Hinweis */}
            <View style={styles.disclaimerCard}>
              <Icon lib="feather" name="info" size="sm" color={colors.textMuted} />
              <Text style={styles.disclaimerCardText}>
                Alle Werte sind Schätzungen. Individuelle Faktoren wie Fitnesslevel, Höhe und Wetter können abweichen.
              </Text>
            </View>

            {/* ③ Energy Balance Bar */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ENERGIEBILANZ</Text>
              <View style={styles.energyBar}>
                <View
                  style={[
                    styles.energyBarBonus,
                    { width: `${Math.round(bonusFraction * 100)}%` as `${number}%` },
                  ]}
                />
              </View>
              <View style={styles.energyNumbers}>
                <View style={styles.energyNumberCol}>
                  <Text style={styles.energyValue}>
                    {animBasis.toLocaleString('de-DE')} kcal
                  </Text>
                  <Text style={styles.energyLabel}>Basis</Text>
                </View>
                <View style={styles.energyNumberCol}>
                  <Text style={[styles.energyValue, styles.energyValueBonus]}>
                    +{animBonus.toLocaleString('de-DE')} kcal
                  </Text>
                  <Text style={[styles.energyLabel, styles.energyLabelBonus]}>Bonus →</Text>
                </View>
                <View style={[styles.energyNumberCol, styles.energyNumberColRight]}>
                  <Text style={styles.energyValue}>
                    {animTotal.toLocaleString('de-DE')} kcal
                  </Text>
                  <Text style={styles.energyLabel}>Gesamt</Text>
                </View>
              </View>
            </View>

            {/* ④ Calculation Card */}
            <View style={styles.calcCard}>
              {/* Row 1 — Wanderverbrauch */}
              <View style={styles.calcRow}>
                <View style={styles.calcRowLeft}>
                  <View style={styles.calcRowTitleRow}>
                    <Text style={styles.calcRowLabel}>Wanderverbrauch</Text>
                    <View style={styles.metBadge}>
                      <Text style={styles.metBadgeText}>MET {activity.estimatedMet.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Text style={styles.calcRowSub}>{metEquation}</Text>
                </View>
                <Text style={styles.calcRowValue}>{hikingCalRounded.toLocaleString('de-DE')} kcal</Text>
              </View>

              {/* Divider */}
              <View style={styles.calcDivider} />

              {/* Row 2 — Abzug */}
              <View style={styles.calcRow}>
                <View style={styles.calcRowLeft}>
                  <Text style={styles.calcRowLabel}>Bereits im Tagesziel</Text>
                  <Text style={styles.calcRowSub}>{fractionLabel}</Text>
                </View>
                <Text style={[styles.calcRowValue, styles.calcRowValueMuted]}>
                  −{alreadyAccountedRounded.toLocaleString('de-DE')} kcal
                </Text>
              </View>

              {/* Equals divider */}
              <View style={styles.equalsDivider}>
                <View style={styles.equalsDividerLine} />
                <Text style={styles.equalsSign}>=</Text>
                <View style={styles.equalsDividerLine} />
              </View>

              {/* Row 3 — Aktivitätsbonus (highlighted) */}
              <View style={[styles.calcRow, styles.calcRowBonus]}>
                <Text style={styles.calcRowBonusLabel}>Aktivitätsbonus</Text>
                <Text style={styles.calcRowBonusValue}>
                  +{activityBonusRounded.toLocaleString('de-DE')} kcal
                </Text>
              </View>
            </View>

            {/* ⑤ MET Breakdown Card (V3 — only when metBase is available) */}
            {activity.metBase != null && (
              <View style={styles.metBreakdownCard}>
                <Text style={styles.metBreakdownTitle}>MET-Schätzung</Text>
                <View style={styles.metBreakdownRow}>
                  <Text style={styles.metBreakdownLabel}>Gehtempo</Text>
                  <Text style={styles.metBreakdownValue}>{activity.metBase.toFixed(1)}</Text>
                </View>
                <View style={styles.metBreakdownRow}>
                  <Text style={styles.metBreakdownLabel}>inkl. Höhenprofil</Text>
                  <Text style={styles.metBreakdownValue}>
                    {activity.metLocomotion != null ? activity.metLocomotion.toFixed(1) : '—'}
                  </Text>
                </View>
                {activity.terrainFactor != null && activity.metLocomotion != null && (
                  <View style={styles.metBreakdownRow}>
                    <Text style={styles.metBreakdownLabel}>
                      {`\u00d7 Gel\u00e4nde-Faktor (${activity.terrainFactor.toFixed(2)})`}
                    </Text>
                    <Text style={styles.metBreakdownValue}>
                      {(activity.metLocomotion * activity.terrainFactor).toFixed(1)}
                    </Text>
                  </View>
                )}
                {activity.deltaPack != null && activity.deltaPack !== 0 && (
                  <View style={styles.metBreakdownRow}>
                    <Text style={styles.metBreakdownLabel}>+ Rucksack-Zuschlag</Text>
                    <Text style={styles.metBreakdownValue}>
                      {activity.deltaPack > 0 ? '+' : ''}{activity.deltaPack.toFixed(1)}
                    </Text>
                  </View>
                )}
                <View style={styles.metBreakdownDivider} />
                <View style={styles.metBreakdownRow}>
                  <Text style={[styles.metBreakdownLabel, styles.metBreakdownLabelTotal]}>
                    = MET gesamt
                  </Text>
                  <Text style={[styles.metBreakdownValue, styles.metBreakdownValueTotal]}>
                    {activity.estimatedMet.toFixed(1)}
                  </Text>
                </View>
              </View>
            )}

            {/* ⑥ Info Section */}
            <View style={styles.infoCard}>
              <View style={styles.infoTitleRow}>
                <Text style={styles.infoIcon}>ℹ</Text>
                <Text style={styles.infoTitle}>Was ist der MET-Wert?</Text>
              </View>
              <Text style={styles.infoText}>
                Das MET-Verfahren (Metabolic Equivalent of Task) ist die wissenschaftliche
                Standardmethode zur Energieverbrauchsschätzung. Ein MET-Wert von{' '}
                {activity.estimatedMet.toFixed(1)} entspricht{' '}{metIntensityLabel(activity.estimatedMet)}.
              </Text>
              <Text style={[styles.infoText, { marginTop: spacing.sm }]}>
                Dein Tagesziel deckt deinen Energiebedarf für den gesamten Tag ab – einschließlich
                der Wanderzeit. Wir ziehen den zeitanteiligen Anteil des Tagesziels ab, damit
                dieser Zeitraum nicht doppelt gezählt wird.
              </Text>
            </View>


          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '75%',
  },

  // ① Handle
  handleZone: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    height: 40,
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },

  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  // ② Activity Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerIcon: {
    fontSize: 32,
  },
  headerText: {
    flex: 1,
  },
  headerOverline: {
    ...typography.overline,
    color: colors.textMuted,
    letterSpacing: 1.4,
  },
  headerSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ③ Energy Balance
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  energyBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.md,
  },
  energyBarBonus: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  energyNumbers: {
    flexDirection: 'row',
  },
  energyNumberCol: {
    flex: 1,
  },
  energyNumberColRight: {
    alignItems: 'flex-end',
  },
  energyValue: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  energyValueBonus: {
    color: colors.primary,
  },
  energyLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  energyLabelBonus: {
    color: colors.primary,
  },

  // ④ Calculation Card
  calcCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  calcRowLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  calcRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  calcRowLabel: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  calcRowSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 3,
  },
  calcRowValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  calcRowValueMuted: {
    color: colors.textSecondary,
  },
  metBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  metBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  calcDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  equalsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  equalsDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  equalsSign: {
    ...typography.body2,
    color: colors.textMuted,
    fontWeight: '700',
  },
  calcRowBonus: {
    alignItems: 'center',
  },
  calcRowBonusLabel: {
    ...typography.body1,
    color: colors.primary,
    fontWeight: '600',
  },
  calcRowBonusValue: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // ⑤ Info Section
  infoCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoIcon: {
    ...typography.body2,
    color: colors.textMuted,
  },
  infoTitle: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  infoText: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // ⑤ MET Breakdown Card
  metBreakdownCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  metBreakdownTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  metBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  metBreakdownLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  metBreakdownValue: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  metBreakdownDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  metBreakdownLabelTotal: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metBreakdownValueTotal: {
    color: colors.textSecondary,
    fontWeight: '600',
  },

  disclaimerCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  disclaimerCardText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
