// Root application component — auth gate wrapping the main navigator.
// Shows LoginScreen when unauthenticated, main app when authenticated.

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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

  let content: React.ReactNode;

  if (isAuthenticated === null) {
    // Loading state — checking stored tokens
    content = (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  } else if (!isAuthenticated) {
    // Unauthenticated — show login
    content = (
      <>
        <StatusBar style="light" />
        <LoginScreen onLoginSuccess={login} />
      </>
    );
  } else {
    // Authenticated — show main app
    content = (
      <>
        <StatusBar style="light" />
        <RootNavigator />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <SafeAreaProvider>
          {content}
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
