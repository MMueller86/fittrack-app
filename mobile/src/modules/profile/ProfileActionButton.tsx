import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';

type Tone = 'primary' | 'danger';

interface ProfileActionButtonProps {
  label: string;
  iconName: ComponentProps<typeof Feather>['name'];
  tone: Tone;
  onPress: () => void;
  accessibilityHint?: string;
}

export function ProfileActionButton({
  label,
  iconName,
  tone,
  onPress,
  accessibilityHint,
}: ProfileActionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, tone === 'danger' ? styles.dangerButton : styles.primaryButton]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      <Icon lib="feather" name={iconName} size="md" color={tone === 'danger' ? colors.negative : colors.primaryBright} />
      <Text style={[styles.label, tone === 'danger' ? styles.dangerLabel : styles.primaryLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  primaryButton: { borderColor: colors.primary },
  dangerButton: { borderColor: colors.negative },
  label: { ...typography.button },
  primaryLabel: { color: colors.primaryBright },
  dangerLabel: { color: colors.negative },
});