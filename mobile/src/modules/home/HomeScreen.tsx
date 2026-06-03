// HomeScreen — branded landing surface.
// Shows the app logo, a welcome line, a Day-Type toggle (rest/training),
// macro progress for today, and an embedded compact weight chart.

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import { BrandAsset } from '../../shared/components/BrandAsset';
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
      if (profileData.profile?.displayName) setDisplayName(profileData.profile.displayName);
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
        {/* ── Hero Header ── */}
        <View style={styles.hero}>
          {/* Top row: brand + personal weight KPI */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroWordmarkRow}>
              <BrandAsset name="header_symbol" width={52} height={52} />
              <Text style={styles.heroAppName}><Text>Fit</Text><Text style={{ color: colors.primary }}>Track</Text></Text>
            </View>
            {latest && (
              <TouchableOpacity style={styles.heroKpi} onPress={() => navToTab('Weight')} activeOpacity={0.7}>
                <Text style={styles.heroKpiValue}>{latest.value.toFixed(1)}</Text>
                <Text style={styles.heroKpiUnit}>kg</Text>
                {previous ? (
                  <Text style={[
                    styles.heroKpiDelta,
                    latest.value <= previous.value ? styles.heroKpiGood : styles.heroKpiBad,
                  ]}>
                    {latest.value < previous.value ? '↓' : latest.value > previous.value ? '↑' : '→'}{' '}
                    {Math.abs(latest.value - previous.value).toFixed(1)}
                  </Text>
                ) : null}
              </TouchableOpacity>
            )}
          </View>

          {/* Greeting */}
          <Text style={styles.heroGreeting}>
            {getGreeting()},{' '}
            <Text style={styles.heroName}>{displayName ?? 'Sportler'}</Text>
          </Text>

          {/* Day-Type Toggle — integrated into hero */}
          <View style={styles.heroToggleRow}>
            {(['rest', 'training'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.heroToggleBtn, dayType === t && styles.heroToggleBtnActive]}
                onPress={() => setDayType(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.heroToggleText, dayType === t && styles.heroToggleTextActive]}>
                  {t === 'rest' ? '🛌 Ruhetag' : '💪 Trainingstag'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.quickActions}>
          {[
            { icon: '📷', label: 'Scan', tab: 'Nutrition' as const },
            { icon: '➕', label: 'Essen', tab: 'Nutrition' as const },
            { icon: '⚖', label: 'Gewicht', tab: 'Weight' as const },
            { icon: '🍽', label: 'Rezept', tab: 'Recipes' as const },
          ].map((action) => (
            <TouchableOpacity
              key={action.tab + action.icon}
              style={styles.quickAction}
              onPress={() => navToTab(action.tab)}
              activeOpacity={0.75}
            >
              <Text style={styles.quickActionIcon}>{action.icon}</Text>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Macro-Fortschritt — tippbar → Nutrition Tab ── */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navToTab('Nutrition')} style={{ paddingHorizontal: spacing.md }}>
          {todayDiary && todayTargets ? (
            <MacroSummaryCard summary={todayDiary.summary} target={todayTargets} />
          ) : todayTargets ? (
            <MacroSummaryCard
              summary={{ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }}
              target={todayTargets}
            />
          ) : null}
        </TouchableOpacity>

        {/* ── Gewicht — tippbar → Gewicht Tab ── */}
        <TouchableOpacity style={styles.weightCard} activeOpacity={0.85} onPress={() => navToTab('Weight')}>
          <View style={styles.weightCardHeader}>
            <View style={styles.weightCardLeft}>
              <Text style={styles.weightEyebrow}>GEWICHT</Text>
              {latest ? (
                <>
                  <View style={styles.weightValueRow}>
                    <Text style={styles.weightValueLarge}>{latest.value.toFixed(1)}</Text>
                    <Text style={styles.weightUnit}>kg</Text>
                  </View>
                  {targetWeightKg ? (
                    <Text style={styles.weightGoalText}>Ziel {targetWeightKg.toFixed(1)} kg</Text>
                  ) : null}
                </>
              ) : null}
            </View>
            <View style={styles.weightCardRight}>
              {latest && previous && (
                <TrendPill latest={latest} previous={previous} />
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
  content: { paddingBottom: spacing.xxl },

  // ── Hero Header ──
  // Asset renders directly on background — no container box.
  // Spacing and typography carry the premium feel.
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroWordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroAppName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: 1.5,
  },
  heroKpi: { alignItems: 'flex-end' },
  heroKpiValue: { fontSize: 24, fontWeight: '800' as const, color: colors.text, lineHeight: 28 },
  heroKpiUnit: { ...typography.caption, color: colors.textSecondary },
  heroKpiDelta: { fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
  heroKpiGood: { color: colors.primary },
  heroKpiBad: { color: colors.negative },
  heroGreeting: {
    ...typography.h2,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  heroName: {
    ...typography.h2,
    color: colors.text,
  },
  heroToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    padding: 3,
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  heroToggleBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  heroToggleBtnActive: { backgroundColor: colors.primary },
  heroToggleText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' as const },
  heroToggleTextActive: { color: colors.background },

  // ── Quick Actions ──
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickActionIcon: { fontSize: 28 },
  quickActionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── Weight Card ──
  weightCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    overflow: 'hidden',
    // Subtle elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  weightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  weightCardLeft: { flex: 1 },
  weightEyebrow: { ...typography.overline, color: colors.primaryBright, marginBottom: spacing.xs },
  weightValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  weightValueLarge: { fontSize: 40, fontWeight: '800' as const, color: colors.text, lineHeight: 44 },
  weightUnit: { ...typography.h3, color: colors.textSecondary },
  weightGoalText: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  weightCardRight: { flexDirection: 'column', alignItems: 'flex-end', gap: spacing.xs },
  weightChevron: { fontSize: 22, color: colors.textMuted, fontWeight: '600' },
  weightEmpty: { paddingVertical: spacing.lg, alignItems: 'center' },
  weightEmptyText: { ...typography.body2, color: colors.textSecondary, textAlign: 'center' },
});
