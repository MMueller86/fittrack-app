// LabelSubFlow — Nährwert-Label scannen via ImageCropPicker.
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
import type { FoodEntryHubContext } from './useFoodEntryHubStore';
import type { MealType } from '@fittrack/shared';

// ImageCropPicker with graceful fallback (native module)
let ImageCropPicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImageCropPicker = require('react-native-image-crop-picker').default;
} catch {
  // native module not available (Expo Go, CI, etc.)
}

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
  if (mealId) return mealId;
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

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setError(null);
      setScanResult(null);
      setResolvedMealId(null);
      return;
    }
    void resolveOrCreateMealId(context.date, context.mealType, context.mealId).then(
      setResolvedMealId,
    );
  }, [visible, context.date, context.mealType, context.mealId]);

  async function handlePickImage(source: 'camera' | 'gallery') {
    setError(null);

    if (!ImageCropPicker) {
      setError('Label-Scan ist nur in EAS-Builds verfügbar, nicht in Expo Go.');
      return;
    }

    setLoading(true);
    try {
      let imageUri: string;
      let mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg';

      if (source === 'camera') {
        const image = await ImageCropPicker.openCamera({
          cropping: true,
          freeStyleCropEnabled: true,
          mediaType: 'photo',
        });
        imageUri = image.path;
        mimeType = image.mime === 'image/png' ? 'image/png' : 'image/jpeg';
      } else {
        const image = await ImageCropPicker.openPicker({
          cropping: true,
          freeStyleCropEnabled: true,
          mediaType: 'photo',
        });
        imageUri = image.path;
        mimeType = image.mime === 'image/png' ? 'image/png' : 'image/jpeg';
      }

      const scanResponse = await aiApi.scanLabel(imageUri, mimeType);
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
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.pickBtn}
                onPress={() => void handlePickImage('camera')}
              >
                <Text style={styles.pickBtnText}>📷 Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickBtn}
                onPress={() => void handlePickImage('gallery')}
              >
                <Text style={styles.pickBtnText}>🖼️ Galerie</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Review Screen (nested Modal — same pattern as AddItemModal) */}
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
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
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
