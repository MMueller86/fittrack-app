// ProfileScreen — Profil-Hub: Kartenplatz (Basisdaten bzw. Lade-/Fehler-/Leerzustand), darunter die
// Navigationsgruppen (Persönliche Daten, Bibliothek, Integrationen, Gemeinsam, Rechtliches — siehe profileHubGroups.ts).
// Der aktive Tab liefert den Screen-Kontext; Bibliothek, Integrationen und Rechtliches bleiben immer sichtbar.

import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '../../app/theme';
import { Snackbar } from '../../shared/components/Snackbar';
import ProfileWizardScreen from './ProfileWizardScreen';
import { ProfileGroup, ProfileRow, profileCardStyle } from './ProfileGroup';
import { getProfileHubGroups } from './profileHubGroups';
import { BasicDataCard } from './ProfileSummaryCards';
import { ProfileEmptyState, ProfileErrorState, ProfileLoadingState } from './ProfileStateViews';
import { useProfileData } from './useProfileData';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

export default function ProfileScreen({ navigation }: Props) {
  const { status, profile, refreshing, refresh, retry, snackbarRef } = useProfileData();
  const [showWizard, setShowWizard] = useState(false);

  if (showWizard) {
    return (
      <ProfileWizardScreen
        isNewProfile={true}
        onComplete={() => { setShowWizard(false); retry(); }}
        onDismiss={() => { setShowWizard(false); }}
      />
    );
  }

  function renderCardSlot() {
    if (status === 'loading') {
      return (
        <View style={styles.stateCard}>
          <ProfileLoadingState />
        </View>
      );
    }
    if (status === 'error') {
      return (
        <View style={styles.stateCard}>
          <ProfileErrorState onRetry={retry} />
        </View>
      );
    }
    if (!profile) {
      return (
        <View style={styles.stateCard}>
          <ProfileEmptyState onSetup={() => setShowWizard(true)} />
        </View>
      );
    }
    return <BasicDataCard profile={profile} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {renderCardSlot()}

        {getProfileHubGroups({ hasProfile: status === 'ready' && profile !== null }).map((group) => (
          <ProfileGroup key={group.id} title={group.title}>
            {group.entries.map((entry) => (
              <ProfileRow
                key={entry.id}
                label={entry.label}
                detail={entry.detail}
                iconName={entry.iconName}
                onPress={() => navigation.navigate(entry.route)}
              />
            ))}
          </ProfileGroup>
        ))}
      </ScrollView>
      <Snackbar ref={snackbarRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  stateCard: {
    ...profileCardStyle,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
});
