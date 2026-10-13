// Profil-Stack-Routen für Impressum und Datenschutzerklärung (Profil > Rechtliches).

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';
import { LegalDocumentView } from './LegalDocumentView';

export function ImprintScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'Imprint'>) {
  return <LegalDocumentView documentId="imprint" onBack={() => navigation.goBack()} />;
}

export function PrivacyPolicyScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'PrivacyPolicy'>) {
  return <LegalDocumentView documentId="privacy" onBack={() => navigation.goBack()} />;
}
