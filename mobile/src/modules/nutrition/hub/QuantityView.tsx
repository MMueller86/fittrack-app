// QuantityView -- UX Polish Story 3.
// Fokus: Wie viel habe ich gegessen?
// Layout: Produkt -> Mahlzeit (kompakt) -> Menge (dominant) -> Makros (Feedback) -> Hinzufuegen

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { FoodSearchResult, MealType } from '@fittrack/shared';
import { calculateNutrition } from '../nutritionUtils';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { diaryApi } from '../../../shared/api/diaryApi';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { formatApiError } from '../../../shared/api/apiError';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { Icon } from '../../../shared/components/Icon';
import type { FoodEntryHubContext } from './useFoodEntryHubStore';

// ---------------------------------------------------------------------------
// Mahlzeit-Optionen
// ---------------------------------------------------------------------------
const MEAL_OPTIONS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittagessen' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'snack', label: 'Snack' },
  { id: 'preworkout', label: 'Vor dem Training' },
  { id: 'postworkout', label: 'Nach dem Training' },
];

function getMealLabel(id: MealType | null): string {
  return MEAL_OPTIONS.find((m) => m.id === id)?.label ?? 'Mahlzeit';
}

// ---------------------------------------------------------------------------
// Einheiten-Typ
// ---------------------------------------------------------------------------
type UnitType = 'g' | 'portion';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface QuantityViewProps {
  product: FoodSearchResult;
  context: FoodEntryHubContext;
  onBack: () => void;
  onAdded: (productName: string, mealId: string, itemId: string) => void;
}

// ---------------------------------------------------------------------------
// MealSelector — kompakter Pill + Modal
// ---------------------------------------------------------------------------
interface MealSelectorProps {
  selected: MealType;
  onChange: (meal: MealType) => void;
}

function MealSelector({ selected, onChange }: MealSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.mealPill}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Mahlzeit: ${getMealLabel(selected)}`}
      >
        <Text style={styles.mealPillText}>Zu {getMealLabel(selected)}</Text>
        <Icon lib="feather" name="chevron-down" size={14} color={colors.primary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Mahlzeit auswählen</Text>
            {MEAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.modalOption}
                onPress={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    opt.id === selected && styles.modalOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {opt.id === selected && (
                  <Icon lib="feather" name="check" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// MacroBar — Diary-Stil: kcal links | EW | KH | Fett
// ---------------------------------------------------------------------------
interface MacroBarProps {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

function MacroBar({ kcal, protein, carbs, fat }: MacroBarProps) {
  return (
    <View style={styles.macroBar}>
      <View style={styles.macroHeroSlot}>
        <Text style={styles.macroHeroVal}>{Math.round(kcal)}</Text>
        <Text style={styles.macroLabel}>kcal</Text>
      </View>
      <View style={styles.macroDivider} />
      <View style={styles.macroSlot}>
        <Text style={styles.macroVal}>{protein.toFixed(1)}</Text>
        <Text style={styles.macroLabel}>EW</Text>
      </View>
      <View style={styles.macroDivider} />
      <View style={styles.macroSlot}>
        <Text style={styles.macroVal}>{carbs.toFixed(1)}</Text>
        <Text style={styles.macroLabel}>KH</Text>
      </View>
      <View style={styles.macroDivider} />
      <View style={styles.macroSlot}>
        <Text style={styles.macroVal}>{fat.toFixed(1)}</Text>
        <Text style={styles.macroLabel}>Fett</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Adaptiver Step: analog zu EditItemSheet
// ---------------------------------------------------------------------------
function getStep(amount: number, isPortion: boolean): number {
  if (isPortion) return 0.5;
  if (amount < 50) return 5;
  if (amount < 500) return 10;
  return 50;
}

function formatAmount(val: number, isPortion: boolean): string {
  if (isPortion) return val % 1 === 0 ? String(val) : val.toFixed(1);
  return String(Math.round(val));
}

// ---------------------------------------------------------------------------
// QuantityView — Hauptkomponente
// ---------------------------------------------------------------------------
export function QuantityView({ product, context, onBack, onAdded }: QuantityViewProps) {
  // Mahlzeit-Auswahl (nur relevant wenn kein mealId im context)
  const defaultMeal: MealType =
    (context.mealId as MealType | null) ?? 'breakfast';
  const [selectedMeal, setSelectedMeal] = useState<MealType>(defaultMeal);

  // Einheit
  const portionGrams = product.portion?.weightGrams;
  const hasPortion = !!(portionGrams && portionGrams > 0);
  const [unit, setUnit] = useState<UnitType>('g');

  // Menge
  const defaultGrams = portionGrams ?? 100;
  const [quantityStr, setQuantityStr] = useState(
    String(defaultGrams),
  );

  // Favorit
  const [isFavorite, setIsFavorite] = useState(product.isFavorite ?? false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Stepper
  const adjustAmount = useCallback((delta: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuantityStr((prev) => {
      const current = parseFloat(prev.replace(',', '.'));
      const base = isNaN(current) || current <= 0 ? 0 : current;
      const next = Math.max(unit === 'portion' ? 0.5 : 1, +(base + delta).toFixed(1));
      return formatAmount(next, unit === 'portion');
    });
  }, [unit]);

  // Senden
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const scrollRef = useRef<ScrollView>(null);
  const addBtnRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);

  // Android Back-Handler
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // Keyboard -> scroll to add-button
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        addBtnRef.current?.measureLayout(
          // @ts-ignore
          scrollRef.current?.getScrollableNode?.() ?? null,
          (_x, y) => {
            scrollRef.current?.scrollTo({ y: y - 16, animated: true });
          },
          () => {},
        );
      }, 150);
    });
    return () => sub.remove();
  }, []);

  // Gramm aus Input ableiten
  const gramsValue = useMemo(() => {
    const n = parseFloat(quantityStr.replace(',', '.'));
    if (isNaN(n) || n <= 0) return 0;
    if (unit === 'portion') {
      return n * (portionGrams ?? 100);
    }
    return n;
  }, [quantityStr, unit, portionGrams]);

  // Makros berechnen
  const nutrition = useMemo(() => {
    if (gramsValue <= 0 || !product.nutritionPer100g) return null;
    try {
      return calculateNutrition('grams', gramsValue, product.nutritionPer100g);
    } catch {
      return null;
    }
  }, [gramsValue, product.nutritionPer100g]);

  // Einheit wechseln
  const handleUnitToggle = useCallback(
    (next: UnitType) => {
      if (next === unit) return;
      setUnit(next);
      if (next === 'portion') {
        setQuantityStr('1');
      } else {
        setQuantityStr(String(portionGrams ?? 100));
      }
    },
    [unit, portionGrams],
  );

  // Favorit umschalten
  const handleFavoriteToggle = useCallback(async () => {
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await favoritesApi.removeFavorite(product.id);
      } else {
        await favoritesApi.addFavorite({
          foodRef: product.id,
          foodRefType: product.source === 'openFoodFacts' ? 'catalog' : 'personal',
          displayName: product.name,
          displayBrand: product.brand,
          imageUrl: product.imageUrl ?? null,
        });
      }
      setIsFavorite((prev) => !prev);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // silent
    } finally {
      setFavoriteLoading(false);
    }
  }, [isFavorite, favoriteLoading, product]);

  // Hinzufügen
  const handleAdd = useCallback(async () => {
    if (gramsValue <= 0 || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      // Wenn kein mealId: existierende Mahlzeit suchen, sonst neu anlegen
      let mealId = context.mealId;
      if (!mealId) {
        const dayData = await diaryApi.getDay(context.date);
        const existing = dayData.meals.find((m) => m.type === selectedMeal);
        if (existing) {
          mealId = existing.id;
        } else {
          const created = await diaryApi.createMeal(context.date, selectedMeal);
          mealId = created.meal.id;
        }
      }
      const calcNutrition = product.nutritionPer100g
        ? calculateNutrition('grams', gramsValue, product.nutritionPer100g).calculatedNutrition
        : { calories: 0, protein: 0, carbs: 0, fat: 0 };
      const result = await diaryApi.addItem(mealId, {
        productId: product.id,
        productName: product.name,
        inputMode: 'grams',
        inputAmount: gramsValue,
        amountGrams: gramsValue,
        calculatedNutrition: calcNutrition,
        sourceType: product.source === 'library' ? 'reusableItem' : product.source,
        imageUrl: product.imageUrl ?? null,
      });
      const newItem = result.meal.items[result.meal.items.length - 1];
      onAdded(product.name, mealId, newItem?.id ?? '');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [gramsValue, loading, context.mealId, selectedMeal, product, onAdded]);

  const canAdd = gramsValue > 0 && !loading;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Workspace-Navigation ── */}
      <TouchableOpacity onPress={onBack} style={styles.workspaceNav} hitSlop={8}>
        <Icon lib="feather" name="arrow-left" size={14} color={colors.textMuted} />
        <Text style={styles.workspaceNavText}>Zurück zur Suche</Text>
      </TouchableOpacity>

      {/* ── Produkt-Header ── */}
      <View style={styles.header}>
        {!!product.imageUrl && (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          {!!product.brand && (
            <Text style={styles.productBrand} numberOfLines={1}>
              {product.brand}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handleFavoriteToggle}
          disabled={favoriteLoading}
          hitSlop={8}
          style={styles.favBtn}
        >
          <Icon
            lib="ion"
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorite ? colors.negative : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Mahlzeit-Selektor (nur ohne festen mealId) ── */}
      {!context.mealId && (
        <View style={styles.mealRow}>
          <MealSelector selected={selectedMeal} onChange={setSelectedMeal} />
        </View>
      )}

      {/* ── Einheit-Toggle (nur mit Portionsangabe) ── */}
      {hasPortion && (
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, unit === 'g' && styles.segmentActive]}
            onPress={() => handleUnitToggle('g')}
          >
            <Text style={[styles.segmentText, unit === 'g' && styles.segmentTextActive]}>
              Gramm
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, unit === 'portion' && styles.segmentActive]}
            onPress={() => handleUnitToggle('portion')}
          >
            <Text style={[styles.segmentText, unit === 'portion' && styles.segmentTextActive]}>
              Portion
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Menge (dominant) ── */}
      <View style={styles.quantityRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => adjustAmount(-getStep(parseFloat(quantityStr.replace(',', '.')) || 0, unit === 'portion'))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Menge verringern"
        >
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>

        <View style={styles.quantityCenter}>
          <TextInput
            ref={inputRef}
            style={styles.quantityInput}
            value={quantityStr}
            onChangeText={setQuantityStr}
            keyboardType="decimal-pad"
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            accessibilityLabel="Menge"
          />
          <Text style={styles.unitLabel}>
            {unit === 'portion' ? 'Portionen' : 'g'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => adjustAmount(getStep(parseFloat(quantityStr.replace(',', '.')) || 0, unit === 'portion'))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Menge erhöhen"
        >
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Portions-Hint — immer sichtbar wenn Portionsangabe vorhanden */}
      {hasPortion && (
        <Text style={styles.portionHint}>
          1 Portion = {portionGrams}g
        </Text>
      )}

      {/* ── Makro-Feedback-Bar ── */}
      {nutrition && (
        <MacroBar
          kcal={nutrition.calculatedNutrition.calories}
          protein={nutrition.calculatedNutrition.protein}
          carbs={nutrition.calculatedNutrition.carbs}
          fat={nutrition.calculatedNutrition.fat}
        />
      )}

      {/* ── Fehler ── */}
      {error && <ErrorBanner error={error} />}

      {/* ── Hinzufügen-Button ── */}
      <View ref={addBtnRef} collapsable={false}>
        <TouchableOpacity
          style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!canAdd}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.addBtnText}>Hinzufügen</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },

  // Workspace-Navigation
  workspaceNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  workspaceNavText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  productName: {
    ...typography.body1,
    fontWeight: '600',
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

  // Mahlzeit
  mealRow: {
    flexDirection: 'row',
  },
  mealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  mealPillText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalOptionText: {
    ...typography.body1,
    color: colors.text,
  },
  modalOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Einheit-Toggle (segmentedControl wie EditItemSheet)
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs + 1,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.white,
    fontWeight: '600',
  },

  // Menge
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  productImage: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  quantityCenter: {
    flex: 1,
    alignItems: 'center',
  },
  quantityInput: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: 0,
    includeFontPadding: false,
  },
  unitLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -4,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtnText: {
    fontSize: 22,
    color: colors.text,
    fontWeight: '400',
    lineHeight: 26,
  },
  portionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },

  // MacroBar — exakt wie EditItemSheet
  macroBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  macroHeroSlot: {
    flex: 1.3,
    alignItems: 'center',
    paddingVertical: 8,
  },
  macroSlot: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  macroHeroVal: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  macroVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  macroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  macroDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },

  // Add Button
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    ...typography.button,
    fontWeight: '700',
    color: colors.white,
  },
});
