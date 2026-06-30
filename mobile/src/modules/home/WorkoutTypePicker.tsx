// WorkoutTypePicker — Bottom-Sheet-Modal zur Auswahl der Trainingsart.
// Wird nach dem Tap auf "Trainingstag" im HomeScreen angezeigt.

import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WorkoutType } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';

interface Props {
  visible: boolean;
  onSelect: (type: WorkoutType | null) => void;
  onClose: () => void;
}

const REST_OPTION = { type: null as null, icon: '😴', label: 'Ruhetag' };

const WORKOUT_OPTIONS: { type: WorkoutType; icon: string; label: string }[] = [
  { type: 'gym', icon: '🏋️', label: 'Gym' },
  { type: 'bouldering', icon: '🧗', label: 'Bouldern / Klettern' },
  { type: 'running', icon: '🏃', label: 'Laufen' },
  { type: 'cycling', icon: '🚴', label: 'Radfahren' },
  { type: 'other', icon: '💡', label: 'Sonstiges' },
];

export default function WorkoutTypePicker({ visible, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />
        <Text style={styles.question}>Wie ist dein heutiger Tag?</Text>

        <View style={styles.optionList}>
          {/* Ruhetag zuerst */}
          <TouchableOpacity
            key="rest"
            style={styles.option}
            onPress={() => onSelect(REST_OPTION.type)}
            activeOpacity={0.7}
          >
            <Text style={styles.optionIcon}>{REST_OPTION.icon}</Text>
            <Text style={styles.optionLabel}>{REST_OPTION.label}</Text>
          </TouchableOpacity>

          {WORKOUT_OPTIONS.map(({ type, icon, label }) => (
            <TouchableOpacity
              key={type}
              style={styles.option}
              onPress={() => onSelect(type)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>{icon}</Text>
              <Text style={styles.optionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Abbrechen</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  question: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  optionList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: { fontSize: 22 },
  optionLabel: { ...typography.body1, color: colors.text },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelText: { ...typography.body1, color: colors.textSecondary },
});
