import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon, type MCIName } from './Icon';

type QuickAction = 'ai' | 'barcode';

const QUICK_ACTIONS: Record<QuickAction, { accessibilityLabel: string; label: string; icon?: MCIName }> = {
  ai: { accessibilityLabel: 'KI schätzen', label: 'Schätzen' },
  barcode: { accessibilityLabel: 'Barcode scannen', label: 'Scan', icon: 'barcode-scan' },
};

interface Props {
  action: QuickAction;
  onPress: () => void;
  hitSlop?: TouchableOpacityProps['hitSlop'];
}

export function FoodEntryQuickActionButton({ action, onPress, hitSlop }: Props) {
  const quickAction = QUICK_ACTIONS[action];

  return (
    <TouchableOpacity
      style={styles.action}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={quickAction.accessibilityLabel}
      hitSlop={hitSlop}
    >
      <View style={styles.actionMark}>
        {quickAction.icon ? (
          <Icon lib="mci" name={quickAction.icon} size="md" color={colors.primary} />
        ) : (
          <Text style={styles.aiMark}>KI</Text>
        )}
      </View>
      <Text style={styles.actionLabel} numberOfLines={1}>
        {quickAction.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs / 2,
  },
  actionMark: {
    width: spacing.xl + spacing.xs,
    height: spacing.xl + spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiMark: {
    ...typography.h3,
    color: colors.primary,
    letterSpacing: 0,
  },
  actionLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    textAlign: 'center',
    width: 52,
    letterSpacing: 0,
    lineHeight: 12,
    includeFontPadding: false,
  },
});