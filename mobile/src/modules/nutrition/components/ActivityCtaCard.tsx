// ActivityCtaCard — CTA card prompting the user to log a special activity.
// Shown in DiaryScreen when no special activity has been logged for the day.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../../app/theme';

interface ActivityCtaCardProps {
  /** true when the previous day had a special activity */
  dynamic: boolean;
  onAdd: () => void;
}

export function ActivityCtaCard({ dynamic, onAdd }: ActivityCtaCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Besondere Aktivität</Text>
      <Text style={styles.text}>
        {dynamic
          ? 'Gestern warst du außergewöhnlich aktiv — heute wieder?'
          : 'Lange Wanderung oder Radtour? Plane außergewöhnliche Aktivitäten und wir passen dein Kalorienziel automatisch an.'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onAdd} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Aktivität hinzufügen</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.body1,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  text: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center' as const,
  },
  buttonText: {
    ...typography.button,
    color: colors.primary,
  },
});
