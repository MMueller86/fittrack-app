// MoveItemSheet — moves a diary item to another meal on the same day.
// API sequence: addItem(targetMealId) → deleteItem(sourceMealId) → reload.
// sourceId-Preservation: uses buildCopyPayload() for correct product linking.

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
import type { Meal, MealItem, MealType } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { nutritionDiaryService as diaryApi } from '../../services/nutritionDiaryService';
import { buildCopyPayload } from './diaryItemUtils';
import { useSourceProduct } from './useSourceProduct';

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙',
  snack: '🍎', preworkout: '⚡', postworkout: '💪',
};

const MEAL_ORDER: MealType[] = ['breakfast', 'preworkout', 'lunch', 'dinner', 'postworkout', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
  snack: 'Snack', preworkout: 'Pre-Workout', postworkout: 'Post-Workout',
};

interface Props {
  visible: boolean;
  item: MealItem;
  sourceMealId: string;
  date: string;
  meals: Meal[];
  onMoved: () => void;
  onClose: () => void;
  onShowSnackbar: (message: string) => void;
}

export default function MoveItemSheet({
  visible, item, sourceMealId, date, meals, onMoved, onClose, onShowSnackbar,
}: Props) {
  const insets = useSafeAreaInsets();
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const { product: sourceProduct } = useSourceProduct(item.sourceId);

  const existingTypes = new Set(meals.map((m) => m.type));
  const missingTypes = MEAL_ORDER.filter((t) => !existingTypes.has(t));

  const targetMeals = meals
    .filter((m) => m.id !== sourceMealId)
    .sort((a, b) => MEAL_ORDER.indexOf(a.type) - MEAL_ORDER.indexOf(b.type));

  const doMove = async (targetMealId: string, targetMealName: string, createType?: MealType) => {
    if (movingTo) return;
    setMovingTo(targetMealId);
    try {
      let resolvedMealId = targetMealId;

      // Create meal first if needed
      if (createType) {
        const { meal } = await diaryApi.createMeal(date, createType);
        resolvedMealId = meal.id;
      }

      const payload = buildCopyPayload(item, sourceProduct);
      await diaryApi.addItem(resolvedMealId, payload);
      await diaryApi.deleteItem(sourceMealId, item.id);
      onMoved();
      onClose();
      onShowSnackbar(`Verschoben nach ${targetMealName} ✓`);
    } catch {
      onShowSnackbar('Verschieben fehlgeschlagen.');
    } finally {
      setMovingTo(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />

        {/* Header */}
        <Text style={styles.title}>Verschieben nach</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{item.name}</Text>

        <View style={styles.divider} />

        <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
          {/* Existing meals (excluding source) */}
          {targetMeals.map((meal) => {
            const isLoading = movingTo === meal.id;
            return (
              <TouchableOpacity
                key={meal.id}
                style={styles.mealRow}
                onPress={() => doMove(meal.id, meal.name)}
                disabled={!!movingTo}
                activeOpacity={0.7}
              >
                <Text style={styles.mealIcon}>{MEAL_ICONS[meal.type]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName}>{meal.name}</Text>
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
                    onPress={() => doMove(`new-${type}`, MEAL_LABELS[type], type)}
                    disabled={!!movingTo}
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
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
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
