// Root application component — auth gate wrapping the main navigator.
// Shows LoginScreen when unauthenticated, main app when authenticated.

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './navigation';
import LoginScreen from '../modules/auth/LoginScreen';
import { useAuthStore } from '../modules/auth/useAuthStore';
import { colors } from './theme';
import ErrorBoundary from './ErrorBoundary';

export default function App() {
  const { isAuthenticated, initialize, login } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  // Loading state — checking stored tokens
  if (isAuthenticated === null) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <View style={styles.loading}>
            <StatusBar style="light" />
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  // Unauthenticated — show login
  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <LoginScreen onLoginSuccess={login} />
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  // Authenticated — show main app
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
