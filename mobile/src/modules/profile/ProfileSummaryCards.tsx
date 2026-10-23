// ProfileSummaryCards — Profilübersicht sowie Detailkarten für Alltag, Ziel und Tagesziele.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { UserProfile, ProfileTargets, Gender, ActivityLevel, GoalType } from '@fittrack/shared';
import { colors, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { profileCardStyle } from './ProfileGroup';

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

export function formatMacroTargetValue(
  value: number,
  range?: { minG: number; maxG: number },
): string {
  return range ? `${range.minG}–${range.maxG} g` : `${value} g`;
}

function MacroGrid({
  targets,
  title,
  icon,
}: {
  targets: ProfileTargets['restDay'];
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.macroTitleRow}>
        {icon}
        <Text style={styles.macroTitle}>{title}</Text>
      </View>
      <View style={styles.macroRow}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValueHighlight}>{targets.calories}</Text>
          <Text style={styles.macroLabel}>kcal</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{formatMacroTargetValue(targets.proteinG, targets.macroRanges?.proteinG)}</Text>
          <Text style={styles.macroLabel}>Protein</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{targets.fatG} g</Text>
          <Text style={styles.macroLabel}>Fett</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{formatMacroTargetValue(targets.carbsG, targets.macroRanges?.carbsG)}</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
        </View>
      </View>
    </View>
  );
}

export function BasicDataCard({ profile, onPress }: { profile: UserProfile; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.card, styles.summaryCard]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Profil & Tagesziele"
      accessibilityHint={`Geschlecht ${GENDER_LABELS[profile.gender]}, Alter ${profile.age} Jahre, Größe ${profile.heightCm} cm, Gewicht ${profile.weightKg} kg, Zielgewicht ${profile.targetWeightKg} kg. Öffnet deine Profil- und Tagesziel-Details.`}
    >
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>Profil & Tagesziele</Text>
        <Icon lib="feather" name="chevron-right" size="md" color={colors.textMuted} />
      </View>
      <InfoRow label="Geschlecht" value={GENDER_LABELS[profile.gender]} />
      <InfoRow label="Alter" value={`${profile.age} Jahre`} />
      <InfoRow label="Größe" value={`${profile.heightCm} cm`} />
      <InfoRow label="Gewicht" value={`${profile.weightKg} kg`} />
      <InfoRow label="Zielgewicht" value={`${profile.targetWeightKg} kg`} />
    </TouchableOpacity>
  );
}

export function LifestyleCard({ profile }: { profile: UserProfile }) {
  const activityDisplay = profile.activityLevel
    ? ACTIVITY_LABELS[profile.activityLevel]
    : profile.stepsPerDay != null
    ? `${profile.stepsPerDay.toLocaleString()} Schritte/Tag`
    : '—';

  return (
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
  );
}

export function GoalCard({ profile }: { profile: UserProfile }) {
  return (
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
  );
}

export function TargetsSection({ targets }: { targets: ProfileTargets | null }) {
  if (!targets) return null;
  return (
    <>
      <Text style={styles.sectionHeader}>Tagesziele</Text>
      <MacroGrid
        title="Ruhetag"
        targets={targets.restDay}
        icon={<Icon lib="feather" name="moon" size="md" color={colors.textSecondary} />}
      />
      <MacroGrid
        title="Trainingstag"
        targets={targets.trainingDay}
        icon={<Icon lib="mci" name="weight-lifter" size="md" color={colors.textSecondary} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    ...profileCardStyle,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryCard: { padding: spacing.md },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryTitle: { ...typography.h3, color: colors.text, flex: 1 },
  cardTitle: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase' },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.body2, color: colors.textSecondary },
  infoValue: { ...typography.body2, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  sectionHeader: { ...typography.h3, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },

  macroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  macroTitle: { ...typography.body1, color: colors.text, fontWeight: '600', flexShrink: 1 },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: spacing.sm },
  macroItem: { alignItems: 'center' },
  macroValueHighlight: { ...typography.h3, color: colors.primaryBright },
  macroValue: { ...typography.body1, color: colors.text, fontWeight: '600' },
  macroLabel: { ...typography.caption, color: colors.textMuted },
});
