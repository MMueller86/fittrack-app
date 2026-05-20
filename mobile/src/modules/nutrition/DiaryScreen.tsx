// DiaryScreen — Nutrition Diary with date navigation, macro summary, and meal management.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { DiaryDayResponse, Meal, MealType } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { diaryApi } from '../../shared/api/diaryApi';
import AddItemModal from './AddItemModal';

// --- Mock nutrition target (until the NutritionTargets feature is live) ---
const MOCK_TARGET = { calories: 2400, protein: 170, carbs: 230, fat: 80, fiber: 30 };

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
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

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = clamp(value, target);
  return (
    <View style={macroStyles.row}>
      <Text style={macroStyles.label}>{label}</Text>
      <View style={macroStyles.track}>
        <View style={[macroStyles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={macroStyles.value}>{Math.round(value)}g</Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { ...typography.caption, color: colors.textSecondary, width: 56 },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: spacing.sm,
  },
  fill: { height: '100%', borderRadius: 3 },
  value: { ...typography.caption, color: colors.text, width: 44, textAlign: 'right' },
});

function SummaryCard({ summary }: { summary: DiaryDayResponse['summary'] }) {
  const calPct = clamp(summary.calories, MOCK_TARGET.calories);
  return (
    <View style={styles.card}>
      {/* Calories hero */}
      <View style={styles.caloriesRow}>
        <View>
          <Text style={styles.calorieValue}>{Math.round(summary.calories)}</Text>
          <Text style={styles.calorieLabel}>kcal consumed</Text>
        </View>
        <View style={styles.calorieRight}>
          <Text style={styles.calorieTarget}>/{MOCK_TARGET.calories}</Text>
          <Text style={styles.calorieRemaining}>
            {Math.max(0, MOCK_TARGET.calories - Math.round(summary.calories))} left
          </Text>
        </View>
      </View>
      {/* Calorie progress bar */}
      <View style={styles.calTrack}>
        <View
          style={[
            styles.calFill,
            { width: `${Math.round(calPct * 100)}%`, backgroundColor: calPct >= 1 ? colors.negative : colors.primary },
          ]}
        />
      </View>
      {/* Macros */}
      <View style={styles.macroSection}>
        <MacroBar label="Protein" value={summary.protein} target={MOCK_TARGET.protein} color="#3B82F6" />
        <MacroBar label="Carbs" value={summary.carbs} target={MOCK_TARGET.carbs} color={colors.primary} />
        <MacroBar label="Fat" value={summary.fat} target={MOCK_TARGET.fat} color="#F59E0B" />
        <MacroBar label="Fiber" value={summary.fiber} target={MOCK_TARGET.fiber} color="#8B5CF6" />
      </View>
    </View>
  );
}

function MealCard({
  meal,
  onAddItem,
  onDeleteItem,
  onDeleteMeal,
}: {
  meal: Meal;
  onAddItem: (mealId: string, mealName: string) => void;
  onDeleteItem: (mealId: string, itemId: string, name: string) => void;
  onDeleteMeal: (meal: Meal) => void;
}) {
  const totalCal = meal.items.reduce((s, i) => s + i.macros.calories, 0);
  return (
    <View style={styles.mealCard}>
      {/* Meal header */}
      <View style={styles.mealHeader}>
        <Text style={styles.mealIcon}>{MEAL_ICONS[meal.type]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.mealName}>{meal.name}</Text>
          {meal.items.length > 0 && (
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
      {meal.items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
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
          </View>
          <TouchableOpacity
            onPress={() => onDeleteItem(meal.id, item.id, item.name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteItemText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      {meal.items.length === 0 && (
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

  // AddItem modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string>('');
  const [selectedMealName, setSelectedMealName] = useState<string>('');

  const loadDay = useCallback(async (d: string) => {
    try {
      setError(null);
      const result = await diaryApi.getDay(d);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load diary');
    }
  }, []);

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

  // Add meal
  const handleAddMeal = (type: MealType) => {
    Alert.alert(`Add ${MEAL_LABELS[type]}`, `Add a ${MEAL_LABELS[type]} meal for ${formatDateLabel(date)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add',
        onPress: async () => {
          try {
            await diaryApi.createMeal(date, type);
            await loadDay(date);
          } catch {
            Alert.alert('Error', 'Could not create meal');
          }
        },
      },
    ]);
  };

  // Delete meal
  const handleDeleteMeal = (meal: Meal) => {
    Alert.alert(`Delete ${meal.name}?`, 'This will remove the meal and all its items.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await diaryApi.deleteMeal(meal.id);
            await loadDay(date);
          } catch {
            Alert.alert('Error', 'Could not delete meal');
          }
        },
      },
    ]);
  };

  // Delete item
  const handleDeleteItem = (mealId: string, itemId: string, name: string) => {
    Alert.alert(`Remove "${name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await diaryApi.deleteItem(mealId, itemId);
            await loadDay(date);
          } catch {
            Alert.alert('Error', 'Could not remove item');
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
    <SafeAreaView style={styles.safe}>
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
          {data && <SummaryCard summary={data.summary} />}

          {/* Meals */}
          {orderedMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onAddItem={handleOpenAddItem}
              onDeleteItem={handleDeleteItem}
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

  // Summary card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  caloriesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  calorieValue: { fontSize: 48, fontWeight: '800', color: colors.text, lineHeight: 52 },
  calorieLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  calorieRight: { alignItems: 'flex-end', paddingTop: 8 },
  calorieTarget: { ...typography.body2, color: colors.textSecondary },
  calorieRemaining: { ...typography.caption, color: colors.primary, marginTop: 2 },
  calTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  calFill: { height: '100%', borderRadius: 4 },
  macroSection: { gap: 2 },

  // Meal card
  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
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

