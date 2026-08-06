// MealParserReviewScreen — shows AI-parsed meal items for user review before saving.
//
// Rendered as a full-screen Modal over AddItemModal.
// User reviews matched / needsSelection / unmatched items and can:
//   - Accept matched items as-is
//   - Pick from candidates for needsSelection items
//   - Search manually for unmatched items
// Save button is enabled only when all items have a resolved product.

import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NutritionCalculationError } from './nutritionUtils';
import type { AiFoodEstimatePreview, FoodSearchResult } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { isQuotaExceededError } from '../../shared/api/client';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { nutritionDiaryService as diaryApi } from '../../services/nutritionDiaryService';
import { foodApi } from '../../shared/api/foodApi';
import { aiApi } from '../../shared/api/aiApi';
import { calculateNutrition } from './nutritionUtils';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';
import FoodEstimateReviewScreen from './FoodEstimateReviewScreen';
import type { AiSavedData } from './FoodEstimateReviewScreen';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolvedItem {
  previewItem: MealParserPreviewItem;
  selectedProduct: FoodSearchResult | null;
  /** User-selected or AI-suggested input mode */
  inputMode: 'grams' | 'portion';
  /** User-entered or AI-suggested amount */
  inputAmount: number;
  /** True when the item was already individually saved via FoodEstimateReviewScreen */
  savedViaAi?: boolean;
  /** Values that were actually saved via the AI estimate flow */
  aiSavedData?: AiSavedData;
}

interface Props {
  visible: boolean;
  mealId: string;
  items: MealParserPreviewItem[];
  warnings: string[];
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Item card
// ---------------------------------------------------------------------------

interface ItemCardProps {
  resolved: ResolvedItem;
  onSelectProduct: (item: MealParserPreviewItem, product: FoodSearchResult) => void;
  onUpdateAmount: (item: MealParserPreviewItem, mode: 'grams' | 'portion', amount: number) => void;
  onRequestEstimate: (item: MealParserPreviewItem) => void;
  estimating: boolean;
  onRemove: () => void;
}

function ItemCard({ resolved, onSelectProduct, onUpdateAmount, onRequestEstimate, estimating, onRemove }: ItemCardProps) {
  const { previewItem, selectedProduct, inputMode, inputAmount } = resolved;
  const [showCandidates, setShowCandidates] = useState(previewItem.status === 'needsSelection');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Local quantity editor state — synced from parent on product change
  const hasPortions = !!selectedProduct?.portion?.weightGrams;
  const [localMode, setLocalMode] = useState<'grams' | 'portion'>(inputMode);
  const [localAmount, setLocalAmount] = useState(String(inputAmount));

  // When the selected product changes, re-evaluate the default mode/amount
  const prevProductRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const newId = selectedProduct?.id ?? null;
    if (newId !== prevProductRef.current) {
      prevProductRef.current = newId;
      if (selectedProduct) {
        // Prefer portion mode whenever the product has serving data (#3).
        const defaultMode: 'grams' | 'portion' =
          selectedProduct.portion?.weightGrams != null ? 'portion' : 'grams';
        const defaultAmount = defaultMode === 'portion' ? 1 : 100;
        setLocalMode(defaultMode);
        setLocalAmount(String(defaultAmount));
        onUpdateAmount(previewItem, defaultMode, defaultAmount);
      }
    }
  }, [selectedProduct]);

  function handleModeChange(mode: 'grams' | 'portion') {
    const newAmount = mode === 'portion' ? '1' : '100';
    setLocalMode(mode);
    setLocalAmount(newAmount);
    onUpdateAmount(previewItem, mode, Number(newAmount));
  }

  function handleAmountChange(text: string) {
    setLocalAmount(text);
    const n = Number(text);
    if (Number.isFinite(n) && n > 0) {
      onUpdateAmount(previewItem, localMode, n);
    }
  }

  const parsedAmount = Number(localAmount);
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const nutritionPreview = useMemo(() => {
    if (!selectedProduct?.nutritionPer100g || !isAmountValid) return null;
    try {
      return calculateNutrition(
        localMode,
        parsedAmount,
        selectedProduct.nutritionPer100g,
        selectedProduct.portion?.weightGrams,
      );
    } catch (e) {
      if (e instanceof NutritionCalculationError) return null;
      return null;
    }
  }, [selectedProduct, localMode, parsedAmount, isAmountValid]);

  const statusColor =
    resolved.savedViaAi
      ? colors.positive
      : selectedProduct != null
        ? colors.positive
        : previewItem.status === 'unmatched'
          ? colors.negative
          : colors.neutral;

  const statusLabel =
    resolved.savedViaAi
      ? '✨ KI-gespeichert'
      : selectedProduct != null
        ? 'Zugeordnet'
        : previewItem.status === 'matched'
          ? 'Zugeordnet'
          : previewItem.status === 'needsSelection'
            ? 'Auswahl erforderlich'
            : 'Nicht gefunden';

  async function handleSearch() {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await foodApi.search(searchQuery.trim());
      setSearchResults(res.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickProduct(p: FoodSearchResult) {
    onSelectProduct(previewItem, p);
    setShowCandidates(false);
    setSearchResults([]);
  }

  const displayedProduct = selectedProduct;
  const candidates = searchResults.length > 0 ? searchResults : previewItem.candidates;

  return (
    <View style={cardStyles.card}>
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.rawText}>„{previewItem.rawText}"</Text>
          <Text style={cardStyles.displayName}>{previewItem.displayName}</Text>
        </View>
        <View style={[cardStyles.badge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[cardStyles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={onRemove}
          style={cardStyles.removeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={cardStyles.removeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* AI-saved summary — shown instead of product/candidates when savedViaAi */}
      {resolved.savedViaAi && resolved.aiSavedData && (
        <View style={cardStyles.selected}>
          <Text style={cardStyles.selectedName}>✨ {resolved.aiSavedData.displayName}</Text>
          <View style={cardStyles.nutritionRow}>
            <Text style={cardStyles.nutritionChip}>
              {resolved.aiSavedData.quantity}{' '}
              {resolved.aiSavedData.unit}
              {resolved.aiSavedData.portionWeightGrams != null
                ? ` (${Math.round(resolved.aiSavedData.quantity * resolved.aiSavedData.portionWeightGrams)} g)`
                : ''}
              {' · '}{Math.round(resolved.aiSavedData.calories)} kcal
            </Text>
            <Text style={cardStyles.nutritionChip}>P {resolved.aiSavedData.protein.toFixed(1)} g</Text>
            <Text style={cardStyles.nutritionChip}>K {resolved.aiSavedData.carbs.toFixed(1)} g</Text>
            <Text style={cardStyles.nutritionChip}>F {resolved.aiSavedData.fat.toFixed(1)} g</Text>
          </View>
        </View>
      )}

      {/* Selected product + quantity selector */}
      {displayedProduct != null && (
        <View style={cardStyles.selected}>
          <Text style={cardStyles.selectedName}>{displayedProduct.name}</Text>
          {displayedProduct.brand && (
            <Text style={cardStyles.selectedBrand}>{displayedProduct.brand}</Text>
          )}

          {/* Gramm / Portion toggle — only when portion data exists */}
          {hasPortions && (
            <View style={cardStyles.segmentRow}>
              <TouchableOpacity
                style={[cardStyles.segment, localMode === 'grams' && cardStyles.segmentActive]}
                onPress={() => handleModeChange('grams')}
              >
                <Text style={[cardStyles.segmentText, localMode === 'grams' && cardStyles.segmentTextActive]}>
                  Gramm
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cardStyles.segment, localMode === 'portion' && cardStyles.segmentActive]}
                onPress={() => handleModeChange('portion')}
              >
                <Text style={[cardStyles.segmentText, localMode === 'portion' && cardStyles.segmentTextActive]}>
                  Portion
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Amount input */}
          <View style={cardStyles.amountRow}>
            <TextInput
              style={cardStyles.amountInput}
              value={localAmount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <Text style={cardStyles.amountUnit}>
              {localMode === 'grams' ? 'g' : 'Portion(en)'}
            </Text>
            {localMode === 'portion' && displayedProduct.portion?.weightGrams != null && (
              <Text style={cardStyles.portionHint}>
                {' '}(1 Portion = {displayedProduct.portion.weightGrams} g)
              </Text>
            )}
          </View>

          {/* Live nutrition preview */}
          {nutritionPreview && (
            <View style={cardStyles.nutritionRow}>
              <Text style={cardStyles.nutritionChip}>
                {Math.round(nutritionPreview.amountGrams)} g · {Math.round(nutritionPreview.calculatedNutrition.calories)} kcal
              </Text>
              <Text style={cardStyles.nutritionChip}>P {nutritionPreview.calculatedNutrition.protein.toFixed(1)} g</Text>
              <Text style={cardStyles.nutritionChip}>K {nutritionPreview.calculatedNutrition.carbs.toFixed(1)} g</Text>
              <Text style={cardStyles.nutritionChip}>F {nutritionPreview.calculatedNutrition.fat.toFixed(1)} g</Text>
            </View>
          )}

          <TouchableOpacity onPress={() => setShowCandidates(true)} style={cardStyles.changeBtn}>
            <Text style={cardStyles.changeBtnText}>Ändern</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Candidates / search / AI button — hidden when item was already saved via AI */}
      {(displayedProduct == null || showCandidates) && !resolved.savedViaAi && (
        <View style={cardStyles.candidates}>
          {candidates.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={cardStyles.candidateRow}
              onPress={() => pickProduct(c)}
            >
              <View style={{ flex: 1 }}>
                <Text style={cardStyles.candidateName}>{c.name}</Text>
                {c.brand && <Text style={cardStyles.candidateBrand}>{c.brand}</Text>}
              </View>
              <Text style={cardStyles.candidateLabel}>{c.displayLabel}</Text>
            </TouchableOpacity>
          ))}

          {/* Manual search */}
          <View style={cardStyles.searchRow}>
            <TextInput
              style={cardStyles.searchInput}
              placeholder="Produkt suchen…"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={cardStyles.searchBtn} onPress={handleSearch} disabled={searching}>
              {searching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={cardStyles.searchBtnText}>Suchen</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* KI-Schätzung */}
          <TouchableOpacity
            style={[cardStyles.aiEstimateBtn, estimating && cardStyles.aiEstimateBtnActive]}
            onPress={() => onRequestEstimate(previewItem)}
            disabled={estimating}
          >
            {estimating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={cardStyles.aiEstimateBtnText}>✨ KI-Schätzung verwenden</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function MealParserReviewScreen({ visible, mealId, items, warnings, onClose, onSaved }: Props) {
  const [resolved, setResolved] = useState<ResolvedItem[]>(() =>
    items.map((item) => ({
      previewItem: item,
      selectedProduct:
        item.status === 'matched' && item.selectedProductId != null
          ? (item.candidates.find((c) => c.id === item.selectedProductId) ?? null)
          : null,
      inputMode: item.inputMode === 'portion' ? 'portion' : 'grams',
      inputAmount: item.inputAmount ?? (item.inputMode === 'portion' ? 1 : 100),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- AI estimate state ---
  const [estimatingFor, setEstimatingFor] = useState<string | null>(null); // rawText of item being estimated
  const [pendingEstimate, setPendingEstimate] = useState<{
    item: MealParserPreviewItem;
    preview: AiFoodEstimatePreview;
  } | null>(null);

  // Re-initialize when items change (new preview result)
  React.useEffect(() => {
    setResolved(
      items.map((item) => ({
        previewItem: item,
        selectedProduct:
          item.status === 'matched' && item.selectedProductId != null
            ? (item.candidates.find((c) => c.id === item.selectedProductId) ?? null)
            : null,
        inputMode: item.inputMode === 'portion' ? 'portion' : 'grams',
        inputAmount: item.inputAmount ?? (item.inputMode === 'portion' ? 1 : 100),
      })),
    );
    setError(null);
  }, [items]);

  function handleSelectProduct(previewItem: MealParserPreviewItem, product: FoodSearchResult) {
    // Default to portion mode when the product carries serving data (#3).
    const defaultMode: 'grams' | 'portion' =
      product.portion?.weightGrams != null ? 'portion' : 'grams';
    const defaultAmount = defaultMode === 'portion' ? 1 : 100;
    setResolved((prev) =>
      prev.map((r) =>
        r.previewItem.rawText === previewItem.rawText
          ? { ...r, selectedProduct: product, inputMode: defaultMode, inputAmount: defaultAmount }
          : r,
      ),
    );
  }

  function handleUpdateAmount(previewItem: MealParserPreviewItem, mode: 'grams' | 'portion', amount: number) {
    setResolved((prev) =>
      prev.map((r) =>
        r.previewItem.rawText === previewItem.rawText
          ? { ...r, inputMode: mode, inputAmount: amount }
          : r,
      ),
    );
  }

  function handleRemoveItem(index: number) {
    setResolved((prev) => {
      const removed = prev[index];
      // Cancel any in-flight estimate for the item being removed.
      if (removed && estimatingFor === removed.previewItem.rawText) {
        setEstimatingFor(null);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleRequestEstimate(previewItem: MealParserPreviewItem) {
    setEstimatingFor(previewItem.rawText);
    setError(null);
    try {
      const preview = await aiApi.estimateFood({
        name: previewItem.rawText,
        contextText: previewItem.rawText,
      });
      setPendingEstimate({ item: previewItem, preview });
    } catch (e) {
      if (isQuotaExceededError(e)) {
        setError('Deine kostenlosen KI-Schätzungen für diesen Monat sind aufgebraucht. Das Kontingent wird am Monatsanfang zurückgesetzt.');
      } else {
        setError(formatApiError(e));
      }
    } finally {
      setEstimatingFor(null);
    }
  }

  // Called when user saved (or added once) from FoodEstimateReviewScreen.
  // Marks the item as already saved — does NOT close the parent modal yet,
  // so the user can still save the remaining product-resolved items.
  function handleEstimateSaved(data: AiSavedData) {
    if (!pendingEstimate) return;
    const savedRawText = pendingEstimate.item.rawText;
    setResolved((prev) =>
      prev.map((r) =>
        r.previewItem.rawText === savedRawText
          ? { ...r, savedViaAi: true, aiSavedData: data }
          : r,
      ),
    );
    setPendingEstimate(null);
    // intentionally do NOT call onSaved() — user returns to review screen
  }

  const allResolved = useMemo(
    () => resolved.length > 0 && resolved.every((r) => r.selectedProduct != null || r.savedViaAi === true),
    [resolved],
  );

  // Hide warnings that no longer apply after AI-resolve.
  // The backend generates a generic count-based warning for unmatched items.
  // We drop it once all originally-unmatched items are either AI-saved or manually resolved.
  const activeWarnings = useMemo(() => {
    const remainingUnmatched = resolved.filter(
      (r) => r.previewItem.status === 'unmatched' && !r.savedViaAi && r.selectedProduct == null,
    ).length;
    if (remainingUnmatched === 0) return [];
    return warnings;
  }, [warnings, resolved]);

  async function handleSave() {
    if (!allResolved) return;
    setSaving(true);
    setError(null);
    try {
      for (const r of resolved) {
        // Skip items already saved individually via AI estimate
        if (r.savedViaAi) continue;

        const product = r.selectedProduct!;
        const { previewItem } = r;

        // Guard: product must have nutritionPer100g to calculate macros
        if (!product.nutritionPer100g) {
          throw new Error(
            `Kein Nährwertprofil für „${product.name}" verfügbar. Bitte ein anderes Produkt auswählen.`,
          );
        }

        // Use the user-selected mode/amount (may differ from AI suggestion)
        let inputMode = r.inputMode;
        let inputAmount = r.inputAmount;

        const portionWeightGrams = product.portion?.weightGrams;

        // Fall back to grams when portion mode is requested but the product has no
        // portion weight (e.g. manually searched product without portion data).
        if (inputMode === 'portion' && portionWeightGrams == null) {
          inputMode = 'grams';
          inputAmount = 100;
        }

        const result = calculateNutrition(inputMode, inputAmount, product.nutritionPer100g, portionWeightGrams);

        await diaryApi.addItem(mealId, {
          productId: product.id,
          productName: product.name,
          inputMode,
          inputAmount,
          amountGrams: result.amountGrams,
          calculatedNutrition: result.calculatedNutrition,
        });
      }
      onSaved();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.title}>KI-Vorschlag prüfen</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Global warnings — only for still-unresolved items */}
          {activeWarnings.map((w, i) => (
            <View key={i} style={styles.warningBanner}>
              <Text style={styles.warningText}>⚠ {w}</Text>
            </View>
          ))}

          {/* Item cards */}
          {resolved.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Alle Einträge entfernt.</Text>
              <Text style={styles.emptyStateSubtext}>Schließe diesen Dialog, um fortzufahren.</Text>
            </View>
          ) : (
            resolved.map((r, i) => (
              <ItemCard
                key={i}
                resolved={r}
                onSelectProduct={handleSelectProduct}
                onUpdateAmount={handleUpdateAmount}
                onRequestEstimate={handleRequestEstimate}
                estimating={estimatingFor === r.previewItem.rawText}
                onRemove={() => handleRemoveItem(i)}
              />
            ))
          )}

          {/* Error */}
          {error && <ErrorBanner error={error} />}

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, (!allResolved || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!allResolved || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>
                {allResolved ? 'Alle speichern' : 'Alle Einträge auflösen'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: spacing.lg * 2 }} />
        </ScrollView>
      </View>

      {/* Nested FoodEstimateReviewScreen for AI estimate flow */}
      {pendingEstimate && (
        <FoodEstimateReviewScreen
          visible={true}
          mealId={mealId}
          estimate={pendingEstimate.preview}
          onClose={() => setPendingEstimate(null)}
          onSaved={handleEstimateSaved}
        />
      )}
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
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h3, color: colors.text },
  cancelBtn: { width: 80 },
  cancelBtnText: { ...typography.body1, color: colors.textSecondary },
  body: { padding: spacing.md, gap: spacing.md },
  warningBanner: {
    backgroundColor: `${colors.negative}22`,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  warningText: { ...typography.caption, color: colors.negative },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { ...typography.body1, color: colors.white, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  emptyStateText: { ...typography.body1, color: colors.text },
  emptyStateSubtext: { ...typography.caption, color: colors.textMuted },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rawText: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  displayName: { ...typography.body1, color: colors.text, fontWeight: '600' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { ...typography.caption, fontWeight: '600' },
  selected: { gap: spacing.xs },
  selectedName: { ...typography.body1, color: colors.text },
  selectedBrand: { ...typography.caption, color: colors.textMuted },
  selectedLabel: { ...typography.caption, color: colors.textSecondary },
  // Gramm / Portion segmented control
  segmentRow: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textSecondary },
  segmentTextActive: { color: colors.white, fontWeight: '700' },
  // Amount input row
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  amountInput: {
    width: 72,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    ...typography.body1,
    textAlign: 'right',
  },
  amountUnit: { ...typography.body1, color: colors.textSecondary },
  portionHint: { ...typography.caption, color: colors.textMuted },
  // Nutrition preview row
  nutritionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  nutritionChip: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  changeBtn: { marginTop: spacing.xs },
  changeBtnText: { ...typography.caption, color: colors.primary },
  candidates: { gap: spacing.xs },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  candidateName: { ...typography.body1, color: colors.text },
  candidateBrand: { ...typography.caption, color: colors.textMuted },
  candidateLabel: { ...typography.caption, color: colors.textSecondary },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    ...typography.body1,
  },
  searchBtn: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: { ...typography.body1, color: colors.primary },
  aiEstimateBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  aiEstimateBtnActive: { opacity: 0.5 },
  aiEstimateBtnText: { ...typography.caption, color: colors.primary },
  removeBtn: { padding: 2, marginLeft: spacing.xs },
  removeBtnText: { ...typography.body1, color: colors.textMuted },
});
