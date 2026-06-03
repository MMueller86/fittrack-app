// HomeScreen — branded landing surface.
// Shows the app logo, a welcome line, a Day-Type toggle (rest/training),
// macro progress for today, and an embedded compact weight chart.

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { HomeStackParamList, RootTabParamList } from '../../app/navigation/RootNavigator';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Logo } from '../../shared/components/Logo';
import { WeightChart } from '../../shared/components/WeightChart';
import { TrendPill } from '../../shared/components/TrendPill';
import { MacroSummaryCard } from '../../shared/components/MacroSummaryCard';
import { listWeights } from '../../services/weightsService';
import { diaryApi } from '../../shared/api/diaryApi';
import { profileApi } from '../../shared/api/profileApi';
import { useDayTypeStore } from '../nutrition/useDayTypeStore';
import type { WeightEntry, DiaryDayResponse } from '@fittrack/shared';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

const TODAY = new Date().toISOString().split('T')[0];

export default function HomeScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [todayDiary, setTodayDiary] = useState<DiaryDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(undefined);

  const { dayType, targets, setTargets, setDayType } = useDayTypeStore();

  const load = useCallback(async () => {
    try {
      const [weightData, profileData, diaryData] = await Promise.all([
        listWeights(),
        profileApi.getMe(),
        diaryApi.getDay(TODAY),
      ]);
      setEntries(weightData);
      if (profileData.targets) setTargets(profileData.targets);
      if (profileData.profile?.targetWeightKg) setTargetWeightKg(profileData.profile.targetWeightKg);
      setTodayDiary(diaryData);
    } catch {
      setEntries([]);
    }
  }, [setTargets]);

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
  const todayTargets = targets ? (dayType === 'training' ? targets.trainingDay : targets.restDay) : null;

  const chartWidth = useMemo(() => Dimensions.get('window').width - spacing.md * 4, []);

  function navToTab(tab: keyof RootTabParamList) {
    navigation.getParent<any>()?.navigate(tab);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.brand}>
          <Logo size={120} />
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.tagline}>Ernährung. Training. Fortschritt.</Text>
        </View>

        {/* Day-Type Toggle (kompakt) */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, dayType === 'rest' && styles.toggleBtnActive]}
            onPress={() => setDayType('rest')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, dayType === 'rest' && styles.toggleTextActive]}>
              🛌 Ruhetag
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, dayType === 'training' && styles.toggleBtnActive]}
            onPress={() => setDayType('training')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, dayType === 'training' && styles.toggleTextActive]}>
              💪 Trainingstag
            </Text>
          </TouchableOpacity>
        </View>

        {/* Macro-Fortschritt für heute — tippbar → Nutrition Tab */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navToTab('Nutrition')}>
          {todayDiary && todayTargets ? (
            <MacroSummaryCard summary={todayDiary.summary} target={todayTargets} />
          ) : todayTargets ? (
            <MacroSummaryCard
              summary={{ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }}
              target={todayTargets}
            />
          ) : null}
        </TouchableOpacity>

        {/* Gewicht — tippbar → Gewicht Tab */}
        <TouchableOpacity style={styles.weightCard} activeOpacity={0.85} onPress={() => navToTab('Weight')}>
          <View style={styles.weightCardHeader}>
            <Text style={styles.weightEyebrow}>Gewicht</Text>
            <View style={styles.weightCardRight}>
              {latest && (
                <>
                  <TrendPill latest={latest} previous={previous} />
                  <Text style={styles.weightValue}>{latest.value.toFixed(1)} kg</Text>
                </>
              )}
              <Text style={styles.weightChevron}>›</Text>
            </View>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : entries.length >= 2 ? (
            <WeightChart
              entries={entries}
              width={chartWidth}
              height={160}
              windowDays={30}
              targetWeightKg={targetWeightKg}
              showLegend={false}
            />
          ) : (
            <View style={styles.weightEmpty}>
              <Text style={styles.weightEmptyText}>
                {entries.length === 0
                  ? 'Noch keine Einträge. Tippe hier zum Eintragen.'
                  : 'Einen weiteren Eintrag hinzufügen für den Trend.'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  brand: { alignItems: 'center', marginBottom: spacing.lg },
  welcome: { ...typography.h1, color: colors.text, marginTop: spacing.sm },
  tagline: { ...typography.caption, color: colors.primaryBright, marginTop: spacing.xs, textTransform: 'uppercase' },

  // Kompakter Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: colors.background },

  weightCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  weightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  weightEyebrow: { ...typography.overline, color: colors.primaryBright },
  weightCardRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weightValue: { ...typography.h3, color: colors.text },
  weightChevron: { fontSize: 22, color: colors.textMuted, fontWeight: '600' },
  weightEmpty: { paddingVertical: spacing.lg, alignItems: 'center' },
  weightEmptyText: { ...typography.body2, color: colors.textSecondary, textAlign: 'center' },
});
