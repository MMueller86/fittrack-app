// Root application component — auth gate wrapping the main navigator.
// Shows LoginScreen when unauthenticated, main app when authenticated.

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { RootNavigator } from './navigation';
import LoginScreen from '../modules/auth/LoginScreen';
import { useAuthStore } from '../modules/auth/useAuthStore';
import { colors } from './theme';

export default function App() {
  const { isAuthenticated, initialize, login } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  // Loading state — checking stored tokens
  if (isAuthenticated === null) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Unauthenticated — show login
  if (!isAuthenticated) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onLoginSuccess={login} />
      </>
    );
  }

  // Authenticated — show main app
  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
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
