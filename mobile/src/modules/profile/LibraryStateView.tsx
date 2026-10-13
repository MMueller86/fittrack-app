// LibraryStateView — Lade-, Fehler- und Leerzustand der Bibliotheks-Listen.
// Scrollbar und mit Pull-to-Refresh, damit große Schrift und schmale Viewports nichts abschneiden.

import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';

interface Props {
  kind: 'loading' | 'error' | 'empty';
  title?: string;
  body?: string;
  iconName?: ComponentProps<typeof Feather>['name'];
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function LibraryStateView({ kind, title, body, iconName, onRetry, refreshing, onRefresh }: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing === true} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
    >
      {kind === 'loading' ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Wird geladen" />
      ) : (
        <>
          <Icon
            lib="feather"
            name={iconName ?? (kind === 'error' ? 'alert-circle' : 'inbox')}
            size="lg"
            color={colors.textMuted}
          />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {body ? <Text style={styles.body}>{body}</Text> : null}
          {kind === 'error' && onRetry ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Erneut versuchen"
            >
              <Text style={styles.retryText}>Erneut versuchen</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  body: { ...typography.body2, color: colors.textSecondary, textAlign: 'center' },
  retryButton: {
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  retryText: { ...typography.button, color: colors.white },
});
