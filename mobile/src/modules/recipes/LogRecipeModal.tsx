// LogRecipeModal — Portion picker + meal selector + live kcal preview
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LogRecipeModal({ visible, recipe, onClose, onLogged }: Props) {
  const [portions, setPortions] = useState(1);
  const [customPortions, setCustomPortions] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [diary, setDiary] = useState<DiaryDayResponse | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  const effectivePortions = useCustom
    ? parseFloat(customPortions) || 0
    : portions;

  const kcalPreview = Math.round(recipe.nutritionPerPortion.calories * effectivePortions);

  useEffect(() => {
    if (!visible) return;
    const today = isoToday();
    diaryApi.getDay(today).then((data) => {
      setDiary(data);
      // auto-select first meal
      if (data.meals.length > 0 && selectedMealId === null) {
        setSelectedMealId(data.meals[0].id);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleLog = async () => {
    if (!selectedMealId) {
      Alert.alert('Mahlzeit wählen', 'Bitte wähle eine Mahlzeit aus.');
      return;
    }
    if (effectivePortions <= 0) {
      Alert.alert('Portion', 'Bitte gib eine gültige Portionszahl ein.');
      return;
    }
    setLogging(true);
    try {
      await recipeApi.log(recipe.id, { portions: effectivePortions, mealId: selectedMealId });
      onLogged();
    } catch {
      Alert.alert('Fehler', 'Rezept konnte nicht eingetragen werden.');
    } finally {
      setLogging(false);
    }
  };

  const meals = diary?.meals ?? [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Portion eintragen</Text>
          <TouchableOpacity onPress={handleLog} disabled={logging || effectivePortions <= 0}>
            <Text style={[styles.save, (logging || effectivePortions <= 0) && styles.saveDisabled]}>
              {logging ? '…' : 'Eintragen'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Recipe name */}
          <Text style={styles.recipeName}>{recipe.name}</Text>
          <Text style={styles.kcalPreview}>{kcalPreview} kcal</Text>

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
              placeholder="z. B. 1.5"
              placeholderTextColor={colors.textMuted}
              value={customPortions}
              onChangeText={setCustomPortions}
            />
          )}

          {/* Meal selector */}
          <Text style={styles.label}>Mahlzeit</Text>
          {meals.length === 0 ? (
            <Text style={styles.noMeals}>Keine Mahlzeiten heute gefunden.</Text>
          ) : (
            meals.map((meal) => (
              <TouchableOpacity
                key={meal.id}
                style={[styles.mealRow, meal.id === selectedMealId && styles.mealRowActive]}
                onPress={() => setSelectedMealId(meal.id)}
              >
                <Text style={[styles.mealName, meal.id === selectedMealId && styles.mealNameActive]}>
                  {meal.name ?? MEAL_LABELS[meal.type]}
                </Text>
                {meal.id === selectedMealId && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
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
  kcalPreview: { ...typography.h1, color: colors.primaryBright, marginBottom: spacing.lg },
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  mealName: { ...typography.body1, color: colors.text },
  mealNameActive: { color: colors.primaryBright, fontWeight: '600' },
  checkmark: { ...typography.body1, color: colors.primary },
  noMeals: { ...typography.body2, color: colors.textMuted },
});
