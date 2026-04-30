// HomeScreen — M1 placeholder.
// Will display macro progress bars/cards and today's summary in M3.
// For now provides entry points to feature screens (Weight tracking).

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { HomeStackParamList } from '../../app/navigation/RootNavigator';
import { colors, radius, spacing, typography } from '../../app/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Today's summary — coming in M3</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('WeightDetail')}
        accessibilityRole="button"
      >
        <Text style={styles.cardTitle}>Weight tracking</Text>
        <Text style={styles.cardSubtitle}>Log your weight and view history</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
  },
});
