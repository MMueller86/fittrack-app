// DiaryScreen — Nutrition Diary with date navigation, macro summary, and meal management.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import type {
  DiaryBulkCopyResponse,
  DiaryBulkCopyTarget,
  DiaryBulkMoveTarget,
  DiaryDayResponse,
  DiaryItemReference,
  Meal,
  MealItem,
  MealType,
} from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { nutritionDiaryService as diaryApi } from '../../services/nutritionDiaryService';
import { DayStoryCard } from '../../shared/components/DayStoryCard';
import type { MealMacroSummary } from '../../shared/components/DayStoryCard';
import type { MacroTarget } from '../../shared/components/MacroSummaryCard';
import { ConfirmSheet, type ConfirmSheetAction } from '../../shared/components/ConfirmSheet';
import { Icon } from '../../shared/components/Icon';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { SwipeableRow } from '../../shared/components/SwipeableRow';
import { DiaryItemRow } from '../../shared/components/DiaryItemRow';
import { useDayTypeStore } from './useDayTypeStore';
import EditItemSheet from './EditItemSheet';
import MoveItemSheet from './MoveItemSheet';
import CopyItemSheet from './CopyItemSheet';
import { useFoodEntryHubStore } from './hub/useFoodEntryHubStore';
import {
  applyAddMeal,
  getDiaryItemSelectionKey,
  getDiaryMealSelectionState,
  normalizeDiaryItemSelection,
  toggleDiaryItemSelection,
  toggleDiaryMealSelection,
} from './diaryItemUtils';
import { ActivityBonusSheet } from './components/ActivityBonusSheet';
import type { NutritionStackParamList } from '../../app/navigation/RootNavigator';
import { addLocalDays, getLocalIsoDate, isValidDateOnly } from '../../shared/date/localDate';

type Props = NativeStackScreenProps<NutritionStackParamList, 'DiaryMain'>;

const MEAL_ORDER: MealType[] = ['breakfast', 'preworkout', 'lunch', 'dinner', 'postworkout', 'snack'];
// Mahlzeiten, die als leere State-B-Karten immer sichtbar sein sollen (Phase 6)
export const DEFAULT_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
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

function offsetDate(iso: string, days: number): string {
  return addLocalDays(iso, days);
}

function formatDateLabel(iso: string): string {
  const today = getLocalIsoDate();
  const yesterday = offsetDate(today, -1);
  if (iso === today) return 'Heute';
  if (iso === yesterday) return 'Gestern';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
}

function clamp(value: number, max: number): number {
  return Math.min(value / max, 1);
}

function getBulkMutationErrorMessage(error: unknown, action: 'delete' | 'move' | 'copy'): string {
  let errorCode: string | undefined;
  if (axios.isAxiosError<{ error?: unknown }>(error)) {
    const apiError = error.response?.data?.error;
    if (typeof apiError === 'string') errorCode = apiError;
  }

  switch (errorCode) {
    case 'invalid_diary_bulk_request':
      return action === 'copy'
        ? 'Die Auswahl, das Datum oder die Zielmahlzeit ist ungültig. Bitte prüfe sie und versuche es erneut.'
        : 'Die Auswahl oder das Ziel ist ungültig. Bitte passe sie an und versuche es erneut.';
    case 'diary_bulk_reference_not_found':
      return 'Mindestens ein Eintrag oder die Zielmahlzeit ist nicht mehr verfügbar. Die Tagebuchansicht wurde aktualisiert.';
    case 'diary_bulk_conflict':
      return 'Das Tagebuch wurde gleichzeitig geändert. Die Ansicht wurde aktualisiert. Bitte prüfe deine Auswahl und versuche es erneut.';
    case 'diary_bulk_operation_limit_exceeded':
      return action === 'delete'
        ? 'Zu viele Einträge für eine einzelne Löschaktion. Bitte wähle weniger Einträge aus.'
        : action === 'move'
          ? 'Zu viele Einträge für eine einzelne Verschiebeaktion. Bitte wähle weniger Einträge aus.'
          : 'Zu viele Einträge für eine einzelne Kopieraktion. Bitte wähle weniger Einträge aus.';
    default:
      return action === 'delete'
        ? 'Einträge konnten nicht gelöscht werden. Bitte versuche es erneut.'
        : action === 'move'
          ? 'Einträge konnten nicht verschoben werden. Bitte versuche es erneut.'
          : 'Einträge konnten nicht kopiert werden. Bitte versuche es erneut.';
  }
}

function getMoveItemLabel(references: readonly DiaryItemReference[], meals: readonly Meal[]): string {
  if (references.length !== 1) return `${references.length} Einträge ausgewählt`;
  const reference = references[0];
  const item = reference
    ? meals.find((meal) => meal.id === reference.mealId)?.items.find((candidate) => candidate.id === reference.itemId)
    : undefined;
  return item?.name ?? 'Eintrag';
}

/** Animated item row: slides in from below on mount (250ms). */
function AnimatedItem({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  React.useEffect(() => {
    const delay = index * 30;
    const timeout = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 250 });
      translateY.value = withTiming(0, { duration: 250 });
    }, delay);
    return () => clearTimeout(timeout);
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

/** Returns the MealType that is "current" based on the hour of the day. */
function getCurrentMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 22) return 'dinner';
  return 'snack';
}

// Meal card — supports 3 visual states:
//   A: has items (full card)
//   B: empty (compact single row)
//   C: current meal highlight (3px left border)
function MealCard({
  meal,
  isToday,
  selectionMode,
  selectedItemKeys,
  onAddItem,
  onDeleteItem,
  onEditItem,
  onDeleteMeal,
  onOpenMealOptions,
  onStartItemSelection,
  onToggleItemSelection,
  onToggleMealSelection,
}: {
  meal: Meal;
  isToday: boolean;
  selectionMode: boolean;
  selectedItemKeys: ReadonlySet<string>;
  onAddItem: (mealId: string, mealName: string) => void;
  onDeleteItem: (mealId: string, itemId: string, name: string) => void;
  onEditItem: (mealId: string, item: MealItem) => void;
  onDeleteMeal: (meal: Meal) => void;
  onOpenMealOptions: (meal: Meal) => void;
  onStartItemSelection: (mealId: string, itemId: string) => void;
  onToggleItemSelection: (mealId: string, itemId: string) => void;
  onToggleMealSelection: (meal: Meal) => void;
}) {
  const items = meal.items ?? [];
  const totalCal = items.reduce((s, i) => s + i.macros.calories, 0);
  const isEmpty = items.length === 0;
  const isCurrent = isToday && isEmpty && getCurrentMealType() === meal.type;
  const mealSelectionState = getDiaryMealSelectionState(meal, selectedItemKeys);
  const mealSelectionIcon = mealSelectionState === 'all'
    ? 'check-square'
    : mealSelectionState === 'partial' ? 'minus-square' : 'square';
  const mealSelectionColor = mealSelectionState === 'none' ? colors.textMuted : colors.primary;

  // State B: compact single-row for empty meals
  if (isEmpty) {
    const compactContent = (
      <>
        <Text style={styles.mealIcon}>{MEAL_ICONS[meal.type]}</Text>
        <Text style={styles.mealName}>{meal.name}</Text>
        {!selectionMode && <Text style={styles.compactAddHint}>+ Hinzufügen</Text>}
      </>
    );

    if (selectionMode) {
      return (
        <View style={styles.mealCardCompactWrapper}>
          <View style={[styles.mealCardCompact, isCurrent && styles.mealCardCurrent]}>
            {compactContent}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.mealCardCompactWrapper}>
        <SwipeableRow onDelete={() => onDeleteMeal(meal)}>
          <TouchableOpacity
            style={[styles.mealCardCompact, isCurrent && styles.mealCardCurrent]}
            onPress={() => onAddItem(meal.id, meal.name)}
            activeOpacity={0.7}
          >
            {compactContent}
          </TouchableOpacity>
        </SwipeableRow>
      </View>
    );
  }

  // State A (+ C border): full card with items
  return (
    <View style={[styles.mealCard, isCurrent && styles.mealCardCurrent]}>
      {/* Meal header */}
      <View style={styles.mealHeader}>
        {selectionMode && (
          <TouchableOpacity
            style={styles.mealSelectionToggle}
            onPress={() => onToggleMealSelection(meal)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityLabel={`${meal.name}, ${mealSelectionState === 'all' ? 'vollständig ausgewählt' : mealSelectionState === 'partial' ? 'teilweise ausgewählt' : 'nicht ausgewählt'}`}
            accessibilityState={{
              checked: mealSelectionState === 'partial' ? 'mixed' : mealSelectionState === 'all',
            }}
          >
            <Icon lib="feather" name={mealSelectionIcon} size="md" color={mealSelectionColor} />
          </TouchableOpacity>
        )}
        <Text style={styles.mealIcon}>{MEAL_ICONS[meal.type]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.mealName}>{meal.name}</Text>
          {items.length > 0 && (
            <Text style={styles.mealCal}>
              {Math.round(totalCal)} kcal
              <Text style={styles.mealItemCount}> · {items.length} {items.length === 1 ? 'Eintrag' : 'Einträge'}</Text>
            </Text>
          )}
        </View>
        {!selectionMode && (
          <TouchableOpacity
            onPress={() => onOpenMealOptions(meal)}
            style={styles.moreBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Optionen für ${meal.name}`}
          >
            <Text style={styles.moreBtnText}>···</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Items — swipe left to delete, tap to edit */}
      {items.map((item, index) => {
        const itemRow = (
          <DiaryItemRow
            name={item.name}
            amountLabel={item.unit === 'portion'
              ? `${item.quantity} Portion${item.quantity !== 1 ? 'en' : ''}`
              : `${Math.round(item.quantity)} g`}
            kcal={item.macros.calories}
            protein={item.macros.protein}
            aiBadgeLabel={item.sourceType === 'ai-meal-estimate'
              ? (item.aiMealEstimatePhotoUsed ? '📷 KI-Schätzung' : '✨ KI-Schätzung')
              : undefined}
            onPress={selectionMode ? undefined : () => onEditItem(meal.id, item)}
            onLongPress={selectionMode ? undefined : () => onStartItemSelection(meal.id, item.id)}
            selectionMode={selectionMode}
            selected={selectedItemKeys.has(getDiaryItemSelectionKey({ mealId: meal.id, itemId: item.id }))}
            onToggleSelection={selectionMode ? () => onToggleItemSelection(meal.id, item.id) : undefined}
          />
        );

        return (
          <AnimatedItem key={item.id} index={index}>
            {selectionMode ? itemRow : (
              <SwipeableRow onDelete={() => onDeleteItem(meal.id, item.id, item.name)}>
                {itemRow}
              </SwipeableRow>
            )}
          </AnimatedItem>
        );
      })}
      {/* Footer add row — slot-style, same rhythm as item rows */}
      {!selectionMode && (
        <TouchableOpacity
          style={styles.inlineAddBtn}
          onPress={() => onAddItem(meal.id, meal.name)}
          activeOpacity={0.6}
        >
          <Text style={styles.inlineAddBtnText}>+ Eintrag hinzufügen</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- Main Screen ---

export default function DiaryScreen({ navigation, route }: Props) {
  const initialRouteDate = isValidDateOnly(route.params?.date) ? route.params.date : null;
  const [date, setDate] = useState(initialRouteDate ?? getLocalIsoDate());
  const consumedRouteDate = useRef<string | null>(null);
  const [data, setData] = useState<DiaryDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { dayType, targets, hydrateDayType } = useDayTypeStore();
  const todayTargets = targets ? (dayType === 'training' ? targets.trainingDay : targets.restDay) : null;
  const openHub = useFoodEntryHubStore((s) => s.open);
  const insets = useSafeAreaInsets();
  const [headerRowHeight, setHeaderRowHeight] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(() => new Set());
  const [bulkMutation, setBulkMutation] = useState<'delete' | 'move' | 'copy' | null>(null);
  const bulkMutationInFlight = useRef(false);
  const [copyingItemReferences, setCopyingItemReferences] = useState<DiaryItemReference[] | null>(null);
  const [copyingSourceMealType, setCopyingSourceMealType] = useState<MealType | undefined>();

  const clearSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedItemKeys(new Set());
  }, []);

  // Snackbar
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  // ScrollView ref + meal Y-offsets for DayStoryCard chip scroll-to
  const scrollViewRef = useRef<ScrollView>(null);
  const mealOffsets = useRef<Partial<Record<MealType, number>>>({}).current;

  // Day-transition fade animation
  const contentOpacity = useSharedValue(1);
  const contentAnimStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  const routeDate = route.params?.date;
  useEffect(() => {
    if (routeDate == null) {
      consumedRouteDate.current = null;
      return;
    }

    if (!isValidDateOnly(routeDate)) {
      navigation.setParams({ date: undefined });
      return;
    }

    if (consumedRouteDate.current === routeDate) return;
    consumedRouteDate.current = routeDate;
    navigation.setParams({ date: undefined });
    clearSelectionMode();
    setDate((currentDate) => currentDate === routeDate ? currentDate : routeDate);
  }, [clearSelectionMode, navigation, routeDate]);

  useEffect(() => {
    clearSelectionMode();
    setCopyingItemReferences(null);
    setCopyingSourceMealType(undefined);
  }, [clearSelectionMode, date]);

  // ConfirmSheet state
  const [confirmSheet, setConfirmSheet] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    actions: ConfirmSheetAction[];
    onDismiss?: () => void;
  }>({ visible: false, title: '', actions: [] });

  const closeConfirmSheet = () => setConfirmSheet((s) => ({ ...s, visible: false, onDismiss: undefined }));

  // EditItem sheet state
  const [editingItem, setEditingItem] = useState<MealItem | null>(null);
  const [editingMealId, setEditingMealId] = useState<string>('');

  // Move / Copy sheet state
  const [moveSheetVisible, setMoveSheetVisible] = useState(false);
  const [singleMoveReference, setSingleMoveReference] = useState<DiaryItemReference | null>(null);

  // Activity states
  const [activityBonusSheetVisible, setActivityBonusSheetVisible] = useState(false);

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

  const loadDay = useCallback(async (d: string): Promise<boolean> => {
    try {
      setError(null);
      const result = await diaryApi.getDay(d);
      setData(result);
      setSelectedItemKeys((selection) => normalizeDiaryItemSelection(selection, result.meals));
      if (result.dayType != null) {
        hydrateDayType(result.dayType, d, result.workoutType ?? null);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load diary');
      return false;
    }
  }, [hydrateDayType]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fade out before loading new day
      contentOpacity.value = withTiming(0, { duration: 100 });
      await loadDay(date);
      setLoading(false);
      // Fade in after data loaded
      contentOpacity.value = withTiming(1, { duration: 200 });
    })();
  }, [date, loadDay]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDay(date);
    setRefreshing(false);
  }, [date, loadDay]);

  // Reload when returning from child screens (e.g. HikingInputScreen)
  const isInitialMount = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      void loadDay(date);
    }, [date, loadDay]),
  );

  // Date navigation
  const prevDay = () => {
    if (bulkMutationInFlight.current) return;
    clearSelectionMode();
    setDate((d) => offsetDate(d, -1));
  };
  const nextDay = () => {
    if (bulkMutationInFlight.current) return;
    const next = offsetDate(date, 1);
    if (next <= getLocalIsoDate()) {
      clearSelectionMode();
      setDate(next);
    }
  };
  const isToday = date === getLocalIsoDate();

  const startSelectionMode = (initialSelection = new Set<string>()) => {
    setSelectedItemKeys(new Set(initialSelection));
    setSelectionMode(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const handleStartItemSelection = (mealId: string, itemId: string) => {
    startSelectionMode(new Set([getDiaryItemSelectionKey({ mealId, itemId })]));
  };
  const handleToggleItemSelection = (mealId: string, itemId: string) => {
    setSelectedItemKeys((selection) => toggleDiaryItemSelection(selection, { mealId, itemId }));
  };
  const handleToggleMealSelection = (meal: Meal) => {
    if ((meal.items ?? []).length === 0) return;
    setSelectedItemKeys((selection) => toggleDiaryMealSelection(selection, meal));
  };

  // Add meal — direkt ohne Bestätigungs-Alert, optimistisches Update
  const handleAddMeal = async (type: MealType) => {
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

    await applyAddMeal({
      type,
      date,
      tempId,
      setData,
      showSnackbar,
      loadDay,
      createMeal: (d, t) => diaryApi.createMeal(d, t),
      mealLabels: MEAL_LABELS,
    });
  };

  // Delete meal — opens ConfirmSheet
  const handleDeleteMeal = (meal: Meal) => {
    setConfirmSheet({
      visible: true,
      title: `„${meal.name}" löschen?`,
      subtitle: 'Mahlzeit und alle Einträge werden entfernt.',
      actions: [
        {
          label: 'Mahlzeit löschen',
          destructive: true,
          onPress: async () => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setData((prev) => prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== meal.id) } : prev);
            try {
              await diaryApi.deleteMeal(meal);
              void loadDay(date);
            } catch {
              await loadDay(date);
              showSnackbar({ message: 'Mahlzeit konnte nicht gelöscht werden.' });
            }
          },
        },
      ],
    });
  };

  const handleOpenMealOptions = (meal: Meal) => {
    setConfirmSheet({
      visible: true,
      title: meal.name,
      actions: [
        { label: 'Einträge auswählen', onPress: () => startSelectionMode() },
        { label: 'Mahlzeit löschen', destructive: true, onPress: () => handleDeleteMeal(meal) },
      ],
    });
  };

  // Delete item — optimistic with Snackbar undo (no confirmation dialog)
  const handleDeleteItem = (mealId: string, itemId: string, name: string) => {
    const snapshot = data;
    // Optimistic remove
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: prev.meals.map((m) =>
          m.id === mealId ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m,
        ),
      };
    });
    diaryApi.deleteItem(mealId, itemId)
      .then(() => { void loadDay(date); })
      .catch(() => {
        if (snapshot) setData(snapshot);
        showSnackbar({ message: 'Eintrag konnte nicht entfernt werden.' });
      });
    showSnackbar({
      message: `„${name}" entfernt`,
      onUndo: () => {        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);        if (snapshot) setData(snapshot);
        void loadDay(date);
      },
    });
  };

  // Open hub for adding items (replaces AddItemModal as primary entry)
  const handleOpenAddItem = (mealId: string, _mealName: string) => {
    const meal = orderedMeals.find((m) => m.id === mealId);
    openHub({
      mealId,
      date,
      mealType: meal?.type,
      onSuccess: () => { void loadDay(date); },
      topInset: insets.top + headerRowHeight,
    });
  };

  const handleItemSaved = async () => {
    await loadDay(date);
  };

  // Meals ordered by type
  const orderedMeals = data
    ? [...data.meals].sort(
        (a, b) => MEAL_ORDER.indexOf(a.type) - MEAL_ORDER.indexOf(b.type),
      )
    : [];

  const existingTypes = new Set(orderedMeals.map((m) => m.type));
  // Context-aware chip filter: training day → all missing types; rest/unknown → hide Pre/Post-Workout
  const visibleMealTypes: MealType[] = dayType === 'training'
    ? ['breakfast', 'preworkout', 'lunch', 'dinner', 'postworkout', 'snack']
    : ['breakfast', 'lunch', 'dinner', 'snack'];
  const missingTypes = visibleMealTypes.filter((t) => !existingTypes.has(t));
  const selectedItemReferences = orderedMeals.flatMap((meal) =>
    (meal.items ?? [])
      .filter((item) => selectedItemKeys.has(getDiaryItemSelectionKey({ mealId: meal.id, itemId: item.id })))
      .map((item) => ({ mealId: meal.id, itemId: item.id })),
  );
  const moveItemReferences = (selectionMode
    ? selectedItemReferences
    : singleMoveReference ? [singleMoveReference] : [])
    .filter((reference) => orderedMeals.some((meal) =>
      meal.id === reference.mealId && meal.items.some((item) => item.id === reference.itemId),
    ));
  const selectionActionsDisabled = selectedItemReferences.length === 0 || bulkMutation !== null;

  const handleBulkDelete = async () => {
    const items = selectedItemReferences;
    if (items.length === 0 || bulkMutationInFlight.current) return;

    bulkMutationInFlight.current = true;
    setBulkMutation('delete');
    try {
      const result = await diaryApi.bulkDeleteItems({ sourceDate: date, items });
      const reloaded = await loadDay(date);
      clearSelectionMode();
      const countLabel = `${result.deletedCount} ${result.deletedCount === 1 ? 'Eintrag' : 'Einträge'}`;
      showSnackbar({
        message: reloaded
          ? `${countLabel} gelöscht.`
          : `${countLabel} gelöscht. Tagebuchansicht konnte nicht aktualisiert werden.`,
      });
    } catch (error) {
      await loadDay(date);
      showSnackbar({ message: getBulkMutationErrorMessage(error, 'delete') });
    } finally {
      bulkMutationInFlight.current = false;
      setBulkMutation(null);
    }
  };

  const confirmBulkDelete = () => {
    const count = selectedItemReferences.length;
    if (count === 0 || bulkMutationInFlight.current) return;
    setConfirmSheet({
      visible: true,
      title: `${count} ${count === 1 ? 'Eintrag' : 'Einträge'} löschen?`,
      subtitle: 'Nur die ausgewählten Einträge werden aus dem Tagebuch entfernt.',
      onDismiss: clearSelectionMode,
      actions: [{
        label: `${count === 1 ? 'Eintrag' : 'Einträge'} löschen`,
        destructive: true,
        onPress: () => { void handleBulkDelete(); },
      }],
    });
  };

  const handleMoveItems = async (
    items: DiaryItemReference[],
    target: DiaryBulkMoveTarget,
  ): Promise<boolean> => {
    if (items.length === 0 || bulkMutationInFlight.current) return false;

    bulkMutationInFlight.current = true;
    setBulkMutation('move');
    try {
      const result = await diaryApi.bulkMoveItems({ sourceDate: date, items, target });
      const reloaded = await loadDay(date);
      clearSelectionMode();
      const countLabel = `${result.movedCount} ${result.movedCount === 1 ? 'Eintrag' : 'Einträge'}`;
      showSnackbar({
        message: reloaded
          ? `${countLabel} nach ${result.targetMeal.name} verschoben.`
          : `${countLabel} verschoben. Tagebuchansicht konnte nicht aktualisiert werden.`,
      });
      return true;
    } catch (error) {
      await loadDay(date);
      showSnackbar({ message: getBulkMutationErrorMessage(error, 'move') });
      return false;
    } finally {
      bulkMutationInFlight.current = false;
      setBulkMutation(null);
    }
  };

  const handleCopyItems = async (
    items: DiaryItemReference[],
    targetDate: string,
    target: DiaryBulkCopyTarget,
  ): Promise<DiaryBulkCopyResponse | null> => {
    if (items.length === 0 || bulkMutationInFlight.current) return null;

    bulkMutationInFlight.current = true;
    setBulkMutation('copy');
    try {
      const result = await diaryApi.bulkCopyItems({ sourceDate: date, targetDate, items, target });
      const reloaded = await loadDay(date);
      if (selectionMode) clearSelectionMode();
      const countLabel = `${result.copiedCount} ${result.copiedCount === 1 ? 'Eintrag' : 'Einträge'}`;
      showSnackbar({
        message: reloaded
          ? `${countLabel} auf ${formatDateLabel(result.targetMeal.date)} in ${result.targetMeal.name} kopiert.`
          : `${countLabel} kopiert. Tagebuchansicht konnte nicht aktualisiert werden.`,
      });
      return result;
    } catch (error) {
      await loadDay(date);
      showSnackbar({ message: getBulkMutationErrorMessage(error, 'copy') });
      return null;
    } finally {
      bulkMutationInFlight.current = false;
      setBulkMutation(null);
    }
  };

  const closeMoveSheet = () => {
    setMoveSheetVisible(false);
    setSingleMoveReference(null);
    clearSelectionMode();
  };

  const closeCopySheet = () => {
    if (bulkMutationInFlight.current) return;
    setCopyingItemReferences(null);
    setCopyingSourceMealType(undefined);
    clearSelectionMode();
  };

  // Per-meal macro sums for the breakdown sheet in DayStoryCard
  const mealSummaries: MealMacroSummary[] = orderedMeals
    .filter((m) => (m.items ?? []).length > 0)
    .map((m) => ({
      type: m.type,
      name: m.name,
      macros: (m.items ?? []).reduce(
        (acc, i) => ({
          calories: acc.calories + i.macros.calories,
          protein:  acc.protein  + i.macros.protein,
          carbs:    acc.carbs    + i.macros.carbs,
          fat:      acc.fat      + i.macros.fat,
          fiber:    acc.fiber    + i.macros.fiber,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      ),
      items: (m.items ?? []).map((i) => ({ name: i.name, macros: i.macros })),
    }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header + Date navigator — unified single row */}
      <GestureDetector gesture={Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          'worklet';
          if (e.translationX < -40) {
            runOnJS(nextDay)();
          } else if (e.translationX > 40) {
            runOnJS(prevDay)();
          }
        })
      }>
        <View style={styles.headerRow} onLayout={(e) => setHeaderRowHeight(e.nativeEvent.layout.height)}>
          {/* Left: screen eyebrow label */}
          <Text style={styles.headerEyebrow}>Ernährung</Text>
          {/* Center: date navigator */}
          <View style={styles.dateNavCenter}>
            <TouchableOpacity
              onPress={prevDay}
              style={[styles.dateNavBtn, bulkMutation !== null && styles.dateNavBtnDisabled]}
              disabled={bulkMutation !== null}
            >
              <Text style={styles.dateNavArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
            <TouchableOpacity
              onPress={nextDay}
              style={[styles.dateNavBtn, (isToday || bulkMutation !== null) && styles.dateNavBtnDisabled]}
              disabled={isToday || bulkMutation !== null}
            >
              <Text style={[styles.dateNavArrow, (isToday || bulkMutation !== null) && styles.dateNavArrowDisabled]}>›</Text>
            </TouchableOpacity>
          </View>
          {selectionMode ? (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={clearSelectionMode}
              activeOpacity={0.7}
              disabled={bulkMutation !== null}
              accessibilityRole="button"
              accessibilityLabel="Mehrfachauswahl beenden"
            >
              <Text style={[styles.headerActionText, styles.headerActionCancelText]}>Abbrechen</Text>
            </TouchableOpacity>
          ) : <View style={styles.headerSpacer} />}
        </View>
      </GestureDetector>

      <Animated.View style={[{ flex: 1 }, contentAnimStyle]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadDay(date)} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ref={scrollViewRef}
        >
          {/* Summary card — DayStoryCard with semi-circle gauge */}
          {data && (
            <DayStoryCard
              summary={data.summary}
              target={todayTargets ?? { calories: 2000, proteinG: 150, carbsG: 200, fatG: 70, fiberG: 25 } satisfies MacroTarget}
              meals={orderedMeals.map((m) => ({ type: m.type, items: m.items ?? [] }))}
              mealSummaries={mealSummaries}
              scrollRef={scrollViewRef}
              mealOffsets={mealOffsets}
              hint={data.hint}
              activityBonusInfo={data.activityBonus && data.activityBonus > 0 ? {
                bonus: data.activityBonus,
                onShowBreakdown: () => setActivityBonusSheetVisible(true),
              } : undefined}
            />
          )}

          {/* Meals */}
          {orderedMeals.map((meal) => (
            <View
              key={meal.id}
              onLayout={(e) => { mealOffsets[meal.type] = e.nativeEvent.layout.y; }}
            >
              <MealCard
                meal={meal}
                isToday={isToday}
                selectionMode={selectionMode}
                selectedItemKeys={selectedItemKeys}
                onAddItem={handleOpenAddItem}
                onDeleteItem={handleDeleteItem}
                onEditItem={handleEditItem}
                onDeleteMeal={handleDeleteMeal}
                onOpenMealOptions={handleOpenMealOptions}
                onStartItemSelection={handleStartItemSelection}
                onToggleItemSelection={handleToggleItemSelection}
                onToggleMealSelection={handleToggleMealSelection}
              />
            </View>
          ))}

          {/* Add meal buttons for missing types */}
          {!selectionMode && missingTypes.length > 0 && (
            <View style={styles.addMealSection}>
              <Text style={styles.addMealSectionTitle}>Weitere Mahlzeit</Text>
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
      </Animated.View>

      {selectionMode && (
        <View style={[styles.selectionActionBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <Text
            style={styles.selectionCount}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${selectedItemReferences.length} ${selectedItemReferences.length === 1 ? 'Eintrag' : 'Einträge'} ausgewählt`}
          >
            {selectedItemReferences.length} {selectedItemReferences.length === 1 ? 'Eintrag ausgewählt' : 'Einträge ausgewählt'}
          </Text>
          <View style={styles.selectionActionButtons}>
            <TouchableOpacity
              style={[styles.selectionActionButton, selectionActionsDisabled && styles.selectionActionDisabled]}
              onPress={confirmBulkDelete}
              disabled={selectionActionsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Löschen"
              accessibilityState={{ disabled: selectionActionsDisabled }}
            >
              <Icon lib="feather" name="trash-2" size="sm" color={selectionActionsDisabled ? colors.textDisabled : colors.negative} />
              <Text style={[styles.selectionActionLabel, selectionActionsDisabled ? styles.selectionActionLabelDisabled : styles.selectionActionLabelDestructive]}>Löschen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectionActionButton, selectionActionsDisabled && styles.selectionActionDisabled]}
              onPress={() => {
                setSingleMoveReference(null);
                setMoveSheetVisible(true);
              }}
              disabled={selectionActionsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Verschieben"
              accessibilityState={{ disabled: selectionActionsDisabled }}
            >
              <Icon lib="feather" name="move" size="sm" color={selectionActionsDisabled ? colors.textDisabled : colors.primary} />
              <Text style={[styles.selectionActionLabel, selectionActionsDisabled ? styles.selectionActionLabelDisabled : styles.selectionActionLabelActive]}>Verschieben</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectionActionButton, selectionActionsDisabled && styles.selectionActionDisabled]}
              onPress={() => {
                setCopyingSourceMealType(undefined);
                setCopyingItemReferences([...selectedItemReferences]);
              }}
              disabled={selectionActionsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Kopieren"
              accessibilityState={{ disabled: selectionActionsDisabled }}
            >
              <Icon lib="feather" name="copy" size="sm" color={selectionActionsDisabled ? colors.textDisabled : colors.primary} />
              <Text style={[styles.selectionActionLabel, selectionActionsDisabled ? styles.selectionActionLabelDisabled : styles.selectionActionLabelActive]}>Kopieren</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit Item Sheet */}
      {editingItem && (
        <EditItemSheet
          visible={!!editingItem}
          mealId={editingMealId}
          mealName={orderedMeals.find((m) => m.id === editingMealId)?.name ?? ''}
          dateLabel={formatDateLabel(date)}
          item={editingItem}
          proteinTarget={todayTargets?.proteinG}
          onSaved={handleEditSaved}
          onDeleted={handleDeleteItem}
          onClose={() => setEditingItem(null)}
          onMoveRequest={(item) => {
            setEditingItem(null);
            setSingleMoveReference({ mealId: editingMealId, itemId: item.id });
            setMoveSheetVisible(true);
          }}
          onCopyRequest={(item) => {
            const sourceMeal = orderedMeals.find((m) => m.id === editingMealId);
            setEditingItem(null);
            setCopyingItemReferences([{ mealId: editingMealId, itemId: item.id }]);
            setCopyingSourceMealType(sourceMeal?.type);
          }}
        />
      )}

      {/* Move Item Sheet */}
      {moveSheetVisible && (
        <MoveItemSheet
          visible={moveSheetVisible}
          items={moveItemReferences}
          itemLabel={getMoveItemLabel(moveItemReferences, orderedMeals)}
          meals={orderedMeals}
          onMove={handleMoveItems}
          onClose={closeMoveSheet}
        />
      )}

      {/* Copy Item Sheet */}
      {copyingItemReferences && (
        <CopyItemSheet
          visible
          sourceDate={date}
          items={copyingItemReferences}
          itemLabel={getMoveItemLabel(copyingItemReferences, orderedMeals)}
          sourceMealType={copyingSourceMealType}
          onCopy={handleCopyItems}
          onClose={closeCopySheet}
        />
      )}

      {/* Confirm Sheet (replaces Alert.alert for destructive actions) */}
      <ConfirmSheet
        visible={confirmSheet.visible}
        title={confirmSheet.title}
        subtitle={confirmSheet.subtitle}
        actions={confirmSheet.actions}
        onClose={closeConfirmSheet}
        onDismiss={confirmSheet.onDismiss}
      />

      {/* Activity bonus breakdown sheet */}
      {data?.specialActivity && (
        <ActivityBonusSheet
          visible={activityBonusSheetVisible}
          onClose={() => setActivityBonusSheetVisible(false)}
          activity={data.specialActivity}
        />
      )}

      {/* Snackbar (item delete undo + error feedback) */}
      <Snackbar ref={snackbarRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // ─── Unified header row ───
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerEyebrow: {
    ...typography.caption,
    fontWeight: '600' as const,
    color: colors.textMuted,
    width: 88,
  },
  dateNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerSpacer: {
    width: 88,
  },
  headerAction: {
    width: 88,
    height: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerActionText: { ...typography.caption, color: colors.primary, fontWeight: '600' as const },
  headerActionCancelText: { color: colors.textSecondary },
  selectionActionBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  selectionCount: { ...typography.body2, color: colors.text, fontWeight: '600' as const },
  selectionActionButtons: { flexDirection: 'row', gap: spacing.sm },
  selectionActionButton: {
    flex: 1,
    minHeight: spacing.xl + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionActionDisabled: { opacity: 0.55 },
  selectionActionLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' as const },
  selectionActionLabelDisabled: { color: colors.textDisabled },
  selectionActionLabelActive: { color: colors.primary },
  selectionActionLabelDestructive: { color: colors.negative },
  mealSelectionToggle: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
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

  // Meal card — State A (filled)
  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  // Meal card — State B wrapper: clips SwipeableRow to card border-radius
  mealCardCompactWrapper: {
    borderRadius: radius.xl,
    overflow: 'hidden' as const,
    marginBottom: spacing.sm,
  },
  // Meal card — State B (compact empty)
  mealCardCompact: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // State C modifier (3px left border for current meal)
  mealCardCurrent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  compactAddHint: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: 'auto',
  },
  // Inline add link at bottom of filled card
  inlineAddBtn: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inlineAddBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' as const },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  mealIcon: { fontSize: 20, marginRight: spacing.sm, marginTop: 2 },
  mealName: { ...typography.h3, color: colors.text },
  mealCal: { ...typography.caption, color: colors.textSecondary, marginTop: 2, fontVariant: ['tabular-nums'] as const },
  mealItemCount: { ...typography.caption, color: colors.textMuted },

  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtnText: { fontSize: 16, color: colors.textSecondary, letterSpacing: 3, lineHeight: 18 },
  deleteItemText: { ...typography.body2, color: colors.textMuted },

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
  addMealChipLabel: { ...typography.body2, color: colors.text },
});

