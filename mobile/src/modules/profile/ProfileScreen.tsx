// ProfileScreen — Zeigt das aktuelle Benutzerprofil und die berechneten Tagesziele.
// Über den "Bearbeiten"-Button gelangt man zu ProfileEditScreen.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { UserProfile, ProfileTargets, Gender, ActivityLevel, GoalType } from '@fittrack/shared';
import { profileApi } from '../../shared/api/profileApi';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Männlich',
  female: 'Weiblich',
  other: 'Divers',
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Überwiegend sitzend',
  light: 'Leicht aktiv',
  active: 'Aktiv',
  very_active: 'Sehr aktiv',
};

const GOAL_LABELS: Record<GoalType, string> = {
  lose_weight: 'Abnehmen',
  maintain: 'Gewicht halten',
  gain_muscle: 'Muskeln aufbauen',
  recomposition: 'Rekomposition',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MacroGrid({ targets, title }: { targets: ProfileTargets['restDay']; title: string }) {
  return (
    <View style={styles.macroCard}>
      <Text style={styles.macroTitle}>{title}</Text>
      <View style={styles.macroRow}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValueHighlight}>{targets.calories}</Text>
          <Text style={styles.macroLabel}>kcal</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{targets.proteinG} g</Text>
          <Text style={styles.macroLabel}>Protein</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{targets.fatG} g</Text>
          <Text style={styles.macroLabel}>Fett</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{targets.carbsG} g</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<ProfileTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await profileApi.getMe();
      setProfile(res.profile as UserProfile | null);
      setTargets(res.targets);
    } catch {
      // Fehler ignorieren — leerer Zustand wird angezeigt
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  // --- Loading ---
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // --- Kein Profil ---
  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Noch kein Profil</Text>
          <Text style={styles.emptyBody}>Richte dein Profil ein, damit FitTrack deine Ziele berechnen kann.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('ProfileEdit', { profile: null })}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Profil anlegen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Aktivitätslevel ermitteln ---
  const activityDisplay = profile.activityLevel
    ? ACTIVITY_LABELS[profile.activityLevel]
    : profile.stepsPerDay != null
    ? `${profile.stepsPerDay.toLocaleString()} Schritte/Tag`
    : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Mein Profil</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('ProfileEdit', { profile })}
            activeOpacity={0.7}
          >
            <Text style={styles.editButtonText}>Bearbeiten</Text>
          </TouchableOpacity>
        </View>

        {/* Basisdaten */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Basisdaten</Text>
          <InfoRow label="Geschlecht" value={GENDER_LABELS[profile.gender]} />
          <InfoRow label="Alter" value={`${profile.age} Jahre`} />
          <InfoRow label="Größe" value={`${profile.heightCm} cm`} />
          <InfoRow label="Gewicht" value={`${profile.weightKg} kg`} />
          <InfoRow label="Zielgewicht" value={`${profile.targetWeightKg} kg`} />
        </View>

        {/* Alltag & Training */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alltag & Training</Text>
          <InfoRow label="Aktivität" value={activityDisplay} />
          <InfoRow
            label="Training"
            value={
              profile.trainingFrequencyPerWeek === 0
                ? 'Kein Training'
                : `${profile.trainingFrequencyPerWeek}× / Woche, ${profile.trainingDurationMinutes} min`
            }
          />
          {profile.sports.length > 0 && (
            <InfoRow label="Sportarten" value={profile.sports.join(', ')} />
          )}
        </View>

        {/* Ziel */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ziel</Text>
          <InfoRow label="Ziel" value={GOAL_LABELS[profile.goal]} />
          {profile.goalIntensity && (
            <InfoRow
              label="Intensität"
              value={profile.goalIntensity === 'gentle' ? 'Sanft' : profile.goalIntensity === 'moderate' ? 'Moderat' : 'Aggressiv'}
            />
          )}
        </View>

        {/* Tagesziele */}
        {targets && (
          <>
            <Text style={styles.sectionHeader}>Tagesziele</Text>
            <MacroGrid title="🛌 Ruhetag" targets={targets.restDay} />
            <MacroGrid title="💪 Trainingstag" targets={targets.trainingDay} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  screenTitle: { ...typography.h2, color: colors.text },
  editButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  editButtonText: { ...typography.button, color: colors.primaryBright },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase' },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.body2, color: colors.textSecondary },
  infoValue: { ...typography.body2, color: colors.text, fontWeight: '600' },

  sectionHeader: { ...typography.h3, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },

  macroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroTitle: { ...typography.body1, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem: { alignItems: 'center' },
  macroValueHighlight: { ...typography.h3, color: colors.primaryBright },
  macroValue: { ...typography.body1, color: colors.text, fontWeight: '600' },
  macroLabel: { ...typography.caption, color: colors.textMuted },

  emptyTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  emptyBody: { ...typography.body1, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  primaryButtonText: { ...typography.button, color: colors.background },
});

