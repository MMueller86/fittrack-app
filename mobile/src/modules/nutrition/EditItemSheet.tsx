// EditItemSheet — Bottom-Sheet-Modal zum Bearbeiten einer Diary-Mahlzeitposition.
// Spiegelt das QuantitySelector-UI aus der Suche (AddItemModal) wider.
// Erlaubt Gramm- oder Portionseingabe mit Live-Macro-Vorschau.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Meal, MealItem, ReusableItem } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { diaryApi } from '../../shared/api/diaryApi';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';

interface Props {
  visible: boolean;
  mealId: string;
  item: MealItem;
  onSaved: (updatedMeal: Meal) => void;
  onClose: () => void;
}

// Derive nutrition per 100g from current item macros (only valid for gram-based items)
function deriveNutritionPer100g(item: MealItem) {
  if (item.unit !== 'g' || !item.quantity || item.quantity <= 0) return null;
  const q = item.quantity;
  return {
    calories: Math.round((item.macros.calories / q) * 100 * 10) / 10,
    protein:  Math.round((item.macros.protein  / q) * 100 * 10) / 10,
    carbs:    Math.round((item.macros.carbs    / q) * 100 * 10) / 10,
    fat:      Math.round((item.macros.fat      / q) * 100 * 10) / 10,
    fiber:    Math.round(((item.macros.fiber ?? 0) / q) * 100 * 10) / 10,
  };
}

function PreviewValue({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.previewItem}>
      <Text style={styles.previewValue}>{Math.round(value * 10) / 10}</Text>
      <Text style={styles.previewUnit}>{unit}</Text>
      <Text style={styles.previewLabel}>{label}</Text>
    </View>
  );
}

type InputMode = 'grams' | 'portion';

export default function EditItemSheet({ visible, mealId, item, onSaved, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const isPortion = item.unit === 'portion';

  const [inputMode, setInputMode] = useState<InputMode>(isPortion ? 'portion' : 'grams');
  const [amount, setAmount] = useState(String(item.quantity));
  const [saving, setSaving] = useState(false);
  const [sourceProduct, setSourceProduct] = useState<ReusableItem | null>(null);

  // Load source product to get portion weight in grams.
  // Load whenever sourceId exists — not just for 'portion' unit items,
  // so gram-based items can also switch to portion mode in edit.
  useEffect(() => {
    if (item.sourceId) {
      reusableItemsApi.getById(item.sourceId)
        .then((r) => setSourceProduct(r.item))
        .catch(() => setSourceProduct(null));
    } else {
      setSourceProduct(null);
    }
  }, [item.sourceId]);

  // Reset when item changes
  useEffect(() => {
    setInputMode(item.unit === 'portion' ? 'portion' : 'grams');
    setAmount(String(item.quantity));
  }, [item.id, item.quantity, item.unit]);

  const per100g = useMemo(() => deriveNutritionPer100g(item), [item]);
  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  // Live preview: only for gram-mode items where we can derive per100g
  const preview = useMemo(() => {
    if (!per100g || !isValid || inputMode !== 'grams') return null;
    const scale = parsedAmount / 100;
    return {
      calories: per100g.calories * scale,
      protein:  per100g.protein  * scale,
      carbs:    per100g.carbs    * scale,
      fat:      per100g.fat      * scale,
      fiber:    per100g.fiber    * scale,
      amountGrams: parsedAmount,
    };
  }, [per100g, parsedAmount, isValid, inputMode]);

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Ungültige Menge', 'Bitte eine positive Zahl eingeben.');
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      const result = await diaryApi.updateItem(mealId, item.id, {
        inputMode,
        ...(inputMode === 'portion' ? { portionCount: parsedAmount } : { amountGrams: parsedAmount }),
      });
      onSaved(result.meal);
    } catch {
      Alert.alert('Fehler', 'Änderung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : 'height'}
        style={styles.avoidingView}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={styles.scrollContent}
          >
            {/* Back / Cancel */}
            <TouchableOpacity onPress={onClose} style={styles.backRow}>
              <Text style={styles.backText}>← Zurück</Text>
            </TouchableOpacity>

            {/* Item name */}
            <Text style={styles.itemName}>{item.name}</Text>

            {/* kcal per 100g */}
            {per100g && (
              <Text style={styles.per100gHint}>
                {Math.round(per100g.calories)} kcal / 100 g
                {'  ·  '}{per100g.protein} g P
                {'  ·  '}{per100g.carbs} g K
                {'  ·  '}{per100g.fat} g F
              </Text>
            )}

            {/* Portion size hint — visible when in portion mode */}
            {inputMode === 'portion' && item.quantity > 0 && (() => {
              const portionLabel = sourceProduct?.portion?.label;
              const portionWeightGrams = sourceProduct?.portion?.weightGrams;
              const kcalPerPortion = Math.round(item.macros.calories / item.quantity);
              const proteinPerPortion = Math.round(item.macros.protein / item.quantity * 10) / 10;
              // Build: "1 Handvoll (40 g) = 23 kcal · 0.5 g Protein"
              const portionDesc = portionLabel
                ? portionWeightGrams
                  ? `${portionLabel} (${portionWeightGrams} g)`
                  : portionLabel
                : portionWeightGrams
                  ? `${portionWeightGrams} g`
                  : null;
              return (
                <View style={styles.portionHint}>
                  {portionDesc && (
                    <Text style={[styles.portionHintText, styles.portionHintLabel]}>
                      1 Portion = {portionDesc}
                    </Text>
                  )}
                  <Text style={styles.portionHintText}>
                    {portionDesc ? '→ ' : '1 Portion ≈ '}
                    {kcalPerPortion} kcal · {proteinPerPortion} g Protein
                  </Text>
                </View>
              );
            })()}

            {/* Gram / Portion segmented control — show when original unit was portion OR when sourceProduct has a portion size */}
            {(isPortion || sourceProduct?.portion?.weightGrams) && (
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segment, inputMode === 'grams' && styles.segmentActive]}
                  onPress={() => { setInputMode('grams'); setAmount('100'); }}
                >
                  <Text style={[styles.segmentText, inputMode === 'grams' && styles.segmentTextActive]}>Gramm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, inputMode === 'portion' && styles.segmentActive]}
                  onPress={() => {
                    setInputMode('portion');
                    // When switching from grams to portion, estimate a sensible portion count
                    const portionGrams = sourceProduct?.portion?.weightGrams;
                    if (isPortion) {
                      setAmount(String(item.quantity));
                    } else if (portionGrams && parsedAmount > 0) {
                      setAmount(String(Math.max(1, Math.round(parsedAmount / portionGrams))));
                    } else {
                      setAmount('1');
                    }
                  }}
                >
                  <Text style={[styles.segmentText, inputMode === 'portion' && styles.segmentTextActive]}>Portion</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Amount input */}
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>
                {inputMode === 'grams' ? 'Menge in g' : 'Anzahl Portionen'}
              </Text>
              <TextInput
                style={styles.qInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                selectTextOnFocus
                editable={!saving}
                autoFocus
              />
            </View>

            {/* Live macro preview */}
            {preview ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>
                  Nährwerte ({Math.round(preview.amountGrams)} g)
                </Text>
                <View style={styles.previewRow}>
                  <PreviewValue label="Kalorien" value={preview.calories} unit="kcal" />
                  <PreviewValue label="Protein"  value={preview.protein}  unit="g" />
                  <PreviewValue label="Kohlenhy." value={preview.carbs}   unit="g" />
                  <PreviewValue label="Fett"      value={preview.fat}     unit="g" />
                  {preview.fiber > 0 && (
                    <PreviewValue label="Ballaststoffe" value={preview.fiber} unit="g" />
                  )}
                </View>
              </View>
            ) : (
              // Portion mode or no per100g — show current macros as reference
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>
                  Aktuelle Nährwerte ({item.unit === 'portion'
                    ? `${item.quantity} Portion${item.quantity !== 1 ? 'en' : ''}`
                    : `${item.quantity} g`})
                </Text>
                <View style={styles.previewRow}>
                  <PreviewValue label="Kalorien" value={item.macros.calories} unit="kcal" />
                  <PreviewValue label="Protein"  value={item.macros.protein}  unit="g" />
                  <PreviewValue label="Kohlenhy." value={item.macros.carbs}   unit="g" />
                  <PreviewValue label="Fett"      value={item.macros.fat}     unit="g" />
                </View>
                <Text style={styles.previewHint}>Makros werden nach dem Speichern neu berechnet.</Text>
              </View>
            )}

          </ScrollView>

          {/* Save button — always visible outside scroll */}
          <TouchableOpacity
            style={[styles.saveBtn, (!isValid || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.saveBtnText}>Speichern</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  avoidingView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  portionHint: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  portionHintText: { ...typography.caption, color: colors.textSecondary },
  portionHintLabel: { fontWeight: '600' as const, marginBottom: 2 },
  backRow: {
    marginBottom: spacing.sm,
  },
  backText: { ...typography.body1, color: colors.textSecondary },
  itemName: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  per100gHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { ...typography.body2, color: colors.textSecondary },
  segmentTextActive: { color: colors.text, fontWeight: '600' },
  inputBlock: {
    marginBottom: spacing.md,
  },
  inputLabel: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  qInput: {
    ...typography.h2,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  preview: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  previewRow: { flexDirection: 'row', justifyContent: 'space-around' },
  previewItem: { alignItems: 'center' },
  previewValue: { ...typography.body1, color: colors.text, fontWeight: '600' },
  previewUnit: { ...typography.caption, color: colors.textMuted },
  previewLabel: { ...typography.caption, color: colors.textSecondary },
  previewHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...typography.button, color: colors.white },
});
