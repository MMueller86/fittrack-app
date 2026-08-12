// AISubFlow — Full-Screen Modal für KI-Mahlzeitschätzung.
// Fast Path: MealEstimateReviewScreen
// Precision Path: MealParserReviewScreen (nach "Verfeinern")
// Öffnet sich über dem FoodEntryHub, Hub bleibt im Hintergrund.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import type { AiFoodEstimatePreview, AiMealEstimatePreview } from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../../shared/api/aiApi';
import { aiApi } from '../../../shared/api/aiApi';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { formatApiError } from '../../../shared/api/apiError';
import { isQuotaExceededError } from '../../../shared/api/client';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { Icon } from '../../../shared/components/Icon';
import { nutritionDiaryService as diaryApi } from '../../../services/nutritionDiaryService';
import MealEstimateReviewScreen from '../MealEstimateReviewScreen';
import MealParserReviewScreen from '../MealParserReviewScreen';
import type { FoodEntryHubContext } from './useFoodEntryHubStore';
import type { MealType } from '@fittrack/shared';

const MEAL_OPTIONS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittagessen' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'snack', label: 'Snack' },
  { id: 'preworkout', label: 'Vor dem Training' },
  { id: 'postworkout', label: 'Nach dem Training' },
];

function getMealLabel(id: MealType): string {
  return MEAL_OPTIONS.find((m) => m.id === id)?.label ?? 'Mahlzeit';
}

interface Props {
  visible: boolean;
  context: FoodEntryHubContext;
  onClose: () => void;
  onSaved: (label: string) => void;
  /** Recipe mode: run a single-food estimate instead of a meal estimate. */
  onIngredientEstimated?: (estimate: AiFoodEstimatePreview, query: string) => void;
  initialQuery?: string;
}

async function resolveOrCreateMealId(
  date: string,
  mealType: MealType,
  mealId?: string,
): Promise<string> {
  // Temp IDs are optimistic placeholders — not real backend IDs
  if (mealId && !mealId.startsWith('temp-')) return mealId;
  const dayData = await diaryApi.getDay(date);
  const existing = dayData.meals.find((m) => m.type === mealType);
  if (existing) return existing.id;
  const { meal } = await diaryApi.createMeal(date, mealType);
  return meal.id;
}

export function AISubFlow({ visible, context, onClose, onSaved, onIngredientEstimated, initialQuery }: Props) {
  const [text, setText] = useState('');
  const [mealPhoto, setMealPhoto] = useState<{
    uri: string;
    mimeType: 'image/jpeg' | 'image/png';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealEstimate, setMealEstimate] = useState<AiMealEstimatePreview | null>(null);
  const [parserItems, setParserItems] = useState<MealParserPreviewItem[] | null>(null);
  // Mahlzeit-Selektor — vorbelegt mit zeitbasiertem Default
  const [selectedMealType, setSelectedMealType] = useState<MealType>(context.mealType);
  const [mealSelectorOpen, setMealSelectorOpen] = useState(false);
  // resolvedMealId wird lazy beim Speichern ermittelt (nicht upfront)
  const [resolvedMealId, setResolvedMealId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFullReview, setShowFullReview] = useState(false);

  useEffect(() => {
    if (!visible) {
      setText('');
      setMealPhoto(null);
      setError(null);
      setSaveError(null);
      setMealEstimate(null);
      setParserItems(null);
      setResolvedMealId(null);
      setShowFullReview(false);
      return;
    }
    setText(initialQuery ?? '');
    // Mahlzeit-Selektor mit aktuellem context.mealType vorbelegen
    setSelectedMealType(context.mealType);
  }, [visible, context.mealType, initialQuery]);

  async function handlePickPhoto(source: 'camera' | 'gallery') {
    setError(null);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError('Kamera-Berechtigung benötigt');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          allowsEditing: true,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setError('Galerie-Berechtigung benötigt');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          allowsEditing: true,
        });
      }
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      setMealPhoto({ uri: asset.uri, mimeType });
    } catch (e) {
      setError(formatApiError(e, 'Foto konnte nicht geladen werden'));
    }
  }

  async function handleAnalyze() {
    if (text.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.estimateMeal(
        text.trim(),
        mealPhoto?.uri,
        mealPhoto?.mimeType,
      );
      setMealEstimate(result);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      if (isQuotaExceededError(e)) {
        setError(
          'Deine kostenlosen KI-Analysen für diesen Monat sind aufgebraucht. Das Kontingent wird am Monatsanfang zurückgesetzt.',
        );
      } else {
        setError(formatApiError(e));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleIngredientEstimate() {
    const query = text.trim();
    if (!onIngredientEstimated || query.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const estimate = await aiApi.estimateFood({ name: query });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onIngredientEstimated(estimate, query);
    } catch (e) {
      if (isQuotaExceededError(e)) {
        setError(
          'Deine kostenlosen KI-Analysen für diesen Monat sind aufgebraucht. Das Kontingent wird am Monatsanfang zurückgesetzt.',
        );
      } else {
        setError(formatApiError(e, 'KI-Schätzung fehlgeschlagen'));
      }
    } finally {
      setLoading(false);
    }
  }

  const handleEstimateSaved = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved('KI-Mahlzeitschätzung');
  };

  // Direktes Speichern ohne Nested-Modal — Hauptpfad
  async function handleDirectSave() {
    if (!mealEstimate || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Lazy: Mahlzeit finden oder anlegen mit dem vom User gewählten Typ
      const mealId = await resolveOrCreateMealId(context.date, selectedMealType, context.mealId);
      setResolvedMealId(mealId);
      await diaryApi.addItem(mealId, {
        productName: mealEstimate.mealName,
        inputMode: 'grams',
        inputAmount: 100,
        amountGrams: 100,
        calculatedNutrition: {
          calories: mealEstimate.mealEstimate.calories,
          protein: mealEstimate.mealEstimate.protein,
          carbs: mealEstimate.mealEstimate.carbs,
          fat: mealEstimate.mealEstimate.fat,
          fiber: mealEstimate.mealEstimate.fiber,
        },
        unit: 'Portion',
        sourceType: 'ai-meal-estimate',
        isAiEstimate: true,
        aiMealEstimateComponents: mealEstimate.components,
        aiMealEstimateContext: mealEstimate.contextDetected ?? undefined,
        aiMealEstimateConfidence: mealEstimate.portionConfidence,
        aiMealEstimateAssumptions: mealEstimate.assumptions,
        aiMealEstimatePhotoUsed: mealEstimate.photoUsed,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved('KI-Mahlzeitschätzung');
    } catch (e) {
      setSaveError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  // Verfeinern-Pfad: Meal ID resolven und MealEstimateReviewScreen öffnen
  async function handleOpenFullReview() {
    if (!mealEstimate) return;
    try {
      const mealId = await resolveOrCreateMealId(context.date, selectedMealType, context.mealId);
      setResolvedMealId(mealId);
      setShowFullReview(true);
    } catch (e) {
      setSaveError(formatApiError(e));
    }
  }

  const handleRefine = (items: MealParserPreviewItem[]) => {
    setMealEstimate(null);
    setShowFullReview(false);
    setParserItems(items);
  };

  const handleParserSaved = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved('KI-Mahlzeitschätzung');
  };

  if (!visible) return null;

  if (onIngredientEstimated) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>✨ KI-Lebensmittelschätzung</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.subtitle}>
              Kein passendes Lebensmittel gefunden. Die KI kann eine einmalige Nährwertschätzung erstellen.
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Lebensmittel beschreiben…"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              blurOnSubmit
            />
            {error ? <ErrorBanner error={error} /> : null}
            <TouchableOpacity
              style={[styles.analyzeBtn, (loading || text.trim().length < 2) && styles.analyzeBtnDisabled]}
              onPress={() => void handleIngredientEstimate()}
              disabled={loading || text.trim().length < 2}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.analyzeBtnText}>KI-Schätzung starten</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── Inline Estimate Preview ──────────────────────────────────────────────
  // Wird angezeigt wenn die KI-Schätzung vorliegt — KEIN nested Modal!
  if (mealEstimate) {
    const m = mealEstimate.mealEstimate;
    const confidenceColor =
      mealEstimate.portionConfidence === 'high'
        ? colors.primary
        : mealEstimate.portionConfidence === 'medium'
          ? '#C8A032'
          : colors.negative;
    const confidenceLabel =
      mealEstimate.portionConfidence === 'high'
        ? 'Hohe Sicherheit'
        : mealEstimate.portionConfidence === 'medium'
          ? 'Mittlere Sicherheit'
          : 'Geringe Sicherheit';

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMealEstimate(null)}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setMealEstimate(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtn}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>✨ KI-Schätzung</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { gap: spacing.md }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mahlzeit-Name */}
            <Text style={[styles.subtitle, { fontSize: 18, fontWeight: '600', color: colors.text }]}>
              {mealEstimate.mealName}
            </Text>

            {/* Konfidenz-Badge */}
            <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}22` }]}>
              <Text style={[styles.confidenceBadgeText, { color: confidenceColor }]}>
                {confidenceLabel}
              </Text>
            </View>

            {/* Makro-Übersicht */}
            <View style={styles.macroCard}>
              <View style={styles.macroHero}>
                <Text style={styles.macroHeroValue}>{Math.round(m.calories)}</Text>
                <Text style={styles.macroHeroLabel}>kcal</Text>
              </View>
              <View style={styles.macroDivider} />
              <View style={styles.macroRow}>
                {[
                  { label: 'Eiweiß', value: m.protein },
                  { label: 'Kohlenhydrate', value: m.carbs },
                  { label: 'Fett', value: m.fat },
                ].map((macro) => (
                  <View key={macro.label} style={styles.macroItem}>
                    <Text style={styles.macroValue}>{Math.round(macro.value * 10) / 10}g</Text>
                    <Text style={styles.macroLabel}>{macro.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Komponenten */}
            {mealEstimate.components.length > 0 && (
              <Text style={styles.components}>
                {mealEstimate.components.join(' · ')}
              </Text>
            )}

            {/* Warnungen */}
            {mealEstimate.warnings.length > 0 && (
              <View style={styles.warningsBox}>
                {mealEstimate.warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>⚠ {w}</Text>
                ))}
              </View>
            )}

            {saveError ? <ErrorBanner error={saveError} /> : null}

            {/* Primär: Speichern */}
            <TouchableOpacity
              style={[styles.analyzeBtn, saving && styles.analyzeBtnDisabled]}
              onPress={() => void handleDirectSave()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.analyzeBtnText}>Speichern</Text>
              )}
            </TouchableOpacity>

            {/* Sekundär: Verfeinern (lädt Meal ID lazy und öffnet volles Review) */}
            <TouchableOpacity
              style={styles.refineBtn}
              onPress={() => void handleOpenFullReview()}
              disabled={saving}
            >
              <Text style={styles.refineBtnText}>Makros bearbeiten ›</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>

        {/* Verfeinern-Pfad: MealEstimateReviewScreen — nur bei explizitem Tap */}
        {showFullReview && resolvedMealId ? (
          <MealEstimateReviewScreen
            visible
            mealId={resolvedMealId}
            originalText={text.trim()}
            estimate={mealEstimate}
            imageUri={mealPhoto?.uri}
            onClose={() => setShowFullReview(false)}
            onSaved={handleEstimateSaved}
            onRefine={handleRefine}
          />
        ) : null}
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>✨ KI-Mahlzeitschätzung</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>
            Beschreibe deine Mahlzeit, z.B. „Schnitzel mit Pommes und Cola"
          </Text>
          {/* Mahlzeit-Selektor */}
          {!context.mealId && (
            <>
              <TouchableOpacity
                style={styles.mealPill}
                onPress={() => setMealSelectorOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.mealPillText}>Zu {getMealLabel(selectedMealType)}</Text>
                <Icon lib="feather" name="chevron-down" size={13} color={colors.primary} />
              </TouchableOpacity>
              <Modal
                visible={mealSelectorOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setMealSelectorOpen(false)}
              >
                <TouchableOpacity
                  style={styles.mealModalOverlay}
                  activeOpacity={1}
                  onPress={() => setMealSelectorOpen(false)}
                >
                  <View style={styles.mealModalSheet}>
                    <Text style={styles.mealModalTitle}>Mahlzeit auswählen</Text>
                    {MEAL_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        style={styles.mealModalOption}
                        onPress={() => { setSelectedMealType(opt.id); setMealSelectorOpen(false); }}
                      >
                        <Text style={[
                          styles.mealModalOptionText,
                          opt.id === selectedMealType && styles.mealModalOptionSelected,
                        ]}>{opt.label}</Text>
                        {opt.id === selectedMealType && (
                          <Icon lib="feather" name="check" size={15} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </Modal>
            </>
          )}
          {/* Text input */}
          <TextInput
            style={styles.textInput}
            placeholder="Mahlzeit beschreiben…"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={3}
            returnKeyType="done"
            blurOnSubmit
          />

          {/* Photo picker */}
          <View style={styles.photoRow}>
            {mealPhoto ? (
              <View style={styles.photoIndicator}>
                <Text style={styles.photoIndicatorText}>📷 Foto hinzugefügt</Text>
                <TouchableOpacity
                  onPress={() => setMealPhoto(null)}
                  style={styles.removePhotoBtn}
                >
                  <Text style={styles.removePhotoBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={() => void handlePickPhoto('camera')}
                >
                  <Text style={styles.photoBtnText}>📷 Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={() => void handlePickPhoto('gallery')}
                >
                  <Text style={styles.photoBtnText}>🖼️ Galerie</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {error ? <ErrorBanner error={error} /> : null}

          <TouchableOpacity
            style={[
              styles.analyzeBtn,
              (loading || text.trim().length < 3) && styles.analyzeBtnDisabled,
            ]}
            onPress={() => void handleAnalyze()}
            disabled={loading || text.trim().length < 3}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.analyzeBtnText}>Analysieren</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Precision Path */}
      {parserItems && resolvedMealId ? (
        <MealParserReviewScreen
          visible
          mealId={resolvedMealId}
          items={parserItems}
          warnings={[]}
          onClose={() => setParserItems(null)}
          onSaved={handleParserSaved}
        />
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  closeBtn: {
    ...typography.h3,
    color: colors.textMuted,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  subtitle: {
    ...typography.body2,
    color: colors.textMuted,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body1,
    color: colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  photoIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  photoIndicatorText: {
    ...typography.caption,
    color: colors.primary,
  },
  removePhotoBtn: { padding: spacing.xs },
  removePhotoBtnText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  analyzeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  analyzeBtnDisabled: { opacity: 0.4 },
  analyzeBtnText: {
    ...typography.button,
    color: colors.background,
  },

  // Inline Estimate Preview
  confidenceBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  confidenceBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  macroCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  macroHero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  macroHeroValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
  },
  macroHeroLabel: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  macroDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
    gap: 2,
  },
  macroValue: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text,
  },
  macroLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  components: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  warningsBox: {
    backgroundColor: 'rgba(226,107,107,0.12)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  warningText: {
    ...typography.caption,
    color: colors.negative,
  },
  refineBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  refineBtnText: {
    ...typography.body2,
    color: colors.textSecondary,
  },

  // Meal-Selektor
  mealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
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
  mealModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  mealModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  mealModalTitle: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mealModalOptionText: {
    ...typography.body1,
    color: colors.text,
  },
  mealModalOptionSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
