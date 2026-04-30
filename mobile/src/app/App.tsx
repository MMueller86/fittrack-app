// Root application component — M1 navigation shell.
// Auth gate and authenticated user flow will wrap the navigator in M2.

import React from 'react';
import { StatusBar } from 'expo-status-bar';

import { RootNavigator } from './navigation';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}

