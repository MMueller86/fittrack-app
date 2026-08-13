// Shared amount input row — segmented g/Portion control + TextInput + optional live kcal preview.
// No API calls — pure UI + calculation only.
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { calculateNutrition } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';

interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface Props {
  nutritionPer100g: NutritionValues;
  portionWeightGrams?: number;
  portionLabel?: string;
  mode: 'grams' | 'portion';
  value: string;
  onChange: (mode: 'grams' | 'portion', value: string) => void;
  /** Display live kcal preview. Defaults true. */
  showKcalPreview?: boolean;
}

export function QuantityInputRow({
  nutritionPer100g,
  portionWeightGrams,
  portionLabel,
  mode,
  value,
  onChange,
  showKcalPreview = true,
}: Props) {
  const hasPortion = portionWeightGrams != null && portionWeightGrams > 0;
  const label = portionLabel ?? 'Portion';
  const num = parseFloat(value.replace(',', '.'));
  const validNum = Number.isFinite(num) && num > 0;

  let kcal: number | null = null;
  if (validNum && showKcalPreview) {
    try {
      const result = calculateNutrition(
        mode,
        num,
        nutritionPer100g,
        hasPortion ? portionWeightGrams : undefined,
      );
      kcal = Math.round(result.calculatedNutrition.calories);
    } catch {
      // invalid input — leave kcal null
    }
  }

  return (
    <View>
      <View style={styles.row}>
        {hasPortion && (
          <View style={styles.segCtrl}>
            <TouchableOpacity
              style={[styles.seg, mode === 'grams' && styles.segActive]}
              onPress={() => onChange('grams', value)}
            >
              <Text style={[styles.segTxt, mode === 'grams' && styles.segTxtActive]}>g</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.seg, mode === 'portion' && styles.segActive]}
              onPress={() => onChange('portion', value)}
            >
              <Text style={[styles.segTxt, mode === 'portion' && styles.segTxtActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={(v) => onChange(mode, v)}
          placeholder="100"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.unit}>{mode === 'portion' ? label : 'g'}</Text>
        {showKcalPreview && kcal !== null && (
          <Text style={styles.kcal}>{kcal} kcal</Text>
        )}
      </View>
      {hasPortion && mode === 'portion' && portionWeightGrams != null && (
        <Text style={styles.hint}>
          1 {label} = {portionWeightGrams} g
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  segCtrl: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  seg: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surface,
  },
  segActive: { backgroundColor: colors.primary },
  segTxt: { ...typography.caption, color: colors.textMuted },
  segTxtActive: { color: colors.white, fontWeight: '600' },
  input: {
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 60,
    textAlign: 'right',
  },
  unit: { ...typography.caption, color: colors.textMuted },
  kcal: { ...typography.caption, color: colors.primary, marginLeft: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
