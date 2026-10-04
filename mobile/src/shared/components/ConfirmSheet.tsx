// ConfirmSheet — FitTrack-styled bottom sheet replacing system Alert.alert for confirmations.
// Provides a consistent destructive-action pattern across the app.

import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from './Icon';

export interface ConfirmSheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export interface ConfirmSheetCheckbox {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ConfirmSheetAction[];
  checkbox?: ConfirmSheetCheckbox;
  onClose: () => void;
}

export function ConfirmSheet({ visible, title, subtitle, actions, checkbox, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Title + subtitle */}
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {checkbox ? (
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => checkbox.onChange(!checkbox.checked)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityLabel={checkbox.label}
            accessibilityState={{ checked: checkbox.checked }}
          >
            <View style={[styles.checkbox, checkbox.checked && styles.checkboxChecked]}>
              {checkbox.checked ? <Icon lib="feather" name="check" size={14} color={colors.background} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>{checkbox.label}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions */}
        {actions.map((action, i) => (
          <TouchableOpacity
            key={i}
            style={styles.actionRow}
            onPress={() => {
              onClose();
              action.onPress();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionLabel, action.destructive && styles.actionDestructive]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Cancel */}
        <TouchableOpacity style={[styles.actionRow, styles.cancelRow]} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelLabel}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  textBlock: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  checkboxRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.body2,
    color: colors.text,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  actionRow: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionLabel: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '500',
  },
  actionDestructive: {
    color: colors.negative,
  },
  cancelRow: {
    borderBottomWidth: 0,
    marginTop: spacing.xs,
  },
  cancelLabel: {
    ...typography.body1,
    color: colors.textSecondary,
  },
});
