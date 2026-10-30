// LabelSubFlow — Nährwert-Label scannen über den gemeinsamen Rahmen-Foto-Flow (FramedPhotoPicker).
// Kamera oder Galerie → OCR/KI-Analyse → LabelScanReviewScreen → speichern.
// Öffnet sich über dem FoodEntryHub als Full-Screen Modal.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NutritionLabelScanResult, ReusableItem, FoodSearchResult } from '@fittrack/shared';
import { aiApi } from '../../../shared/api/aiApi';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { formatApiError } from '../../../shared/api/apiError';
import { isQuotaExceededError } from '../../../shared/api/client';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { nutritionDiaryService as diaryApi } from '../../../services/nutritionDiaryService';
import LabelScanReviewScreen from '../LabelScanReviewScreen';
import { FramedPhotoPicker, type FramedPhotoResult } from '../../../shared/camera/FramedPhotoPicker';
import type { FoodEntryHubContext } from './useFoodEntryHubStore';
import type { MealType } from '@fittrack/shared';

interface Props {
  visible: boolean;
  context: FoodEntryHubContext;
  onClose: () => void;
  onSaved: (productName: string) => void;
  /**
   * Wenn gesetzt: "Als Produkt speichern" öffnet ProduktDialog statt direkt snackbar.
   * Wird mit dem konvertierten FoodSearchResult aufgerufen.
   */
  onProductFound?: (product: FoodSearchResult) => void;
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

export function LabelSubFlow({ visible, context, onClose, onSaved, onProductFound }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<NutritionLabelScanResult | null>(null);
  const [resolvedMealId, setResolvedMealId] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowPhotoPicker(false);
      setLoading(false);
      setError(null);
      setScanResult(null);
      setResolvedMealId(null);
      return;
    }
    if (context.purpose !== 'diary') return;
    resolveOrCreateMealId(context.date, context.mealType, context.mealId)
      .then(setResolvedMealId)
      .catch((e) => setError(formatApiError(e, 'Mahlzeit konnte nicht geladen werden')));
  }, [visible, context.purpose, context.date, context.mealType, context.mealId]);

  async function handlePhotoSelected({ uri, mime }: FramedPhotoResult) {
    setError(null);
    setLoading(true);
    try {
      const scanResponse = await aiApi.scanLabel(uri, mime);
      setScanResult(scanResponse);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (isQuotaExceededError(e)) {
        setError('Deine kostenlosen Label-Scans für diesen Monat sind aufgebraucht.');
      } else {
        setError(formatApiError(e, 'Scan fehlgeschlagen'));
      }
    } finally {
      setLoading(false);
    }
  }

  const handleReviewSaved = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved('Label-Scan');
  };

  const handleSavedAsProduct = (item: ReusableItem) => {
    if (!onProductFound) return;
    const product: FoodSearchResult = {
      id: item.id,
      source: 'library',
      name: item.name,
      brand: item.brand,
      displayLabel: item.nutritionPer100g
        ? `${Math.round(item.nutritionPer100g.calories)} kcal / 100g`
        : '',
      nutritionBasis: item.nutritionBasis,
      nutritionPer100g: item.nutritionPer100g,
      portion: item.portion ?? undefined,
      isComplete: item.isComplete,
      category: item.category,
    };
    onProductFound(product);
  };

  if (!visible) return null;

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
          <Text style={styles.title}>📷 Nährwert-Label scannen</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.subtitle}>
            Fotografiere das Nährwert-Label auf der Verpackung oder wähle ein Foto aus der Galerie.
          </Text>

          {error ? <ErrorBanner error={error} /> : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Label wird analysiert…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.pickBtn}
              onPress={() => setShowPhotoPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Foto hinzufügen"
            >
              <Text style={styles.pickBtnText}>📷 Foto hinzufügen</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <FramedPhotoPicker
        visible={showPhotoPicker}
        preset="nutritionLabel"
        output="cropped-file"
        cameraReview="direct"
        sourceTitle="Foto hinzufügen"
        sourceSubtitle="Wähle eine Quelle für dein Nährwert-Label."
        cameraPurpose="ein Nährwert-Label aufzunehmen"
        editorTitle="Label-Ausschnitt"
        onClose={() => setShowPhotoPicker(false)}
        onSelected={(result) => void handlePhotoSelected(result)}
      />

      {/* Review Screen (nested Modal) */}
      {scanResult && resolvedMealId ? (
        <LabelScanReviewScreen
          visible
          mealId={resolvedMealId}
          scanResult={scanResult}
          onClose={() => setScanResult(null)}
          onSaved={handleReviewSaved}
          onSavedAsProduct={onProductFound ? handleSavedAsProduct : undefined}
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
  body: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  subtitle: {
    ...typography.body2,
    color: colors.textMuted,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body2,
    color: colors.textMuted,
  },
  pickBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  pickBtnText: {
    ...typography.body1,
    color: colors.background,
    fontWeight: '600',
  },
});
