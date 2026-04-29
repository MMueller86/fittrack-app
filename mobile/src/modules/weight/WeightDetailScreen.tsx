// WeightDetailScreen — pushed from Home, not a tab.
// M1 placeholder — weight tracking implemented in M3.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../app/theme';

export default function WeightDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weight Tracking</Text>
      <Text style={styles.subtitle}>Weight log and trend — coming in M3</Text>
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
