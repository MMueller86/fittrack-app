// Entry point for the Expo bare app.
// Registers the root component with React Native's app registry.
// Navigation shell and screen modules are wired in M1 (navigation milestone).

import { registerRootComponent } from 'expo';
import App from './src/app/App';

registerRootComponent(App);
