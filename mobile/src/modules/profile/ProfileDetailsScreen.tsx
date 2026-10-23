// ProfileDetailsScreen — Alltag & Training, Ziel und Tagesziele (Route `ProfileDetails`).
// Erreichbar über Profil-Hub → Profil & Tagesziele; `Bearbeiten` öffnet ProfileEdit.

import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { Snackbar } from '../../shared/components/Snackbar';
import { GoalCard, LifestyleCard, TargetsSection } from './ProfileSummaryCards';
import { ProfileEmptyState, ProfileErrorState, ProfileLoadingState } from './ProfileStateViews';
import { useProfileData } from './useProfileData';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileDetails'>;

export default function ProfileDetailsScreen({ navigation }: Props) {
  const { status, profile, targets, refreshing, refresh, retry, snackbarRef } = useProfileData();

  function renderBody() {
    if (status === 'loading') {
      return (
        <ScrollView contentContainerStyle={styles.centerContent}>
          <ProfileLoadingState />
        </ScrollView>
      );
    }
    if (status === 'error') {
      return (
        <ScrollView contentContainerStyle={styles.centerContent}>
          <ProfileErrorState onRetry={retry} />
        </ScrollView>
      );
    }
    if (!profile) {
      return (
        <ScrollView contentContainerStyle={styles.centerContent}>
          <ProfileEmptyState />
        </ScrollView>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <LifestyleCard profile={profile} />
        <GoalCard profile={profile} />
        <TargetsSection targets={targets} />
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Icon lib="feather" name="chevron-left" size="lg" color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Profil & Tagesziele</Text>
        {status === 'ready' && profile ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('ProfileEdit', { profile })}
            activeOpacity={0.7}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Profil bearbeiten"
          >
            <Icon lib="feather" name="edit-2" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {renderBody()}
      <Snackbar ref={snackbarRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.h3,
    color: colors.text,
  },
  headerSpacer: { width: spacing.xxl },
  editButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: spacing.md, paddingBottom: spacing.md },
  centerContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
});
