// LabelScanReviewScreen – shows OCR + AI parsed nutrition label results for user review
// before saving as a reusable custom product.
//
// Rendered as a full-screen Modal (nested inside AddItemModal scan mode).
//
// Flow:
//   1. Scanned label data is shown with all editable fields
//   2. OCR + AI confidence and warnings displayed prominently
//   3. User can:
//      A. "Als Produkt speichern + hinzufügen" → creates ReusableItem (sourceType: 'label-scan') → diary entry
//      B. "Einmalig hinzufügen" → flat macros directly to diary
//   4. "Abbrechen" dismisses without saving

import React, { useState, useMemo } from 'react';
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
import type { NutritionLabelScanResult } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { diaryApi } from '../../shared/api/diaryApi';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  mealId: string;
  /** Vorausgefüllte Scan-Daten — fehlen bei manueller Eingabe (isManual=true) */
  scanResult?: NutritionLabelScanResult;
  /** true = manuelle Eingabe (leere Felder, kein OCR/KI-Badge, anderer Titel) */
  isManual?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.7) return { label: 'Hoch', color: colors.positive };
  if (c >= 0.4) return { label: 'Mittel', color: colors.neutral };
  return { label: 'Gering', color: colors.negative };
}

function num(s: string): number {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function LabelScanReviewScreen({ visible, mealId, scanResult, isManual = false, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const n = scanResult?.nutrition;
  const fallbackName = isManual ? '' : 'Gescanntes Produkt';

  // Editable fields — pre-filled from scan data when available, empty for manual entry
  const [name, setName] = useState(
    isManual ? '' : ([scanResult?.brand, scanResult?.productName].filter(Boolean).join(' – ') || 'Gescanntes Produkt'),
  );
  const [portionLabel, setPortionLabel] = useState(scanResult?.servingSize?.label ?? '');
  const [portionGrams, setPortionGrams] = useState(
    scanResult?.servingSize?.weightGrams != null ? String(scanResult.servingSize.weightGrams) : '',
  );
  const [calories, setCalories] = useState(String(n?.calories ?? 0));
  const [protein, setProtein] = useState(String(n?.protein ?? 0));
  const [carbs, setCarbs] = useState(String(n?.carbs ?? 0));
  const [fat, setFat] = useState(String(n?.fat ?? 0));
  const [fiber, setFiber] = useState(String(n?.fiber ?? ''));
  const [salt, setSalt] = useState(String(n?.salt ?? ''));
  const [sugar, setSugar] = useState(String(n?.sugar ?? ''));
  const [saturatedFat, setSaturatedFat] = useState(String(n?.saturatedFat ?? ''));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ocrConf = useMemo(() => scanResult ? confidenceLabel(scanResult.ocrConfidence) : null, [scanResult]);
  const aiConf = useMemo(() => scanResult ? confidenceLabel(scanResult.aiConfidence) : null, [scanResult]);

  // Save as ReusableItem + add to diary
  async function handleSaveAsProduct() {
    setSaving(true);
    setError(null);
    try {
      const result = await reusableItemsApi.create({
        name: name.trim() || (isManual ? 'Neues Produkt' : 'Gescanntes Produkt'),
        sourceType: isManual ? 'manual' : 'label-scan',
        nutritionPer100g: {
          calories: num(calories),
          protein: num(protein),
          carbs: num(carbs),
          fat: num(fat),
          ...(fiber ? { fiber: num(fiber) } : {}),
          ...(salt ? { salt: num(salt) } : {}),
        },
        portion: num(portionGrams) > 0
          ? { label: portionLabel || `${num(portionGrams)} g`, weightGrams: num(portionGrams) }
          : undefined,
      });

      // Add to diary using portion size if available, otherwise 100g
      const grams = num(portionGrams) > 0 ? num(portionGrams) : 100;
      const scale = grams / 100;
      await diaryApi.addItem(mealId, {
        productId: result.item.id,
        productName: result.item.name ?? (isManual ? 'Neues Produkt' : 'Gescanntes Produkt'),
        inputMode: 'grams',
        inputAmount: grams,
        amountGrams: grams,
        calculatedNutrition: {
          calories: Math.round(num(calories) * scale),
          protein: Math.round(num(protein) * scale * 10) / 10,
          carbs: Math.round(num(carbs) * scale * 10) / 10,
          fat: Math.round(num(fat) * scale * 10) / 10,
        },
      });

      onSaved();
    } catch (e) {
      console.error('[LabelScanReviewScreen] handleSaveAsProduct failed:', e);
      setError(formatApiError(e, 'Speichern fehlgeschlagen'));
    } finally {
      setSaving(false);
    }
  }

  // Add once without creating a reusable item
  async function handleAddOnce() {
    setSaving(true);
    setError(null);
    try {
      const grams = num(portionGrams) > 0 ? num(portionGrams) : 100;
      const scale = grams / 100;
      await diaryApi.addItem(mealId, {
        name: name.trim() || (isManual ? 'Neues Produkt' : 'Gescanntes Produkt'),
        calories: Math.round(num(calories) * scale),
        protein: Math.round(num(protein) * scale * 10) / 10,
        carbs: Math.round(num(carbs) * scale * 10) / 10,
        fat: Math.round(num(fat) * scale * 10) / 10,
        fiber: Math.round(num(fiber || '0') * scale * 10) / 10,
      });
      onSaved();
    } catch (e) {
      console.error('[LabelScanReviewScreen] handleAddOnce failed:', e);
      setError(formatApiError(e, 'Hinzufügen fehlgeschlagen'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header — respects Safe Area (notch, status bar) */}
        <View style={[styles.header, { paddingTop: Math.max(spacing.lg, insets.top) }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isManual ? '✏️ Produkt eingeben' : '📷 Scan-Ergebnis'}
          </Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        >
          {/* Confidence indicators — only for scan results */}
          {!isManual && ocrConf && aiConf && (
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceBadge}>
                <Text style={[styles.confidenceLabel, { color: ocrConf.color }]}>
                  OCR: {ocrConf.label}
                </Text>
              </View>
              <View style={styles.confidenceBadge}>
                <Text style={[styles.confidenceLabel, { color: aiConf.color }]}>
                  KI: {aiConf.label}
                </Text>
              </View>
            </View>
          )}

          {/* Warnings — only for scan results */}
          {!isManual && scanResult && scanResult.warnings.length > 0 && (
            <View style={styles.warningsBox}>
              {scanResult.warnings.map((w, i) => (
                <Text key={i} style={styles.warningText}>⚠️ {w}</Text>
              ))}
            </View>
          )}

          {/* Name */}
          <Text style={styles.fieldLabel}>Produktname</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />

          {/* Nutrition fields */}
          <Text style={styles.sectionTitle}>
            Nährwerte pro 100{!isManual && scanResult?.baseUnit === '100ml' ? 'ml' : 'g'}
          </Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Kalorien (kcal)</Text>
              <TextInput style={styles.input} value={calories} onChangeText={setCalories} keyboardType="decimal-pad" selectTextOnFocus />
            </View>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Protein (g)</Text>
              <TextInput style={styles.input} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" selectTextOnFocus />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Kohlenhydrate (g)</Text>
              <TextInput style={styles.input} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" selectTextOnFocus />
            </View>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>davon Zucker (g)</Text>
              <TextInput style={styles.input} value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" selectTextOnFocus />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Fett (g)</Text>
              <TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="decimal-pad" selectTextOnFocus />
            </View>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>davon gesättigt (g)</Text>
              <TextInput style={styles.input} value={saturatedFat} onChangeText={setSaturatedFat} keyboardType="decimal-pad" selectTextOnFocus />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Ballaststoffe (g)</Text>
              <TextInput style={styles.input} value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" selectTextOnFocus />
            </View>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Salz (g)</Text>
              <TextInput style={styles.input} value={salt} onChangeText={setSalt} keyboardType="decimal-pad" selectTextOnFocus />
            </View>
          </View>

          {/* Portion size — editable, pre-filled from scan if detected */}
          <Text style={styles.sectionTitle}>Portionsgröße</Text>
          <View style={styles.fieldRow}>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Bezeichnung (optional)</Text>
              <TextInput
                style={styles.input}
                value={portionLabel}
                onChangeText={setPortionLabel}
                placeholder="z.B. 1 Riegel"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Gewicht (g)</Text>
              <TextInput
                style={styles.input}
                value={portionGrams}
                onChangeText={setPortionGrams}
                keyboardType="decimal-pad"
                placeholder="z.B. 30"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
          {num(portionGrams) > 0 && (
            <Text style={styles.portionHint}>
              Eintrag wird für {portionGrams} g berechnet
            </Text>
          )}

          {error && <ErrorBanner error={error} />}

          {/* Action buttons */}
          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={handleSaveAsProduct}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Als Produkt speichern + hinzufügen</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, saving && styles.btnDisabled]}
            onPress={handleAddOnce}
            disabled={saving}
          >
            <Text style={styles.secondaryBtnText}>Einmalig hinzufügen</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    // paddingTop is set dynamically via insets in JSX
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: { ...typography.body1, color: colors.primary },
  headerTitle: { ...typography.h3, color: colors.text },
  scroll: { flex: 1, padding: spacing.md },
  confidenceRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  confidenceLabel: { ...typography.caption, fontWeight: '600' },
  warningsBox: {
    backgroundColor: `${colors.negative}22`,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  warningText: { ...typography.caption, color: colors.negative, marginBottom: 2 },
  sectionTitle: { ...typography.h3, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },
  input: {
    ...typography.body1,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  fieldCol: { flex: 1 },
  servingBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  servingText: { ...typography.body1, color: colors.textSecondary },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryBtnText: { ...typography.body1, color: colors.white, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  secondaryBtnText: { ...typography.body1, color: colors.primary },
  btnDisabled: { opacity: 0.5 },
  portionHint: { ...typography.caption, color: colors.primary, marginBottom: spacing.sm },
});
