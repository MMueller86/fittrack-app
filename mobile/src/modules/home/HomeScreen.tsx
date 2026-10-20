// HomeScreen — persönliches Daily Dashboard.
// Beantwortet: "Wie läuft mein heutiger Tag?"
//
// Struktur (top → bottom):
//   1. FoodEntrySearchRow: schneller Einstieg zur Ernährungserfassung
//   2. CoachingHeroCard: Begrüßung (KI oder statisch) + Kurz-Insight + Tagesart-Auswahl
//   3. DayNutritionCard: Donut-Ring + Gewichtstrend + Makro-Balken
//   4. WeeklyReviewCard: sieben abgeschlossene Tage + KI-Wochenbewertung
//   5. ActivityCard / ActivityCtaCard: besondere Aktivität

import React, { useCallback, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { HomeStackParamList, RootTabParamList } from '../../app/navigation/RootNavigator';
import { colors, spacing, typography, radius } from '../../app/theme';
import { listWeights } from '../../services/weightsService';
import { diaryApi } from '../../shared/api/diaryApi';
import { profileApi } from '../../shared/api/profileApi';
import { syncLogger } from '../../services/health/syncLogger';
import { useDayTypeStore } from '../nutrition/useDayTypeStore';
import WorkoutTypePicker from './WorkoutTypePicker';
import { Icon } from '../../shared/components/Icon';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { FoodEntrySearchRow } from '../../shared/components/FoodEntrySearchRow';
import { CoachingHeroCard } from './CoachingHeroCard';
import { useFoodEntryHubStore } from '../nutrition/hub/useFoodEntryHubStore';
import { DayNutritionCard } from './DayNutritionCard';
import { WeeklyReviewCard } from './WeeklyReviewCard';
import { getInsight, type DailyInsightResponse } from '../../services/insightService';
import { aiApi } from '../../shared/api/aiApi';
import { getLocalDateContext, getLocalIsoDate } from '../../shared/date/localDate';
import type {
  WeightEntry,
  DiaryDayResponse,
  WorkoutType,
  WeeklyNutritionReviewResponse,
} from '@fittrack/shared';
import { ActivityCtaCard } from '../nutrition/components/ActivityCtaCard';
import { ActivityCard } from '../nutrition/components/ActivityCard';
import { ActivityPickerSheet } from '../nutrition/components/ActivityPickerSheet';
import { ActivityBonusSheet } from '../nutrition/components/ActivityBonusSheet';
import { ConfirmSheet, type ConfirmSheetAction } from '../../shared/components/ConfirmSheet';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import { getHomeActionDate } from './homeDate';
import { loadHomeData } from './homeDataLoader';

function logHomeLoadFailure(source: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[HomeScreen] ${source} load failed:`, error);
  syncLogger.error('HomeScreen', `${source} load failed`, detail);
}

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Guten Tag';
  return 'Guten Abend';
}

export default function HomeScreen({ navigation }: Props) {
  const openHub = useFoodEntryHubStore((s) => s.open);
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [todayDiary, setTodayDiary] = useState<DiaryDayResponse | null>(null);
  const [todayDiaryLoadError, setTodayDiaryLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  // Insight — null = not loaded or unavailable; the coaching card then keeps its static greeting
  const [insight, setInsight] = useState<DailyInsightResponse | null>(null);
  const [insightDate, setInsightDate] = useState<string | null>(null);
  const insightDateRef = useRef<string | null>(null);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyNutritionReviewResponse | null>(null);
  const [weeklyError, setWeeklyError] = useState(false);
  const homeDataRequestId = useRef(0);
  const weeklyRequestId = useRef(0);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  const { dayType, dayTypeDate, workoutType, targets, setTargets, setDayType, hydrateDayType } = useDayTypeStore();
  const [workoutPickerVisible, setWorkoutPickerVisible] = useState(false);
  const [activityPickerVisible, setActivityPickerVisible] = useState(false);
  const [activityBonusSheetVisible, setActivityBonusSheetVisible] = useState(false);
  const [confirmSheet, setConfirmSheet] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    actions: ConfirmSheetAction[];
  }>({ visible: false, title: '', actions: [] });

  const handleWorkoutTypeSelect = (wt: WorkoutType | null) => {
    setWorkoutPickerVisible(false);
    if (wt === null) {
      void setDayType('rest', null);
    } else {
      void setDayType('training', wt);
    }
  };

  const handleDeleteActivity = () => {
    setConfirmSheet({
      visible: true,
      title: 'Aktivität entfernen?',
      subtitle: 'Der Aktivitätsbonus wird aus deinem Kalorienziel entfernt.',
      actions: [
        {
          label: 'Aktivität entfernen',
          destructive: true,
          onPress: async () => {
            try {
              await diaryApi.removeSpecialActivity(getHomeActionDate());
              await load();
            } catch {
              // silent — reload zeigt aktuellen Stand
            }
          },
        },
      ],
    });
  };

  const handleEditActivity = () => {
    if (!todayDiary?.specialActivity) return;
    const currentDate = getHomeActionDate();
    if (todayDiary.specialActivity.type === 'cycling') {
      navigation.navigate('CyclingInput', { date: currentDate, existing: todayDiary.specialActivity });
    } else {
      navigation.navigate('HikingInput', { date: currentDate, existing: todayDiary.specialActivity });
    }
  };

  const loadWeeklyReview = useCallback(async () => {
    const requestId = ++weeklyRequestId.current;
    const { currentLocalDate: referenceDate } = getLocalDateContext();
    setWeeklyError(false);

    try {
      const result = await aiApi.getWeeklyInsight(referenceDate);
      if (requestId !== weeklyRequestId.current) return;
      setWeeklyReview(result);
    } catch {
      if (requestId !== weeklyRequestId.current) return;
      setWeeklyError(true);
    }
  }, []);

  const load = useCallback(async (): Promise<number> => {
    const requestId = ++homeDataRequestId.current;
    const { currentLocalDate: currentDate } = getLocalDateContext();
    const { weights, profile, diary } = await loadHomeData({
      weights: listWeights(),
      profile: profileApi.getMe(),
      diary: diaryApi.getDay(currentDate),
    });
    if (requestId !== homeDataRequestId.current) return requestId;

    if (weights.status === 'fulfilled') {
      setEntries(weights.value);
    } else {
      logHomeLoadFailure('weights', weights.reason);
    }

    if (profile.status === 'fulfilled') {
      if (profile.value.targets) setTargets(profile.value.targets);
      if (profile.value.profile?.targetWeightKg) setTargetWeightKg(profile.value.profile.targetWeightKg);
      if (profile.value.profile?.displayName) setDisplayName(profile.value.profile.displayName);
    } else {
      logHomeLoadFailure('profile', profile.reason);
    }

    if (diary.status === 'fulfilled') {
      setTodayDiary(diary.value);
      setTodayDiaryLoadError(false);
      if (diary.value.dayType != null) {
        hydrateDayType(diary.value.dayType, currentDate, diary.value.workoutType ?? null);
      }
    } else {
      setTodayDiaryLoadError(true);
      logHomeLoadFailure('diary', diary.reason);
    }

    // Insight runs independently — does NOT block the screen from rendering.
    // A same-day refresh keeps the previous response visible until the new one arrives.
    if (insightDateRef.current !== currentDate) setInsight(null);
    insightDateRef.current = currentDate;
    setInsightDate(currentDate);
    getInsight(currentDate)
      .then((result) => {
        if (requestId === homeDataRequestId.current) setInsight(result);
      })
      .catch(() => {
        if (requestId === homeDataRequestId.current) setInsight(null);
      });
    return requestId;
  }, [setTargets, hydrateDayType]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadWeeklyReview();
      (async () => {
        setLoading(true);
        const requestId = await load();
        if (!cancelled && requestId === homeDataRequestId.current) setLoading(false);
      })();
      return () => {
        cancelled = true;
        homeDataRequestId.current += 1;
        weeklyRequestId.current += 1;
      };
    }, [load, loadWeeklyReview]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    void loadWeeklyReview();
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load, loadWeeklyReview]);

  const currentLocalDate = getLocalIsoDate();
  const selectedDayType = dayTypeDate === currentLocalDate
    ? dayType
    : todayDiary?.dayType === 'training' ? 'training' : 'rest';
  const selectedWorkoutType = dayTypeDate === currentLocalDate
    ? workoutType
    : selectedDayType === 'training' ? todayDiary?.workoutType ?? null : null;
  const todayTargets = targets
    ? selectedDayType === 'training'
      ? targets.trainingDay
      : targets.restDay
    : null;

  function navToTab(tab: 'Nutrition' | 'Weight') {
    const rootNavigation = navigation.getParent<NavigationProp<RootTabParamList>>();
    if (tab === 'Nutrition') {
      rootNavigation?.navigate('Nutrition', { screen: 'DiaryMain' });
    } else {
      rootNavigation?.navigate('Weight');
    }
  }

  function openDiaryDay(date: string) {
    navigation.getParent<NavigationProp<RootTabParamList>>()?.navigate('Nutrition', {
      screen: 'DiaryMain',
      params: { date },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Sticky primary action; the tab bar already identifies Home. */}
      <View style={styles.stickyHeader}>
        <FoodEntrySearchRow
          onSearch={() => openHub({ date: getHomeActionDate(), onSuccess: onRefresh, topInset: insets.top })}
          onAi={() => openHub({ date: getHomeActionDate(), initialSubflow: 'ai', autoCloseOnSave: true, onSuccess: onRefresh, topInset: insets.top })}
          onBarcode={() => openHub({ date: getHomeActionDate(), initialSubflow: 'barcode', autoCloseOnSave: true, onSuccess: onRefresh, topInset: insets.top })}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Coaching Hero Card ── */}
        <CoachingHeroCard
          displayName={displayName ?? 'Sportler'}
          greeting={getGreeting()}
          dayType={selectedDayType}
          workoutType={selectedWorkoutType}
          onTrainingPress={() => setWorkoutPickerVisible(true)}
          insight={insight}
          insightDate={insightDate}
          onFeedbackSuccess={() => showSnackbar({ message: 'Feedback gesendet' })}
        />

        {todayDiaryLoadError && (
          <ErrorBanner
            error="Die Ernährungsdaten konnten nicht aktualisiert werden."
            onRetry={onRefresh}
          />
        )}

        {/* ── Tages-Nutrition Card ── */}
        {(!todayDiaryLoadError || todayDiary !== null) && (
          <DayNutritionCard
            summary={todayDiary?.summary ?? null}
            target={todayTargets}
            onPress={() => navToTab('Nutrition')}
            activityBonus={todayDiary?.activityBonus ?? 0}
            entries={entries}
            referenceDate={currentLocalDate}
            hasFoodEntries={todayDiary?.meals.some((meal) => meal.items.length > 0) ?? false}
          />
        )}

        <WeeklyReviewCard
          review={weeklyReview}
          error={weeklyError}
          onRetry={loadWeeklyReview}
          onOpenDiary={openDiaryDay}
        />

        {/* ── Besondere Aktivität ── */}
        {todayDiary && (
          <View style={styles.activitySection}>
            {todayDiary.specialActivity ? (
              <ActivityCard
                activity={todayDiary.specialActivity}
                onShowBreakdown={() => setActivityBonusSheetVisible(true)}
                onEdit={handleEditActivity}
                onDelete={handleDeleteActivity}
                consumedCalories={todayDiary.summary?.calories ?? 0}
              />
            ) : (
              <ActivityCtaCard
                dynamic={todayDiary.previousDayHasActivity ?? false}
                onAdd={() => setActivityPickerVisible(true)}
              />
            )}
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <WorkoutTypePicker
        visible={workoutPickerVisible}
        onSelect={handleWorkoutTypeSelect}
        onClose={() => setWorkoutPickerVisible(false)}
      />

      <ActivityPickerSheet
        visible={activityPickerVisible}
        onClose={() => setActivityPickerVisible(false)}
        onSelectHiking={() => {
          setActivityPickerVisible(false);
          navigation.navigate('HikingInput', { date: getHomeActionDate() });
        }}
        onSelectCycling={() => {
          setActivityPickerVisible(false);
          navigation.navigate('CyclingInput', { date: getHomeActionDate() });
        }}
      />

      {todayDiary?.specialActivity && (
        <ActivityBonusSheet
          visible={activityBonusSheetVisible}
          onClose={() => setActivityBonusSheetVisible(false)}
          activity={todayDiary.specialActivity}
        />
      )}

      <ConfirmSheet
        visible={confirmSheet.visible}
        title={confirmSheet.title}
        subtitle={confirmSheet.subtitle}
        actions={confirmSheet.actions}
        onClose={() => setConfirmSheet((s) => ({ ...s, visible: false }))}
      />

      <Snackbar ref={snackbarRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  activitySection: {
    marginHorizontal: spacing.md,
  },

  // Sticky food-entry action
  stickyHeader: {
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
