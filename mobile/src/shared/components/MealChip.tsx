import React from 'react';
import type { AccessibilityRole, AccessibilityState } from 'react-native';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface MealChipProps {
  label: string;
  filled: boolean;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}

export function MealChip({
  label,
  filled,
  onPress,
  disabled = false,
  compact = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
}: MealChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        compact && styles.chipCompact,
        filled ? styles.chipFilled : styles.chipEmpty,
        disabled && styles.chipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: filled, disabled, ...accessibilityState }}
    >
      <Text style={[styles.text, filled ? styles.textFilled : styles.textEmpty, disabled && styles.textDisabled]}>
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
  chipCompact: {
    flex: 0,
    flexShrink: 1,
  },
  chipFilled: {
    backgroundColor: colors.primarySoft,
  },
  chipEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipDisabled: {
    opacity: 0.5,
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
  textDisabled: {
    color: colors.textDisabled,
  },
});