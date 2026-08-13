import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface MealChipProps {
  label: string;
  filled: boolean;
  onPress: () => void;
}

export function MealChip({ label, filled, onPress }: MealChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, filled ? styles.chipFilled : styles.chipEmpty]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Text style={[styles.text, filled ? styles.textFilled : styles.textEmpty]}>
        {filled ? '✓ ' : '○ '}{label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  chipFilled: {
    backgroundColor: colors.primarySoft,
  },
  chipEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
  textFilled: {
    color: colors.primary,
  },
  textEmpty: {
    color: colors.textMuted,
  },
});