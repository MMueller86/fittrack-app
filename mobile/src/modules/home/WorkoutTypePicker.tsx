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
import { Icon } from '../../shared/components/Icon';
import {
  HOME_TRAINING_KEYS,
  HOME_TRAINING_PRESENTATION,
} from './homeTrainingPresentation';

interface Props {
  visible: boolean;
  onSelect: (type: WorkoutType | null) => void;
  onClose: () => void;
}

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
          {HOME_TRAINING_KEYS.map((key) => {
            const option = HOME_TRAINING_PRESENTATION[key];
            return (
              <TouchableOpacity
                key={key}
                style={styles.option}
                onPress={() => onSelect(option.workoutType)}
                activeOpacity={0.7}
              >
                <View style={styles.optionIcon}>
                  <Icon lib="mci" name={option.icon} size="md" color={colors.textSecondary} />
                </View>
                <Text style={styles.optionLabel}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
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
  optionIcon: {
    width: spacing.lg,
    alignItems: 'center',
  },
  optionLabel: { ...typography.body1, color: colors.text },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelText: { ...typography.body1, color: colors.textSecondary },
});
