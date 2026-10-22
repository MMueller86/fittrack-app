// LoginScreen — Entra External ID login via expo-auth-session (PKCE).
// Single "Sign in" button — Entra handles identity provider routing (Google).

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, typography } from '../../app/theme';
import { authConfig } from '../../services/authConfig';
import { authService } from '../../services/authService';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import { LegalDocumentView } from '../legal/LegalDocumentView';

// Needed so the browser dismisses properly after auth redirect.
WebBrowser.maybeCompleteAuthSession();

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: authConfig.authorizationEndpoint,
  tokenEndpoint: authConfig.tokenEndpoint,
};

// Native redirect URI — uses the custom scheme defined in app.json.
// Must match the redirect URI registered in Azure Portal (fittrack://auth).
const redirectUri = AuthSession.makeRedirectUri({ scheme: 'fittrack', path: 'auth' });

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const cleanupNoticeShown = useRef(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: authConfig.clientId,
      scopes: authConfig.scopes,
      redirectUri,
      usePKCE: true,
      // Skips the Entra sign-in page and goes straight to Google.
      extraParams: { domain_hint: 'google' },
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      exchangeCode(response.params.code, request?.codeVerifier ?? '');
    } else if (response?.type === 'error') {
      const errorDetail = response.params?.error_description
        || response.error?.message
        || 'Authentication failed';
      setError(errorDetail);
      setLoading(false);
    } else if (response?.type === 'dismiss') {
      setLoading(false);
    }
  }, [response]);

  useEffect(() => {
    if (!accountDeletionCleanupNotice || cleanupNoticeShown.current) return;
    cleanupNoticeShown.current = true;
    showSnackbar({
      message: 'Einige private App-Daten von FitTrack konnten auf diesem Gerät nicht gelöscht werden. Du kannst die App-Daten in den Android-Einstellungen entfernen.',
      durationMs: 6000,
      numberOfLines: null,
    });
    onAccountDeletionCleanupNoticeShown?.();
  }, [accountDeletionCleanupNotice, onAccountDeletionCleanupNoticeShown, showSnackbar]);

  async function exchangeCode(code: string, codeVerifier: string) {
    try {
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: authConfig.clientId,
          code,
          redirectUri,
          extraParams: { code_verifier: codeVerifier },
        },
        discovery,
      );

      const { accessToken, refreshToken } = tokenResponse;
      if (!accessToken || !refreshToken) {
        setError('Token response missing access or refresh token');
        setLoading(false);
        return;
      }

      await authService.saveTokens(accessToken, refreshToken);
      onLoginSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Token exchange failed');
      setLoading(false);
    }
  }

  function handleSignIn() {
    setError(null);
    setLoading(true);
    promptAsync();
  }

  if (showPrivacy) {
    return <LegalDocumentView documentId="privacy" onBack={() => setShowPrivacy(false)} interceptHardwareBack />;
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.title}>FitTrack</Text>
        <Text style={styles.subtitle}>Track your nutrition, effortlessly.</Text>

        <Pressable
          style={[styles.button, (!request || loading) && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={!request || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.buttonText}>Sign in with Google</Text>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={styles.privacyLink}
          onPress={() => setShowPrivacy(true)}
          accessibilityRole="button"
          accessibilityLabel="Datenschutzerklärung lesen"
        >
          <Text style={styles.privacyLinkText}>Datenschutzerklärung</Text>
        </Pressable>
      </ScrollView>
      <Snackbar ref={snackbarRef} bottomOffset={spacing.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body1,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    minWidth: 220,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  error: {
    ...typography.body2,
    color: colors.negative,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  privacyLink: {
    minHeight: spacing.xxl,
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  privacyLinkText: {
    ...typography.body2,
    color: colors.primaryBright,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
