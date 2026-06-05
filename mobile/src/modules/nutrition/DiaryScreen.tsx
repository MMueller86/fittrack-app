// DiaryScreen — Nutrition Diary with date navigation, macro summary, and meal management.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DiaryDayResponse, Meal, MealItem, MealType } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { diaryApi } from '../../shared/api/diaryApi';
import { MacroSummaryCard } from '../../shared/components/MacroSummaryCard';
import { useDayTypeStore } from './useDayTypeStore';
import AddItemModal from './AddItemModal';
import EditItemSheet from './EditItemSheet';

const MEAL_ORDER: MealType[] = ['breakfast', 'preworkout', 'lunch', 'dinner', 'postworkout', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  preworkout: 'Pre-Workout',
  postworkout: 'Post-Workout',
};
const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
  preworkout: '⚡',
  postworkout: '💪',
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  const today = isoToday();
  const yesterday = offsetDate(today, -1);
  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
}

function clamp(value: number, max: number): number {
  return Math.min(value / max, 1);
}

// --- Sub-components ---

function MealCard({
  meal,
  onAddItem,
  onDeleteItem,
  onEditItem,
  onDeleteMeal,
}: {
  meal: Meal;
  onAddItem: (mealId: string, mealName: string) => void;
  onDeleteItem: (mealId: string, itemId: string, name: string) => void;
  onEditItem: (mealId: string, item: MealItem) => void;
  onDeleteMeal: (meal: Meal) => void;
}) {
  const totalCal = (meal.items ?? []).reduce((s, i) => s + i.macros.calories, 0);
  return (
    <View style={styles.mealCard}>
      {/* Meal header */}
      <View style={styles.mealHeader}>
        <Text style={styles.mealIcon}>{MEAL_ICONS[meal.type]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.mealName}>{meal.name}</Text>
          {(meal.items ?? []).length > 0 && (
            <Text style={styles.mealCal}>{Math.round(totalCal)} kcal</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => onAddItem(meal.id, meal.name)}
          style={styles.addItemBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.addItemBtnText}>+ Add</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDeleteMeal(meal)}
          style={styles.deleteMealBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteMealBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
      {/* Items */}
      {(meal.items ?? []).map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.itemRow}
          onPress={() => onEditItem(meal.id, item)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.isAiEstimate && <Text style={{ fontSize: 12 }}>✨</Text>}
            </View>
            <Text style={styles.itemMacros}>
              {item.unit === 'portion'
                ? `${item.quantity} Portion${item.quantity !== 1 ? 'en' : ''}`
                : `${Math.round(item.quantity)} g`}
              {' · '}{Math.round(item.macros.calories)} kcal · {Math.round(item.macros.protein)}g P ·{' '}
              {Math.round(item.macros.carbs)}g C · {Math.round(item.macros.fat)}g F
            </Text>
            {item.sourceType === 'ai-meal-estimate' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={styles.aiEstimateBadge}>
                  {item.aiMealEstimatePhotoUsed ? '📷 KI-Schätzung' : '🤖 KI-Schätzung'}
                </Text>
                <TouchableOpacity onPress={() => onAddItem(meal.id, meal.name)}>
                  <Text style={styles.refineLink}>Verfeinern</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => onDeleteItem(meal.id, item.id, item.name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteItemText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      {(meal.items ?? []).length === 0 && (
        <Text style={styles.emptyItems}>No items yet — tap + Add</Text>
      )}
    </View>
  );
}

// --- Main Screen ---

export default function DiaryScreen() {
  const [date, setDate] = useState(isoToday());
  const [data, setData] = useState<DiaryDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { dayType, targets, hydrateDayType } = useDayTypeStore();
  const todayTargets = targets ? (dayType === 'training' ? targets.trainingDay : targets.restDay) : null;

  // AddItem modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string>('');
  const [selectedMealName, setSelectedMealName] = useState<string>('');

  // EditItem sheet state
  const [editingItem, setEditingItem] = useState<MealItem | null>(null);
  const [editingMealId, setEditingMealId] = useState<string>('');

  const handleEditItem = (mealId: string, item: MealItem) => {
    setEditingMealId(mealId);
    setEditingItem(item);
  };

  const handleEditSaved = (updatedMeal: Meal) => {
    setEditingItem(null);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((m) => m.id === updatedMeal.id ? updatedMeal : m),
      };
    });
    // Reload for updated summary
    void loadDay(date);
  };

  const loadDay = useCallback(async (d: string) => {
    try {
      setError(null);
      const result = await diaryApi.getDay(d);
      setData(result);
      // Trainings-/Ruhetag aus API-Response hydratisieren — überschreibt Store-Default ('rest')
      if (result.dayType != null) {
        hydrateDayType(result.dayType, d, result.workoutType ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load diary');
    }
  }, [hydrateDayType]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadDay(date);
      setLoading(false);
    })();
  }, [date, loadDay]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDay(date);
    setRefreshing(false);
  }, [date, loadDay]);

  // Date navigation
  const prevDay = () => setDate((d) => offsetDate(d, -1));
  const nextDay = () => {
    const next = offsetDate(date, 1);
    if (next <= isoToday()) setDate(next);
  };
  const isToday = date === isoToday();

  // Add meal — direkt ohne Bestätigungs-Alert, optimistisches Update
  const handleAddMeal = async (type: MealType) => {
    // Optimistisch: temporäre Meal-ID sofort in State einfügen
    const tempId = `temp-${type}-${Date.now()}`;
    const tempMeal: Meal = {
      id: tempId,
      userId: '',
      date,
      type,
      name: MEAL_LABELS[type],
      items: [],
      createdAt: new Date().toISOString(),
    };
    setData((prev) => prev ? { ...prev, meals: [...prev.meals, tempMeal] } : prev);
    try {
      await diaryApi.createMeal(date, type);
      await loadDay(date); // Server-Sync: ersetzt temp-Meal mit echter ID
    } catch {
      // Rollback bei Fehler
      setData((prev) => prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== tempId) } : prev);
      Alert.alert('Fehler', 'Mahlzeit konnte nicht angelegt werden.');
    }
  };

  // Delete meal
  const handleDeleteMeal = (meal: Meal) => {
    Alert.alert(`"${meal.name}" löschen?`, 'Mahlzeit und alle Einträge werden entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          // Optimistisch entfernen
          setData((prev) => prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== meal.id) } : prev);
          try {
            await diaryApi.deleteMeal(meal.id);
            void loadDay(date); // Sync im Hintergrund
          } catch {
            await loadDay(date); // Rollback via Server-State
            Alert.alert('Fehler', 'Mahlzeit konnte nicht gelöscht werden.');
          }
        },
      },
    ]);
  };

  // Delete item
  const handleDeleteItem = (mealId: string, itemId: string, name: string) => {
    Alert.alert(`"${name}" entfernen?`, undefined, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: async () => {
          // Optimistisch entfernen
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              meals: prev.meals.map((m) =>
                m.id === mealId ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m,
              ),
            };
          });
          try {
            await diaryApi.deleteItem(mealId, itemId);
            void loadDay(date); // Sync im Hintergrund (aktualisiert Summary)
          } catch {
            await loadDay(date); // Rollback
            Alert.alert('Fehler', 'Eintrag konnte nicht entfernt werden.');
          }
        },
      },
    ]);
  };

  // Open add-item modal
  const handleOpenAddItem = (mealId: string, mealName: string) => {
    setSelectedMealId(mealId);
    setSelectedMealName(mealName);
    setModalVisible(true);
  };

  const handleItemSaved = async () => {
    setModalVisible(false);
    await loadDay(date);
  };

  // Meals ordered by type
  const orderedMeals = data
    ? [...data.meals].sort(
        (a, b) => MEAL_ORDER.indexOf(a.type) - MEAL_ORDER.indexOf(b.type),
      )
    : [];

  const existingTypes = new Set(orderedMeals.map((m) => m.type));
  const missingTypes = MEAL_ORDER.filter((t) => !existingTypes.has(t));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nutrition Diary</Text>
      </View>

      {/* Date navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={prevDay} style={styles.dateNavBtn}>
          <Text style={styles.dateNavArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
        <TouchableOpacity onPress={nextDay} style={[styles.dateNavBtn, isToday && styles.dateNavBtnDisabled]} disabled={isToday}>
          <Text style={[styles.dateNavArrow, isToday && styles.dateNavArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadDay(date)} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card */}
          {data && todayTargets && (
            <MacroSummaryCard summary={data.summary} target={todayTargets} />
          )}
          {data && !todayTargets && (
            <MacroSummaryCard
              summary={data.summary}
              target={{ calories: 2000, proteinG: 150, carbsG: 200, fatG: 70, fiberG: 25 }}
            />
          )}

          {/* Meals */}
          {orderedMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onAddItem={handleOpenAddItem}
              onDeleteItem={handleDeleteItem}
              onEditItem={handleEditItem}
              onDeleteMeal={handleDeleteMeal}
            />
          ))}

          {/* Add meal buttons for missing types */}
          {missingTypes.length > 0 && (
            <View style={styles.addMealSection}>
              <Text style={styles.addMealSectionTitle}>Add a meal</Text>
              <View style={styles.addMealGrid}>
                {missingTypes.map((type) => (
                  <TouchableOpacity key={type} onPress={() => handleAddMeal(type)} style={styles.addMealChip}>
                    <Text style={styles.addMealChipIcon}>{MEAL_ICONS[type]}</Text>
                    <Text style={styles.addMealChipLabel}>{MEAL_LABELS[type]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: spacing.lg * 2 }} />
        </ScrollView>
      )}

      {/* Add Item Modal */}
      <AddItemModal
        visible={modalVisible}
        mealId={selectedMealId}
        mealName={selectedMealName}
        onClose={() => setModalVisible(false)}
        onSaved={handleItemSaved}
      />

      {/* Edit Item Sheet */}
      {editingItem && (
        <EditItemSheet
          visible={!!editingItem}
          mealId={editingMealId}
          item={editingItem}
          onSaved={handleEditSaved}
          onClose={() => setEditingItem(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.h2, color: colors.text },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavBtnDisabled: { opacity: 0.35 },
  dateNavArrow: { ...typography.h2, color: colors.primary, lineHeight: 28 },
  dateNavArrowDisabled: { color: colors.textDisabled },
  dateLabel: { ...typography.h3, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  errorText: { ...typography.body2, color: colors.negative, textAlign: 'center', marginBottom: spacing.md },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  retryBtnText: { ...typography.button, color: colors.primary },

  // Meal card
  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  mealIcon: { fontSize: 20, marginRight: spacing.sm },
  mealName: { ...typography.h3, color: colors.text },
  mealCal: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  addItemBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
  },
  addItemBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  deleteMealBtn: { padding: 4 },
  deleteMealBtnText: { ...typography.caption, color: colors.textMuted },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemName: { ...typography.body2, color: colors.text },
  itemMacros: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  deleteItemText: { ...typography.body2, color: colors.textMuted, paddingLeft: spacing.sm },
  aiEstimateBadge: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  refineLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  emptyItems: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.xs },

  // Add meal section
  addMealSection: { marginTop: spacing.sm, marginBottom: spacing.sm },
  addMealSectionTitle: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm },
  addMealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addMealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  addMealChipIcon: { fontSize: 16 },
  addMealChipLabel: { ...typography.button, color: colors.text },
});

