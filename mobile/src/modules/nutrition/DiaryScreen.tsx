// DiaryScreen — M1 placeholder.
// Nutrition diary (Meal → MealItems) implemented in M4.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../app/theme';

export default function DiaryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nutrition Diary</Text>
      <Text style={styles.subtitle}>Meal logging — coming in M4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body2,
    color: colors.textSecondary,
  },
});
