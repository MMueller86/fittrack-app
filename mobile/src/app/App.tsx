// Root application component — auth gate wrapping the main navigator.
// Shows LoginScreen when unauthenticated, main app when authenticated.

import React, { useEffect } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { RootNavigator } from './navigation';
import { FoodEntryHub } from '../modules/nutrition/hub/FoodEntryHub';
import LoginScreen from '../modules/auth/LoginScreen';
import { useAuthStore } from '../modules/auth/useAuthStore';
import { colors } from './theme';
import ErrorBoundary from './ErrorBoundary';

// Intercept native-reconciler errors that bypass ErrorBoundary (e.g. "Text strings must be rendered")
// Logs the full call stack so the source is identifiable during debugging.
const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('Text strings must be rendered') || msg.includes('must be rendered within')) {
    originalError('[DEBUG] Text-render error caught:');
    originalError(...args);
    originalError('[DEBUG] Call stack:', new Error('Trace').stack);
  } else {
    originalError(...args);
  }
};


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
        <FoodEntryHub />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            {content}
          </BottomSheetModalProvider>
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
