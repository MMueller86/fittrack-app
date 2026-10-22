// ProfileEditScreen — Einseitiges Bearbeitungsformular für das Benutzerprofil.
// Wird aus ProfileScreen via Navigation aufgerufen und erhält das aktuelle Profil als Parameter.
// Speichert via PUT /api/profile (updateProfile).

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  Gender,
  GoalType,
  GoalIntensity,
  Sport,
  ActivityLevel,
  UserProfile,
} from '@fittrack/shared';
import { profileApi, type ProfileDeletionRequest } from '../../shared/api/profileApi';
import { recipeApi } from '../../shared/api/recipeApi';
import { completeAccountDeletionLocally } from '../../services/accountDeletionService';
import { listWeights } from '../../services/weightsService';
import { colors, radius, spacing, typography } from '../../app/theme';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import { ProfileGroup, ProfileRow } from './ProfileGroup';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileEdit'>;
type CommunityRecipeCheck = 'loading' | 'failed' | 'available' | 'none';

function getDeletionErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: unknown }>(error)) {
    switch (error.response?.data?.error) {
      case 'profile_deletion_in_progress':
        return 'Die Löschung konnte nicht durchgeführt werden. Bitte versuche es erneut.';
      case 'profile_deletion_unavailable':
        return 'Der Löschdienst ist vorübergehend nicht verfügbar. Bitte versuche es erneut.';
      case 'profile_deletion_failed':
        return 'Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.';
      case 'invalid_profile_deletion_request':
        return 'Die Löschanfrage ist ungültig. Bitte prüfe die Bestätigung und versuche es erneut.';
      case 'authentication_required':
        return 'Deine Anmeldung konnte nicht bestätigt werden. Bitte versuche es erneut.';
      default:
        return 'Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.';
    }
  }
  return 'Die Löschung konnte nicht vollständig abgeschlossen werden. Bitte versuche es erneut.';
}

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
  const [deleteOverlayVisible, setDeleteOverlayVisible] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteCommunityRecipes, setDeleteCommunityRecipes] = useState(false);
  const [communityRecipeCheck, setCommunityRecipeCheck] = useState<CommunityRecipeCheck>('loading');
  const [pendingDeletionRequest, setPendingDeletionRequest] = useState<ProfileDeletionRequest | null>(null);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deletionInProgress, setDeletionInProgress] = useState(false);
  const deletionInProgressRef = useRef(false);
  const recipeCheckSequence = useRef(0);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  async function checkCommunityRecipes() {
    const sequence = ++recipeCheckSequence.current;
    setCommunityRecipeCheck('loading');
    try {
      const { recipes } = await recipeApi.list();
      if (sequence !== recipeCheckSequence.current) return;
      setCommunityRecipeCheck(
        recipes.some((recipe) => recipe.visibility === 'community' && recipe.communityPublication != null)
          ? 'available'
          : 'none',
      );
    } catch {
      if (sequence === recipeCheckSequence.current) setCommunityRecipeCheck('failed');
    }
  }

  function openDeletionOverlay() {
    setDeleteConfirmation('');
    setDeleteCommunityRecipes(false);
    setPendingDeletionRequest(null);
    setDeletionError(null);
    setDeleteOverlayVisible(true);
    void checkCommunityRecipes();
  }

  function closeDeletionOverlay() {
    if (deletionInProgressRef.current) return;
    recipeCheckSequence.current++;
    setDeleteOverlayVisible(false);
    setDeleteConfirmation('');
    setDeleteCommunityRecipes(false);
    setPendingDeletionRequest(null);
    setDeletionError(null);
  }

  async function submitDeletion(request: ProfileDeletionRequest) {
    if (deletionInProgressRef.current) return;
    deletionInProgressRef.current = true;
    setDeletionInProgress(true);
    setDeletionError(null);
    try {
      try {
        await profileApi.deleteProfile(request);
      } catch (error) {
        setDeletionError(getDeletionErrorMessage(error));
        return;
      }
      setDeleteOverlayVisible(false);
      try {
        await completeAccountDeletionLocally();
      } catch {
        // A local cleanup failure must not change the confirmed server result.
      }
    } finally {
      deletionInProgressRef.current = false;
      setDeletionInProgress(false);
    }
  }

  function startDeletion() {
    if (
      deleteConfirmation !== 'DELETE' ||
      (communityRecipeCheck !== 'available' && communityRecipeCheck !== 'none') ||
      deletionInProgressRef.current
    ) return;
    const request: ProfileDeletionRequest = {
      confirmation: 'DELETE',
      deleteCommunityRecipes,
    };
    setPendingDeletionRequest(request);
    void submitDeletion(request);
  }

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
    <SafeAreaView style={styles.container}>
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
          <TouchableOpacity
            style={styles.navAction}
            onPress={handleSave}
            disabled={!isValid() || loading}
            accessibilityRole="button"
            accessibilityLabel="Speichern"
            accessibilityState={{ disabled: !isValid() || loading }}
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
            accessibilityRole="button"
            accessibilityLabel="Speichern"
            accessibilityState={{ disabled: !isValid() || loading }}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <Text style={styles.saveButtonText}>Speichern</Text>
            }
          </TouchableOpacity>

          {!isNew && (
            <ProfileGroup title="Konto">
              <ProfileRow
                label="Konto löschen"
                detail="Profil und persönliche Daten endgültig löschen"
                iconName="trash-2"
                onPress={openDeletionOverlay}
              />
            </ProfileGroup>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
      <InfoOverlay
        visible={saveErrorVisible}
        title="Speichern fehlgeschlagen"
        body="Das Profil konnte nicht gespeichert werden. Bitte versuche es erneut."
        onClose={() => setSaveErrorVisible(false)}
      />
      {deleteOverlayVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeDeletionOverlay}
        >
          <View style={styles.deleteOverlayRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, styles.deleteBackdrop]}
              onPress={closeDeletionOverlay}
              disabled={deletionInProgress}
              accessibilityRole="button"
              accessibilityLabel="Bestätigung schließen"
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.deleteKeyboard}
            >
              <View style={styles.deleteDialog}>
                <ScrollView
                  contentContainerStyle={styles.deleteDialogContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.deleteTitle} accessibilityRole="header">
                    Profil endgültig löschen?
                  </Text>
                  <Text style={styles.deleteBody}>
                    Dein FitTrack-Profil und deine persönlichen FitTrack-Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.{ '\n\n' }Gib zur Bestätigung DELETE ein.
                  </Text>
                  <Text style={styles.deleteSecondaryNotice}>
                    Nach erfolgreicher Kontolöschung versucht die App, FitTrack-Anmeldetokens, lokale Sync-Warteschlangen und das lokale Diagnoseprotokoll von deinem Gerät zu entfernen. Wenn das auf deinem Gerät nicht klappt, zeigt FitTrack dir einen Hinweis. Bereits in Health Connect gespeicherte Einträge und Berechtigungen bleiben davon unberührt.
                  </Text>

                  {communityRecipeCheck === 'loading' ? (
                    <View style={styles.deleteCheckStatus}>
                      <ActivityIndicator color={colors.primary} size="small" />
                      <Text style={styles.deleteStatusText}>Community-Rezepte werden geprüft …</Text>
                    </View>
                  ) : null}
                  {communityRecipeCheck === 'failed' ? (
                    <View style={styles.deleteCheckError}>
                      <Text style={styles.deleteErrorText}>
                        Deine Community-Rezepte konnten nicht geprüft werden. Bitte versuche es erneut.
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteRetryCheck}
                        onPress={() => void checkCommunityRecipes()}
                        disabled={deletionInProgress}
                        accessibilityRole="button"
                        accessibilityLabel="Erneut prüfen"
                      >
                        <Text style={styles.deleteRetryCheckText}>Erneut prüfen</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {communityRecipeCheck === 'available' ? (
                    <>
                      <View style={styles.deleteSwitchRow}>
                        <Text style={styles.deleteSwitchLabel}>Auch meine Community Rezepte löschen</Text>
                        <View style={styles.deleteSwitchControl}>
                          <Text style={styles.deleteSwitchValue}>{deleteCommunityRecipes ? 'Ja' : 'Nein'}</Text>
                          <Switch
                            value={deleteCommunityRecipes}
                            onValueChange={setDeleteCommunityRecipes}
                            disabled={deletionInProgress || pendingDeletionRequest !== null}
                            accessibilityLabel="Auch meine Community Rezepte löschen"
                            accessibilityState={{
                              checked: deleteCommunityRecipes,
                              disabled: deletionInProgress || pendingDeletionRequest !== null,
                            }}
                          />
                        </View>
                      </View>
                      <Text style={styles.deleteSecondaryNotice}>
                        Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten, sofern du sie nicht ebenfalls löschst.
                      </Text>
                    </>
                  ) : null}

                  <TextInput
                    style={styles.deleteInput}
                    value={deleteConfirmation}
                    onChangeText={setDeleteConfirmation}
                    placeholder="DELETE"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={20}
                    editable={!deletionInProgress && pendingDeletionRequest === null}
                    accessibilityLabel="Löschbestätigung"
                    accessibilityHint="Gib DELETE in Großbuchstaben ein."
                  />

                  {deletionInProgress ? (
                    <View style={styles.deleteCheckStatus} accessibilityLiveRegion="polite">
                      <ActivityIndicator color={colors.primary} size="small" />
                      <Text style={styles.deleteStatusText}>Dein Profil wird gelöscht …</Text>
                    </View>
                  ) : null}
                  {deletionError ? (
                    <Text style={styles.deleteErrorText} accessibilityLiveRegion="polite">
                      {deletionError}
                    </Text>
                  ) : null}

                  <View style={styles.deleteActions}>
                    <TouchableOpacity
                      style={styles.deleteCancelButton}
                      onPress={closeDeletionOverlay}
                      disabled={deletionInProgress}
                      accessibilityRole="button"
                      accessibilityLabel="Abbrechen"
                      accessibilityState={{ disabled: deletionInProgress }}
                    >
                      <Text style={styles.deleteCancelText}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteConfirmButton, (
                        deletionInProgress || (deletionError === null && (
                          deleteConfirmation !== 'DELETE' ||
                          (communityRecipeCheck !== 'available' && communityRecipeCheck !== 'none')
                        ))
                      ) && styles.deleteConfirmButtonDisabled]}
                      onPress={deletionError && pendingDeletionRequest
                        ? () => void submitDeletion(pendingDeletionRequest)
                        : startDeletion}
                      disabled={deletionInProgress || (deletionError === null && (
                        deleteConfirmation !== 'DELETE' ||
                        (communityRecipeCheck !== 'available' && communityRecipeCheck !== 'none')
                      ))}
                      accessibilityRole="button"
                      accessibilityLabel={deletionError && pendingDeletionRequest ? 'Erneut versuchen' : 'Endgültig löschen'}
                      accessibilityState={{
                        disabled: deletionInProgress || (deletionError === null && (
                          deleteConfirmation !== 'DELETE' ||
                          (communityRecipeCheck !== 'available' && communityRecipeCheck !== 'none')
                        )),
                      }}
                    >
                      <Text style={styles.deleteConfirmText}>
                        {deletionError && pendingDeletionRequest ? 'Erneut versuchen' : 'Endgültig löschen'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      ) : null}
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
  navTitle: { ...typography.h3, color: colors.text, flexShrink: 1, textAlign: 'center' },
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
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  textInput: { flex: 1, color: colors.text, fontSize: typography.body1.fontSize, paddingVertical: spacing.md },
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
  goalTitle: { ...typography.body1, color: colors.text, fontWeight: '600' },
  goalTitleSelected: { color: colors.primaryBright },
  goalDesc: { ...typography.caption, color: colors.textMuted },

  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    minHeight: spacing.xxl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { ...typography.button, color: colors.background },

  deleteOverlayRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  deleteBackdrop: { backgroundColor: colors.overlay },
  deleteKeyboard: { flex: 1, justifyContent: 'center', padding: spacing.md },
  deleteDialog: {
    maxHeight: '94%',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  deleteDialogContent: { padding: spacing.lg, gap: spacing.md },
  deleteTitle: { ...typography.h3, color: colors.text },
  deleteBody: { ...typography.body2, color: colors.text },
  deleteSecondaryNotice: { ...typography.body2, color: colors.textSecondary },
  deleteCheckStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deleteStatusText: { ...typography.body2, color: colors.textSecondary, flexShrink: 1 },
  deleteCheckError: { gap: spacing.xs },
  deleteErrorText: { ...typography.body2, color: colors.negative },
  deleteRetryCheck: { minHeight: spacing.xxl, justifyContent: 'center', alignSelf: 'flex-start' },
  deleteRetryCheckText: { ...typography.button, color: colors.primaryBright },
  deleteSwitchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deleteSwitchLabel: { ...typography.body2, color: colors.text, flex: 1, flexShrink: 1 },
  deleteSwitchControl: { alignItems: 'center', minWidth: spacing.xxl * 2 },
  deleteSwitchValue: { ...typography.caption, color: colors.textSecondary },
  deleteInput: {
    ...typography.body1,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    minHeight: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  deleteActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  deleteCancelButton: {
    flex: 1,
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteCancelText: { ...typography.button, color: colors.textSecondary },
  deleteConfirmButton: {
    flex: 1,
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.negative,
    paddingHorizontal: spacing.sm,
  },
  deleteConfirmButtonDisabled: { opacity: 0.4 },
  deleteConfirmText: { ...typography.button, color: colors.background, textAlign: 'center' },
});
