// CoachingHeroCard — kompakter Begrüßungsbereich des HomeScreens.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { WorkoutType } from '@fittrack/shared';
import { Icon } from '../../shared/components/Icon';
import { HOME_TRAINING_PRESENTATION } from './homeTrainingPresentation';
import { hasCompactInsight, type DailyInsightResponse } from '../../services/insightService';
import { InsightCard } from './InsightCard';

interface Props {
  displayName: string;
  greeting: string;
  dayType: 'rest' | 'training' | null;
  workoutType: WorkoutType | null;
  onTrainingPress: () => void;
  insight?: DailyInsightResponse | null;
  insightDate?: string | null;
  onFeedbackSuccess?: () => void;
}

export function CoachingHeroCard({
  displayName,
  greeting,
  dayType,
  workoutType,
  onTrainingPress,
  insight = null,
  insightDate = null,
  onFeedbackSuccess,
}: Props) {
  const [isInsightExpanded, setIsInsightExpanded] = useState(false);
  useEffect(() => {
    setIsInsightExpanded(false);
  }, [insight?.generatedAt, insightDate]);
  const compactAvailable = hasCompactInsight(insight);
  const trainingPresentation =
    dayType === 'rest'
      ? HOME_TRAINING_PRESENTATION.rest
      : workoutType && dayType === 'training'
        ? HOME_TRAINING_PRESENTATION[workoutType]
        : null;

  const selectorLabel = trainingPresentation?.label ?? 'Training';

  return (
    <>
    <View style={styles.card} testID="coaching-hero-card">
      <View style={styles.row} testID="coaching-hero-row">
        <Text style={styles.greeting}>
          {compactAvailable ? insight.greeting : <>{greeting},{' '}
          <Text style={styles.name}>{displayName}</Text>
          {'  👋'}</>}
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
      {compactAvailable ? (
        <>
          <Text style={styles.shortInsight} testID="short-insight">{insight.shortInsight}</Text>
          {isInsightExpanded ? (
            <InsightCard
              key={`${insightDate}:${insight.generatedAt}`}
              insight={insight}
              date={insightDate}
              inlineDetail
              onFeedbackSuccess={onFeedbackSuccess}
            />
          ) : null}
          <TouchableOpacity
            style={styles.insightToggle}
            accessibilityRole="button"
            accessibilityLabel={isInsightExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
            accessibilityHint={isInsightExpanded
              ? 'Blendet die vollständige Analyse wieder aus.'
              : 'Zeigt die vollständige Analyse an.'}
            accessibilityState={{ expanded: isInsightExpanded }}
            onPress={() => setIsInsightExpanded((expanded) => !expanded)}
          >
            <Text style={styles.insightToggleText}>
              {isInsightExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
            </Text>
            <Icon
              lib="feather"
              name={isInsightExpanded ? 'chevron-up' : 'chevron-down'}
              size="sm"
              color={colors.primary}
            />
          </TouchableOpacity>
        </>
      ) : null}
    </View>
    </>
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
    minHeight: spacing.xxl,
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
  shortInsight: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  insightToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: spacing.xxl,
    gap: spacing.xs,
  },
  insightToggleText: {
    ...typography.button,
    color: colors.primary,
    flexShrink: 1,
  },
});
