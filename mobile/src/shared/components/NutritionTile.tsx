import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface NutritionTileProps {
  label: string;
  value: number;
  unit: string;
}

export function NutritionTile({ label, value, unit }: NutritionTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value}>
        {Math.round(value)}
        <Text style={styles.unit}> {unit}</Text>
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { ...typography.body1, color: colors.text, fontWeight: '700' },
  unit: { ...typography.caption, color: colors.textMuted, fontWeight: '400' },
  label: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});