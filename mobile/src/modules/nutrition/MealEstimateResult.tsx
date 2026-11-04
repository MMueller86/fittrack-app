import React, { useEffect, useRef, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import type {
  AiMealEstimateComponent,
  AiMealEstimateNutrition,
  AiMealEstimatePreview,
  AiMealEstimateRefine,
} from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';
import type { AddItemProductInput } from '../../shared/api/diaryApi';
import { aiApi } from '../../shared/api/aiApi';
import { formatApiError } from '../../shared/api/apiError';
import { isQuotaExceededError } from '../../shared/api/client';
import { colors, radius, spacing, typography } from '../../app/theme';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { Icon } from '../../shared/components/Icon';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import { nutritionDiaryService as diaryApi } from '../../services/nutritionDiaryService';
import MealEstimateRefineSheet from './MealEstimateRefineSheet';
import { applyMealEstimateAdjustments, type MealEstimateMacro } from './mealEstimateAdjust';

interface Props {
  visible: boolean;
  estimate: AiMealEstimatePreview;
  originalText: string;
  imageUri?: string;
  imageMimeType?: 'image/jpeg' | 'image/png';
  mealId?: string;
  resolveMealId?: () => Promise<string>;
  onClose: () => void;
  onSaved: () => void;
  onRefine?: (items: MealParserPreviewItem[]) => void | Promise<void>;
}

type CompleteAiMealEstimate = AiMealEstimatePreview & Required<Pick<
  AiMealEstimatePreview,
  'componentItems' | 'estimatedTotalGrams' | 'promptVersion'
>>;

const MACROS: { key: MealEstimateMacro; label: string }[] = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Kohlenhydrate' },
  { key: 'fat', label: 'Fett' },
  { key: 'fiber', label: 'Ballaststoffe' },
];

const PHOTO_MISMATCH_WARNING = 'Beschreibung und Foto scheinen nicht zusammenzupassen. Die Schätzung basiert nur auf deiner Beschreibung. Prüfe bitte, ob du das richtige Foto ausgewählt hast.';
const PHOTO_UNCERTAIN_WARNING = 'Das Foto ließ sich nicht sicher zuordnen und wurde für die Schätzung nicht verwendet. Bitte prüfe, ob es zur Beschreibung passt.';

function formatValue(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

function getPhotoUseNotice(estimate: AiMealEstimatePreview): string | undefined {
  if (estimate.photoUse === 'excluded_mismatch') {
    return PHOTO_MISMATCH_WARNING;
  }
  if (estimate.photoUse === 'excluded_uncertain') {
    return PHOTO_UNCERTAIN_WARNING;
  }
  if (estimate.photoUse === 'included') {
    if (estimate.photoAssessment === 'complementary') {
      return 'Das Foto ergänzt die Beschreibung und wurde für die Nährwertschätzung genutzt.';
    }
    if (estimate.photoAssessment === 'consistent') {
      return 'Das Foto passt zur Beschreibung und wurde für die Nährwertschätzung genutzt.';
    }
    return 'Das Foto wurde für die Nährwertschätzung genutzt.';
  }
  if (estimate.photoUse === 'no_photo' || estimate.photoProvided === false) {
    return 'Kein Foto übermittelt. Die Nährwertschätzung basiert auf deiner Beschreibung.';
  }
  return undefined;
}

function parseValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function validStructuredItems(items: AiMealEstimateComponent[] | undefined): items is AiMealEstimateComponent[] {
  return items !== undefined
    && items.length <= 20
    && items.every((item) => item.name.trim().length > 0
      && item.name.length <= 100
      && Number.isFinite(item.estimatedGrams)
      && item.estimatedGrams > 0
      && item.estimatedGrams <= 5000
      && Number.isFinite(item.calories)
      && item.calories >= 0
      && item.calories <= 3000);
}

function isCompleteV2Estimate(estimate: AiMealEstimatePreview): estimate is CompleteAiMealEstimate {
  return estimate.componentItems !== undefined
    && estimate.estimatedTotalGrams !== undefined
    && Number.isFinite(estimate.estimatedTotalGrams)
    && estimate.estimatedTotalGrams >= 20
    && estimate.estimatedTotalGrams <= 5000
    && typeof estimate.promptVersion === 'string'
    && estimate.promptVersion.length >= 1
    && estimate.promptVersion.length <= 100
    && validStructuredItems(estimate.componentItems);
}

function isMacroMismatch(calories: number, protein: number, carbs: number, fat: number): boolean {
  if (!Number.isFinite(calories) || calories <= 0) return false;
  const computed = protein * 4 + carbs * 4 + fat * 9;
  return computed > 0 && Math.abs(calories - computed) > Math.max(50, computed * 0.1);
}

function MacroWarning({ nutrition }: { nutrition: AiMealEstimateNutrition }) {
  const [expanded, setExpanded] = useState(false);
  if (!isMacroMismatch(nutrition.calories, nutrition.protein, nutrition.carbs, nutrition.fat)) return null;
  const computed = Math.round(nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9);

  return (
    <TouchableOpacity
      style={styles.warningBadge}
      onPress={() => setExpanded((value) => !value)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Nährwertwarnung ein- oder ausblenden"
    >
      <View style={styles.warningBadgeRow}>
        <Text style={styles.warningBadgeText}>Nährwerte inkonsistent</Text>
        <Icon lib="feather" name={expanded ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.warning} />
      </View>
      {expanded ? (
        <Text style={styles.warningDetail}>
          Die geänderten Kalorien passen nicht zu den Makronährstoffen. Aus Protein, Kohlenhydraten
          und Fett errechnen sich {computed} kcal, du hast {Math.round(nutrition.calories)} kcal eingetragen.
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

interface StepButtonProps {
  label: string;
  icon: 'minus' | 'plus';
  onStep: (direction: -1 | 1) => boolean;
  direction: -1 | 1;
}

function StepButton({ label, icon, onStep, direction }: StepButtonProps) {
  const onStepRef = useRef(onStep);
  const longPressed = useRef(false);
  const warnedAtBoundary = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  onStepRef.current = onStep;

  function stopRepeat() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function performStep(): boolean {
    if (!onStepRef.current(direction)) {
      if (!warnedAtBoundary.current) {
        warnedAtBoundary.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      stopRepeat();
      return false;
    }
    void Haptics.selectionAsync();
    return true;
  }

  useEffect(() => stopRepeat, []);

  return (
    <TouchableOpacity
      style={styles.stepButton}
      onPressIn={() => {
        longPressed.current = false;
        warnedAtBoundary.current = false;
      }}
      onLongPress={() => {
        longPressed.current = true;
        if (performStep()) intervalRef.current = setInterval(performStep, 140);
      }}
      delayLongPress={400}
      onPress={() => {
        if (!longPressed.current) performStep();
      }}
      onPressOut={stopRepeat}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon lib="feather" name={icon} size="md" color={colors.text} />
    </TouchableOpacity>
  );
}

function formatPercentDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '±0 % zur KI-Schätzung';
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${formatValue(Math.abs(rounded))} % zur KI-Schätzung`;
}

export default function MealEstimateResult({
  visible,
  estimate,
  originalText,
  imageUri,
  imageMimeType,
  mealId,
  resolveMealId,
  onClose,
  onSaved,
  onRefine,
}: Props) {
  const [currentEstimate, setCurrentEstimate] = useState(estimate);
  const [portionSteps, setPortionSteps] = useState(0);
  const [macroOffsets, setMacroOffsets] = useState<Partial<Record<MealEstimateMacro, number>>>({});
  const [typedOverrides, setTypedOverrides] = useState<Partial<AiMealEstimateNutrition>>({});
  const [macroDrafts, setMacroDrafts] = useState<Partial<Record<MealEstimateMacro, string>>>({});
  const [caloriesDraft, setCaloriesDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [refineSheetOpen, setRefineSheetOpen] = useState(false);
  const [refineAttempts, setRefineAttempts] = useState(0);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refineQuotaExceeded, setRefineQuotaExceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assumptionsExpanded, setAssumptionsExpanded] = useState(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  useEffect(() => {
    setCurrentEstimate(estimate);
    setPortionSteps(0);
    setMacroOffsets({});
    setTypedOverrides({});
    setMacroDrafts({});
    setCaloriesDraft(null);
    setError(null);
  }, [estimate]);

  const adjusted = applyMealEstimateAdjustments(currentEstimate, { portionSteps, macroOffsets, typedOverrides });
  const isAdjusted = adjusted.mealEstimate.calories !== currentEstimate.mealEstimate.calories
    || MACROS.some(({ key }) => adjusted.mealEstimate[key] !== currentEstimate.mealEstimate[key])
    || adjusted.estimatedTotalGrams !== currentEstimate.estimatedTotalGrams
    || adjusted.componentItems?.some((item, index) => (
      item.estimatedGrams !== currentEstimate.componentItems?.[index]?.estimatedGrams
    )) === true;
  const canRefineEstimate = isCompleteV2Estimate(currentEstimate);
  const calorieText = caloriesDraft ?? formatValue(adjusted.mealEstimate.calories);
  const parsedCalories = parseValue(calorieText);
  const canSave = parsedCalories !== undefined && !saving && !refining && !parsing;
  const busy = saving || refining || parsing;
  const deltaPercent = currentEstimate.mealEstimate.calories > 0
    ? ((adjusted.mealEstimate.calories / currentEstimate.mealEstimate.calories) - 1) * 100
    : 0;

  function stepPortion(direction: -1 | 1): boolean {
    const nextSteps = portionSteps + direction;
    if (nextSteps < -10 || nextSteps > 10) return false;
    const overriddenNutrients = ['calories', ...MACROS.map(({ key }) => key)] as const;
    const nextOverrides = { ...typedOverrides };
    let updatedOverride = false;
    for (const nutrient of overriddenNutrients) {
      if (typedOverrides[nutrient] === undefined) continue;
      const current = adjusted.mealEstimate[nutrient];
      const next = Math.max(0, current + direction * currentEstimate.mealEstimate[nutrient] * 0.05);
      if (next === current) continue;
      nextOverrides[nutrient] = next;
      updatedOverride = true;
    }
    if (updatedOverride) {
      setTypedOverrides(nextOverrides);
      setCaloriesDraft(null);
      setMacroDrafts({});
    }
    setPortionSteps(nextSteps);
    return true;
  }

  function stepMacro(macro: MealEstimateMacro, direction: -1 | 1): boolean {
    const before = adjusted.mealEstimate[macro];
    const step = Math.max(0.5, currentEstimate.mealEstimate[macro] * 0.05);
    const after = Math.max(0, before + direction * step);
    if (after === before) return false;
    if (typedOverrides[macro] !== undefined) {
      setTypedOverrides((value) => ({ ...value, [macro]: after }));
      setMacroDrafts((value) => {
        const next = { ...value };
        delete next[macro];
        return next;
      });
    } else {
      setMacroOffsets((value) => ({ ...value, [macro]: (value[macro] ?? 0) + direction }));
    }
    const calorieFactor = macro === 'protein' || macro === 'carbs' ? 4 : macro === 'fat' ? 9 : 0;
    const calorieDelta = (after - before) * calorieFactor;
    if (calorieDelta !== 0 && typedOverrides.calories !== undefined) {
      setTypedOverrides((value) => ({ ...value, calories: Math.max(0, adjusted.mealEstimate.calories + calorieDelta) }));
      setCaloriesDraft(null);
    }
    return true;
  }

  function resetAdjustments() {
    setPortionSteps(0);
    setMacroOffsets({});
    setTypedOverrides({});
    setMacroDrafts({});
    setCaloriesDraft(null);
  }

  function openRefineSheet() {
    if (!canRefineEstimate || busy || refineAttempts >= 3) return;
    setRefineError(null);
    setRefineSheetOpen(true);
  }

  async function handleRefineEstimate(options: Omit<AiMealEstimateRefine, 'previous'>): Promise<boolean> {
    if (!isCompleteV2Estimate(currentEstimate) || busy || refineAttempts >= 3) return false;
    const hadAdjustments = isAdjusted;
    setRefining(true);
    setRefineError(null);
    try {
      const result = await aiApi.estimateMeal(originalText, imageUri, imageMimeType, {
        previous: {
          mealName: currentEstimate.mealName,
          estimatedTotalGrams: currentEstimate.estimatedTotalGrams,
          mealEstimate: currentEstimate.mealEstimate,
          componentItems: currentEstimate.componentItems,
        },
        ...options,
      });
      setCurrentEstimate(result);
      resetAdjustments();
      setRefineAttempts((attempts) => attempts + 1);
      showSnackbar({
        message: hadAdjustments
          ? 'KI-Schätzung aktualisiert. Deine Anpassungen wurden zurückgesetzt.'
          : 'Neu geschätzt',
      });
      return true;
    } catch (requestError) {
      if (isQuotaExceededError(requestError)) {
        setRefineQuotaExceeded(true);
        setRefineError('Deine kostenlosen KI-Analysen für diesen Monat sind aufgebraucht. Das Kontingent wird am Monatsanfang zurückgesetzt.');
      } else {
        setRefineError(formatApiError(requestError));
      }
      return false;
    } finally {
      setRefining(false);
    }
  }

  async function handleParseComponents() {
    if (!onRefine || busy) return;
    setParsing(true);
    setError(null);
    try {
      const names = currentEstimate.components.length > 0 ? currentEstimate.components.join(', ') : originalText;
      const result = await aiApi.previewMeal(names, currentEstimate.contextDetected ?? undefined);
      await onRefine(result.items);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const targetMealId = mealId ?? await resolveMealId?.();
      if (!targetMealId) throw new Error('Mahlzeit konnte nicht bestimmt werden.');

      const structuredItems = validStructuredItems(adjusted.componentItems) ? adjusted.componentItems : undefined;
      const weightGrams = adjusted.estimatedTotalGrams !== undefined
        && Number.isFinite(adjusted.estimatedTotalGrams)
        && adjusted.estimatedTotalGrams >= 20
        && adjusted.estimatedTotalGrams <= 5000
        ? adjusted.estimatedTotalGrams
        : undefined;
      const version = currentEstimate.promptVersion !== undefined
        && currentEstimate.promptVersion.length >= 1
        && currentEstimate.promptVersion.length <= 100
        ? currentEstimate.promptVersion
        : undefined;
      const payload: AddItemProductInput = {
        productName: currentEstimate.mealName,
        inputMode: 'portion',
        inputAmount: 1,
        calculatedNutrition: { ...adjusted.mealEstimate, calories: parsedCalories! },
        sourceType: 'ai-meal-estimate',
        isAiEstimate: true,
        ...(structuredItems === undefined
          ? { aiMealEstimateComponents: currentEstimate.components }
          : { aiMealEstimateItems: structuredItems }),
        ...(weightGrams === undefined ? {} : { aiMealEstimateWeightGrams: weightGrams }),
        ...(version === undefined ? {} : { aiMealEstimateVersion: version }),
        ...(currentEstimate.contextDetected == null ? {} : { aiMealEstimateContext: currentEstimate.contextDetected }),
        aiMealEstimateConfidence: currentEstimate.portionConfidence,
        aiMealEstimateAssumptions: currentEstimate.assumptions,
        aiMealEstimatePhotoUsed: currentEstimate.photoUsed,
      };

      await diaryApi.addItem(targetMealId, payload);
      onSaved();
    } catch (saveError) {
      setError(formatApiError(saveError));
    } finally {
      setSaving(false);
    }
  }

  const confidenceColor = currentEstimate.portionConfidence === 'high'
    ? colors.primary
    : currentEstimate.portionConfidence === 'medium'
      ? colors.warning
      : colors.negative;
  const confidenceLabel = currentEstimate.portionConfidence === 'high'
    ? 'Hohe Sicherheit'
    : currentEstimate.portionConfidence === 'medium'
      ? 'Mittlere Sicherheit'
      : 'Geringe Sicherheit';
  const photoUseNotice = getPhotoUseNotice(currentEstimate);
  const duplicatePhotoWarning = currentEstimate.photoUse === 'excluded_mismatch'
    ? PHOTO_MISMATCH_WARNING
    : currentEstimate.photoUse === 'excluded_uncertain'
      ? PHOTO_UNCERTAIN_WARNING
      : undefined;
  const visibleWarnings = currentEstimate.warnings.filter((warning) => warning !== duplicatePhotoWarning);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (refineSheetOpen) {
          if (!refining) setRefineSheetOpen(false);
        } else if (!busy) {
          onClose();
        }
      }}
    >
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel="Zurück">
            <Icon lib="feather" name="chevron-left" size="md" color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>KI-Mahlzeitschätzung</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" /> : null}
          <View style={styles.disclaimerRow}>
            <Text style={styles.disclaimerText}>KI-Schätzung · Werte können abweichen</Text>
            {currentEstimate.photoUsed ? <Text style={styles.photoBadge}>Foto genutzt</Text> : null}
          </View>
          {photoUseNotice ? (
            <View
              style={styles.photoUseNotice}
              accessible
              accessibilityRole="text"
              accessibilityLabel={photoUseNotice}
            >
              <Text style={styles.photoUseNoticeText}>{photoUseNotice}</Text>
            </View>
          ) : null}
          <Text style={styles.mealName}>{currentEstimate.mealName}</Text>
          {currentEstimate.contextDetected ? <Text style={styles.contextText}>{currentEstimate.contextDetected}</Text> : null}
          <View style={[styles.confidenceBanner, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.confidenceText, { color: confidenceColor }]}>{confidenceLabel}</Text>
          </View>

          <View style={styles.adjustmentHeader}>
            <Text style={styles.sectionTitle}>Nährwerte gesamt</Text>
            {isAdjusted ? (
              <View style={styles.adjustmentActions}>
                <Text style={styles.deltaBadge}>{formatPercentDelta(deltaPercent)}</Text>
                <TouchableOpacity onPress={resetAdjustments} disabled={busy} accessibilityRole="button" accessibilityLabel="Anpassungen zurücksetzen">
                  <Icon lib="feather" name="rotate-ccw" size="sm" color={colors.primaryBright} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.calorieHero}>
            <View style={styles.calorieControl}>
              <StepButton label="Portion um fünf Prozent verringern" icon="minus" direction={-1} onStep={stepPortion} />
              <View style={styles.calorieValueGroup}>
                <TextInput
                  style={styles.calorieValue}
                  value={calorieText}
                  onChangeText={(text) => {
                    setCaloriesDraft(text);
                    const parsed = parseValue(text);
                    setTypedOverrides((value) => {
                      if (parsed === undefined) {
                        const next = { ...value };
                        delete next.calories;
                        return next;
                      }
                      return { ...value, calories: parsed };
                    });
                  }}
                  onBlur={() => {
                    if (parsedCalories === undefined) setCaloriesDraft(null);
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  maxLength={7}
                  accessibilityLabel="Kalorien"
                />
                <Text style={styles.calorieUnit}>kcal</Text>
              </View>
              <StepButton label="Portion um fünf Prozent erhöhen" icon="plus" direction={1} onStep={stepPortion} />
            </View>
            <View style={styles.portionRow}>
              <Text style={styles.portionLabel}>Portion</Text>
              <Text style={styles.portionValue}>{Math.round((1 + portionSteps * 0.05) * 100)} %</Text>
            </View>
          </View>

          <View style={styles.macroGrid}>
            {MACROS.map(({ key, label }) => (
              <View key={key} style={styles.macroTile}>
                <Text style={styles.macroLabel}>{label}</Text>
                <View style={styles.macroValueRow}>
                  <TextInput
                    style={styles.macroValue}
                    value={macroDrafts[key] ?? formatValue(adjusted.mealEstimate[key])}
                    onChangeText={(text) => {
                      setMacroDrafts((value) => ({ ...value, [key]: text }));
                      const parsed = parseValue(text);
                      setTypedOverrides((value) => {
                        if (parsed === undefined) {
                          const next = { ...value };
                          delete next[key];
                          return next;
                        }
                        return { ...value, [key]: parsed };
                      });
                    }}
                    onBlur={() => {
                      if (parseValue(macroDrafts[key] ?? '') === undefined) {
                        setMacroDrafts((value) => {
                          const next = { ...value };
                          delete next[key];
                          return next;
                        });
                      }
                    }}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    maxLength={7}
                    accessibilityLabel={label}
                  />
                  <Text style={styles.macroUnit}>g</Text>
                </View>
                <View style={styles.macroActions}>
                  <StepButton label={`${label} verringern`} icon="minus" direction={-1} onStep={(direction) => stepMacro(key, direction)} />
                  <StepButton label={`${label} erhöhen`} icon="plus" direction={1} onStep={(direction) => stepMacro(key, direction)} />
                </View>
              </View>
            ))}
          </View>

          <MacroWarning nutrition={{ ...adjusted.mealEstimate, calories: parsedCalories ?? adjusted.mealEstimate.calories }} />

          <View style={styles.refineSection}>
            <TouchableOpacity
              style={[styles.refineAction, (!canRefineEstimate || busy || refineAttempts >= 3) && styles.buttonDisabled]}
              onPress={openRefineSheet}
              disabled={!canRefineEstimate || busy || refineAttempts >= 3}
              accessibilityRole="button"
              accessibilityLabel="Stimmt nicht ganz? Neu schätzen"
            >
              <Text style={styles.refineActionText}>Stimmt nicht ganz? Neu schätzen</Text>
            </TouchableOpacity>
            {!canRefineEstimate
              ? <Text style={styles.refineHint}>Für diese ältere KI-Schätzung nicht verfügbar</Text>
              : refineAttempts >= 3
                ? <Text style={styles.refineHint}>Maximal 3 Neu-Schätzungen pro Ergebnis.</Text>
                : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Erkannte Bestandteile</Text>
            {adjusted.componentItems !== undefined ? (
              <>
                {adjusted.estimatedTotalGrams !== undefined ? (
                  <Text style={styles.totalWeight}>Gesamtgewicht ca. {formatValue(adjusted.estimatedTotalGrams)} g</Text>
                ) : null}
                {adjusted.componentItems.map((item, index) => (
                  <View key={`${item.name}-${index}`} style={styles.componentRow}>
                    <Text style={styles.componentName}>{item.name}</Text>
                    <Text style={styles.componentDetail}>ca. {formatValue(item.estimatedGrams)} g · {Math.round(item.calories)} kcal</Text>
                  </View>
                ))}
              </>
            ) : currentEstimate.components.length > 0 ? (
              <View style={styles.chipsRow}>
                {currentEstimate.components.map((name, index) => (
                  <View key={`${name}-${index}`} style={styles.chip}><Text style={styles.chipText}>{name}</Text></View>
                ))}
              </View>
            ) : null}
          </View>

          {visibleWarnings.length > 0 ? (
            <View style={styles.section}>
              {visibleWarnings.map((warning, index) => <Text key={index} style={styles.aiWarning}>{warning}</Text>)}
            </View>
          ) : null}
          {currentEstimate.assumptions.length > 0 ? (
            <View style={styles.section}>
              <TouchableOpacity style={styles.assumptionsToggle} onPress={() => setAssumptionsExpanded((value) => !value)} accessibilityRole="button">
                <Text style={styles.assumptionsToggleText}>{assumptionsExpanded ? 'Annahmen ausblenden' : `Annahmen (${currentEstimate.assumptions.length})`}</Text>
              </TouchableOpacity>
              {assumptionsExpanded
                ? currentEstimate.assumptions.map((assumption, index) => <Text key={index} style={styles.assumptionItem}>{assumption}</Text>)
                : null}
            </View>
          ) : null}

          {onRefine ? (
            <TouchableOpacity
              style={[styles.parseButton, busy && styles.buttonDisabled]}
              onPress={() => void handleParseComponents()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Einzeln aufschlüsseln"
            >
              {parsing ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.refineButtonText}>Einzeln aufschlüsseln</Text>}
            </TouchableOpacity>
          ) : null}

          {error ? <ErrorBanner error={error} /> : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.primaryButton, (!canSave || busy) && styles.buttonDisabled]} onPress={() => void handleSave()} disabled={!canSave || busy} accessibilityRole="button">
            {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>Speichern</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <MealEstimateRefineSheet
        visible={refineSheetOpen}
        loading={refining}
        quotaExceeded={refineQuotaExceeded}
        error={refineError}
        attemptsUsed={refineAttempts}
        onClose={() => setRefineSheetOpen(false)}
        onSubmit={handleRefineEstimate}
      />
      <Snackbar ref={snackbarRef} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.text },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  photo: { width: '100%', height: 200, borderRadius: radius.md, marginBottom: spacing.sm },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disclaimerText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  photoBadge: { ...typography.caption, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  photoUseNotice: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
  photoUseNoticeText: { ...typography.body2, color: colors.textSecondary },
  mealName: { ...typography.h2, color: colors.text },
  contextText: { ...typography.body2, color: colors.textSecondary },
  confidenceBanner: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  confidenceText: { ...typography.caption, fontWeight: '600' },
  adjustmentHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { ...typography.overline, color: colors.textMuted },
  adjustmentActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deltaBadge: { ...typography.caption, color: colors.primaryBright },
  calorieHero: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  calorieControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calorieValueGroup: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  calorieValue: { ...typography.h1, color: colors.primaryBright, minWidth: 72, padding: 0, textAlign: 'center' },
  calorieUnit: { ...typography.body2, color: colors.textSecondary },
  stepButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  portionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.xs },
  portionLabel: { ...typography.body2, color: colors.textSecondary },
  portionValue: { ...typography.body1, color: colors.text, minWidth: 52, textAlign: 'center' },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  macroTile: { width: '48%', minHeight: 128, justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  macroLabel: { ...typography.caption, color: colors.textMuted, minHeight: 32 },
  macroActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  macroValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  macroValue: { ...typography.body1, color: colors.text, minWidth: 48, padding: 0, textAlign: 'center' },
  macroUnit: { ...typography.body1, color: colors.textSecondary },
  warningBadge: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  warningBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  warningBadgeText: { ...typography.caption, color: colors.warning, fontWeight: '700', flex: 1 },
  warningDetail: { ...typography.caption, color: colors.warning, marginTop: spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  totalWeight: { ...typography.body2, color: colors.textSecondary },
  componentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  componentName: { ...typography.body2, color: colors.text, flex: 1 },
  componentDetail: { ...typography.caption, color: colors.textSecondary, textAlign: 'right' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.primarySoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  aiWarning: { ...typography.body2, color: colors.warning },
  assumptionsToggle: { minHeight: 48, justifyContent: 'center' },
  assumptionsToggleText: { ...typography.body2, color: colors.textSecondary },
  assumptionItem: { ...typography.body2, color: colors.textMuted, paddingLeft: spacing.sm },
  refineSection: { gap: spacing.sm, marginTop: spacing.md },
  refineAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  refineActionText: { ...typography.button, color: colors.primaryBright, textAlign: 'center' },
  refineButtonText: { ...typography.button, color: colors.primaryBright, textAlign: 'center' },
  refineHint: { ...typography.caption, color: colors.textMuted },
  parseButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md },
  buttonDisabled: { opacity: 0.5 },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md },
  primaryButtonText: { ...typography.button, color: colors.background },
});