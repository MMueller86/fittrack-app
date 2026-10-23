// ProfileEditScreen — Einseitiges Bearbeitungsformular für das Benutzerprofil.
// Wird aus ProfileDetails via Navigation aufgerufen und erhält das aktuelle Profil als Parameter.
// Speichert via PUT /api/profile (updateProfile).

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  Gender,
  GoalType,
  GoalIntensity,
  Sport,
  ActivityLevel,
  UserProfile,
} from '@fittrack/shared';
import { profileApi } from '../../shared/api/profileApi';
import { listWeights } from '../../services/weightsService';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileEdit'>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Männlich',
  female: 'Weiblich',
  other: 'Divers',
};

const GOAL_LABELS: Record<GoalType, string> = {
  lose_weight: 'Abnehmen',
  maintain: 'Gewicht halten',
  gain_muscle: 'Muskeln aufbauen',
  recomposition: 'Rekomposition',
};

const GOAL_DESCRIPTIONS: Record<GoalType, string> = {
  lose_weight: 'Kaloriendefizit für Fettabbau',
  maintain: 'Kalorienbilanz ausgeglichen halten',
  gain_muscle: 'Kalorienüberschuss für Muskelaufbau',
  recomposition: 'Fett abbauen & Muskeln aufbauen',
};

const INTENSITY_LABELS: Record<GoalIntensity, string> = {
  gentle: 'Sanft (–0,25 kg/Woche)',
  moderate: 'Moderat (–0,5 kg/Woche)',
  aggressive: 'Aggressiv (–0,75 kg/Woche)',
};

const SPORT_LABELS: Record<Sport, string> = {
  strength: 'Krafttraining',
  bouldering: 'Bouldern',
  running: 'Laufen',
  cycling: 'Radfahren',
  swimming: 'Schwimmen',
  hiking: 'Wandern',
  teamsport: 'Teamsport',
  other: 'Sonstiges',
};

const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Überwiegend sitzend',
  light: 'Leicht aktiv',
  active: 'Aktiv',
  very_active: 'Sehr aktiv',
};

const ALL_SPORTS: Sport[] = ['strength', 'bouldering', 'running', 'cycling', 'swimming', 'hiking', 'teamsport', 'other'];
const GOALS: GoalType[] = ['lose_weight', 'maintain', 'gain_muscle', 'recomposition'];
const INTENSITIES: GoalIntensity[] = ['gentle', 'moderate', 'aggressive'];
const ALL_ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'active', 'very_active'];
const STEP_PRESETS = [5000, 7500, 10000, 12500, 15000];
const DURATION_OPTIONS = [30, 60, 90, 120, 150];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  displayName: string;
  gender: Gender | null;
  age: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  stepsPreset: number | null;
  stepsPerDay: string;
  stepsUnknown: boolean;
  activityLevel: ActivityLevel | null;
  trainingFrequencyPerWeek: number;
  trainingDurationMinutes: number;
  sports: Sport[];
  goal: GoalType | null;
  goalIntensity: GoalIntensity | null;
}

function profileToForm(p: UserProfile | null): FormState {
  if (!p) {
    return {
      displayName: '',
      gender: null, age: '', heightCm: '', weightKg: '', targetWeightKg: '',
      stepsPreset: null, stepsPerDay: '', stepsUnknown: false, activityLevel: null,
      trainingFrequencyPerWeek: 0, trainingDurationMinutes: 60,
      sports: [], goal: null, goalIntensity: null,
    };
  }
  const preset = p.stepsPerDay != null && STEP_PRESETS.includes(p.stepsPerDay) ? p.stepsPerDay : null;
  const customSteps = p.stepsPerDay != null && !STEP_PRESETS.includes(p.stepsPerDay) ? String(p.stepsPerDay) : '';
  return {
    displayName: p.displayName ?? '',
    gender: p.gender,
    age: String(p.age),
    heightCm: String(p.heightCm),
    weightKg: String(p.weightKg),
    targetWeightKg: String(p.targetWeightKg),
    stepsPreset: preset,
    stepsPerDay: customSteps,
    stepsUnknown: p.stepsPerDay === null,
    activityLevel: p.activityLevel,
    trainingFrequencyPerWeek: p.trainingFrequencyPerWeek,
    trainingDurationMinutes: p.trainingDurationMinutes || 60,
    sports: p.sports,
    goal: p.goal,
    goalIntensity: p.goalIntensity,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({
  children,
  description,
  iconName,
}: {
  children: string;
  description: string;
  iconName: 'user' | 'sun' | 'activity' | 'target';
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon}>
        <Icon lib="feather" name={iconName} size="md" color={colors.primaryBright} />
      </View>
      <View style={styles.sectionHeadingText}>
        <Text style={styles.sectionTitle}>{children}</Text>
        <Text style={styles.sectionDescription}>{description}</Text>
      </View>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function ChipButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function NumericField({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldRow}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.inputWithUnit}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '0'}
          placeholderTextColor={colors.textMuted}
        />
        {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProfileEditScreen({ route, navigation }: Props) {
  const existing = route.params.profile;
  const isNew = existing === null;

  const [form, setForm] = useState<FormState>(() => profileToForm(existing));
  const [loading, setLoading] = useState(false);
  const [saveErrorVisible, setSaveErrorVisible] = useState(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  // Pre-fill current weight from diary when creating a new profile
  useEffect(() => {
    if (!isNew) return;
    listWeights().then((entries) => {
      if (entries.length === 0) return;
      const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      const diffDays = (Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) {
        const value = latest.unit === 'lbs' ? +(latest.value * 0.453592).toFixed(1) : latest.value;
        setForm((prev) => ({ ...prev, weightKg: String(value) }));
      }
    }).catch(() => { /* silently ignore */ });
  }, [isNew]);

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function isValid(): boolean {
    if (!form.gender || !form.goal) return false;
    if (!parseInt(form.age, 10) || !parseFloat(form.heightCm) || !parseFloat(form.weightKg) || !parseFloat(form.targetWeightKg)) return false;
    if (form.stepsUnknown) return form.activityLevel !== null;
    const hasSteps = form.stepsPreset !== null || parseInt(form.stepsPerDay, 10) > 0;
    if (!hasSteps && form.activityLevel === null) return false;
    if (form.goal === 'lose_weight' || form.goal === 'gain_muscle') return form.goalIntensity !== null;
    return true;
  }

  async function handleSave() {
    if (!form.gender || !form.goal) return;
    const stepsPerDay = form.stepsUnknown ? null : (form.stepsPreset ?? (form.stepsPerDay ? parseInt(form.stepsPerDay, 10) : null));
    const activityLevel = form.stepsUnknown ? form.activityLevel : null;
    if (stepsPerDay === null && activityLevel === null) {
      showSnackbar({ message: 'Bitte Schritte oder Aktivitätslevel angeben.' });
      return;
    }
    const input = {
      gender: form.gender,
      age: parseInt(form.age, 10),
      heightCm: parseFloat(form.heightCm),
      weightKg: parseFloat(form.weightKg),
      targetWeightKg: parseFloat(form.targetWeightKg),
      stepsPerDay,
      activityLevel,
      trainingFrequencyPerWeek: form.trainingFrequencyPerWeek,
      trainingDurationMinutes: form.trainingDurationMinutes,
      sports: form.sports,
      goal: form.goal,
      goalIntensity: form.goalIntensity,
      ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
    };
    setLoading(true);
    try {
      if (isNew) {
        await profileApi.createProfile(input);
      } else {
        await profileApi.updateProfile(input);
      }
      navigation.goBack();
    } catch {
      setSaveErrorVisible(true);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.navAction}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Abbrechen"
          >
            <Text style={styles.cancelText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle} accessibilityRole="header">{isNew ? 'Profil anlegen' : 'Profil bearbeiten'}</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>

          <View style={styles.sectionCard}>
            <SectionTitle description="Damit deine Ziele zu deinem Körper passen" iconName="user">
              Basisdaten
            </SectionTitle>

            <FieldLabel>Geschlecht</FieldLabel>
            <View style={styles.chipRow}>
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <ChipButton
                  key={g}
                  label={GENDER_LABELS[g]}
                  selected={form.gender === g}
                  onPress={() => update({ gender: g })}
                />
              ))}
            </View>

            <View style={styles.fieldRow}>
              <FieldLabel>Wie möchtest du genannt werden? (optional)</FieldLabel>
              <View style={styles.inputWithUnit}>
                <TextInput
                  style={styles.textInput}
                  value={form.displayName}
                  onChangeText={(v) => update({ displayName: v })}
                  placeholder="z.B. Michael"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  maxLength={50}
                />
              </View>
            </View>

            <NumericField label="Alter" value={form.age} onChangeText={(v) => update({ age: v })} unit="Jahre" />
            <NumericField label="Größe" value={form.heightCm} onChangeText={(v) => update({ heightCm: v })} unit="cm" />
            <NumericField label="Aktuelles Gewicht" value={form.weightKg} onChangeText={(v) => update({ weightKg: v })} unit="kg" />
            <NumericField label="Zielgewicht" value={form.targetWeightKg} onChangeText={(v) => update({ targetWeightKg: v })} unit="kg" />
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle description="Dein Alltag hilft bei der Berechnung" iconName="sun">
              Alltag
            </SectionTitle>

            <FieldLabel>Schritte pro Tag</FieldLabel>
            <View style={styles.chipRow}>
              {STEP_PRESETS.map((p) => (
                <ChipButton
                  key={p}
                  label={p.toLocaleString()}
                  selected={!form.stepsUnknown && form.stepsPreset === p}
                  onPress={() => update({ stepsPreset: p, stepsPerDay: '', activityLevel: null, stepsUnknown: false })}
                />
              ))}
              <ChipButton
                label="Eigene Zahl"
                selected={!form.stepsUnknown && form.stepsPreset === null && form.stepsPerDay !== ''}
                onPress={() => update({ stepsPreset: null, activityLevel: null, stepsUnknown: false })}
              />
              <ChipButton
                label="Kenne ich nicht"
                selected={form.stepsUnknown}
                onPress={() => update({ stepsUnknown: true, stepsPreset: null, stepsPerDay: '' })}
              />
            </View>

            {!form.stepsUnknown && form.stepsPreset === null && (
              <NumericField
                label="Eigene Schrittzahl"
                value={form.stepsPerDay}
                onChangeText={(v) => update({ stepsPerDay: v })}
                unit="Schritte"
              />
            )}

            {form.stepsUnknown && (
              <>
                <FieldLabel>Aktivitätslevel</FieldLabel>
                {ALL_ACTIVITY_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={styles.optionRow}
                    onPress={() => update({ activityLevel: level })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, form.activityLevel === level && styles.optionTextSelected]}>
                      {ACTIVITY_LEVEL_LABELS[level]}
                    </Text>
                    {form.activityLevel === level
                      ? <Icon lib="feather" name="check" size="md" color={colors.primaryBright} />
                      : null}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle description="Berücksichtige dein regelmäßiges Training" iconName="activity">
              Training
            </SectionTitle>

            <FieldLabel>Trainingstage pro Woche</FieldLabel>
            <View style={styles.chipRow}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                <ChipButton
                  key={n}
                  label={n === 0 ? 'Kein' : `${n}×`}
                  selected={form.trainingFrequencyPerWeek === n}
                  onPress={() => update({ trainingFrequencyPerWeek: n })}
                />
              ))}
            </View>

            {form.trainingFrequencyPerWeek > 0 && (
              <>
                <FieldLabel>Dauer pro Training</FieldLabel>
                <View style={styles.chipRow}>
                  {DURATION_OPTIONS.map((d) => (
                    <ChipButton
                      key={d}
                      label={`${d} min`}
                      selected={form.trainingDurationMinutes === d}
                      onPress={() => update({ trainingDurationMinutes: d })}
                    />
                  ))}
                </View>

                <FieldLabel>Sportarten (optional)</FieldLabel>
                <View style={styles.chipRow}>
                  {ALL_SPORTS.map((sport) => (
                    <ChipButton
                      key={sport}
                      label={SPORT_LABELS[sport]}
                      selected={form.sports.includes(sport)}
                      onPress={() => {
                        const next = form.sports.includes(sport)
                          ? form.sports.filter((s) => s !== sport)
                          : [...form.sports, sport];
                        update({ sports: next });
                      }}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={styles.sectionCard}>
            <SectionTitle description="Wähle, worauf du hinarbeitest" iconName="target">
              Ziel
            </SectionTitle>

            {GOALS.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.goalCard}
                onPress={() => update({ goal: g, goalIntensity: null })}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: form.goal === g }}
              >
                <View style={styles.goalText}>
                  <Text style={[styles.goalTitle, form.goal === g && styles.goalTitleSelected]}>
                    {GOAL_LABELS[g]}
                  </Text>
                  <Text style={styles.goalDesc}>{GOAL_DESCRIPTIONS[g]}</Text>
                </View>
                {form.goal === g ? <Icon lib="feather" name="check" size="md" color={colors.primaryBright} /> : null}
              </TouchableOpacity>
            ))}

            {(form.goal === 'lose_weight' || form.goal === 'gain_muscle') && (
              <>
                <FieldLabel>Intensität</FieldLabel>
                <View style={styles.chipRow}>
                  {INTENSITIES.map((i) => (
                    <ChipButton
                      key={i}
                      label={INTENSITY_LABELS[i]}
                      selected={form.goalIntensity === i}
                      onPress={() => update({ goalIntensity: i })}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

        </ScrollView>
        <View style={styles.saveFooter} testID="profile-edit-save-footer">
          <TouchableOpacity
            style={[styles.saveButton, !isValid() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isValid() || loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Speichern"
            accessibilityState={{ disabled: !isValid() || loading, busy: loading }}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <Icon lib="feather" name="save" size="md" color={colors.background} />
            }
            <Text style={styles.saveButtonText}>Speichern</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <InfoOverlay
        visible={saveErrorVisible}
        title="Speichern fehlgeschlagen"
        body="Das Profil konnte nicht gespeichert werden. Bitte versuche es erneut."
        onClose={() => setSaveErrorVisible(false)}
      />
      <Snackbar ref={snackbarRef} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navAction: { minHeight: spacing.xxl, justifyContent: 'center' },
  navSpacer: { width: spacing.xl },
  navTitle: { ...typography.h3, color: colors.text, flexShrink: 1, textAlign: 'center' },
  cancelText: { ...typography.body1, color: colors.textSecondary },

  scroll: { padding: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },

  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: 0,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  sectionHeadingText: { flex: 1, gap: spacing.xs },
  sectionTitle: { ...typography.h3, color: colors.text },
  sectionDescription: { ...typography.body2, color: colors.textSecondary },
  fieldLabel: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    minHeight: spacing.xxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...typography.body2, color: colors.textSecondary },
  chipTextSelected: { color: colors.primaryBright, fontWeight: '600' },

  fieldRow: { marginBottom: spacing.sm },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: spacing.xxl,
  },
  textInput: { ...typography.body1, flex: 1, color: colors.text, paddingVertical: spacing.sm },
  unitText: { ...typography.body2, color: colors.textMuted, marginLeft: spacing.sm },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.xxl,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { ...typography.body1, color: colors.textSecondary },
  optionTextSelected: { color: colors.primaryBright, fontWeight: '600' },

  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: spacing.xxl,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  goalText: { flex: 1, gap: spacing.xs },
  goalTitle: { ...typography.body1, color: colors.text, fontWeight: '600' },
  goalTitleSelected: { color: colors.primaryBright },
  goalDesc: { ...typography.caption, color: colors.textMuted },

  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: spacing.xxl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { ...typography.button, color: colors.background },
  saveFooter: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },

});
