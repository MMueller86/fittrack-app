// HomeScreen — persönliches Daily Dashboard.
// Beantwortet: "Wie läuft mein heutiger Tag?"
//
// Struktur (top → bottom):
//   1. BrandHeader: FitTrack-Logo + Name
//   2. CoachingHeroCard: Begrüßung + Hint + Gewicht (2-Spalten) + Sparkline
//   3. DayNutritionCard: Donut-Ring + animierte Kalorien + Makro-Balken
//   4. InsightCard: KI-Tagesanalyse (async, non-blocking)

import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { HomeStackParamList, RootTabParamList } from '../../app/navigation/RootNavigator';
import { colors, spacing, typography } from '../../app/theme';
import { listWeights } from '../../services/weightsService';
import { diaryApi } from '../../shared/api/diaryApi';
import { profileApi } from '../../shared/api/profileApi';
import { useDayTypeStore } from '../nutrition/useDayTypeStore';
import WorkoutTypePicker from './WorkoutTypePicker';
import { getDayHint } from './getDayHint';
import { CoachingHeroCard } from './CoachingHeroCard';
import { DayNutritionCard } from './DayNutritionCard';
import { InsightCard } from './InsightCard';
import { getInsight } from '../../services/insightService';
import type { WeightEntry, DiaryDayResponse, WorkoutType, InsightResponse } from '@fittrack/shared';

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
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [todayDiary, setTodayDiary] = useState<DiaryDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(undefined);
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  // Insight — null = loading (shows skeleton), InsightResponse = content arrived
  const [insight, setInsight] = useState<InsightResponse | null>(null);

  const { dayType, workoutType, targets, setTargets, setDayType, hydrateDayType } = useDayTypeStore();
  const [workoutPickerVisible, setWorkoutPickerVisible] = useState(false);

  const handleWorkoutTypeSelect = (wt: WorkoutType | null) => {
    setWorkoutPickerVisible(false);
    if (wt === null) {
      void setDayType('rest', null);
    } else {
      void setDayType('training', wt);
    }
  };

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
      console.error('[HomeScreen] load failed:', err);
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
      (async () => {
        setLoading(true);
        await load();
        if (!cancelled) setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const latest = entries[0];
  const previous = entries[1];
  const todayTargets = targets
    ? dayType === 'training'
      ? targets.trainingDay
      : targets.restDay
    : null;

  function navToTab(tab: keyof RootTabParamList) {
    navigation.getParent<any>()?.navigate(tab);
  }

  const hint = getDayHint(
    todayDiary?.summary ?? null,
    todayTargets ? { calories: todayTargets.calories, proteinG: todayTargets.proteinG } : null,
    dayType,
    workoutType,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Brand Header ── */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandLogo}>
            Fit<Text style={styles.brandAccent}>Track</Text>
          </Text>
          <Text style={styles.brandName}>{displayName ?? 'Willkommen'}</Text>
        </View>

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
        />

        {/* ── FitTrack Insight — async, non-blocking ── */}
        <InsightCard
          insight={insight}
          onCtaPress={(target) => {
            if (target === 'Nutrition') navToTab('Nutrition');
            else if (target === 'Weight') navToTab('Weight');
          }}
        />

      </ScrollView>

      <WorkoutTypePicker
        visible={workoutPickerVisible}
        onSelect={handleWorkoutTypeSelect}
        onClose={() => setWorkoutPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },

  // ── Brand Header ──
  brandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
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
});
