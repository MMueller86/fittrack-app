// LoginScreen — Entra External ID login via expo-auth-session (PKCE).
// Single "Sign in" button — Entra handles identity provider routing (Google).

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import { LegalDocumentView } from '../legal/LegalDocumentView';
import type { LegalDocumentId } from '../legal/legalTexts';
import { GoogleGlyph } from './landing/GoogleGlyph';
import { LandingPager } from './landing/LandingPager';
import { authTexts } from './authTexts';
import { useAuthLogin } from './useAuthLogin';

// Needed so the browser dismisses properly after auth redirect.
WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
  onLoginSuccess: () => void;
  accountDeletionCleanupNotice?: boolean;
  onAccountDeletionCleanupNoticeShown?: () => void;
}

export default function LoginScreen({
  onLoginSuccess,
  accountDeletionCleanupNotice = false,
  onAccountDeletionCleanupNoticeShown,
}: LoginScreenProps) {
  const { loading, error, canStart, startLogin } = useAuthLogin(onLoginSuccess);
  const [legalDocument, setLegalDocument] = useState<LegalDocumentId | null>(null);
  const cleanupNoticeShown = useRef(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  useEffect(() => {
    if (!accountDeletionCleanupNotice || cleanupNoticeShown.current) return;
    cleanupNoticeShown.current = true;
    showSnackbar({
      message: authTexts.cleanupNotice,
      durationMs: 6000,
      numberOfLines: null,
    });
    onAccountDeletionCleanupNoticeShown?.();
  }, [accountDeletionCleanupNotice, onAccountDeletionCleanupNoticeShown, showSnackbar]);

  function handleSignIn() {
    void startLogin();
  }

  if (legalDocument) {
    return <LegalDocumentView documentId={legalDocument} onBack={() => setLegalDocument(null)} interceptHardwareBack />;
  }

  const signInDisabled = !canStart;

  return (
    <SafeAreaView style={styles.root}>
      <LandingPager />

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.button, signInDisabled && styles.buttonDisabled, pressed && styles.buttonPressed]}
          onPress={handleSignIn}
          disabled={signInDisabled}
          accessibilityRole="button"
          accessibilityLabel={authTexts.signIn}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <GoogleGlyph size={24} />
              <Text style={styles.buttonText}>{authTexts.signIn}</Text>
            </>
          )}
        </Pressable>

        {error && (
          <>
            <Text style={styles.error}>{authTexts.errors[error]}</Text>
            <Pressable
              style={styles.retryLink}
              onPress={handleSignIn}
              disabled={signInDisabled}
              accessibilityRole="button"
              accessibilityLabel={authTexts.retry}
            >
              <Text style={styles.retryLinkText}>{authTexts.retry}</Text>
            </Pressable>
          </>
        )}

        <View style={styles.legalRow}>
          <Pressable
            style={styles.legalLink}
            onPress={() => setLegalDocument('privacy')}
            accessibilityRole="button"
            accessibilityLabel={authTexts.privacyLinkLabel}
          >
            <Text style={styles.legalLinkText}>{authTexts.privacyLink}</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>·</Text>
          <Pressable
            style={styles.legalLink}
            onPress={() => setLegalDocument('imprint')}
            accessibilityRole="button"
            accessibilityLabel={authTexts.imprintLinkLabel}
          >
            <Text style={styles.legalLinkText}>{authTexts.imprintLink}</Text>
          </Pressable>
        </View>
      </View>
      <Snackbar ref={snackbarRef} bottomOffset={spacing.lg} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    ...typography.body1,
    color: colors.background,
    fontWeight: '700',
  },
  error: {
    ...typography.body2,
    color: colors.negative,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryLink: {
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLinkText: {
    ...typography.body2,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  legalLink: {
    minHeight: spacing.xxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  legalLinkText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  legalSeparator: {
    ...typography.body2,
    color: colors.textMuted,
  },
});
