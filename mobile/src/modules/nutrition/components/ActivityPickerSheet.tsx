// ActivityPickerSheet — bottom sheet for selecting a special activity type.
// Uses React Native Modal (screen-level safe, follows ConfirmSheet pattern).
// Wandern is the only currently available activity type (MVP).

import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { Icon } from '../../../shared/components/Icon';

export interface ActivityPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectHiking: () => void;
  onSelectCycling: () => void;
}

interface ActivityOption {
  key: string;
  label: string;
  iconName: string;
  available: boolean;
  onPress?: () => void;
}

export function ActivityPickerSheet({ visible, onClose, onSelectHiking, onSelectCycling }: ActivityPickerSheetProps) {
  const insets = useSafeAreaInsets();

  const activities: ActivityOption[] = [
    { key: 'hiking',  label: 'Wandern',    iconName: 'hiking',          available: true,  onPress: onSelectHiking },
    { key: 'running', label: 'Laufen',     iconName: 'run',             available: false },
    { key: 'cycling', label: 'Radfahren',  iconName: 'bike',            available: true,  onPress: onSelectCycling },
    { key: 'other',   label: 'Sonstige',   iconName: 'dots-horizontal', available: false },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Aktivität auswählen</Text>

        {activities.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={[styles.activityRow, !a.available && styles.activityRowDisabled]}
            onPress={a.available && a.onPress ? a.onPress : undefined}
            activeOpacity={a.available ? 0.7 : 1}
            disabled={!a.available}
          >
            <View style={[styles.iconWrapper, !a.available && styles.iconWrapperDisabled]}>
              <Icon
                lib="mci"
                name={a.iconName as React.ComponentProps<typeof Icon>['name'] extends never ? never : any}
                size="lg"
                color={a.available ? colors.primary : colors.textDisabled}
              />
            </View>
            <Text style={[styles.activityLabel, !a.available && styles.activityLabelDisabled]}>
              {a.label}
            </Text>
            {!a.available ? (
              <View style={styles.soonBadge}>
                <Text style={styles.soonText}>Bald verfügbar</Text>
              </View>
            ) : (
              <Icon lib="feather" name="chevron-right" size="md" color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
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
  title: {
    ...typography.body1,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  activityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityRowDisabled: {
    opacity: 0.5,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconWrapperDisabled: {
    backgroundColor: colors.surfaceElevated,
  },
  activityLabel: {
    ...typography.body1,
    fontWeight: '600' as const,
    color: colors.text,
    flex: 1,
  },
  activityLabelDisabled: {
    color: colors.textMuted,
  },
  soonBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  soonText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
