// ProgressScreen — the Progress tab (formerly WeightDetailScreen).
//
// Dashboard-first layout answering 5 key user questions in order:
//   1. Wo stehe ich heute?          → ProgressHeroCard
//   2. Entwickle ich mich richtig?  → ProgressHeroCard (delta + trend pill)
//   3. Wie weit bis zum Ziel?       → ProgressHeroCard (goal progress bar)
//   4. Neue Messung hinzufügen?     → NewMeasurementCard
//   5. Bisheriger Verlauf?          → WeightChart + TrendStatsRow + HistoryList
//
// Technical: WeightEntry, weightsService, and all backend types are unchanged.
// This file is a new presentation layer — no breaking changes to shared types.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addWeight, deleteWeight, listWeights } from '../../services/weightsService';
import type { WeightEntry, WeightUnit, GoalType } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { WeightChart } from '../../shared/components/WeightChart';
import { ProgressHeroCard } from '../../shared/components/ProgressHeroCard';
import { TrendStatsRow } from '../../shared/components/TrendStatsRow';
import { NewMeasurementCard } from '../../shared/components/NewMeasurementCard';
import { HistoryList } from '../../shared/components/HistoryList';
import { profileApi } from '../../shared/api/profileApi';

// Chart time-window options. 0 = show all entries.
type WindowDays = 30 | 90 | 0;

const WINDOW_OPTIONS: { label: string; value: WindowDays }[] = [
  { label: '30T', value: 30 },
  { label: '90T', value: 90 },
  { label: 'Alle', value: 0 },
];

export default function ProgressScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [input, setInput] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(undefined);
  const [goalType, setGoalType] = useState<GoalType>('lose_weight');
  const [windowDays, setWindowDays] = useState<WindowDays>(30);

  // Ref allows optimistic-delete rollback without stale closure
  const entriesRef = useRef<WeightEntry[]>(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, profileData] = await Promise.all([
        listWeights(),
        profileApi.getMe(),
      ]);
      setEntries(data);
      if (profileData.profile?.targetWeightKg) {
        setTargetWeightKg(profileData.profile.targetWeightKg);
      }
      if (profileData.profile?.goal) {
        setGoalType(profileData.profile.goal);
      }
    } catch (e) {
      setError(formatApiError(e, 'Fehler beim Laden der Daten'));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onSave = useCallback(async () => {
    const normalized = input.replace(',', '.').trim();
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Ungültiger Wert', 'Bitte gib eine positive Zahl ein (z.B. 78.5).');
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      const created = await addWeight({ value, unit });
      setEntries((prev) => [created, ...prev]);
      setInput('');
    } catch (e) {
      Alert.alert('Fehler', formatApiError(e, 'Speichern fehlgeschlagen'));
    } finally {
      setSaving(false);
    }
  }, [input, unit]);

  const onDelete = useCallback((entry: WeightEntry) => {
    Alert.alert(
      'Eintrag löschen?',
      `${entry.date} — ${entry.value.toFixed(1)} ${entry.unit}`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const snapshot = entriesRef.current;
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            try {
              await deleteWeight(entry.id);
            } catch (e) {
              setEntries(snapshot);
              Alert.alert('Fehler', formatApiError(e, 'Löschen fehlgeschlagen'));
            }
          },
        },
      ],
    );
  }, []);

  const latest = entries[0];
  const previous = entries[1];
  // Oldest entry = starting point for total progress calculation
  const startEntry = entries.length > 0 ? entries[entries.length - 1] : undefined;

  const chartWidth = useMemo(
    () => Dimensions.get('window').width - spacing.lg * 2 - spacing.md * 2,
    [],
  );

  // WindowDays = 0 means "all" — pass a large value that covers any realistic history
  const effectiveWindowDays = windowDays === 0 ? 99999 : windowDays;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Progress</Text>
        </View>

        {error ? <ErrorBanner error={error} onRetry={load} /> : null}

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={styles.initialLoader}
            size="large"
          />
        ) : (
          <>
            {/* 1–3: Current value + delta + goal progress */}
            <ProgressHeroCard
              latest={latest}
              previous={previous}
              startEntry={startEntry}
              targetWeightKg={targetWeightKg}
              unit={unit}
              goalType={goalType}
            />

            {/* Chart — only shown with ≥2 entries (WeightChart requires it) */}
            {entries.length >= 2 && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Entwicklung</Text>
                  <View style={styles.windowRow}>
                    {WINDOW_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setWindowDays(opt.value)}
                        style={[
                          styles.windowChip,
                          windowDays === opt.value && styles.windowChipActive,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: windowDays === opt.value }}
                      >
                        <Text
                          style={[
                            styles.windowChipLabel,
                            windowDays === opt.value && styles.windowChipLabelActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <WeightChart
                  entries={entries}
                  width={chartWidth}
                  height={220}
                  windowDays={effectiveWindowDays}
                  targetWeightKg={targetWeightKg}
                />
              </View>
            )}

            {/* Stats row: Ø 7T / Ø 30T / weekly change */}
            <TrendStatsRow entries={entries} unit={unit} />

            {/* 4: New measurement */}
            <NewMeasurementCard
              unit={unit}
              onUnitChange={setUnit}
              input={input}
              onInputChange={setInput}
              onSave={onSave}
              saving={saving}
            />

            {/* 5: History */}
            <Text style={styles.sectionLabel}>Verlauf</Text>
            <HistoryList
              entries={entries}
              unit={unit}
              onDelete={onDelete}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text,
  },
  initialLoader: {
    marginTop: spacing.xxl,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  chartTitle: {
    ...typography.h3,
    color: colors.text,
  },
  windowRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  windowChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  windowChipActive: {
    backgroundColor: colors.primarySoft,
  },
  windowChipLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  windowChipLabelActive: {
    color: colors.primaryBright,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
});
