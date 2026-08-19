// HomeScreen — persönliches Daily Dashboard.
// Beantwortet: "Wie läuft mein heutiger Tag?"
//
// Struktur (top → bottom):
//   1. BrandHeader: FitTrack-Logo + Name
//   2. CoachingHeroCard: Begrüßung + Hint + Gewicht (2-Spalten) + Sparkline
//   3. DayNutritionCard: Donut-Ring + animierte Kalorien + Makro-Balken
//   4. WeeklyReviewCard: sieben abgeschlossene Tage + KI-Wochenbewertung
//   5. ActivityCard / ActivityCtaCard: besondere Aktivität
//   6. InsightCard: KI-Tagesanalyse (async, non-blocking)

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
import { getDayHint } from './getDayHint';
import { Icon } from '../../shared/components/Icon';
import { CoachingHeroCard } from './CoachingHeroCard';
import { useFoodEntryHubStore } from '../nutrition/hub/useFoodEntryHubStore';
import { DayNutritionCard } from './DayNutritionCard';
import { WeeklyReviewCard } from './WeeklyReviewCard';
import { InsightCard } from './InsightCard';
import { getInsight } from '../../services/insightService';
import { aiApi } from '../../shared/api/aiApi';
import { getLocalIsoDate } from '../../shared/date/localDate';
import type {
  WeightEntry,
  DiaryDayResponse,
  WorkoutType,
  InsightResponse,
  WeeklyNutritionReviewResponse,
} from '@fittrack/shared';
import { ActivityCtaCard } from '../nutrition/components/ActivityCtaCard';
import { ActivityCard } from '../nutrition/components/ActivityCard';
import { ActivityPickerSheet } from '../nutrition/components/ActivityPickerSheet';
import { ActivityBonusSheet } from '../nutrition/components/ActivityBonusSheet';
import { ConfirmSheet, type ConfirmSheetAction } from '../../shared/components/ConfirmSheet';

// Shown when the insight could not be loaded (network error, backend unavailable, etc.)
const INSIGHT_UNAVAILABLE: InsightResponse = {
  title: 'Analyse nicht verfügbar',
  summary: 'Sobald wieder eine Verbindung besteht, aktualisiere ich deine persönliche Analyse automatisch.',
  generatedAt: new Date().toISOString(),
  promptVersion: 'v1',
  status: 'unavailable',
};

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
  const [brandHeaderHeight, setBrandHeaderHeight] = useState(0);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [todayDiary, setTodayDiary] = useState<DiaryDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  // Insight — null = loading (shows skeleton), InsightResponse = content arrived
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyNutritionReviewResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyError, setWeeklyError] = useState(false);
  const weeklyRequestId = useRef(0);

  const { dayType, workoutType, targets, setTargets, setDayType, hydrateDayType } = useDayTypeStore();
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

  const todayDate = new Date().toISOString().split('T')[0]!;

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
              await diaryApi.removeSpecialActivity(todayDate);
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
    if (todayDiary.specialActivity.type === 'cycling') {
      navigation.navigate('CyclingInput', { date: todayDate, existing: todayDiary.specialActivity });
    } else {
      navigation.navigate('HikingInput', { date: todayDate, existing: todayDiary.specialActivity });
    }
  };

  const loadWeeklyReview = useCallback(async () => {
    const requestId = ++weeklyRequestId.current;
    const referenceDate = getLocalIsoDate();
    setWeeklyLoading(true);
    setWeeklyError(false);

    try {
      const result = await aiApi.getWeeklyInsight(referenceDate);
      if (requestId !== weeklyRequestId.current) return;
      setWeeklyReview(result);
    } catch {
      if (requestId !== weeklyRequestId.current) return;
      setWeeklyError(true);
    } finally {
      if (requestId === weeklyRequestId.current) setWeeklyLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    // Compute today's date inside the callback so it's always current,
    // even if the app was backgrounded overnight (module-level constants freeze at load time).
    const today = new Date().toISOString().split('T')[0]!;
    try {
      const [weightData, profileData, diaryData] = await Promise.all([
        listWeights(),
        profileApi.getMe(),
        diaryApi.getDay(today),
      ]);
      setEntries(weightData);
      if (profileData.targets) setTargets(profileData.targets);
      if (profileData.profile?.targetWeightKg) setTargetWeightKg(profileData.profile.targetWeightKg);
      if (profileData.profile?.displayName) setDisplayName(profileData.profile.displayName);
      setTodayDiary(diaryData);
      if (diaryData.dayType != null) {
        hydrateDayType(diaryData.dayType, today, diaryData.workoutType ?? null);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[HomeScreen] load failed:', err);
      syncLogger.error('HomeScreen', 'load failed', detail);
      setEntries([]);
    }
    // Insight runs independently — does NOT block the screen from rendering
    setInsight(null);
    getInsight(today)
      .then((result) => setInsight(result ?? INSIGHT_UNAVAILABLE))
      .catch(() => setInsight(INSIGHT_UNAVAILABLE));
  }, [setTargets, hydrateDayType]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadWeeklyReview();
      (async () => {
        setLoading(true);
        await load();
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
        weeklyRequestId.current += 1;
      };
    }, [load, loadWeeklyReview]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    void loadWeeklyReview();
    await load();
    setRefreshing(false);
  }, [load, loadWeeklyReview]);

  const latest = entries[0];
  const previous = entries[1];
  const todayTargets = targets
    ? dayType === 'training'
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

  const hint = getDayHint(
    todayDiary?.summary ?? null,
    todayTargets ? {
      calories: todayTargets.calories + (todayDiary?.activityBonus ?? 0),
      proteinG: todayTargets.proteinG,
    } : null,
    dayType,
    workoutType,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Sticky Header: Brand + Search Bar */}
      <View style={styles.stickyHeader}>
        <View style={styles.brandHeader} onLayout={(e) => setBrandHeaderHeight(e.nativeEvent.layout.height)}>
          <Text style={styles.brandLogo}>
            Fit<Text style={styles.brandAccent}>Track</Text>
          </Text>
          <Text style={styles.brandName}>{displayName ?? 'Willkommen'}</Text>
        </View>
        {/* Search Row — identisches Layout wie im Food Hub */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.searchPill}
            onPress={() => openHub({ onSuccess: onRefresh, topInset: insets.top + brandHeaderHeight })}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Lebensmittel suchen"
          >
            <Icon lib="feather" name="search" size="sm" color={colors.textMuted} />
            <Text style={styles.searchPillPlaceholder}>Lebensmittel suchen…</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.searchAction}
            onPress={() => openHub({ initialSubflow: 'ai', autoCloseOnSave: true, onSuccess: onRefresh, topInset: insets.top + brandHeaderHeight })}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="KI-Analyse"
          >
            <Icon lib="mci" name="auto-fix" size="md" color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.searchAction}
            onPress={() => openHub({ initialSubflow: 'barcode', autoCloseOnSave: true, onSuccess: onRefresh, topInset: insets.top + brandHeaderHeight })}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Barcode scannen"
          >
            <Icon lib="mci" name="barcode-scan" size="md" color={colors.primary} />
          </TouchableOpacity>
        </View>
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
          hint={hint}
          dayType={dayType}
          workoutType={workoutType}
          onTrainingPress={() => setWorkoutPickerVisible(true)}
          latest={latest}
          previous={previous}
          entries={entries}
        />

        {/* ── Tages-Nutrition Card ── */}
        <DayNutritionCard
          summary={todayDiary?.summary ?? null}
          target={todayTargets}
          onPress={() => navToTab('Nutrition')}
          activityBonus={todayDiary?.activityBonus ?? 0}
        />

        <WeeklyReviewCard
          review={weeklyReview}
          loading={weeklyLoading}
          error={weeklyError}
          onRetry={loadWeeklyReview}
          onOpenDiary={openDiaryDay}
        />

        {/* ── Besondere Aktivität ── */}
        {todayDiary && (
          todayDiary.specialActivity ? (
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
          )
        )}

        {/* ── FitTrack Insight — async, non-blocking ── */}
        <InsightCard
          insight={insight}
          onCtaPress={(target) => {
            if (target === 'Nutrition') navToTab('Nutrition');
            else if (target === 'Weight') navToTab('Weight');
          }}
        />

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
          navigation.navigate('HikingInput', { date: todayDate });
        }}
        onSelectCycling={() => {
          setActivityPickerVisible(false);
          navigation.navigate('CyclingInput', { date: todayDate });
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

  // Sticky Header
  stickyHeader: {
    backgroundColor: colors.background,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  brandLogo: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: colors.text,
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: colors.primary,
  },
  brandName: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Search Row — identisch zum Food Hub
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: 2,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 52,
    paddingHorizontal: spacing.md,
  },
  searchPillPlaceholder: {
    ...typography.body1,
    color: colors.textMuted,
    flex: 1,
  },
  searchAction: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
