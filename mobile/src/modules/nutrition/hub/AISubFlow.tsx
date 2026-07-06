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
import type { AiMealEstimatePreview } from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../../shared/api/aiApi';
import { aiApi } from '../../../shared/api/aiApi';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { formatApiError } from '../../../shared/api/apiError';
import { isQuotaExceededError } from '../../../shared/api/client';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { diaryApi } from '../../../shared/api/diaryApi';
import MealEstimateReviewScreen from '../MealEstimateReviewScreen';
import MealParserReviewScreen from '../MealParserReviewScreen';
import type { FoodEntryHubContext } from './useFoodEntryHubStore';
import type { MealType } from '@fittrack/shared';

interface Props {
  visible: boolean;
  context: FoodEntryHubContext;
  onClose: () => void;
  onSaved: (label: string) => void;
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

export function AISubFlow({ visible, context, onClose, onSaved }: Props) {
  const [text, setText] = useState('');
  const [mealPhoto, setMealPhoto] = useState<{
    uri: string;
    mimeType: 'image/jpeg' | 'image/png';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealEstimate, setMealEstimate] = useState<AiMealEstimatePreview | null>(null);
  const [parserItems, setParserItems] = useState<MealParserPreviewItem[] | null>(null);
  const [resolvedMealId, setResolvedMealId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setText('');
      setMealPhoto(null);
      setError(null);
      setMealEstimate(null);
      setParserItems(null);
      setResolvedMealId(null);
      return;
    }
    void resolveOrCreateMealId(context.date, context.mealType, context.mealId).then(
      setResolvedMealId,
    );
  }, [visible, context.date, context.mealType, context.mealId]);

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
    if (text.trim().length < 3 || !resolvedMealId) return;
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

  const handleEstimateSaved = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved('KI-Mahlzeitschätzung');
  };

  const handleRefine = (items: MealParserPreviewItem[]) => {
    setMealEstimate(null);
    setParserItems(items);
  };

  const handleParserSaved = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved('KI-Mahlzeitschätzung');
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
              (loading || text.trim().length < 3 || !resolvedMealId) && styles.analyzeBtnDisabled,
            ]}
            onPress={() => void handleAnalyze()}
            disabled={loading || text.trim().length < 3 || !resolvedMealId}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.analyzeBtnText}>Analysieren</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Fast Path */}
      {mealEstimate && resolvedMealId ? (
        <MealEstimateReviewScreen
          visible
          mealId={resolvedMealId}
          originalText={text.trim()}
          estimate={mealEstimate}
          imageUri={mealPhoto?.uri}
          onClose={() => setMealEstimate(null)}
          onSaved={handleEstimateSaved}
          onRefine={handleRefine}
        />
      ) : null}

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
});
