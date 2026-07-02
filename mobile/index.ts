// Entry point for the Expo bare app.
// Registers the root component with React Native's app registry.
// Navigation shell and screen modules are wired in M1 (navigation milestone).

// GestureHandler MUST be the first import
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';
import App from './src/app/App';

registerRootComponent(App);
