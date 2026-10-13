// LibraryFoodCard — gemeinsamer Karten-Container für Favoriten und Eigene Lebensmittel:
// Hauptbereich (optional tippbar) und rechts ein 48-pt-Aktionsbutton.

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { spacing } from '../../app/theme';
import { profileCardStyle } from './ProfileGroup';

interface LibraryFoodCardProps {
  children: React.ReactNode;
  /** Ohne `onPress` ist der Hauptbereich nicht tippbar. */
  onPress?: () => void;
  accessibilityHint?: string;
  actionLabel: string;
  onAction: () => void;
  actionIcon: React.ReactNode;
}

export function LibraryFoodCard({
  children,
  onPress,
  accessibilityHint,
  actionLabel,
  onAction,
  actionIcon,
}: LibraryFoodCardProps) {
  return (
    <View style={styles.card}>
      {onPress ? (
        <TouchableOpacity
          style={styles.main}
          onPress={onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityHint={accessibilityHint}
        >
          {children}
        </TouchableOpacity>
      ) : (
        <View style={styles.main}>{children}</View>
      )}
      <TouchableOpacity
        style={styles.action}
        onPress={onAction}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        {actionIcon}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...profileCardStyle,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  main: { flex: 1, padding: spacing.md },
  action: {
    minWidth: spacing.xxl,
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
