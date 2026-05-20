// FoodEstimateReviewScreen — shows an AI-estimated nutrition profile for user review and editing
// before optionally saving it as a reusable custom product.
//
// Rendered as a full-screen Modal (nested inside MealParserReviewScreen or AddItemModal).
//
// Flow:
//   1. AI estimate is shown with all editable fields
//   2. Confidence + warnings are displayed prominently — AI is never presented as exact
//   3. User can:
//      A. "Als Produkt speichern + hinzufügen" → creates ReusableItem (sourceType: 'ai') → diary entry
//      B. "Einmalig hinzufügen" → flat macros directly to diary, no ReusableItem created
//   4. "Abbrechen" dismisses without saving

import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
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
import type { AiFoodEstimatePreview } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { diaryApi } from '../../shared/api/diaryApi';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';
import { aiApi } from '../../shared/api/aiApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Data about what was actually saved — passed back to the caller via onSaved. */
export interface AiSavedData {
  displayName: string;
  quantity: number;
  unit: 'g' | 'portion';
  portionWeightGrams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  visible: boolean;
  mealId: string;
  estimate: AiFoodEstimatePreview;
  onClose: () => void;
  onSaved: (data: AiSavedData) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.7) return { label: 'Hoch', color: colors.positive };
  if (c >= 0.4) return { label: 'Mittel', color: colors.neutral };
  return { label: 'Gering', color: colors.negative };
}



// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function FoodEstimateReviewScreen({ visible, mealId, estimate, onClose, onSaved }: Props) {
  // Editable fields — initialized from AI estimate
  const [name, setName] = useState(estimate.sourceProduct ?? estimate.displayName);
  const [calories, setCalories] = useState(String(estimate.estimatedNutritionPer100g.calories));
  const [protein, setProtein] = useState(String(estimate.estimatedNutritionPer100g.protein));
  const [carbs, setCarbs] = useState(String(estimate.estimatedNutritionPer100g.carbs));
  const [fat, setFat] = useState(String(estimate.estimatedNutritionPer100g.fat));
  const [fiber, setFiber] = useState(
    estimate.estimatedNutritionPer100g.fiber != null
      ? String(estimate.estimatedNutritionPer100g.fiber)
      : '',
  );
  const [portionLabel, setPortionLabel] = useState(estimate.estimatedPortion?.label ?? '');
  const [portionGrams, setPortionGrams] = useState(
    estimate.estimatedPortion != null ? String(estimate.estimatedPortion.weightGrams) : '',
  );

  // Derived: is a valid portion currently defined?
  const parsedPortionGrams = Number(portionGrams);
  const hasPortion =
    portionGrams.trim() !== '' && Number.isFinite(parsedPortionGrams) && parsedPortionGrams > 0;

  // Amount mode: 'portion' by default when estimate includes a portion, else 'grams'
  const [amountMode, setAmountMode] = useState<'grams' | 'portion'>(
    estimate.estimatedPortion != null ? 'portion' : 'grams',
  );
  const [amount, setAmount] = useState(
    estimate.estimatedPortion != null
      ? String(estimate.estimatedPortion.suggestedAmount ?? 1)
      : '100',
  );

  // If user removes portion info, fall back to grams mode automatically
  React.useEffect(() => {
    if (!hasPortion && amountMode === 'portion') {
      setAmountMode('grams');
      setAmount('100');
    }
  }, [hasPortion]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reEstimating, setReEstimating] = useState(false);
  const [sourceProduct, setSourceProduct] = useState<string | null>(estimate.sourceProduct ?? null);
  const [currentConfidence, setCurrentConfidence] = useState(estimate.confidence);
  const [searchTerms, setSearchTerms] = useState<string[]>(estimate.searchTerms ?? []);

  const conf = confidenceLabel(currentConfidence);

  // Parsed numeric values
  const parsedCalories = Number(calories);
  const parsedProtein = Number(protein);
  const parsedCarbs = Number(carbs);
  const parsedFat = Number(fat);
  const parsedFiber = fiber !== '' ? Number(fiber) : undefined;
  const parsedAmount = Number(amount);

  const isValid = useMemo(() => {
    const nums = [parsedCalories, parsedProtein, parsedCarbs, parsedFat, parsedAmount];
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return false;
    if (parsedAmount <= 0) return false;
    if (amountMode === 'portion' && !hasPortion) return false;
    if (name.trim().length === 0) return false;
    return true;
  }, [name, parsedCalories, parsedProtein, parsedCarbs, parsedFat, parsedAmount, amountMode, hasPortion]);

  /** Returns the effective amount in grams for the chosen mode. */
  function getAmountGrams(): number {
    if (amountMode === 'portion' && hasPortion) return parsedAmount * parsedPortionGrams;
    return parsedAmount;
  }

  function buildNutritionPer100g() {
    return {
      calories: parsedCalories,
      protein: parsedProtein,
      carbs: parsedCarbs,
      fat: parsedFat,
      ...(parsedFiber != null && Number.isFinite(parsedFiber) && { fiber: parsedFiber }),
    };
  }

  function buildFlatMacrosForAmount() {
    const factor = getAmountGrams() / 100;
    const r = (v: number) => Math.round(v * factor * 10) / 10;
    return {
      calories: r(parsedCalories),
      protein: r(parsedProtein),
      carbs: r(parsedCarbs),
      fat: r(parsedFat),
      fiber: parsedFiber != null ? r(parsedFiber) : 0,
    };
  }

  // --- Re-estimate with edited name ---
  async function handleReEstimate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setReEstimating(true);
    setError(null);
    try {
      const fresh = await aiApi.estimateFood({ name: trimmed, contextText: trimmed });
      setCalories(String(fresh.estimatedNutritionPer100g.calories));
      setProtein(String(fresh.estimatedNutritionPer100g.protein));
      setCarbs(String(fresh.estimatedNutritionPer100g.carbs));
      setFat(String(fresh.estimatedNutritionPer100g.fat));
      setFiber(fresh.estimatedNutritionPer100g.fiber != null ? String(fresh.estimatedNutritionPer100g.fiber) : '');
      setPortionLabel(fresh.estimatedPortion?.label ?? '');
      setPortionGrams(fresh.estimatedPortion != null ? String(fresh.estimatedPortion.weightGrams) : '');
      setAmountMode(fresh.estimatedPortion != null ? 'portion' : 'grams');
      setAmount(
        fresh.estimatedPortion != null
          ? String(fresh.estimatedPortion.suggestedAmount ?? 1)
          : '100',
      );
      setSourceProduct(fresh.sourceProduct ?? null);
      setCurrentConfidence(fresh.confidence);
      if (fresh.sourceProduct) setName(fresh.sourceProduct);
      setSearchTerms(fresh.searchTerms ?? []);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setReEstimating(false);
    }
  }

  // --- Save as reusable product + add to diary ---
  async function handleSaveAsProduct() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const portion =
        portionLabel.trim() && portionGrams && Number(portionGrams) > 0
          ? { label: portionLabel.trim(), weightGrams: Number(portionGrams) }
          : undefined;

      const { item } = await reusableItemsApi.create({
        sourceType: 'ai',
        name: name.trim(),
        nutritionPer100g: buildNutritionPer100g(),
        portion,
        aiConfidence: estimate.confidence,
        aiWarnings: estimate.warnings.length > 0 ? estimate.warnings : undefined,
        searchTerms: searchTerms.length > 0 ? searchTerms : undefined,
      });

      // Add to diary using the newly created product's id
      const macros = buildFlatMacrosForAmount();
      const actualGrams = getAmountGrams();
      await diaryApi.addItem(mealId, {
        productId: item.id,
        productName: item.name,
        inputMode: amountMode === 'portion' ? 'portion' : 'grams',
        inputAmount: parsedAmount,
        amountGrams: actualGrams,
        calculatedNutrition: macros,
        isAiEstimate: true,
      });

      onSaved({
        displayName: name.trim(),
        quantity: parsedAmount,
        unit: amountMode === 'portion' ? 'portion' : 'g',
        portionWeightGrams: hasPortion ? parsedPortionGrams : undefined,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  // --- Add once (flat macros, no product saved) ---
  async function handleAddOnce() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const macros = buildFlatMacrosForAmount();
      await diaryApi.addItem(mealId, {
        name: name.trim(),
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        quantity: parsedAmount,
        unit: amountMode === 'portion' ? 'portion' : 'g',
        isAiEstimate: true,
      });
      onSaved({
        displayName: name.trim(),
        quantity: parsedAmount,
        unit: amountMode === 'portion' ? 'portion' : 'g',
        portionWeightGrams: hasPortion ? parsedPortionGrams : undefined,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  // Nutrition table row definitions
  const nutritionRows = [
    { key: 'calories', label: 'Kalorien', unit: 'kcal', value: calories, onChange: setCalories, parsed: parsedCalories },
    { key: 'protein',  label: 'Protein',  unit: 'g',    value: protein,  onChange: setProtein,  parsed: parsedProtein  },
    { key: 'carbs',    label: 'Kohlenhydrate', unit: 'g', value: carbs,  onChange: setCarbs,    parsed: parsedCarbs    },
    { key: 'fat',      label: 'Fett',     unit: 'g',    value: fat,      onChange: setFat,      parsed: parsedFat      },
    { key: 'fiber',    label: 'Ballaststoffe', unit: 'g', value: fiber,  onChange: setFiber,    parsed: parsedFiber ?? 0 },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.title}>✨ KI-Schätzung</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

          {/* Confidence banner */}
          <View style={[styles.confidenceBanner, { borderColor: conf.color }]}>
            <Text style={styles.confidenceLabel}>
              KI-Konfidenz:{' '}
              <Text style={[styles.confidenceValue, { color: conf.color }]}>
                {conf.label} ({Math.round(currentConfidence * 100)} %)
              </Text>
            </Text>
            {sourceProduct != null && (
              <Text style={styles.sourceProductText}>Referenzprodukt: {sourceProduct}</Text>
            )}
            <Text style={styles.confidenceHint}>
              Diese Werte sind KI-Schätzungen — kein Ersatz für Produktangaben.
            </Text>
          </View>

          {/* Warnings */}
          {estimate.warnings.map((w, i) => (
            <View key={i} style={styles.warningRow}>
              <Text style={styles.warningText}>⚠ {w}</Text>
            </View>
          ))}

          {/* Name + re-estimate */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Produktname</Text>
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.nameInput, { flex: 1 }]}
                value={name}
                onChangeText={setName}
                placeholder="Name des Lebensmittels"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.reEstimateBtn, (reEstimating || saving) && styles.btnDisabled]}
                onPress={handleReEstimate}
                disabled={reEstimating || saving || name.trim().length === 0}
              >
                {reEstimating
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.reEstimateBtnText}>✨ Neu</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Nutrition table — per 100g (editable) | per portion (auto-calculated) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nährwerte</Text>

            {/* Column headers */}
            <View style={tableStyles.row}>
              <View style={tableStyles.labelCol} />
              <View style={tableStyles.valueCol}>
                <Text style={tableStyles.headerText}>je 100 g</Text>
              </View>
              {hasPortion && (
                <View style={tableStyles.valueCol}>
                  <Text style={tableStyles.headerText}>je Portion</Text>
                  <Text style={tableStyles.portionGramsHint}>({Math.round(parsedPortionGrams)} g)</Text>
                </View>
              )}
            </View>
            <View style={tableStyles.divider} />

            {/* Data rows */}
            {nutritionRows.map((row, idx) => {
              const portionVal =
                hasPortion && Number.isFinite(row.parsed)
                  ? Math.round((row.parsed * parsedPortionGrams) / 100 * 10) / 10
                  : null;
              return (
                <View key={row.key}>
                  <View style={tableStyles.row}>
                    <View style={tableStyles.labelCol}>
                      <Text style={tableStyles.labelText}>{row.label}</Text>
                      <Text style={tableStyles.unitMuted}>{row.unit}</Text>
                    </View>
                    <View style={tableStyles.valueCol}>
                      <TextInput
                        style={tableStyles.cellInput}
                        value={row.value}
                        onChangeText={row.onChange}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                      />
                    </View>
                    {hasPortion && (
                      <View style={tableStyles.valueCol}>
                        <Text style={tableStyles.portionValue}>
                          {portionVal != null ? String(portionVal) : '—'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {idx < nutritionRows.length - 1 && <View style={tableStyles.rowDivider} />}
                </View>
              );
            })}
          </View>

          {/* Portion definition (optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portionsgröße (optional)</Text>
            <View style={portionStyles.row}>
              <Text style={portionStyles.label}>Bezeichnung</Text>
              <TextInput
                style={[portionStyles.input, { flex: 1 }]}
                value={portionLabel}
                onChangeText={setPortionLabel}
                placeholder="z.B. 1 Scheibe"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={portionStyles.row}>
              <Text style={portionStyles.label}>Gewicht</Text>
              <View style={portionStyles.inputWrap}>
                <TextInput
                  style={portionStyles.input}
                  value={portionGrams}
                  onChangeText={setPortionGrams}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <Text style={portionStyles.unit}>g</Text>
              </View>
            </View>
          </View>

          {/* Amount to log */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Menge speichern</Text>

            {/* Gramm / Portion toggle — only when a valid portion is defined */}
            {hasPortion && (
              <View style={amountStyles.segmentRow}>
                <TouchableOpacity
                  style={[amountStyles.segment, amountMode === 'grams' && amountStyles.segmentActive]}
                  onPress={() => { setAmountMode('grams'); setAmount('100'); }}
                >
                  <Text style={[amountStyles.segmentText, amountMode === 'grams' && amountStyles.segmentTextActive]}>
                    Gramm
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[amountStyles.segment, amountMode === 'portion' && amountStyles.segmentActive]}
                  onPress={() => { setAmountMode('portion'); setAmount('1'); }}
                >
                  <Text style={[amountStyles.segmentText, amountMode === 'portion' && amountStyles.segmentTextActive]}>
                    Portion
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={amountStyles.inputRow}>
              <TextInput
                style={amountStyles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Text style={amountStyles.unit}>
                {amountMode === 'portion' ? 'Portion(en)' : 'g'}
              </Text>
              {amountMode === 'portion' && hasPortion && Number.isFinite(parsedAmount) && parsedAmount > 0 && (
                <Text style={amountStyles.hint}>= {Math.round(parsedAmount * parsedPortionGrams)} g</Text>
              )}
            </View>
          </View>

          {/* Error */}
          {error && <ErrorBanner error={error} />}

          {/* Actions */}
          <TouchableOpacity
            style={[styles.primaryBtn, (!isValid || saving) && styles.btnDisabled]}
            onPress={handleSaveAsProduct}
            disabled={!isValid || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Als Produkt speichern + hinzufügen</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, (!isValid || saving) && styles.btnDisabled]}
            onPress={handleAddOnce}
            disabled={!isValid || saving}
          >
            <Text style={styles.secondaryBtnText}>Einmalig hinzufügen</Text>
          </TouchableOpacity>

          <View style={{ height: spacing.lg * 2 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h3, color: colors.text },
  cancelBtn: { width: 80 },
  cancelBtnText: { ...typography.body, color: colors.textSecondary },
  body: { padding: spacing.md, gap: spacing.md },
  confidenceBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  confidenceLabel: { ...typography.body, color: colors.text },
  confidenceValue: { fontWeight: '700' },
  confidenceHint: { ...typography.caption, color: colors.textMuted },
  sourceProductText: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  warningRow: {
    backgroundColor: `${colors.negative}18`,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  warningText: { ...typography.caption, color: colors.negative },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.caption, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  reEstimateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minWidth: 60,
    justifyContent: 'center',
  },
  reEstimateBtnText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { ...typography.body, color: colors.white, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: { ...typography.body, color: colors.textSecondary },
  btnDisabled: { opacity: 0.4 },
});

const fieldStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { ...typography.body, color: colors.textSecondary, flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  input: {
    width: 80,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    ...typography.body,
    textAlign: 'right',
  },
  unit: { ...typography.caption, color: colors.textMuted, width: 36 },
});

// ---------------------------------------------------------------------------
// Table styles (nutrition per-100g / per-portion)
// ---------------------------------------------------------------------------

const tableStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.xs },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  labelCol: { flex: 2 },
  valueCol: { flex: 1.5, alignItems: 'flex-end' },
  headerText: { ...typography.caption, color: colors.textMuted, fontWeight: '700', textAlign: 'right' },
  portionGramsHint: { fontSize: 10, color: colors.textMuted, textAlign: 'right' },
  labelText: { ...typography.body, color: colors.text },
  unitMuted: { ...typography.caption, color: colors.textMuted },
  cellInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    ...typography.body,
    textAlign: 'right',
    minWidth: 72,
  },
  portionValue: { ...typography.body, color: colors.textSecondary, textAlign: 'right' },
});

// ---------------------------------------------------------------------------
// Portion section styles
// ---------------------------------------------------------------------------

const portionStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...typography.body, color: colors.textSecondary, flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  input: {
    width: 80,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    ...typography.body,
    textAlign: 'right',
  },
  unit: { ...typography.caption, color: colors.textMuted, width: 36 },
});

// ---------------------------------------------------------------------------
// Amount section styles
// ---------------------------------------------------------------------------

const amountStyles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: 2,
    alignSelf: 'flex-start',
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { ...typography.caption, color: colors.textMuted },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    width: 80,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    ...typography.body,
    textAlign: 'right',
  },
  unit: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted },
});

