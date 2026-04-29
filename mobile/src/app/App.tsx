// Root application component — M1 navigation shell.
// Auth gate and authenticated user flow will wrap the navigator in M2.

import React from 'react';
import { RootNavigator } from './navigation';

export default function App() {
  return <RootNavigator />;
}

