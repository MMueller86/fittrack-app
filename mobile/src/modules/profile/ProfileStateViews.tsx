// ProfileStateViews — Lade-, Fehler- und Leerzustand des Profils (Inhalt ohne Container).
// Hub rendert sie im Kartenplatz, ProfileDetails zentriert im Screen.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';

export function ProfileLoadingState() {
  return <ActivityIndicator color={colors.primary} accessibilityLabel="Profil wird geladen" />;
}

export function ProfileErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <Icon lib="feather" name="alert-circle" size="lg" color={colors.textMuted} />
      <Text style={styles.stateTitle}>Profil konnte nicht geladen werden</Text>
      <Text style={styles.stateBody}>Bitte prüfe deine Verbindung und versuche es erneut.</Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onRetry}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Erneut versuchen"
      >
        <Text style={styles.primaryButtonText}>Erneut versuchen</Text>
      </TouchableOpacity>
    </>
  );
}

// Ohne `onSetup` wird kein Einrichten-Button gezeigt (ProfileDetails).
export function ProfileEmptyState({ onSetup }: { onSetup?: () => void }) {
  return (
    <>
      <Text style={styles.stateTitle}>Noch kein Profil</Text>
      <Text style={styles.stateBody}>Richte dein Profil ein, damit FitTrack deine Ziele berechnen kann.</Text>
      {onSetup ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onSetup}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Profil einrichten"
        >
          <Text style={styles.primaryButtonText}>Profil einrichten</Text>
          <Icon lib="feather" name="arrow-right" size="md" color={colors.white} />
        </TouchableOpacity>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  stateTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  stateBody: { ...typography.body1, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: spacing.xxl,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: { ...typography.button, color: colors.white },
});
