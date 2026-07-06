// ErrorBoundary — Fängt unkontrollierte React-Fehler (Crashes) auf.
// Zeigt eine saubere Fehlerseite statt eines Whitescreens.
// Der Stacktrace wird via console.error geloggt (erscheint in Expo-Logs / Sentry).

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { colors, radius, spacing, typography } from './theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error.message);
    console.error('[ErrorBoundary] JS Stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
    // Auch als einzelne Zeilen für bessere Terminal-Lesbarkeit
    info.componentStack?.split('\n').forEach((line, i) => {
      if (line.trim()) console.error(`  [#${i}] ${line.trim()}`);
    });
  }

  handleReset = () => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    const { error, componentStack } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Etwas ist schiefgelaufen</Text>
          <Text style={styles.message}>
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
          </Text>

          <View style={styles.errorBox}>
            <Text style={styles.errorLabel} selectable>Fehler:</Text>
            <Text style={styles.errorText} selectable>
              {error.message}
            </Text>
          </View>

          {componentStack ? (
            <View style={styles.stackBox}>
              <Text style={styles.errorLabel}>Component Stack (kopierbar):</Text>
              <Text style={styles.stackText} selectable>
                {componentStack}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body1,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  errorLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: '600' as const,
  },
  errorText: {
    ...typography.caption,
    color: colors.negative,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  stackBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.xl,
    maxHeight: 300,
  },
  stackText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 16,
    fontSize: 10,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.button,
    color: colors.background,
  },
});
