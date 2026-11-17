// Entry point for the Expo bare app.
// Registers the root component with React Native's app registry.
// Navigation shell and screen modules are wired in M1 (navigation milestone).

// GestureHandler MUST be the first import
import 'react-native-gesture-handler';
// Telemetry episode origin: MUST be the second import, directly after the gesture handler.
import { markAppRegistered } from './src/services/telemetry/startMark';

import { registerRootComponent } from 'expo';
import App from './src/app/App';

markAppRegistered();
registerRootComponent(App);
