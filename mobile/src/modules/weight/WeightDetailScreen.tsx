// WeightDetailScreen — polished MVP for the Weight Tracking experience.
//
// Layout (top → bottom):
//   1. Brand header: small logo + screen title
//   2. Current-weight hero card: latest value (display size), unit,
//      formatted date, and a trend pill vs the previous entry
//   3. Chart card: 30-day window with actual line + dashed 7-day moving
//      average overlay, drawn with `react-native-svg`
//   4. Quick-add row: numeric input, kg/lbs segmented toggle, Save button
//   5. Entries list (scrollable, newest first) with date + value + delete
//
// Auth: backend uses a fixed dev-user. When real JWT auth lands the
// apiClient will start sending the Bearer token; this screen needs no
// changes.

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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addWeight,
  deleteWeight,
  listWeights,
} from '../../services/weightsService';
import type { WeightEntry, WeightUnit } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { Logo } from '../../shared/components/Logo';
import { TrendPill } from '../../shared/components/TrendPill';
import { WeightChart } from '../../shared/components/WeightChart';
import { profileApi } from '../../shared/api/profileApi';

const UNITS: WeightUnit[] = ['kg', 'lbs'];

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export default function WeightDetailScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [input, setInput] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(undefined);

  // Ref tracks the latest entries so the optimistic-delete rollback can
  // restore them without making `onDelete` depend on `entries` state.
  const entriesRef = useRef<WeightEntry[]>(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, profileData] = await Promise.all([listWeights(), profileApi.getMe()]);
      setEntries(data);
      if (profileData.profile?.targetWeightKg) {
        setTargetWeightKg(profileData.profile.targetWeightKg);
      }
    } catch (e) {
      setError(formatApiError(e, 'Failed to load entries'));
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
      Alert.alert('Invalid weight', 'Please enter a positive number (e.g. 78.5).');
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      const created = await addWeight({ value, unit });
      setEntries((prev) => [created, ...prev]);
      setInput('');
    } catch (e) {
      Alert.alert('Save failed', formatApiError(e, 'Failed to save entry'));
    } finally {
      setSaving(false);
    }
  }, [input, unit]);

  const onDelete = useCallback((entry: WeightEntry) => {
    Alert.alert(
      'Delete entry?',
      `${formatShortDate(entry.date)} — ${entry.value.toFixed(1)} ${entry.unit}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const previous = entriesRef.current;
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            try {
              await deleteWeight(entry.id);
            } catch (e) {
              setEntries(previous);
              Alert.alert('Delete failed', formatApiError(e, 'Failed to delete entry'));
            }
          },
        },
      ],
    );
  }, []);

  const latest = entries[0];
  const previous = entries[1];

  const chartWidth = useMemo(
    () => Dimensions.get('window').width - spacing.lg * 2 - spacing.md * 2,
    [],
  );

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
          <Logo size={36} style={styles.headerLogo} />
          <View>
            <Text style={styles.headerTitle}>Weight</Text>
            <Text style={styles.headerSubtitle}>Track. Trend. Progress.</Text>
          </View>
        </View>

        {error ? (
          <ErrorBanner error={error} onRetry={load} />
        ) : null}

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={styles.initialLoader}
            size="large"
          />
        ) : (
          <>
            {/* Hero card */}
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>Latest</Text>
              {latest ? (
                <>
                  <View style={styles.valueRow}>
                    <Text style={styles.valueText}>{latest.value.toFixed(1)}</Text>
                    <Text style={styles.unitText}>{latest.unit}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatLongDate(latest.date)}</Text>
                  <View style={styles.pillRow}>
                    <TrendPill latest={latest} previous={previous} />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.placeholderHero}>—</Text>
                  <Text style={styles.dateText}>
                    Add your first weight below to start tracking.
                  </Text>
                </>
              )}
            </View>

            {/* Chart card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitleInline}>Trend</Text>
                <Text style={styles.cardCaption}>Last 30 days · 7-day avg</Text>
              </View>
              <WeightChart
                entries={entries}
                width={chartWidth}
                height={220}
                windowDays={30}
                targetWeightKg={targetWeightKg}
              />
            </View>

            {/* Quick add */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Log entry</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="78.5"
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="decimal-pad"
                  editable={!saving}
                />
                <View style={styles.unitSegment}>
                  {UNITS.map((u) => {
                    const active = u === unit;
                    return (
                      <TouchableOpacity
                        key={u}
                        onPress={() => setUnit(u)}
                        style={[
                          styles.unitOption,
                          active && styles.unitOptionActive,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[
                            styles.unitOptionLabel,
                            active && styles.unitOptionLabelActive,
                          ]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (saving || !input) && styles.saveButtonDisabled,
                ]}
                onPress={onSave}
                disabled={saving || !input}
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonLabel}>
                  {saving ? 'Saving…' : 'Save weight'}
                </Text>
              </TouchableOpacity>
              {/* Error shown as top-level banner above — kept here for inline save errors */}
            </View>

            {/* Entries list */}
            <View style={styles.listSection}>
              <Text style={styles.sectionLabel}>History</Text>
              {entries.length === 0 ? (
                <Text style={styles.emptyText}>
                  No entries yet. Log your first weight above.
                </Text>
              ) : (
                entries.map((item) => (
                  <View key={item.id} style={styles.entryCard}>
                    <View>
                      <Text style={styles.entryDate}>
                        {formatShortDate(item.date)}
                      </Text>
                      <Text style={styles.entryYear}>{item.date.slice(0, 4)}</Text>
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={styles.entryValue}>
                        {item.value.toFixed(1)}
                        <Text style={styles.entryUnit}> {item.unit}</Text>
                      </Text>
                      <TouchableOpacity
                        onPress={() => onDelete(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete entry from ${item.date}`}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteLabel}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerLogo: {
    marginRight: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.primaryBright,
    textTransform: 'uppercase',
  },
  initialLoader: {
    marginTop: spacing.xxl,
  },
  heroCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  eyebrow: {
    ...typography.overline,
    color: colors.primaryBright,
    marginBottom: spacing.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  valueText: {
    ...typography.display,
    color: colors.text,
  },
  unitText: {
    ...typography.h2,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    marginBottom: 6,
  },
  placeholderHero: {
    ...typography.display,
    color: colors.textMuted,
  },
  dateText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pillRow: {
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  cardTitleInline: {
    ...typography.h3,
    color: colors.text,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardCaption: {
    ...typography.caption,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.h2,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  unitSegment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 3,
  },
  unitOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  unitOptionActive: {
    backgroundColor: colors.primary,
  },
  unitOptionLabel: {
    ...typography.button,
    color: colors.textSecondary,
  },
  unitOptionLabelActive: {
    color: colors.white,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  saveButtonLabel: {
    ...typography.button,
    color: colors.white,
    fontSize: 16,
  },
  errorText: {
    ...typography.body2,
    color: colors.negative,
    marginTop: spacing.sm,
  },
  listSection: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  emptyText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.lg,
  },
  entryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  entryDate: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  entryYear: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  entryValue: {
    ...typography.h3,
    color: colors.primaryBright,
    fontWeight: '700',
  },
  entryUnit: {
    ...typography.body2,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  deleteButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.negative,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
