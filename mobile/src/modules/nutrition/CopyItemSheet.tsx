// CopyItemSheet — selects a date and one target meal for diary-item snapshots.
// Step 1: date selection (quick picks + 14-day strip)
// Step 2: meal selection on target date

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  DiaryBulkCopyResponse,
  DiaryBulkCopyTarget,
  DiaryDayResponse,
  DiaryItemReference,
  Meal,
  MealType,
} from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { nutritionDiaryService as diaryApi } from '../../services/nutritionDiaryService';
import { addLocalDays, getLocalIsoDate } from '../../shared/date/localDate';
import { MEAL_LABELS } from './mealLabels';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙',
  snack: '🍎', preworkout: '⚡', postworkout: '💪',
};
const MEAL_ORDER: MealType[] = ['breakfast', 'preworkout', 'lunch', 'dinner', 'postworkout', 'snack'];
const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function isoToday(): string {
  return getLocalIsoDate();
}

function offsetIso(iso: string, days: number): string {
  return addLocalDays(iso, days);
}

function formatShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_LABELS[date.getDay()]}, ${d}. ${MONTH_LABELS[m - 1]}`;
}

function buildDateStrip(today: string): string[] {
  const days: string[] = [];
  for (let i = 1; i <= 14; i++) {
    days.unshift(offsetIso(today, -i));
  }
  return days;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  sourceDate: string;
  items: DiaryItemReference[];
  itemLabel: string;
  sourceMealType?: MealType;
  onCopy: (
    items: DiaryItemReference[],
    targetDate: string,
    target: DiaryBulkCopyTarget,
  ) => Promise<DiaryBulkCopyResponse | null>;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CopyItemSheet({
  visible,
  sourceDate,
  items,
  itemLabel,
  sourceMealType,
  onCopy,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const today = isoToday();
  const dateStrip = useMemo(
    () => buildDateStrip(today).filter((date) => date !== sourceDate),
    [sourceDate, today],
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [targetDayData, setTargetDayData] = useState<DiaryDayResponse | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const dateRequestId = useRef(0);

  // Reset on open
  useEffect(() => {
    if (!visible) {
      dateRequestId.current += 1;
      return;
    }

    dateRequestId.current += 1;
    setStep(1);
    setSelectedDate(null);
    setTargetDayData(null);
    setCopying(null);

    return () => {
      dateRequestId.current += 1;
    };
  }, [visible]);

  const selectDate = useCallback(async (targetDate: string) => {
    const requestId = dateRequestId.current + 1;
    dateRequestId.current = requestId;
    setSelectedDate(targetDate);
    setStep(2);
    setTargetDayData(null);
    setLoadingDay(true);
    try {
      const result = await diaryApi.getDay(targetDate);
      if (requestId === dateRequestId.current) setTargetDayData(result);
    } catch {
      if (requestId === dateRequestId.current) setTargetDayData(null);
    } finally {
      if (requestId === dateRequestId.current) setLoadingDay(false);
    }
  }, []);

  const doCopy = async (targetKey: string, target: DiaryBulkCopyTarget) => {
    if (!selectedDate || loadingDay || copying || items.length === 0) return;
    setCopying(targetKey);
    try {
      const result = await onCopy(items, selectedDate, target);
      if (result) onClose();
    } finally {
      setCopying(null);
    }
  };

  // Quick pick dates
  const quickPicks = [
    { label: 'Gestern', date: offsetIso(today, -1) },
    { label: 'Vorgestern', date: offsetIso(today, -2) },
    { label: 'Vor 3 Tagen', date: offsetIso(today, -3) },
  ].filter((pick) => pick.date !== sourceDate);

  const closeSheet = () => {
    if (!copying) onClose();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeSheet} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />

        {step === 1 ? (
          // ── Step 1: Date selection ──────────────────────────────────────────
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Auf welchen Tag kopieren?</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{itemLabel}</Text>

            <TouchableOpacity
              style={styles.todayQuickPickCard}
              onPress={() => selectDate(sourceDate)}
              activeOpacity={0.7}
            >
              <Text style={styles.todayQuickPickLabel}>Gleicher Tag</Text>
              <Text style={styles.todayQuickPickDate}>{formatShort(sourceDate)}</Text>
            </TouchableOpacity>

            {/* Quick picks */}
            {today !== sourceDate && (
              <TouchableOpacity
                style={styles.todayQuickPickCard}
                onPress={() => selectDate(today)}
                activeOpacity={0.7}
              >
                <Text style={styles.todayQuickPickLabel}>Heute</Text>
                <Text style={styles.todayQuickPickDate}>{formatShort(today)}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.quickPickRow}>
              {quickPicks.map((q) => (
                <TouchableOpacity
                  key={q.date}
                  style={styles.quickPickCard}
                  onPress={() => selectDate(q.date)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickPickLabel}>{q.label}</Text>
                  <Text style={styles.quickPickDate}>{formatShort(q.date)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date strip */}
            <Text style={styles.sectionLabel}>ODER TAG WÄHLEN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateStrip}>
              {dateStrip.map((iso) => {
                const [, m, d] = iso.split('-').map(Number);
                const date = new Date(parseInt(iso.slice(0, 4)), m - 1, d);
                const weekday = WEEKDAY_LABELS[date.getDay()];
                const isSelected = selectedDate === iso;
                return (
                  <TouchableOpacity
                    key={iso}
                    style={[styles.dateCell, isSelected && styles.dateCellSelected]}
                    onPress={() => selectDate(iso)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateWeekday, isSelected && styles.dateCellTextActive]}>
                      {weekday}
                    </Text>
                    <Text style={[styles.dateDay, isSelected && styles.dateCellTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.cancelBtn} onPress={closeSheet}>
              <Text style={styles.cancelLabel}>Abbrechen</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          // ── Step 2: Meal selection ──────────────────────────────────────────
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.step2Header}>
              <TouchableOpacity
                onPress={() => setStep(1)}
                style={styles.backBtn}
                disabled={!!copying}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.backBtnText}>← Zurück</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Zu welcher Mahlzeit?</Text>
                {selectedDate && <Text style={styles.subtitle}>{formatShort(selectedDate)}</Text>}
              </View>
            </View>

            {loadingDay ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <>
                {/* Existing meals on target date */}
                {(targetDayData?.meals ?? [])
                  .sort((a, b) => MEAL_ORDER.indexOf(a.type) - MEAL_ORDER.indexOf(b.type))
                  .map((meal) => {
                    const isHighlighted = sourceMealType != null && meal.type === sourceMealType;
                    const isLoading = copying === meal.id;
                    return (
                      <TouchableOpacity
                        key={meal.id}
                        style={[styles.mealRow, isHighlighted && styles.mealRowHighlighted]}
                        onPress={() => { void doCopy(meal.id, { mealId: meal.id }); }}
                        disabled={!!copying || items.length === 0}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.mealIcon}>{MEAL_ICONS[meal.type]}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mealName}>{MEAL_LABELS[meal.type]}</Text>
                          <Text style={styles.mealMeta}>
                            {meal.items.length > 0
                              ? `${meal.items.length} Einträge`
                              : '— leer —'}
                          </Text>
                        </View>
                        {isLoading
                          ? <ActivityIndicator size="small" color={colors.primary} />
                          : <Text style={styles.chevron}>›</Text>
                        }
                      </TouchableOpacity>
                    );
                  })}

                {/* Missing meal types as create+copy chips */}
                {(() => {
                  const existingTypes = new Set((targetDayData?.meals ?? []).map((m) => m.type));
                  const missing = MEAL_ORDER.filter((t) => !existingTypes.has(t));
                  if (missing.length === 0) return null;
                  return (
                    <>
                      <Text style={styles.sectionLabel}>MAHLZEIT ANLEGEN + KOPIEREN</Text>
                      <View style={styles.chipRow}>
                        {missing.map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={styles.chip}
                            onPress={() => { void doCopy(`new-${type}`, { newMealType: type }); }}
                            disabled={!!copying || items.length === 0}
                          >
                            <Text style={styles.chipIcon}>{MEAL_ICONS[type]}</Text>
                            <Text style={styles.chipLabel}>{MEAL_LABELS[type]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  );
                })()}

                <TouchableOpacity style={styles.cancelBtn} onPress={closeSheet} disabled={!!copying}>
                  <Text style={styles.cancelLabel}>Abbrechen</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={{ height: spacing.md }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm, paddingHorizontal: spacing.md,
    maxHeight: '80%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },

  // Quick picks
  quickPickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  todayQuickPickCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  todayQuickPickLabel: { ...typography.body2, color: colors.text, fontWeight: '600' },
  todayQuickPickDate: { ...typography.body2, color: colors.textSecondary },
  quickPickCard: {
    flex: 1, backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.md,
    alignItems: 'center',
  },
  quickPickLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },
  quickPickDate: { ...typography.body2, color: colors.text, fontWeight: '600', textAlign: 'center' },

  // Date strip
  sectionLabel: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm },
  dateStrip: { marginBottom: spacing.md },
  dateCell: {
    width: 46, height: 62, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.xs, backgroundColor: colors.surfaceMuted,
    borderWidth: 1, borderColor: colors.border,
  },
  dateCellSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  dateWeekday: { ...typography.overline, color: colors.textMuted },
  dateDay: { ...typography.h3, color: colors.text, marginTop: 2 },
  dateCellTextActive: { color: colors.primary },

  // Step 2
  step2Header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
  backBtn: { paddingTop: 2 },
  backBtnText: { ...typography.body2, color: colors.textSecondary },
  loadingCenter: { height: 160, alignItems: 'center', justifyContent: 'center' },
  mealRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  mealRowHighlighted: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.sm - 3 },
  mealIcon: { fontSize: 20 },
  mealName: { ...typography.body1, color: colors.text, fontWeight: '500' },
  mealMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  chevron: { ...typography.h2, color: colors.textMuted, lineHeight: 26 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  chipIcon: { fontSize: 16 },
  chipLabel: { ...typography.button, color: colors.text },

  // Cancel
  cancelBtn: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  cancelLabel: { ...typography.body1, color: colors.textSecondary },
});
