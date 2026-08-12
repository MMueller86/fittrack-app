import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FoodSearchResult, RecipeIngredient } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { QuantityInputRow } from '../../shared/components/QuantityInputRow';
import { buildFromProduct } from './ingredientBuilders';

interface Props {
  product: FoodSearchResult;
  replacingIngId?: string | null;
  onAdd: (ingredient: RecipeIngredient) => void;
  onBack: () => void;
}

export function RecipeIngredientAmountView({ product, replacingIngId, onAdd, onBack }: Props) {
  const [mode, setMode] = useState<'grams' | 'portion'>('grams');
  const [value, setValue] = useState('100');

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const rawNutrition = product.nutritionPer100g;
  const nutritionPer100g = {
    calories: rawNutrition?.calories ?? 0,
    protein: rawNutrition?.protein ?? 0,
    carbs: rawNutrition?.carbs ?? 0,
    fat: rawNutrition?.fat ?? 0,
    fiber: rawNutrition?.fiber ?? 0,
  };
  const amount = parseFloat(value.replace(',', '.'));
  const amountIsValid = Number.isFinite(amount) && amount > 0;
  const hasPortion = product.portion?.weightGrams != null && product.portion.weightGrams > 0;

  const handleAdd = () => {
    if (!amountIsValid) {
      Alert.alert('Ungültige Menge', 'Bitte gib eine gültige Menge ein.');
      return;
    }
    const ingredient = buildFromProduct(product, mode, amount);
    onAdd(replacingIngId != null ? { ...ingredient, id: replacingIngId } : ingredient);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Menge auswählen</Text>
      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
      <QuantityInputRow
        nutritionPer100g={nutritionPer100g}
        portionWeightGrams={hasPortion ? product.portion?.weightGrams : undefined}
        portionLabel={hasPortion ? product.portion?.label : undefined}
        mode={mode}
        value={value}
        onChange={(nextMode, nextValue) => {
          setMode(nextMode);
          setValue(nextValue);
        }}
      />
      <TouchableOpacity
        style={[styles.addButton, !amountIsValid && styles.addButtonDisabled]}
        onPress={handleAdd}
        disabled={!amountIsValid}
        activeOpacity={0.8}
      >
        <Text style={styles.addButtonText}>{replacingIngId != null ? 'Zutat ersetzen' : 'Zutat hinzufügen'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  heading: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  productName: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  addButtonDisabled: {
    backgroundColor: colors.border,
  },
  addButtonText: {
    ...typography.button,
    color: colors.white,
  },
});
