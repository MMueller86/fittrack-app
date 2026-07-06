// ProduktDialog — Produktdetail + Mengenauswahl + In-Hub-Hinzufügen.
// Öffnet sich als gestapeltes BottomSheetModal auf dem FoodEntryHub.
// Snap-Points: 50% Standard, 92% bei Tastatur.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { FoodSearchResult, MealType } from '@fittrack/shared';
import { calculateNutrition } from '../nutritionUtils';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { diaryApi } from '../../../shared/api/diaryApi';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { formatApiError } from '../../../shared/api/apiError';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import type { FoodEntryHubContext } from './useFoodEntryHubStore';

const SNAP_POINTS = ['50%', '92%'];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
  preworkout: 'Pre-Workout',
  postworkout: 'Post-Workout',
};
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'preworkout', 'postworkout'];

interface Props {
  product: FoodSearchResult | null;
  context: FoodEntryHubContext;
  onDismiss: () => void;
  onAdded: (productName: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFoodRef(product: FoodSearchResult): { foodRef: string; foodRefType: 'catalog' | 'personal' } {
  return {
    foodRef: product.id,
    foodRefType: product.source === 'openFoodFacts' ? 'catalog' : 'personal',
  };
}

function MacroItem({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.macroItem}>
      <Text style={styles.macroValue}>{Math.round(value)}</Text>
      <Text style={styles.macroUnit}>{unit}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ProduktDialog
// ---------------------------------------------------------------------------

export function ProduktDialog({ product, context, onDismiss, onAdded }: Props) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  type QMode = 'grams' | 'portion';
  const [qMode, setQMode] = useState<QMode>('grams');
  const [qValue, setQValue] = useState('100');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favToast, setFavToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(context.mealType);
  // P-1.4: selectedMealType nur beim ERSTEN Öffnen auf Kontext setzen,
  // nicht bei jedem Produkt-Wechsel (verhindert Reset einer User-Auswahl)
  const isFirstProductRef = useRef(true);

  const hasPortions = !!product?.portion?.weightGrams;
  const hasPer100g = !!product?.nutritionPer100g;
  const parsedQValue = Number(qValue);
  const isQValid = Number.isFinite(parsedQValue) && parsedQValue > 0;

  // Sync visible state with product
  useEffect(() => {
    if (product) {
      // reset input with defaults first
      const defaultMode: QMode = product.portion?.weightGrams ? 'portion' : 'grams';
      setQMode(defaultMode);
      setQValue(defaultMode === 'portion' ? '1' : '100');
      setIsFavorite(product.isFavorite ?? false);
      setError(null);
      setSaving(false);
      // Meal-Type nur beim ersten Open zurücksetzen
      if (isFirstProductRef.current) {
        setSelectedMealType(context.mealType);
        isFirstProductRef.current = false;
      }
      sheetRef.current?.present();

      // UX-2: Pre-fill last used quantity from UserFoodRelation
      void favoritesApi.listRecent(10).then((relations) => {
        const rel = relations.find((r) => r.foodRef === product.id);
        if (rel?.lastInputMode && rel?.lastInputAmount != null) {
          const hasPortions = !!product.portion?.weightGrams;
          const mode: QMode = rel.lastInputMode === 'portion' && hasPortions ? 'portion' : 'grams';
          setQMode(mode);
          setQValue(String(rel.lastInputAmount));
        }
      }).catch(() => {
        // Non-critical — ignore
      });
    } else {
      isFirstProductRef.current = true; // Reset für nächstes Öffnen
      sheetRef.current?.dismiss();
    }
  }, [product]);

  const handleSheetDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  // ---------------------------------------------------------------------------
  // Live macro preview
  // ---------------------------------------------------------------------------

  const preview = useMemo(() => {
    if (!product || !hasPer100g || !isQValid || !product.nutritionPer100g) return null;
    try {
      return calculateNutrition(qMode, parsedQValue, product.nutritionPer100g, product.portion?.weightGrams);
    } catch {
      return null;
    }
  }, [product, hasPer100g, isQValid, qMode, parsedQValue]);

  // ---------------------------------------------------------------------------
  // Favorite toggle
  // ---------------------------------------------------------------------------

  const handleFavoriteToggle = useCallback(async () => {
    if (!product) return;
    const prev = isFavorite;
    const next = !prev;
    setIsFavorite(next);
    try {
      if (next) {
        const { foodRef, foodRefType } = buildFoodRef(product);
        await favoritesApi.addFavorite({
          foodRef,
          foodRefType,
          displayName: product.name,
          displayBrand: product.brand,
        });
        setFavToast('Zu Favoriten hinzugefügt');
      } else {
        await favoritesApi.removeFavorite(product.id);
        setFavToast('Aus Favoriten entfernt');
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => setFavToast(null), 1500);
    } catch {
      // Revert on error
      setIsFavorite(prev);
    }
  }, [product, isFavorite]);

  // ---------------------------------------------------------------------------
  // Add to diary
  // ---------------------------------------------------------------------------

  const handleAdd = useCallback(async () => {
    if (!product || !isQValid || !preview || saving) return;
    setSaving(true);
    setError(null);
    try {
      let mealId = context.mealId;

      // Kein mealId → suche Mahlzeit nach selectedMealType oder erstelle sie
      if (!mealId) {
        const dayData = await diaryApi.getDay(context.date);
        const existingMeal = dayData.meals.find((m) => m.type === selectedMealType);
        if (existingMeal) {
          mealId = existingMeal.id;
        } else {
          const { meal: newMeal } = await diaryApi.createMeal(context.date, selectedMealType);
          mealId = newMeal.id;
        }
      }

      await diaryApi.addItem(mealId, {
        productId: product.id,
        productName: product.name,
        inputMode: qMode,
        inputAmount: parsedQValue,
        amountGrams: preview.amountGrams,
        calculatedNutrition: preview.calculatedNutrition,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAdded(product.name);
    } catch (e: unknown) {
      setError(formatApiError(e, 'Hinzufügen fehlgeschlagen'));
    } finally {
      setSaving(false);
    }
  }, [product, context, selectedMealType, qMode, parsedQValue, preview, isQValid, saving, onAdded]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!product) return null;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      index={0}
      onDismiss={handleSheetDismiss}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      enablePanDownToClose
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onDismiss}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Zurück"
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
            {product.brand ? (
              <Text style={styles.productBrand} numberOfLines={1}>{product.brand}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.favBtn}
            onPress={() => { void handleFavoriteToggle(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          >
            <Text style={[styles.favIcon, isFavorite && styles.favIconActive]}>
              {isFavorite ? '❤️' : '♡'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Favorite toast */}
        {favToast ? (
          <View style={styles.favToast}>
            <Text style={styles.favToastText}>{favToast}</Text>
          </View>
        ) : null}

        {/* Unvollständiges Produkt — Warnung */}
        {!product.isComplete ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              ⚠ Unvollständige Nährwertdaten – Werte könnten ungenau sein.
            </Text>
          </View>
        ) : null}

        {/* Mahlzeit-Chips (nur ohne festen mealId-Kontext) */}
        {!context.mealId ? (
          <View style={styles.mealSection}>
            <Text style={styles.sectionLabel}>Mahlzeit</Text>
            <View style={styles.mealChips}>
              {MEAL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.mealChip, selectedMealType === type && styles.mealChipActive]}
                  onPress={() => setSelectedMealType(type)}
                >
                  <Text
                    style={[styles.mealChipText, selectedMealType === type && styles.mealChipTextActive]}
                  >
                    {MEAL_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* Mengen-Eingabe */}
        <View style={styles.quantitySection}>
          <Text style={styles.sectionLabel}>Menge</Text>

          {/* Unit toggle — nur bei Portionsdaten */}
          {hasPortions ? (
            <View style={styles.unitToggle}>
              <TouchableOpacity
                style={[styles.unitBtn, qMode === 'grams' && styles.unitBtnActive]}
                onPress={() => { setQMode('grams'); setQValue('100'); }}
              >
                <Text style={[styles.unitBtnText, qMode === 'grams' && styles.unitBtnTextActive]}>Gramm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitBtn, qMode === 'portion' && styles.unitBtnActive]}
                onPress={() => { setQMode('portion'); setQValue('1'); }}
              >
                <Text style={[styles.unitBtnText, qMode === 'portion' && styles.unitBtnTextActive]}>Portion</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.quantityRow}>
            <BottomSheetTextInput
              style={styles.quantityInput}
              value={qValue}
              onChangeText={setQValue}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel={qMode === 'grams' ? 'Menge in Gramm' : 'Anzahl Portionen'}
              onFocus={() => sheetRef.current?.snapToIndex(1)}
            />
            <Text style={styles.quantityUnit}>
              {qMode === 'grams' ? 'g' : 'Port.'}
            </Text>
          </View>

          {qMode === 'portion' && product.portion?.weightGrams ? (
            <Text style={styles.portionHint}>
              1 Portion = {product.portion.weightGrams} g
            </Text>
          ) : null}
        </View>

        {/* Makro-Vorschau */}
        {preview ? (
          <View style={styles.macroPreview}>
            <Text style={styles.macroPreviewTitle}>
              Nährwerte ({Math.round(preview.amountGrams)} g)
            </Text>
            <View style={styles.macroRow}>
              <MacroItem label="Kalorien" value={preview.calculatedNutrition.calories} unit="kcal" />
              <MacroItem label="Protein" value={preview.calculatedNutrition.protein} unit="g" />
              <MacroItem label="Kohlenhydr." value={preview.calculatedNutrition.carbs} unit="g" />
              <MacroItem label="Fett" value={preview.calculatedNutrition.fat} unit="g" />
              {(preview.calculatedNutrition.fiber ?? 0) > 0 ? (
                <MacroItem label="Ballaststoffe" value={preview.calculatedNutrition.fiber ?? 0} unit="g" />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Keine Nährwertdaten */}
        {!hasPer100g ? (
          <Text style={styles.noDataHint}>
            Keine Nährwertdaten — manuelle Eingabe empfohlen.
          </Text>
        ) : null}

        {/* Error */}
        {error ? (
          <View style={styles.errorContainer}>
            <ErrorBanner error={error} onRetry={() => void handleAdd()} />
          </View>
        ) : null}

        {/* Add-Button */}
        <TouchableOpacity
          style={[
            styles.addBtn,
            (!isQValid || saving || !hasPer100g) && styles.addBtnDisabled,
          ]}
          onPress={() => { void handleAdd(); }}
          disabled={!isQValid || saving || !hasPer100g}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.addBtnText}>Zur Mahlzeit hinzufügen</Text>
          )}
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: {
    backgroundColor: colors.border,
    width: 40,
    height: 4,
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  backBtn: {
    paddingTop: 2,
    paddingRight: spacing.xs,
  },
  backIcon: {
    fontSize: 28,
    color: colors.primary,
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
  },
  productName: {
    ...typography.h3,
    color: colors.text,
  },
  productBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  favBtn: {
    paddingTop: 2,
  },
  favIcon: {
    fontSize: 24,
    color: colors.textMuted,
  },
  favIconActive: {
    color: colors.negative,
  },

  // Favorite toast
  favToast: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'center',
  },
  favToastText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Warning
  warning: {
    backgroundColor: 'rgba(226, 107, 107, 0.12)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.negative,
  },
  warningText: {
    ...typography.caption,
    color: colors.negative,
  },

  // Meal chips
  mealSection: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
  },
  mealChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  mealChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  mealChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  mealChipTextActive: {
    color: colors.primary,
    fontWeight: '600' as const,
  },

  // Quantity
  quantitySection: {
    gap: spacing.xs,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 2,
  },
  unitBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  unitBtnActive: {
    backgroundColor: colors.surfaceElevated,
  },
  unitBtnText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600' as const,
  },
  unitBtnTextActive: {
    color: colors.text,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    ...typography.h3,
    textAlign: 'center',
  },
  quantityUnit: {
    ...typography.body1,
    color: colors.textSecondary,
    minWidth: 36,
  },
  portionHint: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Macro preview
  macroPreview: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  macroPreviewTitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  macroItem: {
    alignItems: 'center',
    minWidth: 56,
  },
  macroValue: {
    ...typography.h3,
    color: colors.text,
  },
  macroUnit: {
    ...typography.caption,
    color: colors.textMuted,
  },
  macroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },

  // No data hint
  noDataHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Error
  errorContainer: {
    marginTop: spacing.xs,
  },

  // Add button
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    ...typography.button,
    color: colors.background,
  },
});
