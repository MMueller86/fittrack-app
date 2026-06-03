// ProfileEditScreen — Einseitiges Bearbeitungsformular für das Benutzerprofil.
// Wird aus ProfileScreen via Navigation aufgerufen und erhält das aktuelle Profil als Parameter.
// Speichert via PUT /api/profile (updateProfile).

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { colors, radius, spacing, typography } from '../../app/theme';
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
      gender: null, age: '', heightCm: '', weightKg: '', targetWeightKg: '',
      stepsPreset: null, stepsPerDay: '', stepsUnknown: false, activityLevel: null,
      trainingFrequencyPerWeek: 0, trainingDurationMinutes: 60,
      sports: [], goal: null, goalIntensity: null,
    };
  }
  const preset = p.stepsPerDay != null && STEP_PRESETS.includes(p.stepsPerDay) ? p.stepsPerDay : null;
  const customSteps = p.stepsPerDay != null && !STEP_PRESETS.includes(p.stepsPerDay) ? String(p.stepsPerDay) : '';
  return {
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

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
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
      Alert.alert('Fehler', 'Bitte Schritte oder Aktivitätslevel angeben.');
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
      Alert.alert('Fehler', 'Profil konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      'Profil löschen',
      'Möchtest du dein Profil wirklich löschen? Alle persönlichen Daten und Zielwerte werden entfernt. Beim nächsten App-Start wirst du erneut nach einem Profil gefragt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await profileApi.deleteProfile();
              navigation.goBack();
            } catch {
              Alert.alert('Fehler', 'Profil konnte nicht gelöscht werden. Bitte erneut versuchen.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>{isNew ? 'Profil anlegen' : 'Profil bearbeiten'}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid() || loading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {loading
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={[styles.saveText, !isValid() && styles.saveTextDisabled]}>Speichern</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>

          {/* ── Basisdaten ── */}
          <SectionTitle>Basisdaten</SectionTitle>

          <FieldLabel>Geschlecht</FieldLabel>
          <View style={styles.chipRow}>
            {(['male', 'female', 'other'] as Gender[]).map((g) => (
              <ChipButton key={g} label={GENDER_LABELS[g]} selected={form.gender === g} onPress={() => update({ gender: g })} />
            ))}
          </View>

          <NumericField label="Alter" value={form.age} onChangeText={(v) => update({ age: v })} unit="Jahre" />
          <NumericField label="Größe" value={form.heightCm} onChangeText={(v) => update({ heightCm: v })} unit="cm" />
          <NumericField label="Aktuelles Gewicht" value={form.weightKg} onChangeText={(v) => update({ weightKg: v })} unit="kg" />
          <NumericField label="Zielgewicht" value={form.targetWeightKg} onChangeText={(v) => update({ targetWeightKg: v })} unit="kg" />

          {/* ── Alltag ── */}
          <SectionTitle>Alltag</SectionTitle>

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
                  style={[styles.optionRow, form.activityLevel === level && styles.optionRowSelected]}
                  onPress={() => update({ activityLevel: level })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, form.activityLevel === level && styles.optionTextSelected]}>
                    {ACTIVITY_LEVEL_LABELS[level]}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── Training ── */}
          <SectionTitle>Training</SectionTitle>

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

          {/* ── Ziel ── */}
          <SectionTitle>Ziel</SectionTitle>

          {GOALS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.goalCard, form.goal === g && styles.goalCardSelected]}
              onPress={() => update({ goal: g, goalIntensity: null })}
              activeOpacity={0.7}
            >
              <Text style={[styles.goalTitle, form.goal === g && styles.goalTitleSelected]}>{GOAL_LABELS[g]}</Text>
              <Text style={styles.goalDesc}>{GOAL_DESCRIPTIONS[g]}</Text>
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

          {/* Bottom save button */}
          <TouchableOpacity
            style={[styles.saveButton, !isValid() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isValid() || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <Text style={styles.saveButtonText}>Speichern</Text>
            }
          </TouchableOpacity>

          {/* Danger zone — nur bei bestehendem Profil */}
          {!isNew && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteButtonText}>Profil löschen</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTitle: { ...typography.h3, color: colors.text },
  cancelText: { ...typography.body1, color: colors.textSecondary },
  saveText: { ...typography.button, color: colors.primary },
  saveTextDisabled: { color: colors.textDisabled },

  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
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
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  textInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: spacing.md },
  unitText: { ...typography.body2, color: colors.textMuted, marginLeft: spacing.sm },

  optionRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionRowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { ...typography.body1, color: colors.textSecondary },
  optionTextSelected: { color: colors.primaryBright, fontWeight: '600' },

  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  goalCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  goalTitle: { ...typography.body1, color: colors.text, fontWeight: '600', marginBottom: 2 },
  goalTitleSelected: { color: colors.primaryBright },
  goalDesc: { ...typography.caption, color: colors.textMuted },

  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { ...typography.button, color: colors.background },

  deleteButton: {
    borderWidth: 1,
    borderColor: colors.negative,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  deleteButtonText: { ...typography.button, color: colors.negative },
});
