// HikingInputScreen — form screen for logging a hiking activity.
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
import type { PackCategory, SpecialActivity, TerrainType } from '@fittrack/shared';
import { calculateActivityBonus } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { diaryApi } from '../../shared/api/diaryApi';
import { profileApi } from '../../shared/api/profileApi';
import { Icon } from '../../shared/components/Icon';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import type { NutritionStackParamList } from '../../app/navigation/RootNavigator';
import { useDayTypeStore } from './useDayTypeStore';

type Props = NativeStackScreenProps<NutritionStackParamList, 'HikingInput'>;

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

function getSpeedLabel(kmh: number): { label: string; color: string; ok: boolean } {
  if (kmh < 0.5) return { label: 'Zu langsam für eine Wanderung', color: colors.negative, ok: false };
  if (kmh <= 2.0) return { label: 'Sehr ruhiges Tempo', color: colors.primary, ok: true };
  if (kmh <= 3.5) return { label: 'Gemütliches Wandertempo', color: colors.primary, ok: true };
  if (kmh <= 5.0) return { label: 'Flüssiges Wandertempo', color: colors.primary, ok: true };
  if (kmh <= 7.0) return { label: 'Zügiges Tempo', color: colors.primary, ok: true };
  if (kmh <= 10.0) return { label: 'Sehr schnelles Tempo', color: colors.neutral, ok: true };
  return { label: 'Zu schnell für eine Wanderung', color: colors.negative, ok: false };
}

// ─── Pack default helper ───────────────────────────────────────────────────────

function getDefaultPack(minutes: number): PackCategory {
  if (minutes > 240) return 'medium';
  if (minutes >= 120) return 'small';
  return 'none';
}

// ─── Terrain config ────────────────────────────────────────────────────────────

const TERRAIN_OPTIONS: Array<{ value: TerrainType; label: string; iconLib: 'mci'; icon: string }> = [
  { value: 'path',     label: 'Weg',         iconLib: 'mci', icon: 'road-variant' },
  { value: 'trail',    label: 'Wanderweg',   iconLib: 'mci', icon: 'hiking' },
  { value: 'alpine',   label: 'Alpin',       iconLib: 'mci', icon: 'image-filter-hdr' },
  { value: 'scramble', label: 'Klettersteig',iconLib: 'mci', icon: 'terrain' },
];

const TERRAIN_INFO = [
  {
    label: '🛣️  Weg',
    description:
      'Befestigter oder fester Weg, Forststraße oder Teerweg. Gleichmäßiger Untergrund ohne Hindernisse – typisch für Talboden und Zufahrtswege.',
  },
  {
    label: '🥾  Wanderweg',
    description:
      'Markierter Bergweg mit natürlichem Untergrund (Erde, Schotter, Wurzeln). Kann steile Abschnitte und unebenes Gelände enthalten – der häufigste Wandertyp.',
  },
  {
    label: '🏔️  Alpin',
    description:
      'Steiler Steig im felsigen Hochgebirge. Hände werden gelegentlich zur Stabilisierung benötigt. Entspricht etwa T3–T4 der SAC-Wanderskala.',
  },
  {
    label: '🧗  Klettersteig',
    description:
      'Sehr anspruchsvolles Gelände mit Leitern, Stufen und Sicherungsseil. Entspricht Klettersteigkategorie A–D. Spezielle Ausrüstung und Erfahrung erforderlich.',
  },
];

const PACK_OPTIONS: Array<{ value: PackCategory; label: string }> = [
  { value: 'none',   label: 'Kein' },
  { value: 'small',  label: 'Klein\n(<5 kg)' },
  { value: 'medium', label: 'Mittel\n(5–10 kg)' },
  { value: 'heavy',  label: 'Schwer\n(>10 kg)' },
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
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCurrent(Math.round(target * eased));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, active]);
  return current;
}

export default function HikingInputScreen({ navigation, route }: Props) {
  const { date, existing } = route.params;
  const isEdit = !!existing;

  // Form state — pre-fill from existing if editing
  const [hoursVal, setHoursVal] = useState<number>(
    existing ? Math.floor(existing.movementTimeMinutes / 60) : 2,
  );
  const [minutesVal, setMinutesVal] = useState<number>(
    existing ? Math.round((existing.movementTimeMinutes % 60) / 15) * 15 : 0,
  );
  const [distanceKmVal, setDistanceKmVal] = useState<number>(
    existing ? existing.distanceKm : 6,
  );
  const [elevationGainMVal, setElevationGainMVal] = useState<number>(
    existing ? existing.elevationGainM : 200,
  );
  const [elevationLossM, setElevationLossM] = useState<number>(
    existing ? (existing.elevationLossM ?? 0) : 0,
  );
  const [terrainType, setTerrainType] = useState<TerrainType>(
    existing?.terrainType ?? (existing ? 'path' : 'trail'),
  );

  const initialMinutes = existing ? existing.movementTimeMinutes : 120;
  const [packCategory, setPackCategory] = useState<PackCategory>(
    existing?.packCategory ?? getDefaultPack(initialMinutes),
  );
  // Track whether user has manually changed the pack category
  const packUserModified = useRef(!!existing?.packCategory);

  const [profileWeight, setProfileWeight] = useState<number>(
    existing?.bodyWeightKg ?? 75,
  );

  const [saving, setSaving] = useState(false);
  const [terrainInfoVisible, setTerrainInfoVisible] = useState(false);
  const [sliderScrollEnabled, setSliderScrollEnabled] = useState(true);

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
  const distanceMin = useSharedValue(0.5);
  const distanceMax = useSharedValue(35);
  const elevationMin = useSharedValue(0);
  const elevationMax = useSharedValue(3000);
  const elevationLossMin = useSharedValue(0);
  const elevationLossMax = useSharedValue(3000);

  useEffect(() => {
    distanceProgress.value = distanceKmVal;
  }, [distanceKmVal]);
  useEffect(() => {
    elevationProgress.value = elevationGainMVal;
  }, [elevationGainMVal]);
  useEffect(() => {
    elevationLossProgress.value = elevationLossM;
  }, [elevationLossM]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const previewAnimDoneRef = useRef(false);
  const [previewActive, setPreviewActive] = useState(false);

  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  // Load profile weight for live preview
  useEffect(() => {
    profileApi.getMe().then(({ profile }) => {
      if (profile?.weightKg) setProfileWeight(profile.weightKg);
    }).catch(() => {});
  }, []);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const totalMinutes = hoursVal * 60 + minutesVal;
  const parsedDistance = distanceKmVal;
  const parsedElevation = elevationGainMVal;

  // Auto-update packCategory when time changes and user hasn't manually chosen
  useEffect(() => {
    if (!packUserModified.current) {
      setPackCategory(getDefaultPack(totalMinutes));
    }
  }, [totalMinutes]);

  const speedInfo = useMemo(() => {
    if (totalMinutes <= 0 || parsedDistance <= 0) return null;
    const kmh = parsedDistance / (totalMinutes / 60);
    return { kmh, ...getSpeedLabel(kmh) };
  }, [totalMinutes, parsedDistance]);

  const liveResult = useMemo(() => {
    if (totalMinutes < 30 || parsedDistance < 0.5) return null;
    try {
      return calculateActivityBonus(
        {
          movementTimeMinutes: totalMinutes,
          distanceKm: parsedDistance,
          elevationGainM: parsedElevation,
          elevationLossM,
          packCategory,
          terrainType,
        },
        profileWeight,
        dailyCalorieTarget,
      );
    } catch {
      return null;
    }
  }, [totalMinutes, parsedDistance, parsedElevation, elevationLossM, packCategory, terrainType, profileWeight, dailyCalorieTarget]);

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
    if (totalMinutes < 30) {
      return 'Die Bewegungszeit muss mindestens 30 Minuten betragen.';
    }
    // distanceKm und elevationGainM sind durch die Slider immer im gültigen Bereich
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
        type: 'hiking',
        movementTimeMinutes: totalMinutes,
        distanceKm: parsedDistance,
        elevationGainM: parsedElevation,
        elevationLossM,
        packCategory,
        terrainType,
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

  const canSubmit = totalMinutes >= 30;

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
          <Text style={styles.screenTitle}>{isEdit ? 'Wanderung bearbeiten' : 'Wanderung erfassen'}</Text>
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
              <Text style={styles.previewOverline}>🥾  GESCHÄTZTER AKTIVITÄTSBONUS</Text>
              <Text style={styles.previewBonus}>≈  {previewActive ? animBonus : Math.round(liveResult.activityBonus)} kcal</Text>
              <Text style={styles.previewDetail}>
                MET {liveResult.estimatedMet.toFixed(1)} · {(totalMinutes / 60).toFixed(1)} h · {Math.round(profileWeight)} kg · {Math.round(liveResult.hikingCalories)} kcal Wanderverbrauch
              </Text>
            </View>
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={styles.previewPlaceholderText}>
                Gib Bewegungszeit und Strecke ein, um den geschätzten Aktivitätsbonus zu berechnen.
              </Text>
            </View>
          )}

          {/* Disclaimer */}
          <View style={styles.disclaimerCard}>
            <Icon lib="feather" name="info" size="sm" color={colors.textMuted} />
            <Text style={styles.disclaimerText}>
              Alle Werte sind Schätzungen. Individuelle Faktoren wie Fitnesslevel, Höhe und Wetter können abweichen.
            </Text>
          </View>

          {/* ③ Eingabe-Karte: Bewegungszeit */}
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

          {/* ④ Eingabe-Karten: Strecke & Höhenmeter */}
          <View style={styles.inputCard}>
            <Text style={styles.cardOverline}>📍  STRECKE</Text>
            <View style={styles.sliderValueRow}>
              <Text style={styles.sliderValue}>
                {distanceKmVal % 1 === 0 ? `${distanceKmVal} km` : `${distanceKmVal.toFixed(1)} km`}
              </Text>
            </View>
            <Slider
              progress={distanceProgress}
              minimumValue={distanceMin}
              maximumValue={distanceMax}
              onValueChange={(v) => {
                const snapped = Math.round(v / 0.5) * 0.5;
                setDistanceKmVal(snapped);
              }}
              onSlidingStart={() => setSliderScrollEnabled(false)}
              onSlidingComplete={() => setSliderScrollEnabled(true)}
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
              <Text style={styles.sliderRangeText}>0.5 km</Text>
              <Text style={styles.sliderRangeText}>35 km</Text>
            </View>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.cardOverline}>⛰  HÖHENMETER</Text>
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
              <Text style={styles.sliderRangeText}>3000 m</Text>
            </View>
          </View>

          {/* ⑤ Eingabe-Karte: Abstieg */}
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
              <Text style={styles.sliderRangeText}>3000 m</Text>
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

          {/* ⑥ Eingabe-Karte: Gelände */}
          <View style={styles.inputCard}>
            <View style={styles.cardOverlineRow}>
              <Text style={styles.cardOverline}>🗺  GELÄNDE</Text>
              <TouchableOpacity
                onPress={() => setTerrainInfoVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Icon lib="feather" name="info" size="sm" color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.chipGroup}>
              {TERRAIN_OPTIONS.map((opt) => {
                const active = terrainType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setTerrainType(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Icon lib={opt.iconLib} name={opt.icon as any} size="sm" color={active ? colors.primary : colors.textMuted} />
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ⑦ Eingabe-Karte: Rucksack */}
          <View style={styles.inputCard}>
            <Text style={styles.cardOverline}>🎒  RUCKSACK</Text>
            <View style={styles.chipGroup}>
              {PACK_OPTIONS.map((opt) => {
                const active = packCategory === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      packUserModified.current = true;
                      setPackCategory(opt.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ⑨ Inline-Fehler */}
          {inlineError && (            <View style={styles.errorCard}>
              <Icon lib="feather" name="alert-circle" size="sm" color={colors.negative} />
              <Text style={styles.errorText}>{inlineError}</Text>
            </View>
          )}
      </ScrollView>

      {/* ⑧ Speichern-Button */}
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

      {/* Gelände-Info Modal */}
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
            <Text style={styles.terrainInfoTitle}>Geländetypen</Text>
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
  // Input cards (③ ④ ⑤)
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
  // ③ Time row
  timeRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  timeField: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  timeInput: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    minWidth: 40,
  },
  fieldUnit: {
    ...typography.body2,
    color: colors.textMuted,
  },
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
  // ④ Two-column row
  twoColumnRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  columnField: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  columnInput: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    minWidth: 40,
  },
  // ⑤ Switch row (kept for potential future use)
  switchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  switchLabel: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
  },
  backpackHint: {
    ...typography.caption,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    alignSelf: 'flex-start' as const,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
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
  // Chip group (terrain / pack selectors)
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
  // ⑥ Error card
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
  // ⑦ Footer & save button
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
