// ErrorBanner — displays an API/network error with optional retry button.
//
// Usage:
//   <ErrorBanner error={error} onRetry={load} />
//   <ErrorBanner error={error} />   ← no retry button

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';

interface Props {
  error: string;
  onRetry?: () => void | Promise<void>;
}

export function ErrorBanner({ error, onRetry }: Props) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠</Text>
      <View style={styles.body}>
        <Text style={styles.title}>Request failed</Text>
        <Text style={styles.detail}>{error}</Text>
        {onRetry ? (
          <TouchableOpacity
            onPress={handleRetry}
            disabled={retrying}
            style={[styles.retryBtn, retrying && styles.retryBtnDisabled]}
            accessibilityRole="button"
          >
            <Text style={styles.retryLabel}>{retrying ? 'Retrying…' : 'Retry'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(226, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(226, 107, 107, 0.40)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 18,
    color: colors.negative,
    lineHeight: 22,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.body2,
    color: colors.negative,
    fontWeight: '600',
  },
  detail: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'monospace' as const,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.negative,
    borderRadius: radius.sm,
  },
  retryBtnDisabled: {
    opacity: 0.5,
  },
  retryLabel: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
});
