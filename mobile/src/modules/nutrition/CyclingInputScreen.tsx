// CyclingInputScreen — form screen for logging a cycling activity.
// Navigation params: { date: string; existing?: SpecialActivity }
// On success: navigates back and the DiaryScreen reloads via useFocusEffect.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EbikeSupport, SpecialActivity } from '@fittrack/shared';
import { calculateCyclingActivityBonus } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { diaryApi } from '../../shared/api/diaryApi';
import { profileApi } from '../../shared/api/profileApi';
import { Icon } from '../../shared/components/Icon';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import type { NutritionStackParamList } from '../../app/navigation/RootNavigator';
import { useDayTypeStore } from './useDayTypeStore';

type Props = NativeStackScreenProps<NutritionStackParamList, 'CyclingInput'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Heute';
  if (dateStr === yesterdayStr) return 'Gestern';
  const d = new Date(dateStr + 'T12:00:00');
  const weekdays = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  const months = ['Jan.', 'Feb.', 'Mär.', 'Apr.', 'Mai', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
  return `${weekdays[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]}`;
}

function getCyclingSpeedLabel(kmh: number): { label: string; color: string; ok: boolean } {
  if (kmh < 3)   return { label: 'Zu langsam für eine Radfahrt', color: colors.negative, ok: false };
  if (kmh <= 10) return { label: 'Sehr ruhiges Tempo', color: colors.primary, ok: true };
  if (kmh <= 20) return { label: 'Gemäßigtes Radtempo', color: colors.primary, ok: true };
  if (kmh <= 30) return { label: 'Flottes Radtempo', color: colors.primary, ok: true };
  if (kmh <= 45) return { label: 'Schnelles Tempo', color: colors.neutral, ok: true };
  if (kmh <= 80) return { label: 'Sehr schnelles Tempo', color: colors.neutral, ok: true };
  return { label: 'Zu schnell für eine Radfahrt', color: colors.negative, ok: false };
}

// ─── Terrain info ──────────────────────────────────────────────────────────────

const TERRAIN_INFO = [
  {
    label: '🛣️  Asphalt',
    description: 'Befestigter Straßenbelag, Radweg oder Teerweg. Geringster Rollwiderstand.',
  },
  {
    label: '🪨  Schotter / Kies',
    description: 'Unbefestigter Weg, Waldweg oder Kiesweg. Erhöhter Rollwiderstand.',
  },
  {
    label: '🌲  Trail / Pfad',
    description: 'Naturbelassener Pfad, Singletrack oder technisches Gelände. Höchster Rollwiderstand.',
  },
];

// ─── eBike options ─────────────────────────────────────────────────────────────

const EBIKE_OPTIONS: Array<{ value: EbikeSupport; label: string }> = [
  { value: 'NONE',  label: 'Ohne Motor' },
  { value: 'LIGHT', label: 'Leichte Unterstützung' },
  { value: 'HIGH',  label: 'Starke Unterstützung' },
];

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  value, onDecrement, onIncrement, unit, minReached, maxReached,
}: {
  value: number; onDecrement: () => void; onIncrement: () => void;
  unit: string; minReached: boolean; maxReached: boolean;
}) {
  return (
    <View style={stepperStyles.container}>
      <TouchableOpacity
        onPress={onDecrement}
        disabled={minReached}
        style={[stepperStyles.btn, minReached && stepperStyles.btnDisabled]}
        activeOpacity={0.7}
      >
        <Text style={[stepperStyles.btnText, minReached && stepperStyles.btnTextDisabled]}>−</Text>
      </TouchableOpacity>
      <View style={stepperStyles.valueWrap}>
        <Text style={stepperStyles.value}>{value}</Text>
        <Text style={stepperStyles.unit}>{unit}</Text>
      </View>
      <TouchableOpacity
        onPress={onIncrement}
        disabled={maxReached}
        style={[stepperStyles.btn, maxReached && stepperStyles.btnDisabled]}
        activeOpacity={0.7}
      >
        <Text style={[stepperStyles.btnText, maxReached && stepperStyles.btnTextDisabled]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  btnText: { ...typography.h3, color: colors.text, lineHeight: 24 },
  btnTextDisabled: { color: colors.textDisabled },
  valueWrap: { alignItems: 'center', minWidth: 52 },
  value: { ...typography.h2, color: colors.text },
  unit: { ...typography.caption, color: colors.textMuted, marginTop: -2 },
});

function useCountUp(target: number, active: boolean): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!active) {
      setCurrent(0);
      return;
    }
    const steps = 40;
    const duration = 600;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const t = step / steps;
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.round(target * eased));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, active]);
  return current;
}

export default function CyclingInputScreen({ navigation, route }: Props) {
  const { date, existing } = route.params;
  const existingCycling = existing?.type === 'cycling' ? existing : null;
  const isEdit = !!existingCycling;

  // Form state — pre-fill from existing if editing
  const [hoursVal, setHoursVal] = useState<number>(
    existingCycling ? Math.floor(existingCycling.movementTimeMinutes / 60) : 1,
  );
  const [minutesVal, setMinutesVal] = useState<number>(
    existingCycling ? Math.round((existingCycling.movementTimeMinutes % 60) / 15) * 15 : 0,
  );
  const [distanceKmVal, setDistanceKmVal] = useState<number>(
    existingCycling ? existingCycling.distanceKm : 20,
  );
  const [elevationGainMVal, setElevationGainMVal] = useState<number>(
    existingCycling ? existingCycling.elevationGainM : 0,
  );
  const [elevationLossM, setElevationLossM] = useState<number>(
    existingCycling ? (existingCycling.elevationLossM ?? 0) : 0,
  );
  const [asphaltShare, setAsphaltShare] = useState<number>(
    existingCycling ? existingCycling.asphaltShare : 0.7,
  );
  const [gravelShare, setGravelShare] = useState<number>(
    existingCycling ? existingCycling.gravelShare : 0.3,
  );
  const [ebikeSupport, setEbikeSupport] = useState<EbikeSupport>(
    existingCycling ? existingCycling.ebikeSupport : 'NONE',
  );

  // trailShare is always derived — never stored in state
  const trailShare = Math.max(0, 1 - asphaltShare - gravelShare);

  const [profileWeight, setProfileWeight] = useState<number>(
    existingCycling?.bodyWeightKg ?? 75,
  );
  const [saving, setSaving] = useState(false);
  const [terrainInfoVisible, setTerrainInfoVisible] = useState(false);
  const [sliderScrollEnabled, setSliderScrollEnabled] = useState(true);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const previewAnimDoneRef = useRef(false);
  const [previewActive, setPreviewActive] = useState(false);

  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  // Terrain info sheet swipe-to-close
  const terrainDragY = useSharedValue(0);
  const terrainAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: terrainDragY.value }],
  }));
  const closeTerrainSheet = () => {
    terrainDragY.value = 0;
    setTerrainInfoVisible(false);
  };
  const terrainPanGesture = Gesture.Pan()
    .onUpdate((e) => {
      terrainDragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 0.5) {
        terrainDragY.value = withTiming(600, { duration: 200 }, () =>
          runOnJS(closeTerrainSheet)(),
        );
      } else {
        terrainDragY.value = withSpring(0, { damping: 18, stiffness: 140 });
      }
    });

  useEffect(() => {
    if (terrainInfoVisible) {
      terrainDragY.value = 0;
    }
  }, [terrainInfoVisible]);

  // Calorie target from global store (with fallback)
  const { dayType, targets } = useDayTypeStore();
  const dailyCalorieTarget = targets
    ? (dayType === 'training' ? targets.trainingDay.calories : targets.restDay.calories)
    : 2000;

  // SharedValues for react-native-awesome-slider
  const distanceProgress = useSharedValue(distanceKmVal);
  const elevationProgress = useSharedValue(elevationGainMVal);
  const elevationLossProgress = useSharedValue(elevationLossM);
  const asphaltProgress = useSharedValue(asphaltShare);
  const gravelProgress = useSharedValue(gravelShare);
  const distanceMin = useSharedValue(1);
  const distanceMax = useSharedValue(200);
  const elevationMin = useSharedValue(0);
  const elevationMax = useSharedValue(8000);
  const elevationLossMin = useSharedValue(0);
  const elevationLossMax = useSharedValue(8000);
  const terrainMin = useSharedValue(0);
  const terrainMax = useSharedValue(1);

  useEffect(() => { distanceProgress.value = distanceKmVal; }, [distanceKmVal]);
  useEffect(() => { elevationProgress.value = elevationGainMVal; }, [elevationGainMVal]);
  useEffect(() => { elevationLossProgress.value = elevationLossM; }, [elevationLossM]);
  useEffect(() => { asphaltProgress.value = asphaltShare; }, [asphaltShare]);
  useEffect(() => { gravelProgress.value = gravelShare; }, [gravelShare]);

  // Load profile weight for live preview
  useEffect(() => {
    profileApi.getMe().then(({ profile }) => {
      if (profile?.weightKg) setProfileWeight(profile.weightKg);
    }).catch(() => {});
  }, []);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const totalMinutes = hoursVal * 60 + minutesVal;

  const speedInfo = useMemo(() => {
    if (totalMinutes <= 0 || distanceKmVal <= 0) return null;
    const kmh = distanceKmVal / (totalMinutes / 60);
    return { kmh, ...getCyclingSpeedLabel(kmh) };
  }, [totalMinutes, distanceKmVal]);

  const liveResult = useMemo(() => {
    if (totalMinutes < 15 || distanceKmVal < 1) return null;
    try {
      return calculateCyclingActivityBonus(
        {
          movementTimeMinutes: totalMinutes,
          distanceKm: distanceKmVal,
          elevationGainM: elevationGainMVal,
          elevationLossM,
          asphaltShare,
          gravelShare,
          trailShare: Math.max(0, 1 - asphaltShare - gravelShare),
          ebikeSupport,
        },
        profileWeight,
        dailyCalorieTarget,
      );
    } catch {
      return null;
    }
  }, [totalMinutes, distanceKmVal, elevationGainMVal, elevationLossM, asphaltShare, gravelShare, ebikeSupport, profileWeight, dailyCalorieTarget]);

  const liveResultAvailable = liveResult != null;
  useEffect(() => {
    if (!previewAnimDoneRef.current && liveResultAvailable) {
      previewAnimDoneRef.current = true;
      setPreviewActive(true);
      const timer = setTimeout(() => setPreviewActive(false), 700);
      return () => clearTimeout(timer);
    }
  }, [liveResultAvailable]);

  const animBonus = useCountUp(
    liveResult ? Math.round(liveResult.activityBonus) : 0,
    previewActive,
  );

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (totalMinutes < 15) {
      return 'Die Bewegungszeit muss mindestens 15 Minuten betragen.';
    }
    return null;
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setInlineError(null);
    const validationError = validate();
    if (validationError) {
      setInlineError(validationError);
      return;
    }
    setSaving(true);
    try {
      await diaryApi.setSpecialActivity(date, {
        type: 'cycling',
        movementTimeMinutes: totalMinutes,
        distanceKm: distanceKmVal,
        elevationGainM: elevationGainMVal,
        elevationLossM,
        asphaltShare,
        gravelShare,
        trailShare: Math.max(0, 1 - asphaltShare - gravelShare),
        ebikeSupport,
      });
      navigation.goBack();
    } catch (err: unknown) {
      if (isAxiosError(err, 422)) {
        const msg = extractErrorMessage(err) ?? 'Die Eingaben sind nicht gültig.';
        setInlineError(msg);
      } else {
        showSnackbar({ message: 'Speichern fehlgeschlagen. Bitte erneut versuchen.' });
      }
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = totalMinutes >= 15;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ① Screen Header */}
      <View style={styles.screenHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon lib="feather" name="arrow-left" size="md" color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.screenTitle}>{isEdit ? 'Radfahrt bearbeiten' : 'Radfahrt erfassen'}</Text>
          <Text style={styles.screenDate}>{formatDateLabel(date)}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={sliderScrollEnabled}
      >
        {/* ② Live-Vorschau-Karte */}
        {liveResult != null ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewOverline}>🚴  GESCHÄTZTER AKTIVITÄTSBONUS</Text>
            <Text style={styles.previewBonus}>
              ≈  {previewActive ? animBonus : Math.round(liveResult.activityBonus)} kcal
            </Text>
            <Text style={styles.previewDetail}>
              MET {liveResult.estimatedMet.toFixed(1)} · {(totalMinutes / 60).toFixed(1)} h · {Math.round(profileWeight)} kg · {Math.round(liveResult.activityCalories)} kcal Fahrverbrauch
            </Text>
          </View>
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>
              Gib Bewegungszeit und Strecke ein, um den geschätzten Aktivitätsbonus zu berechnen.
            </Text>
          </View>
        )}

        {/* ③ Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Icon lib="feather" name="info" size="sm" color={colors.textMuted} />
          <Text style={styles.disclaimerText}>
            Alle Werte sind Schätzungen. Individuelle Faktoren wie Fitnesslevel, Höhe und Wetter können abweichen.
          </Text>
        </View>

        {/* ④ Eingabe-Karte: Bewegungszeit */}
        <View style={styles.inputCard}>
          <Text style={styles.cardOverline}>⏱  BEWEGUNGSZEIT</Text>
          <View style={styles.timeRow}>
            <Stepper
              value={hoursVal}
              onDecrement={() => setHoursVal(v => Math.max(0, v - 1))}
              onIncrement={() => setHoursVal(v => Math.min(14, v + 1))}
              unit="h"
              minReached={hoursVal === 0}
              maxReached={hoursVal === 14}
            />
            <Stepper
              value={minutesVal}
              onDecrement={() => setMinutesVal(v => (v === 0 ? 45 : v - 15))}
              onIncrement={() => setMinutesVal(v => (v === 45 ? 0 : v + 15))}
              unit="min"
              minReached={false}
              maxReached={false}
            />
          </View>
          {speedInfo && (
            <View style={styles.speedRow}>
              <Icon
                lib="feather"
                name={speedInfo.ok ? 'check-circle' : 'alert-circle'}
                size="sm"
                color={speedInfo.color}
              />
              <Text style={[styles.speedLabel, { color: speedInfo.color }]}>
                {speedInfo.kmh.toFixed(1)} km/h — {speedInfo.label}
              </Text>
            </View>
          )}
        </View>

        {/* ⑤ Eingabe-Karte: Strecke */}
        <View style={styles.inputCard}>
          <Text style={styles.cardOverline}>📍  STRECKE</Text>
          <View style={styles.sliderValueRow}>
            <Text style={styles.sliderValue}>{distanceKmVal} km</Text>
          </View>
          <Slider
            progress={distanceProgress}
            minimumValue={distanceMin}
            maximumValue={distanceMax}
            onValueChange={(v) => {
              const snapped = Math.round(v);
              setDistanceKmVal(snapped);
            }}
            onSlidingStart={() => setSliderScrollEnabled(false)}
            onSlidingComplete={() => setSliderScrollEnabled(true)}
            disableTrackPress
            theme={{
              maximumTrackTintColor: colors.border,
              minimumTrackTintColor: colors.primary,
              bubbleBackgroundColor: colors.surface,
              bubbleTextColor: colors.primary,
            }}
            style={{ height: 40 }}
            thumbWidth={24}
          />
          <View style={styles.sliderRange}>
            <Text style={styles.sliderRangeText}>1 km</Text>
            <Text style={styles.sliderRangeText}>200 km</Text>
          </View>
        </View>

        {/* ⑥ Eingabe-Karte: Anstieg */}
        <View style={styles.inputCard}>
          <Text style={styles.cardOverline}>⛰  ANSTIEG</Text>
          <View style={styles.sliderValueRow}>
            <Text style={styles.sliderValue}>{elevationGainMVal} m</Text>
          </View>
          <Slider
            progress={elevationProgress}
            minimumValue={elevationMin}
            maximumValue={elevationMax}
            onValueChange={(v) => {
              const snapped = Math.round(v / 50) * 50;
              setElevationGainMVal(snapped);
            }}
            onSlidingStart={() => setSliderScrollEnabled(false)}
            onSlidingComplete={() => setSliderScrollEnabled(true)}
            disableTrackPress
            theme={{
              maximumTrackTintColor: colors.border,
              minimumTrackTintColor: colors.primary,
              bubbleBackgroundColor: colors.surface,
              bubbleTextColor: colors.primary,
            }}
            style={{ height: 40 }}
            thumbWidth={24}
          />
          <View style={styles.sliderRange}>
            <Text style={styles.sliderRangeText}>0 m</Text>
            <Text style={styles.sliderRangeText}>8000 m</Text>
          </View>
        </View>

        {/* ⑦ Eingabe-Karte: Abstieg */}
        <View style={styles.inputCard}>
          <Text style={styles.cardOverline}>🏔  ABSTIEG</Text>
          <View style={styles.sliderValueRow}>
            <Text style={styles.sliderValue}>{elevationLossM} m</Text>
          </View>
          <Slider
            progress={elevationLossProgress}
            minimumValue={elevationLossMin}
            maximumValue={elevationLossMax}
            onValueChange={(v) => {
              const snapped = Math.round(v / 50) * 50;
              setElevationLossM(snapped);
            }}
            onSlidingStart={() => setSliderScrollEnabled(false)}
            onSlidingComplete={() => setSliderScrollEnabled(true)}
            disableTrackPress
            theme={{
              maximumTrackTintColor: colors.border,
              minimumTrackTintColor: colors.primary,
              bubbleBackgroundColor: colors.surface,
              bubbleTextColor: colors.primary,
            }}
            style={{ height: 40 }}
            thumbWidth={24}
          />
          <View style={styles.sliderRange}>
            <Text style={styles.sliderRangeText}>0 m</Text>
            <Text style={styles.sliderRangeText}>8000 m</Text>
          </View>
          <TouchableOpacity
            style={styles.rundwegBtn}
            onPress={() => setElevationLossM(elevationGainMVal)}
            activeOpacity={0.7}
          >
            <Icon lib="mci" name="swap-vertical" size="sm" color={colors.primary} />
            <Text style={styles.rundwegBtnText}>Rundweg (Abstieg = Aufstieg)</Text>
          </TouchableOpacity>
        </View>

        {/* ⑧ Eingabe-Karte: Untergrund */}
        <View style={styles.inputCard}>
          <View style={styles.cardOverlineRow}>
            <Text style={styles.cardOverline}>🛣️  UNTERGRUND</Text>
            <TouchableOpacity
              onPress={() => setTerrainInfoVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Icon lib="feather" name="info" size="sm" color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Asphalt slider */}
          <View style={styles.terrainSliderBlock}>
            <View style={styles.terrainSliderHeader}>
              <Text style={styles.terrainSliderLabel}>Asphalt</Text>
              <Text style={styles.terrainSliderValue}>{Math.round(asphaltShare * 100)} %</Text>
            </View>
            <Slider
              progress={asphaltProgress}
              minimumValue={terrainMin}
              maximumValue={terrainMax}
              onValueChange={(v) => {
                const snapped = Math.round(v / 0.05) * 0.05;
                const newAsphalt = Math.max(0, Math.min(1, snapped));
                const newGravel = newAsphalt + gravelShare > 1 ? 1 - newAsphalt : gravelShare;
                setAsphaltShare(newAsphalt);
                setGravelShare(newGravel);
              }}
              onSlidingStart={() => setSliderScrollEnabled(false)}
              onSlidingComplete={() => setSliderScrollEnabled(true)}
              disableTrackPress
              theme={{
                maximumTrackTintColor: colors.border,
                minimumTrackTintColor: colors.primary,
                bubbleBackgroundColor: colors.surface,
                bubbleTextColor: colors.primary,
              }}
              style={{ height: 40 }}
              thumbWidth={24}
            />
          </View>

          {/* Schotter/Kies slider */}
          <View style={styles.terrainSliderBlock}>
            <View style={styles.terrainSliderHeader}>
              <Text style={styles.terrainSliderLabel}>Schotter / Kies</Text>
              <Text style={styles.terrainSliderValue}>{Math.round(gravelShare * 100)} %</Text>
            </View>
            <Slider
              progress={gravelProgress}
              minimumValue={terrainMin}
              maximumValue={terrainMax}
              onValueChange={(v) => {
                const snapped = Math.round(v / 0.05) * 0.05;
                const newGravel = Math.max(0, Math.min(1, snapped));
                const newAsphalt = asphaltShare + newGravel > 1 ? 1 - newGravel : asphaltShare;
                setGravelShare(newGravel);
                setAsphaltShare(newAsphalt);
              }}
              onSlidingStart={() => setSliderScrollEnabled(false)}
              onSlidingComplete={() => setSliderScrollEnabled(true)}
              disableTrackPress
              theme={{
                maximumTrackTintColor: colors.border,
                minimumTrackTintColor: colors.primary,
                bubbleBackgroundColor: colors.surface,
                bubbleTextColor: colors.primary,
              }}
              style={{ height: 40 }}
              thumbWidth={24}
            />
          </View>

          {/* Trail — read-only derived fill-bar */}
          <View style={styles.terrainSliderBlock}>
            <View style={styles.terrainSliderHeader}>
              <Text style={styles.terrainSliderLabel}>Trail / Pfad</Text>
              <Text style={styles.terrainSliderValue}>{Math.round(trailShare * 100)} %</Text>
            </View>
            <View style={styles.trailBarTrack}>
              <View
                style={[
                  styles.trailBarFill,
                  { width: `${Math.round(trailShare * 100)}%` as `${number}%` },
                ]}
              />
            </View>
          </View>

          <Text style={styles.terrainHint}>Die drei Anteile ergeben zusammen 100 %.</Text>
        </View>

        {/* ⑨ Eingabe-Karte: eBike-Unterstützung */}
        <View style={styles.inputCard}>
          <Text style={styles.cardOverline}>⚡  eBIKE-UNTERSTÜTZUNG</Text>
          <View style={styles.chipGroup}>
            {EBIKE_OPTIONS.map((opt) => {
              const active = ebikeSupport === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setEbikeSupport(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.ebikeHint}>
            Starke Unterstützung reduziert den geschätzten Kalorienverbrauch deutlich.
          </Text>
        </View>

        {/* ⑩ Inline-Fehler */}
        {inlineError && (
          <View style={styles.errorCard}>
            <Icon lib="feather" name="alert-circle" size="sm" color={colors.negative} />
            <Text style={styles.errorText}>{inlineError}</Text>
          </View>
        )}
      </ScrollView>

      {/* ⑪ Speichern-Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving || !canSubmit}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveBtnText}>Speichern</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Untergrund-Info Modal */}
      <Modal
        visible={terrainInfoVisible}
        transparent
        animationType="slide"
        onRequestClose={closeTerrainSheet}
      >
        <GestureHandlerRootView style={styles.terrainModalRoot}>
          <TouchableOpacity
            style={styles.terrainInfoBackdrop}
            activeOpacity={1}
            onPress={closeTerrainSheet}
          />
          <Animated.View style={[styles.terrainInfoSheet, terrainAnimStyle]}>
            <GestureDetector gesture={terrainPanGesture}>
              <View style={styles.terrainHandleZone}>
                <View style={styles.terrainInfoHandle} />
              </View>
            </GestureDetector>
            <Text style={styles.terrainInfoTitle}>Untergrundtypen</Text>
            {TERRAIN_INFO.map((item) => (
              <View key={item.label} style={styles.terrainInfoItem}>
                <Text style={styles.terrainInfoItemLabel}>{item.label}</Text>
                <Text style={styles.terrainInfoItemDesc}>{item.description}</Text>
              </View>
            ))}
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>

      <Snackbar ref={snackbarRef} />
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAxiosError(err: unknown, status: number): boolean {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const e = err as { response?: { status?: number } };
    return e.response?.status === status;
  }
  return false;
}

function extractErrorMessage(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const e = err as { response?: { data?: { message?: string } } };
    return e.response?.data?.message ?? null;
  }
  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // ① Screen Header
  screenHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTextBlock: {
    flex: 1,
  },
  screenTitle: {
    ...typography.h3,
    color: colors.text,
  },
  screenDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  headerSpacer: {
    width: 36,
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  // ② Preview card
  previewCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  previewOverline: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  previewBonus: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  previewDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  previewPlaceholder: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  previewPlaceholderText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  // Input cards
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardOverlineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.sm,
  },
  cardOverline: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  // Time row
  timeRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  // Speed row
  speedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  speedLabel: {
    ...typography.caption,
    flex: 1,
  },
  // Rundweg button
  rundwegBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    alignSelf: 'flex-start' as const,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  rundwegBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  // Terrain sliders
  terrainSliderBlock: {
    marginBottom: spacing.sm,
  },
  terrainSliderHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xs,
  },
  terrainSliderLabel: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  terrainSliderValue: {
    ...typography.body2,
    fontWeight: '700' as const,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  // Trail read-only bar
  trailBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden' as const,
  },
  trailBarFill: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
  },
  terrainHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center' as const,
  },
  // eBike chips
  chipGroup: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryDark,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center' as const,
  },
  chipLabelActive: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
  ebikeHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  // Disclaimer
  disclaimerCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  // Error card
  errorCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    backgroundColor: 'rgba(226, 107, 107, 0.12)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 107, 107, 0.3)',
    padding: spacing.sm,
  },
  errorText: {
    ...typography.body2,
    color: colors.negative,
    flex: 1,
  },
  // Slider value display
  sliderValueRow: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    marginBottom: spacing.xs,
  },
  sliderValue: {
    ...typography.body1,
    fontWeight: '700' as const,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  sliderRange: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginTop: 4,
  },
  sliderRangeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // Footer & save button
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700' as const,
  },
  // Terrain info modal
  terrainModalRoot: {
    flex: 1,
    justifyContent: 'flex-end' as const,
  },
  terrainInfoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  terrainInfoSheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  terrainInfoHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center' as const,
    marginBottom: spacing.md,
  },
  terrainHandleZone: {
    alignItems: 'center' as const,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    height: 40,
    justifyContent: 'center' as const,
  },
  terrainInfoTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  terrainInfoItem: {
    marginBottom: spacing.md,
  },
  terrainInfoItemLabel: {
    ...typography.body2,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 4,
  },
  terrainInfoItemDesc: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
