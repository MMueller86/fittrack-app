// MoveItemSheet — selects an existing or transactionally-created meal on the same day.

import React, { useState } from 'react';
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
import type { DiaryBulkMoveTarget, DiaryItemReference, Meal, MealType } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { MEAL_LABELS } from './mealLabels';

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙',
  snack: '🍎', preworkout: '⚡', postworkout: '💪',
};

const MEAL_ORDER: MealType[] = ['breakfast', 'preworkout', 'lunch', 'dinner', 'postworkout', 'snack'];

interface Props {
  visible: boolean;
  items: DiaryItemReference[];
  itemLabel: string;
  meals: Meal[];
  onMove: (items: DiaryItemReference[], target: DiaryBulkMoveTarget) => Promise<boolean>;
  onClose: () => void;
}

export default function MoveItemSheet({
  visible, items, itemLabel, meals, onMove, onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [movingTo, setMovingTo] = useState<string | null>(null);

  const sourceMealIds = new Set(items.map((reference) => reference.mealId));
  const existingTypes = new Set(meals.map((m) => m.type));
  const missingTypes = MEAL_ORDER.filter((t) => !existingTypes.has(t));

  const targetMeals = meals
    .filter((m) => !sourceMealIds.has(m.id))
    .sort((a, b) => MEAL_ORDER.indexOf(a.type) - MEAL_ORDER.indexOf(b.type));

  const doMove = async (targetKey: string, target: DiaryBulkMoveTarget) => {
    if (movingTo || items.length === 0) return;
    setMovingTo(targetKey);
    try {
      if (await onMove(items, target)) onClose();
    } finally {
      setMovingTo(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => { if (!movingTo) onClose(); }}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={movingTo ? undefined : onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />

        {/* Header */}
        <Text style={styles.title}>Verschieben nach</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{itemLabel}</Text>

        <View style={styles.divider} />

        <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
          {/* Existing meals (excluding source) */}
          {targetMeals.map((meal) => {
            const isLoading = movingTo === meal.id;
            return (
              <TouchableOpacity
                key={meal.id}
                style={styles.mealRow}
                onPress={() => { void doMove(meal.id, { mealId: meal.id }); }}
                disabled={!!movingTo || items.length === 0}
                activeOpacity={0.7}
              >
                <Text style={styles.mealIcon}>{MEAL_ICONS[meal.type]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName}>{MEAL_LABELS[meal.type]}</Text>
                  <Text style={styles.mealMeta}>
                    {(meal.items?.length ?? 0) > 0
                      ? `${meal.items.length} Eintrag${meal.items.length !== 1 ? 'einträge' : ''}`
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

          {/* Create + move chips for missing types */}
          {missingTypes.length > 0 && (
            <>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionLabel}>MAHLZEIT ANLEGEN + VERSCHIEBEN</Text>
              <View style={styles.chipRow}>
                {missingTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.chip}
                    onPress={() => { void doMove(`new-${type}`, { newMealType: type }); }}
                    disabled={!!movingTo || items.length === 0}
                  >
                    <Text style={styles.chipIcon}>{MEAL_ICONS[type]}</Text>
                    <Text style={styles.chipLabel}>{MEAL_LABELS[type]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={{ height: spacing.md }} />
        </ScrollView>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={!!movingTo}>
          <Text style={styles.cancelLabel}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm, paddingHorizontal: spacing.md,
    maxHeight: '75%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.xs },
  list: { flex: 1 },
  mealRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  mealIcon: { fontSize: 20 },
  mealName: { ...typography.body1, color: colors.text, fontWeight: '500' },
  mealMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  chevron: { ...typography.h2, color: colors.textMuted, lineHeight: 26 },
  sectionDivider: { height: 1, backgroundColor: colors.border, marginTop: spacing.sm },
  sectionLabel: { ...typography.overline, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  chipIcon: { fontSize: 16 },
  chipLabel: { ...typography.button, color: colors.text },
  cancelBtn: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  cancelLabel: { ...typography.body1, color: colors.textSecondary },
});
