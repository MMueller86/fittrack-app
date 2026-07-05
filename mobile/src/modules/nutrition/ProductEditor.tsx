// ProductEditor — Unified editor for creating and editing ReusableItems.
//
// Covers:
//   - Manual creation (empty form)
//   - Pre-filled from barcode scan (barcode no-match flow)
//   - Edit existing product
//
// This is the Phase 0 foundation for the Food Entry Hub.
// LabelScanReviewScreen and FoodEstimateReviewScreen remain for now
// but will be migrated to use this component in a later phase.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { ReusableItem } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductEditorInitialData {
  name?: string;
  brand?: string;
  barcode?: string;   // pre-filled from barcode scan
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

interface Props {
  visible: boolean;
  /** Edit mode: existing item to update */
  existingItem?: ReusableItem;
  /** Pre-fill data for new product (e.g. from barcode no-match) */
  initialData?: ProductEditorInitialData;
  onClose: () => void;
  /** Called after successful create — passes the created item */
  onCreated?: (item: ReusableItem) => void;
  /** Called after successful update */
  onUpdated?: () => void;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function num(s: string): number {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function str(n: number | undefined): string {
  return n != null && n > 0 ? String(n) : '';
}

function NutritionField({
  label,
  value,
  onChangeText,
  unit = 'g',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
}) {
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.inputWrapper}>
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          selectTextOnFocus
          accessibilityLabel={label}
        />
        <Text style={fieldStyles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    flex: 1,
    ...typography.body2,
    color: colors.textMuted,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    minWidth: 110,
  },
  input: {
    flex: 1,
    ...typography.body1,
    color: colors.text,
    paddingVertical: spacing.xs,
    textAlign: 'right',
  },
  unit: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 4,
  },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProductEditor({
  visible,
  existingItem,
  initialData,
  onClose,
  onCreated,
  onUpdated,
}: Props) {
  const insets = useSafeAreaInsets();
  const isEdit = existingItem != null;
  const e100 = existingItem?.nutritionPer100g;

  const [name, setName] = useState(
    existingItem?.name ?? initialData?.name ?? '',
  );
  const [brand, setBrand] = useState(
    existingItem?.brand ?? initialData?.brand ?? '',
  );
  const [calories, setCalories] = useState(str(e100?.calories ?? initialData?.calories));
  const [protein, setProtein] = useState(str(e100?.protein ?? initialData?.protein));
  const [carbs, setCarbs] = useState(str(e100?.carbs ?? initialData?.carbs));
  const [fat, setFat] = useState(str(e100?.fat ?? initialData?.fat));
  const [fiber, setFiber] = useState(str(e100?.fiber ?? initialData?.fiber));
  const [salt, setSalt] = useState(str(e100?.salt));
  const [sugar, setSugar] = useState(str(e100?.sugar));
  const [saturatedFat, setSaturatedFat] = useState(str(e100?.saturatedFat));
  const [portionLabel, setPortionLabel] = useState(existingItem?.portion?.label ?? '');
  const [portionGrams, setPortionGrams] = useState(
    existingItem?.portion?.weightGrams != null ? String(existingItem.portion.weightGrams) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const barcode = initialData?.barcode;

  function buildNutrition() {
    return {
      calories: num(calories),
      protein: num(protein),
      carbs: num(carbs),
      fat: num(fat),
      ...(fiber ? { fiber: num(fiber) } : {}),
      ...(salt ? { salt: num(salt) } : {}),
      ...(sugar ? { sugar: num(sugar) } : {}),
      ...(saturatedFat ? { saturatedFat: num(saturatedFat) } : {}),
    };
  }

  function buildPortion() {
    const g = num(portionGrams);
    if (g <= 0) return undefined;
    return { label: portionLabel.trim() || `${g} g`, weightGrams: g };
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Bitte einen Produktnamen eingeben.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
          const item = await reusableItemsApi.create({
        name: trimmedName,
        brand: brand.trim() || undefined,
        sourceType: 'manual',
        nutritionPer100g: buildNutrition(),
        portion: buildPortion(),
        ...(barcode ? { sourceRef: { provider: 'openFoodFacts' as const, barcode } } : {}),
      });
          onCreated?.(item.item);
      onClose();
        } catch (e) {
          setError(formatApiError(e, 'Produkt konnte nicht gespeichert werden.'));
        } finally {
          setSaving(false);
        }
  }

  async function handleUpdate(updateHistory: boolean) {
    if (!existingItem) return;
    setSaving(true);
    setError(null);
    try {
      await reusableItemsApi.update(
        existingItem.id,
        {
          name: name.trim() || existingItem.name,
          brand: brand.trim() || null,
          nutritionPer100g: buildNutrition(),
          portion: buildPortion() ?? null,
        },
        updateHistory,
      );
      onUpdated?.();
      onClose();
    } catch (e) {
      setError(formatApiError(e, 'Aktualisierung fehlgeschlagen.'));
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (isEdit) {
      Alert.alert(
        'Historische Einträge aktualisieren?',
        'Sollen alle bisherigen Diary-Einträge mit diesem Produkt auf die neuen Nährwerte aktualisiert werden?',
        [
          { text: 'Nur Produkt', onPress: () => handleUpdate(false) },
          { text: 'Produkt + History', onPress: () => handleUpdate(true) },
          { text: 'Abbrechen', style: 'cancel' },
        ],
      );
    } else {
      void handleCreate();
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isEdit ? 'Produkt bearbeiten' : 'Neues Produkt'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.saveText}>Speichern</Text>
              )}
            </TouchableOpacity>
          </View>

          {barcode ? (
            <View style={styles.barcodeChip}>
              <Text style={styles.barcodeText}>Barcode: {barcode}</Text>
            </View>
          ) : null}

          {error ? <ErrorBanner error={error} /> : null}

          {/* Product Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Produktinfo</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Produktname"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
                accessibilityLabel="Produktname"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Marke</Text>
              <TextInput
                style={styles.textInput}
                value={brand}
                onChangeText={setBrand}
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
                accessibilityLabel="Marke"
              />
            </View>
          </View>

          {/* Nutrition per 100g */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nährwerte pro 100 g</Text>
            <NutritionField label="Kalorien" value={calories} onChangeText={setCalories} unit="kcal" />
            <NutritionField label="Eiweiß" value={protein} onChangeText={setProtein} />
            <NutritionField label="Kohlenhydrate" value={carbs} onChangeText={setCarbs} />
            <NutritionField label="Fett" value={fat} onChangeText={setFat} />
            <NutritionField label="Ballaststoffe" value={fiber} onChangeText={setFiber} />
            <NutritionField label="Zucker" value={sugar} onChangeText={setSugar} />
            <NutritionField label="Davon ges. Fetts." value={saturatedFat} onChangeText={setSaturatedFat} />
            <NutritionField label="Salz" value={salt} onChangeText={setSalt} />
          </View>

          {/* Portion */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portionsgröße (optional)</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Bezeichnung</Text>
              <TextInput
                style={styles.textInput}
                value={portionLabel}
                onChangeText={setPortionLabel}
                placeholder="z. B. 1 Scheibe"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Portionsbezeichnung"
              />
            </View>
            <NutritionField label="Gramm" value={portionGrams} onChangeText={setPortionGrams} unit="g" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  cancelText: {
    ...typography.body1,
    color: colors.textMuted,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontSize: 17,
  },
  saveText: {
    ...typography.body1,
    color: colors.primary,
    fontWeight: '600',
  },
  barcodeChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  barcodeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
