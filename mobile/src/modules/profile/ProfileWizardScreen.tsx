// ProfileWizardScreen — 6-step onboarding wizard for user profile.
// Steps: 0. Welcome, 1. Basisdaten, 2. Alltag, 3. Training, 4. Ziel, 5. Vorschau
//
// Features:
//  - Welcome screen (Step 0) with dismiss option
//  - Cancel button (X) on steps 1–4 with confirmation dialog
//  - Swipe left/right navigation (PanResponder)
//  - Step 2: Auto ActivityLevel from steps + "Kenne ich nicht" option
//  - Step 5 preview: inline tooltips for BMR, PAL, Zielanpassung
//  - Weight pre-fill from diary (last 7 days, only for new profiles)

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  Gender,
  GoalType,
  GoalIntensity,
  Sport,
  ActivityLevel,
  ProfileInput,
} from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { profileApi, type CalculatePreviewResponse } from '../../shared/api/profileApi';
import { listWeights } from '../../services/weightsService';
import { BrandAsset } from '../../shared/components/BrandAsset';
import { InfoOverlay } from '../../shared/components/InfoOverlay';

export const SKIP_WIZARD_KEY = 'fittrack:skip_wizard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 0 | 1 | 2 | 3 | 4 | 5;

interface WizardState {
  // Step 1 — Basisdaten
  displayName: string;
  gender: Gender | null;
  age: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  // Step 2 — Alltag
  stepsPerDay: string;
  stepsPreset: number | null;   // null = custom or unknown
  stepsUnknown: boolean;        // "Kenne ich nicht"
  activityLevel: ActivityLevel | null;
  // Step 3 — Training
  trainingFrequencyPerWeek: number;
  trainingDurationMinutes: number;
  sports: Sport[];
  // Step 4 — Ziel
  goal: GoalType | null;
  goalIntensity: GoalIntensity | null;
}

const INITIAL_STATE: WizardState = {
  displayName: '',
  gender: null,
  age: '',
  heightCm: '',
  weightKg: '',
  targetWeightKg: '',
  stepsPerDay: '',
  stepsPreset: null,
  stepsUnknown: false,
  activityLevel: null,
  trainingFrequencyPerWeek: 0,
  trainingDurationMinutes: 60,
  sports: [],
  goal: null,
  goalIntensity: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_PRESETS = [5000, 7500, 10000, 12500, 15000];
const DURATION_OPTIONS = [30, 60, 90, 120, 150];

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

const ALL_SPORTS: Sport[] = ['strength', 'bouldering', 'running', 'cycling', 'swimming', 'hiking', 'teamsport', 'other'];
const GOALS: GoalType[] = ['lose_weight', 'maintain', 'gain_muscle', 'recomposition'];
const INTENSITIES: GoalIntensity[] = ['gentle', 'moderate', 'aggressive'];

const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Überwiegend sitzend',
  light: 'Leicht aktiv',
  active: 'Aktiv',
  very_active: 'Sehr aktiv',
};
const ALL_ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'active', 'very_active'];

const BMR_TOOLTIP = `Der Grundumsatz (BMR) gibt an, wie viele Kalorien dein Körper im völligen Ruhezustand verbraucht – also nur für Atmung, Herzschlag und Organfunktionen.\n\nBerechnung: Mifflin-St Jeor-Formel (geschlechtsspezifisch).`;

const PAL_TOOLTIP = `Der PAL-Wert (Physical Activity Level) ist ein Multiplikator, der angibt, wie aktiv du im Alltag bist.\n\nBeispiele: 1,4 = überwiegend sitzend, 1,6 = mäßig aktiv, 1,8 = sehr aktiv.\n\nDein Gesamtumsatz = BMR × PAL.`;

const ADJUSTMENT_TOOLTIP = `Die Zielanpassung beschreibt, wie viele Kalorien täglich von deinem Gesamtumsatz abgezogen (Abnehmen) oder hinzugefügt (Aufbauen) werden, um dein Ziel zu erreichen.\n\nEin Defizit von ca. 500 kcal/Tag entspricht etwa 0,5 kg Gewichtsabnahme pro Woche.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stepsToActivityLevel(steps: number): ActivityLevel {
  if (steps < 5000) return 'sedentary';
  if (steps < 10000) return 'light';
  if (steps < 15000) return 'active';
  return 'very_active';
}

function getDerivedActivityLevel(s: WizardState): ActivityLevel | null {
  if (s.stepsUnknown) return null;
  const steps = s.stepsPreset ?? (s.stepsPerDay ? parseInt(s.stepsPerDay, 10) : null);
  if (steps != null && steps > 0) return stepsToActivityLevel(steps);
  return null;
}

function buildProfileInput(s: WizardState): ProfileInput | null {
  if (!s.gender || !s.goal) return null;
  const age = parseInt(s.age, 10);
  const heightCm = parseFloat(s.heightCm);
  const weightKg = parseFloat(s.weightKg);
  const targetWeightKg = parseFloat(s.targetWeightKg);
  if (!age || !heightCm || !weightKg || !targetWeightKg) return null;

  const stepsPerDay = s.stepsUnknown ? null : (s.stepsPreset ?? (s.stepsPerDay ? parseInt(s.stepsPerDay, 10) : null));
  // Use derived level from steps when not unknown, otherwise manual selection
  const activityLevel = s.stepsUnknown ? s.activityLevel : (getDerivedActivityLevel(s) ?? s.activityLevel);
  if (stepsPerDay === null && activityLevel === null) return null;

  return {
    gender: s.gender,
    age,
    heightCm,
    weightKg,
    targetWeightKg,
    stepsPerDay,
    activityLevel,
    trainingFrequencyPerWeek: s.trainingFrequencyPerWeek,
    trainingDurationMinutes: s.trainingDurationMinutes,
    sports: s.sports,
    goal: s.goal,
    goalIntensity: s.goalIntensity,
    ...(s.displayName?.trim() ? { displayName: s.displayName.trim() } : {}),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChipButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
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

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function NumericInput({
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
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWithUnit}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '0'}
          placeholderTextColor={colors.textMuted}
        />
        {unit ? <Text style={styles.inputUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function MacroCard({
  title,
  targets,
}: {
  title: string;
  targets: { calories: number; proteinG: number; fatG: number; carbsG: number; fiberG: number };
}) {
  return (
    <View style={styles.macroCard}>
      <Text style={styles.macroCardTitle}>{title}</Text>
      <View style={styles.macroRow}>
        <MacroItem label="Kalorien" value={`${targets.calories} kcal`} highlight />
        <MacroItem label="Protein" value={`${targets.proteinG} g`} />
        <MacroItem label="Fett" value={`${targets.fatG} g`} />
        <MacroItem label="Kohlenhydrate" value={`${targets.carbsG} g`} />
        {targets.fiberG > 0 && <MacroItem label="Ballaststoffe" value={`${targets.fiberG} g`} />}
      </View>
    </View>
  );
}

function MacroItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.macroItem}>
      <Text style={highlight ? styles.macroValueHighlight : styles.macroValue}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function MetaRow({
  label,
  value,
  onInfo,
}: {
  label: string;
  value: string;
  onInfo: () => void;
}) {
  return (
    <View style={styles.metaRowContainer}>
      <Text style={styles.metaRowLabel}>{label}</Text>
      <View style={styles.metaRowRight}>
        <Text style={styles.metaRowValue}>{value}</Text>
        <TouchableOpacity onPress={onInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.infoIcon}>ⓘ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  onComplete: () => void;
  onDismiss: () => void;
  isNewProfile: boolean;
}

export default function ProfileWizardScreen({ onComplete, onDismiss, isNewProfile }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [preview, setPreview] = useState<CalculatePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [weightFromDiary, setWeightFromDiary] = useState(false);
  const [tooltip, setTooltip] = useState<{ title: string; body: string } | null>(null);

  // Pre-fill weight from diary if new profile
  useEffect(() => {
    if (!isNewProfile) return;
    listWeights().then((entries) => {
      if (entries.length === 0) return;
      const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      const latestDate = new Date(latest.date);
      const now = new Date();
      const diffDays = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) {
        const value = latest.unit === 'lbs' ? +(latest.value * 0.453592).toFixed(1) : latest.value;
        setState((prev) => ({ ...prev, weightKg: String(value) }));
        setWeightFromDiary(true);
      }
    }).catch(() => { /* silently ignore */ });
  }, [isNewProfile]);

  // Swipe navigation (steps 1–4 only)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 30,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) {
          setStep((s) => {
            if (s >= 4) return s;
            return (s + 1) as Step;
          });
        } else if (g.dx > 50) {
          setStep((s) => {
            if (s <= 1) return s;
            return (s - 1) as Step;
          });
        }
      },
    })
  ).current;

  function update(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  // --- Validation per step ---
  function isStep1Valid(): boolean {
    return (
      state.gender !== null &&
      parseInt(state.age, 10) > 0 &&
      parseFloat(state.heightCm) > 0 &&
      parseFloat(state.weightKg) > 0 &&
      parseFloat(state.targetWeightKg) > 0
    );
  }

  function isStep2Valid(): boolean {
    if (state.stepsUnknown) return state.activityLevel !== null;
    const hasSteps = state.stepsPreset !== null || parseInt(state.stepsPerDay, 10) > 0;
    return hasSteps || state.activityLevel !== null;
  }

  function isStep3Valid(): boolean {
    // Always valid — training is optional
    return true;
  }

  function isStep4Valid(): boolean {
    if (!state.goal) return false;
    if (state.goal === 'lose_weight' || state.goal === 'gain_muscle') {
      return state.goalIntensity !== null;
    }
    return true;
  }

  async function handleNextFromStep4() {
    const input = buildProfileInput(state);
    if (!input) {
      Alert.alert('Fehler', 'Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setLoading(true);
    try {
      const result = await profileApi.calculatePreview(input);
      setPreview(result);
      setStep(5);
    } catch {
      Alert.alert('Fehler', 'Vorschau konnte nicht berechnet werden. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const input = buildProfileInput(state);
    if (!input) return;
    setLoading(true);
    try {
      await profileApi.createProfile(input);
      onComplete();
    } catch {
      Alert.alert('Fehler', 'Profil konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  function handleCancelPress() {
    Alert.alert(
      'Wizard beenden?',
      'Deine Eingaben gehen verloren.',
      [
        { text: 'Verwerfen', style: 'destructive', onPress: onDismiss },
        { text: 'Weiter bearbeiten', style: 'cancel' },
      ]
    );
  }

  function handleBack() {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  function renderProgressBar() {
    // 5 segments, one per wizard step (1–5). Filled up to current step.
    return (
      <View style={styles.progressBar}>
        {Array.from({ length: 5 }, (_, i) => (
          <View
            key={i}
            style={[styles.progressDot, i < step && styles.progressDotActive]}
          />
        ))}
      </View>
    );
  }

  function renderCancelButton() {
    return (
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={handleCancelPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelButtonText}>✕</Text>
      </TouchableOpacity>
    );
  }

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------

  function renderStep0() {
    function handleSkip() {
      Alert.alert(
        'Profil überspringen?',
        'Ohne Profil können Kalorien- und Makroziele nicht berechnet werden. Du kannst das Profil jederzeit unter „Profil" einrichten.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Überspringen',
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.setItem(SKIP_WIZARD_KEY, '1');
              onDismiss();
            },
          },
        ],
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.welcomeContainer}
        showsVerticalScrollIndicator={false}
      >
        <BrandAsset name="splash_logo" width={130} height={130} style={styles.welcomeLogo} />
        <Text style={styles.welcomeEyebrow}>⚡ In unter einer Minute zu deinem persönlichen Ziel.</Text>
        <Text style={styles.welcomeTitle}>
          {'Willkommen bei Fit'}<Text style={{ color: colors.primary }}>Track</Text>
        </Text>
        <Text style={styles.welcomeBody}>
          Damit FitTrack deine Kalorien- und Makroziele individuell berechnen kann, brauchen wir ein paar Angaben zu dir.
        </Text>
        <View style={styles.benefitList}>
          {[
            '✓  Erreiche dein persönliches Zielgewicht',
            '✓  Behalte deine Fortschritte im Blick',
            '✓  Erhalte passende Kalorien- und Makroziele',
            '✓  Nutze intelligente Ernährungsvorschläge',
          ].map((item) => (
            <Text key={item} style={styles.benefitItem}>{item}</Text>
          ))}
        </View>
        <View style={styles.trustSection}>
          <Text style={styles.trustTitle}>🔒 Deine Daten bleiben privat</Text>
          <Text style={styles.trustBody}>Keine Werbung. Keine Weitergabe. Jederzeit änderbar.</Text>
        </View>
        <TouchableOpacity style={[styles.primaryButton, styles.welcomePrimaryBtn]} onPress={() => setStep(1)} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Profil einrichten →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.ghostButtonText}>Zunächst ohne Profil starten</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderStep1() {
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Text style={styles.stepTitle}>Deine Basisdaten</Text>
        <Text style={styles.stepSubtitle}>Diese Werte brauchen wir, um deine Kalorienziele zu berechnen.</Text>

        <SectionLabel>Geschlecht</SectionLabel>
        <View style={styles.chipRow}>
          {(['male', 'female', 'other'] as Gender[]).map((g) => (
            <ChipButton
              key={g}
              label={GENDER_LABELS[g]}
              selected={state.gender === g}
              onPress={() => update({ gender: g })}
            />
          ))}
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Wie möchtest du genannt werden? (optional)</Text>
          <View style={styles.inputWithUnit}>
            <TextInput
              style={styles.textInput}
              value={state.displayName}
              onChangeText={(v) => update({ displayName: v })}
              placeholder="z.B. Michael"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              maxLength={50}
            />
          </View>
        </View>

        <NumericInput label="Alter" value={state.age} onChangeText={(v) => update({ age: v })} unit="Jahre" />
        <NumericInput label="Größe" value={state.heightCm} onChangeText={(v) => update({ heightCm: v })} unit="cm" />
        <NumericInput
          label="Aktuelles Gewicht"
          value={state.weightKg}
          onChangeText={(v) => { update({ weightKg: v }); setWeightFromDiary(false); }}
          unit="kg"
        />
        {weightFromDiary && (
          <Text style={styles.prefillHint}>✓ Aus letztem Gewichtseintrag übernommen</Text>
        )}
        <NumericInput label="Zielgewicht" value={state.targetWeightKg} onChangeText={(v) => update({ targetWeightKg: v })} unit="kg" placeholder="z.B. 75" />
      </ScrollView>
    );
  }

  function renderStep2() {
    const derivedLevel = getDerivedActivityLevel(state);
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Text style={styles.stepTitle}>Dein Alltag</Text>
        <Text style={styles.stepSubtitle}>Wie aktiv bist du außerhalb des Sports?</Text>

        <SectionLabel>Schritte pro Tag</SectionLabel>
        <View style={styles.chipRow}>
          {STEP_PRESETS.map((p) => (
            <ChipButton
              key={p}
              label={`${p.toLocaleString()}`}
              selected={!state.stepsUnknown && state.stepsPreset === p}
              onPress={() => update({ stepsPreset: p, stepsPerDay: '', activityLevel: null, stepsUnknown: false })}
            />
          ))}
          <ChipButton
            label="Eigene Zahl"
            selected={!state.stepsUnknown && state.stepsPreset === null && state.stepsPerDay !== ''}
            onPress={() => update({ stepsPreset: null, activityLevel: null, stepsUnknown: false })}
          />
          <ChipButton
            label="Kenne ich nicht"
            selected={state.stepsUnknown}
            onPress={() => update({ stepsUnknown: true, stepsPreset: null, stepsPerDay: '' })}
          />
        </View>

        {!state.stepsUnknown && state.stepsPreset === null && (
          <NumericInput
            label="Eigene Schrittzahl"
            value={state.stepsPerDay}
            onChangeText={(v) => update({ stepsPerDay: v, activityLevel: null })}
            unit="Schritte"
          />
        )}

        {/* Auto-derived ActivityLevel from steps */}
        {!state.stepsUnknown && derivedLevel != null && (
          <View style={styles.derivedLevelBox}>
            <Text style={styles.derivedLevelLabel}>Aktivitätslevel (automatisch)</Text>
            <Text style={styles.derivedLevelValue}>{ACTIVITY_LEVEL_LABELS[derivedLevel]}</Text>
            <Text style={styles.hintText}>Basierend auf deinen Schritten automatisch bestimmt.</Text>
          </View>
        )}

        {/* Manual selection when steps unknown */}
        {state.stepsUnknown && (
          <>
            <SectionLabel>Aktivitätslevel</SectionLabel>
            <Text style={styles.hintText}>Wähle das Level, das am besten zu deinem Alltag passt.</Text>
            {ALL_ACTIVITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.optionRow, state.activityLevel === level && styles.optionRowSelected]}
                onPress={() => update({ activityLevel: level })}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, state.activityLevel === level && styles.optionTextSelected]}>
                  {ACTIVITY_LEVEL_LABELS[level]}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  function renderStep3() {
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Text style={styles.stepTitle}>Dein Training</Text>
        <Text style={styles.stepSubtitle}>Wie oft und wie lang trainierst du pro Woche?</Text>

        <SectionLabel>Trainingstage pro Woche</SectionLabel>
        <View style={styles.chipRow}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <ChipButton
              key={n}
              label={n === 0 ? 'Kein Training' : `${n}x`}
              selected={state.trainingFrequencyPerWeek === n}
              onPress={() => update({ trainingFrequencyPerWeek: n })}
            />
          ))}
        </View>

        {state.trainingFrequencyPerWeek > 0 && (
          <>
            <SectionLabel>Dauer pro Training</SectionLabel>
            <View style={styles.chipRow}>
              {DURATION_OPTIONS.map((d) => (
                <ChipButton
                  key={d}
                  label={`${d} min`}
                  selected={state.trainingDurationMinutes === d}
                  onPress={() => update({ trainingDurationMinutes: d })}
                />
              ))}
            </View>

            <SectionLabel>Sportarten (optional)</SectionLabel>
            <View style={styles.chipRow}>
              {ALL_SPORTS.map((sport) => (
                <ChipButton
                  key={sport}
                  label={SPORT_LABELS[sport]}
                  selected={state.sports.includes(sport)}
                  onPress={() => {
                    const next = state.sports.includes(sport)
                      ? state.sports.filter((s) => s !== sport)
                      : [...state.sports, sport];
                    update({ sports: next });
                  }}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  function renderStep4() {
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Text style={styles.stepTitle}>Dein Ziel</Text>
        <Text style={styles.stepSubtitle}>Was möchtest du mit FitTrack erreichen?</Text>

        {GOALS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.goalCard, state.goal === g && styles.goalCardSelected]}
            onPress={() => update({ goal: g, goalIntensity: null })}
            activeOpacity={0.7}
          >
            <Text style={[styles.goalTitle, state.goal === g && styles.goalTitleSelected]}>
              {GOAL_LABELS[g]}
            </Text>
            <Text style={styles.goalDesc}>{GOAL_DESCRIPTIONS[g]}</Text>
          </TouchableOpacity>
        ))}

        {(state.goal === 'lose_weight' || state.goal === 'gain_muscle') && (
          <>
            <SectionLabel>Intensität</SectionLabel>
            {INTENSITIES.map((i) => (
              <ChipButton
                key={i}
                label={INTENSITY_LABELS[i]}
                selected={state.goalIntensity === i}
                onPress={() => update({ goalIntensity: i })}
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  function renderStep5() {
    if (!preview) return null;
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Text style={styles.stepTitle}>Deine Ziele</Text>
        <Text style={styles.stepSubtitle}>Basierend auf deinen Angaben haben wir folgende Tagesziele berechnet.</Text>

        <MacroCard title="🛌 Ruhetag" targets={preview.targets.restDay} />
        <MacroCard title="💪 Trainingstag" targets={preview.targets.trainingDay} />

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Berechnung</Text>
          <MetaRow
            label="Grundumsatz (BMR)"
            value={`${Math.round(preview.calculationMeta.bmr)} kcal`}
            onInfo={() => setTooltip({ title: 'Grundumsatz (BMR)', body: BMR_TOOLTIP })}
          />
          <MetaRow
            label="Aktivitätsfaktor (PAL)"
            value={preview.calculationMeta.pal.toFixed(2)}
            onInfo={() => setTooltip({ title: 'Aktivitätsfaktor (PAL)', body: PAL_TOOLTIP })}
          />
          <MetaRow
            label="Zielanpassung"
            value={`${preview.calculationMeta.goalAdjustment > 0 ? '+' : ''}${preview.calculationMeta.goalAdjustment} kcal`}
            onInfo={() => setTooltip({ title: 'Zielanpassung', body: ADJUSTMENT_TOOLTIP })}
          />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator color={colors.background} />
            : <Text style={styles.primaryButtonText}>Profil übernehmen</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation footer
  // ---------------------------------------------------------------------------

  function renderFooter() {
    if (step === 0 || step === 5) return null;

    const validations: Record<number, () => boolean> = {
      1: isStep1Valid,
      2: isStep2Valid,
      3: isStep3Valid,
      4: isStep4Valid,
    };
    const isValid = validations[step]?.() ?? true;
    const isLast = step === 4;

    return (
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>Zurück</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.primaryButton, !isValid && styles.primaryButtonDisabled]}
          onPress={isLast ? handleNextFromStep4 : () => setStep((s) => (s + 1) as Step)}
          disabled={!isValid || loading}
          activeOpacity={0.8}
        >
          {loading && isLast
            ? <ActivityIndicator color={colors.background} />
            : <Text style={styles.primaryButtonText}>{isLast ? 'Vorschau' : 'Weiter'}</Text>
          }
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (step === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {renderStep0()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {tooltip && (
        <InfoOverlay
          visible
          title={tooltip.title}
          body={tooltip.body}
          onClose={() => setTooltip(null)}
        />
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.wizardHeader}>
          {renderProgressBar()}
          {step <= 4 && renderCancelButton()}
        </View>
        <View style={{ flex: 1 }} {...(step >= 1 && step <= 4 ? panResponder.panHandlers : {})}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </View>
        {renderFooter()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Welcome screen
  welcomeContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  welcomePrimaryBtn: {
    flex: 0,
    alignSelf: 'stretch',
  },
  welcomeLogo: {
    marginBottom: spacing.lg,
  },
  welcomeEyebrow: {
    ...typography.caption,
    color: colors.primaryBright,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  welcomeTitle: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  welcomeBody: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  benefitList: {
    alignSelf: 'stretch',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  benefitItem: {
    ...typography.body2,
    color: colors.text,
    lineHeight: 20,
  },
  trustSection: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trustTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 2,
  },
  trustBody: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  ghostButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ghostButtonText: {
    ...typography.body2,
    color: colors.textMuted,
  },

  // Wizard header
  wizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs ?? 4,
  },
  cancelButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
  },

  // Progress bar
  progressBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.sm,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  stepContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  stepTitle: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    ...typography.body1,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primaryBright,
    fontWeight: '600',
  },
  inputRow: {
    marginTop: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
  },
  textInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: spacing.md,
  },
  inputUnit: {
    ...typography.body2,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  hintText: {
    ...typography.body2,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  prefillHint: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  derivedLevelBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  derivedLevelLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  derivedLevelValue: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    ...typography.body1,
    color: colors.textSecondary,
  },
  optionTextSelected: {
    color: colors.primaryBright,
    fontWeight: '600',
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  goalCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  goalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 2,
  },
  goalTitleSelected: {
    color: colors.primaryBright,
  },
  goalDesc: {
    ...typography.body2,
    color: colors.textMuted,
  },
  macroCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroCardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  macroItem: {
    minWidth: 80,
  },
  macroValue: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  macroValueHighlight: {
    ...typography.h3,
    color: colors.primaryBright,
  },
  macroLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  metaTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  metaRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaRowLabel: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
  },
  metaRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRowValue: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '600',
  },
  infoIcon: {
    fontSize: 16,
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  backButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.background,
  },
});
