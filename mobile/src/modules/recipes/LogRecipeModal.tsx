// LogRecipeModal — Portion picker + meal selector + live kcal preview
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DiaryDayResponse, MealType, Recipe } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { recipeApi } from '../../shared/api/recipeApi';
import { diaryApi } from '../../shared/api/diaryApi';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import { MealChip } from '../../shared/components/MealChip';
import { NutritionTile } from '../../shared/components/NutritionTile';
import {
  LOGGABLE_MEAL_TYPES,
  resolvePortionInput,
  scaleNutritionByPortions,
  submitRecipeLog,
  type PortionInput,
} from '../../shared/viewModels/recipeLoggingViewModel';
import { getSuggestedMealType } from '../nutrition/hub/mealTimeRules';
import { nutritionSyncService } from '../../services/health/nutritionSyncService';

interface Props {
  visible: boolean;
  recipe: Recipe;
  onClose: () => void;
  onLogged: () => void;
}

const QUICK_PORTIONS = [0.5, 1, 1.5, 2] as const;

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
  preworkout: 'Pre-Workout',
  postworkout: 'Post-Workout',
};

const MEAL_OPTIONS = LOGGABLE_MEAL_TYPES.map((type) => ({
  type,
  label: MEAL_LABELS[type],
}));

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LogRecipeModal({ visible, recipe, onClose, onLogged }: Props) {
  const [portions, setPortions] = useState(1);
  const [customPortions, setCustomPortions] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [diary, setDiary] = useState<DiaryDayResponse | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(() => getSuggestedMealType());
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [logging, setLogging] = useState(false);
  const [errorNotice, setErrorNotice] = useState<{ title: string; body: string } | null>(null);

  const portionInput: PortionInput = useCustom ? customPortions : portions;
  const parsedPortions = resolvePortionInput(portionInput);
  const effectivePortions = parsedPortions ?? 0;
  const hasValidPortions = parsedPortions !== null;

  const nutritionPreview = scaleNutritionByPortions(recipe.nutritionPerPortion, effectivePortions);
  const canSubmit = hasValidPortions && !diaryLoading && diary !== null && !logging;

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const today = isoToday();
    setPortions(1);
    setCustomPortions('');
    setUseCustom(false);
    setSelectedMealType(getSuggestedMealType());
    setDiary(null);
    setDiaryLoading(true);
    setErrorNotice(null);

    diaryApi.getDay(today)
      .then((data) => {
        if (!cancelled) setDiary(data);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorNotice({
            title: 'Tagebuch konnte nicht geladen werden',
            body: 'Bitte versuche es später erneut.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setDiaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleLog = async () => {
    if (!hasValidPortions) {
      setErrorNotice({
        title: 'Portion prüfen',
        body: 'Bitte gib eine gültige Portionszahl ein.',
      });
      return;
    }
    if (!diary) {
      setErrorNotice({
        title: 'Tagebuch noch nicht bereit',
        body: 'Bitte warte kurz und versuche es erneut.',
      });
      return;
    }

    setLogging(true);
    try {
      const today = isoToday();
      const submission = await submitRecipeLog(
        {
          date: today,
          recipeId: recipe.id,
          mealType: selectedMealType,
          portions: portionInput,
        },
        {
          getDiary: diaryApi.getDay,
          createMeal: diaryApi.createMeal,
          logRecipe: recipeApi.log,
        },
      );
      setDiary(submission.diary);
      void nutritionSyncService.syncNutritionUpsert(submission.result);
      onLogged();
    } catch {
      setErrorNotice({
        title: 'Rezept konnte nicht eingetragen werden',
        body: 'Bitte versuche es später erneut.',
      });
    } finally {
      setLogging(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={logging}>
            <Text style={styles.cancel}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Portion eintragen</Text>
          <TouchableOpacity onPress={handleLog} disabled={!canSubmit}>
            <Text style={[styles.save, !canSubmit && styles.saveDisabled]}>
              {logging ? '…' : 'Eintragen'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Recipe name */}
          <Text style={styles.recipeName}>{recipe.name}</Text>
          <Text style={styles.sectionLabel}>Nährwerte für {effectivePortions || 0} Portionen</Text>
          <View style={styles.nutritionRow}>
            <NutritionTile label="Kalorien" value={nutritionPreview.calories} unit="kcal" />
            <NutritionTile label="Protein" value={nutritionPreview.protein} unit="g" />
            <NutritionTile label="Kohlenhydr." value={nutritionPreview.carbs} unit="g" />
            <NutritionTile label="Fett" value={nutritionPreview.fat} unit="g" />
          </View>

          {/* Quick portion picker */}
          <Text style={styles.label}>Portionen</Text>
          <View style={styles.quickRow}>
            {QUICK_PORTIONS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.quickChip, !useCustom && portions === p && styles.quickChipActive]}
                onPress={() => { setPortions(p); setUseCustom(false); }}
              >
                <Text style={[styles.quickChipText, !useCustom && portions === p && styles.quickChipTextActive]}>
                  {p}×
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.quickChip, useCustom && styles.quickChipActive]}
              onPress={() => setUseCustom(true)}
            >
              <Text style={[styles.quickChipText, useCustom && styles.quickChipTextActive]}>Andere</Text>
            </TouchableOpacity>
          </View>

          {useCustom && (
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="z. B. 1,5"
              placeholderTextColor={colors.textMuted}
              value={customPortions}
              onChangeText={setCustomPortions}
            />
          )}

          {/* Meal type selector */}
          <Text style={styles.label}>Mahlzeit</Text>
          <View style={styles.mealChipRow}>
            {MEAL_OPTIONS.slice(0, 3).map((option) => (
              <MealChip
                key={option.type}
                label={option.label}
                filled={selectedMealType === option.type}
                onPress={() => setSelectedMealType(option.type)}
              />
            ))}
          </View>
          <View style={styles.mealChipRow}>
            {MEAL_OPTIONS.slice(3).map((option) => (
              <MealChip
                key={option.type}
                label={option.label}
                filled={selectedMealType === option.type}
                onPress={() => setSelectedMealType(option.type)}
              />
            ))}
          </View>

          {diaryLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Tagebuch wird geladen …</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <InfoOverlay
        visible={errorNotice != null}
        title={errorNotice?.title ?? 'Fehler'}
        body={errorNotice?.body ?? ''}
        onClose={() => setErrorNotice(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.text },
  cancel: { ...typography.body1, color: colors.textSecondary },
  save: { ...typography.button, color: colors.primary },
  saveDisabled: { color: colors.textDisabled },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  recipeName: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  sectionLabel: { ...typography.overline, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  nutritionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  label: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  quickRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  quickChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  quickChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  quickChipText: { ...typography.body2, color: colors.textSecondary },
  quickChipTextActive: { color: colors.primaryBright, fontWeight: '600' },
  input: {
    ...typography.body1,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  mealChipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  loadingText: { ...typography.body2, color: colors.textMuted },
});
