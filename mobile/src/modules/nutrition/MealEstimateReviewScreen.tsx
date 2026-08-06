// MealEstimateReviewScreen — Fast Path: shows AI whole-meal estimate for review before saving.
//
// Props flow:
//   AddItemModal estimates meal via AI → renders this screen.
//   User either:
//     A. "Mahlzeit speichern" → single diary entry with sourceType 'ai-meal-estimate'
//     B. "Schätzung verfeinern" → triggers previewMeal → transitions to MealParserReviewScreen

import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
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
import type { AiMealEstimatePreview } from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { nutritionDiaryService as diaryApi } from '../../services/nutritionDiaryService';
import { aiApi } from '../../shared/api/aiApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  mealId: string;
  originalText: string;
  estimate: AiMealEstimatePreview;
  imageUri?: string;
  onClose: () => void;
  onSaved: () => void;
  /** Called when user wants the Precision Path — receives parsed items from previewMeal. */
  onRefine: (items: MealParserPreviewItem[]) => void;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Calories should roughly match protein*4 + carbs*4 + fat*9.
 * Tolerance: ±10% of computed calories or ±50 kcal flat (whichever is larger).
 * We base the percentage on the *computed* value so the tolerance doesn't grow
 * when the user increases the calorie input.
 */
function isMacroMismatch(
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): boolean {
  if (!Number.isFinite(calories) || calories <= 0) return false;
  const computed = protein * 4 + carbs * 4 + fat * 9;
  if (computed <= 0) return false;
  const tolerance = Math.max(50, computed * 0.1);
  return Math.abs(calories - computed) > tolerance;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfidenceBanner({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const map: Record<'high' | 'medium' | 'low', { label: string; bg: string; text: string }> = {
    high: { label: 'Hohe Sicherheit', bg: colors.primarySoft, text: colors.primary },
    medium: { label: 'Mittlere Sicherheit', bg: 'rgba(200, 160, 50, 0.18)', text: '#C8A032' },
    low: { label: 'Geringe Sicherheit', bg: 'rgba(226, 107, 107, 0.18)', text: colors.negative },
  };
  const { label, bg, text } = map[confidence];
  return (
    <View style={[styles.confidenceBanner, { backgroundColor: bg }]}>
      <Text style={[styles.confidenceBannerText, { color: text }]}>⚠ {label}</Text>
    </View>
  );
}

interface EditableTileProps {
  label: string;
  value: string;
  unit: string;
  onChangeText: (v: string) => void;
  highlight?: boolean; // primary tile (Kalorien)
}

function EditableTile({ label, value, unit, onChangeText, highlight }: EditableTileProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.tile,
        focused && styles.tileFocused,
        highlight && styles.tileHighlight,
      ]}
    >
      <Text style={styles.tileLabel}>{label}</Text>
      <View style={styles.tileInputRow}>
        <TextInput
          style={[styles.tileInput, highlight && styles.tileInputHighlight]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          selectTextOnFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={6}
        />
        <Text style={styles.tileUnit}>{unit}</Text>
      </View>
    </View>
  );
}

interface MacroWarningProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function MacroWarning({ calories, protein, carbs, fat }: MacroWarningProps) {
  const [expanded, setExpanded] = useState(false);
  const mismatch = isMacroMismatch(calories, protein, carbs, fat);
  if (!mismatch) return null;

  const computed = Math.round(protein * 4 + carbs * 4 + fat * 9);

  return (
    <TouchableOpacity
      style={styles.warningBadge}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.75}
    >
      <View style={styles.warningBadgeRow}>
        <Text style={styles.warningIcon}>⚠</Text>
        <Text style={styles.warningBadgeText}>Nährwerte inkonsistent</Text>
        <Text style={styles.warningChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded ? (
        <Text style={styles.warningDetail}>
          Die geänderten Nährwerte passen nicht zu den Makronährstoffen.{'\n'}
          Aus Protein, Kohlenhydraten und Fett errechnen sich{' '}
          <Text style={{ fontWeight: '700' }}>{computed} kcal</Text> – du hast{' '}
          <Text style={{ fontWeight: '700' }}>{Math.round(calories)} kcal</Text> eingetragen.
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function MealEstimateReviewScreen({
  visible,
  mealId,
  originalText,
  estimate,
  imageUri,
  onClose,
  onSaved,
  onRefine,
}: Props) {
  // Editable nutrition state — initialised from AI estimate
  const [calories, setCalories] = useState(String(Math.round(estimate.mealEstimate.calories)));
  const [protein, setProtein] = useState(String(Math.round(estimate.mealEstimate.protein)));
  const [carbs, setCarbs] = useState(String(Math.round(estimate.mealEstimate.carbs)));
  const [fat, setFat] = useState(String(Math.round(estimate.mealEstimate.fat)));
  const [fiber, setFiber] = useState(String(Math.round(estimate.mealEstimate.fiber ?? 0)));

  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assumptionsExpanded, setAssumptionsExpanded] = useState(false);

  // Parsed values
  const pCalories = Number(calories);
  const pProtein = Number(protein);
  const pCarbs = Number(carbs);
  const pFat = Number(fat);
  const pFiber = Number(fiber);

  const isValid = useMemo(() => {
    const nums = [pCalories, pProtein, pCarbs, pFat, pFiber];
    return nums.every((n) => Number.isFinite(n) && n >= 0) && pCalories > 0;
  }, [pCalories, pProtein, pCarbs, pFat, pFiber]);

  async function handleSave() {
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      await diaryApi.addItem(mealId, {
        productName: estimate.mealName,
        inputMode: 'grams',
        inputAmount: 100,
        amountGrams: 100,
        calculatedNutrition: {
          calories: pCalories,
          protein: pProtein,
          carbs: pCarbs,
          fat: pFat,
          fiber: pFiber,
        },
        unit: 'Portion',
        sourceType: 'ai-meal-estimate',
        isAiEstimate: true,
        aiMealEstimateComponents: estimate.components,
        aiMealEstimateContext: estimate.contextDetected ?? undefined,
        aiMealEstimateConfidence: estimate.portionConfidence,
        aiMealEstimateAssumptions: estimate.assumptions,
        aiMealEstimatePhotoUsed: estimate.photoUsed,
      });
      onSaved();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleRefine() {
    Keyboard.dismiss();
    setRefining(true);
    setError(null);
    try {
      // Use the already-identified components (e.g. "Schnitzel, Brötchen, Curry Creme")
      // instead of the original free text to avoid re-detecting context words as food items.
      const componentsText =
        estimate.components.length > 0 ? estimate.components.join(', ') : originalText;
      const result = await aiApi.previewMeal(componentsText, estimate.contextDetected ?? undefined);
      onRefine(result.items);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setRefining(false);
    }
  }

  const busy = saving || refining;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn} disabled={busy}>
            <Text style={[styles.cancelBtnText, busy && styles.textDisabled]}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>KI-Mahlzeitschätzung</Text>
          <View style={styles.cancelBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo thumbnail */}
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
          ) : null}

          {/* AI disclaimer */}
          <View style={styles.disclaimerRow}>
            <Text style={styles.disclaimerText}>
              KI-Schätzung · Werte können abweichen
            </Text>
            {estimate.photoUsed ? (
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>📷 Foto genutzt</Text>
              </View>
            ) : null}
          </View>

          {/* Meal name */}
          <Text style={styles.mealName}>{estimate.mealName}</Text>

          {/* Context badge */}
          {estimate.contextDetected ? (
            <View style={styles.contextBadge}>
              <Text style={styles.contextBadgeText}>📍 {estimate.contextDetected}</Text>
            </View>
          ) : null}

          {/* Confidence banner */}
          <ConfidenceBanner confidence={estimate.portionConfidence} />

          {/* Section header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Nährwerte (gesamt)</Text>
            <Text style={styles.editHint}>Tipp zum Bearbeiten</Text>
          </View>

          {/* Editable nutrition tiles */}
          <View style={styles.tilesGrid}>
            {/* Calories — full-width highlight tile */}
            <EditableTile
              label="Kalorien"
              value={calories}
              unit="kcal"
              onChangeText={setCalories}
              highlight
            />
            <View style={styles.tilesRow}>
              <EditableTile label="Protein" value={protein} unit="g" onChangeText={setProtein} />
              <EditableTile label="Kohlenhydrate" value={carbs} unit="g" onChangeText={setCarbs} />
            </View>
            <View style={styles.tilesRow}>
              <EditableTile label="Fett" value={fat} unit="g" onChangeText={setFat} />
              <EditableTile label="Ballaststoffe" value={fiber} unit="g" onChangeText={setFiber} />
            </View>
          </View>

          {/* Macro validation warning */}
          <MacroWarning calories={pCalories} protein={pProtein} carbs={pCarbs} fat={pFat} />

          {/* Components */}
          {estimate.components.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Erkannte Bestandteile</Text>
              <View style={styles.chipsRow}>
                {estimate.components.map((comp) => (
                  <View key={comp} style={styles.chip}>
                    <Text style={styles.chipText}>✓ {comp}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Assumptions (collapsible) */}
          {estimate.assumptions.length > 0 ? (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.assumptionsToggle}
                onPress={() => setAssumptionsExpanded((v) => !v)}
              >
                <Text style={styles.assumptionsToggleText}>
                  {assumptionsExpanded ? '▲' : '▼'} Annahmen ({estimate.assumptions.length})
                </Text>
              </TouchableOpacity>
              {assumptionsExpanded
                ? estimate.assumptions.map((a, i) => (
                    <Text key={i} style={styles.assumptionItem}>
                      • {a}
                    </Text>
                  ))
                : null}
            </View>
          ) : null}

          {/* API warnings from AI */}
          {estimate.warnings.length > 0 ? (
            <View style={styles.section}>
              {estimate.warnings.map((w, i) => (
                <Text key={i} style={styles.aiWarning}>
                  ⚠ {w}
                </Text>
              ))}
            </View>
          ) : null}

          {error ? <ErrorBanner error={error} /> : null}
        </ScrollView>

        {/* Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, (busy || !isValid) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={busy || !isValid}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryBtnText}>Mahlzeit speichern</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, busy && styles.btnDisabled]}
            onPress={handleRefine}
            disabled={busy}
          >
            {refining ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryBtnText}>Schätzung aufschlüsseln</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: {
    minWidth: 80,
  },
  cancelBtnText: {
    ...typography.body1,
    color: colors.textSecondary,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  textDisabled: {
    color: colors.textDisabled,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  photoBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  photoBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  mealName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  contextBadge: {
    backgroundColor: colors.surfaceMuted,
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  contextBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  confidenceBanner: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  confidenceBannerText: {
    ...typography.caption,
    fontWeight: '600',
  },

  // --- Nutrition section ---
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  editHint: {
    ...typography.caption,
    color: colors.textDisabled,
    fontStyle: 'italic',
  },
  tilesGrid: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  // Tile base
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileFocused: {
    borderColor: colors.primary,
  },
  tileHighlight: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  tileLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  tileInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tileInput: {
    ...typography.h3,
    color: colors.text,
    padding: 0,
    minWidth: 48,
  },
  tileInputHighlight: {
    ...typography.h2,
    color: colors.primary,
  },
  tileUnit: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // --- Macro warning badge ---
  warningBadge: {
    backgroundColor: 'rgba(200, 160, 50, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200, 160, 50, 0.4)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  warningBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  warningIcon: {
    fontSize: 16,
    color: '#C8A032',
  },
  warningBadgeText: {
    ...typography.caption,
    color: '#C8A032',
    fontWeight: '700',
    flex: 1,
  },
  warningChevron: {
    ...typography.caption,
    color: '#C8A032',
  },
  warningDetail: {
    ...typography.caption,
    color: '#C8A032',
    marginTop: spacing.sm,
    lineHeight: 18,
  },

  // --- Rest ---
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  assumptionsToggle: {
    paddingVertical: spacing.xs,
  },
  assumptionsToggleText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  assumptionItem: {
    ...typography.body2,
    color: colors.textMuted,
    marginTop: spacing.xs,
    paddingLeft: spacing.sm,
  },
  aiWarning: {
    ...typography.body2,
    color: '#C8A032',
    marginBottom: spacing.xs,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    ...typography.button,
    color: colors.background,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...typography.button,
    color: colors.primary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

