// CoachingHeroCard — kompakter Begrüßungsbereich des HomeScreens.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { WorkoutType } from '@fittrack/shared';
import { Icon } from '../../shared/components/Icon';
import { HOME_TRAINING_PRESENTATION } from './homeTrainingPresentation';

interface Props {
  displayName: string;
  greeting: string;
  dayType: 'rest' | 'training' | null;
  workoutType: WorkoutType | null;
  onTrainingPress: () => void;
}

export function CoachingHeroCard({
  displayName,
  greeting,
  dayType,
  workoutType,
  onTrainingPress,
}: Props) {
  const trainingPresentation =
    dayType === 'rest'
      ? HOME_TRAINING_PRESENTATION.rest
      : workoutType && dayType === 'training'
        ? HOME_TRAINING_PRESENTATION[workoutType]
        : null;

  const selectorLabel = trainingPresentation?.label ?? 'Training';

  return (
    <View style={styles.card} testID="coaching-hero-card">
      <View style={styles.row} testID="coaching-hero-row">
        <Text style={styles.greeting}>
          {greeting},{' '}
          <Text style={styles.name}>{displayName}</Text>
          {'  👋'}
        </Text>
        <TouchableOpacity
          style={styles.trainingChip}
          onPress={onTrainingPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Tagesart auswählen: ${selectorLabel}`}
          testID="training-selector"
        >
          {trainingPresentation ? (
            <>
              <Icon
                lib="mci"
                name={trainingPresentation.icon}
                size="sm"
                color={colors.textSecondary}
              />
              <Text style={styles.trainingChipText}>{trainingPresentation.label}</Text>
            </>
          ) : (
            <Text style={styles.trainingChipText}>Training</Text>
          )}
          <Text style={styles.trainingChipChevron}>▾</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  greeting: {
    flex: 1,
    flexShrink: 1,
    ...typography.h3,
    color: colors.textSecondary,
  },
  name: {
    ...typography.h3,
    color: colors.text,
  },
  trainingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    flexShrink: 1,
    maxWidth: '58%',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  trainingChipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  trainingChipChevron: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
