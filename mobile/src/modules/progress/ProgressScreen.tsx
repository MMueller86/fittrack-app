// ProgressScreen — the Progress tab (formerly WeightDetailScreen).
//
// Dashboard-first layout: current weight and entry first, followed by the
// chart, trend summary, and grouped history.
//
// Technical: WeightEntry, weightsService, and all backend types are unchanged.
// This file is a new presentation layer — no breaking changes to shared types.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { addWeight, deleteWeight, listWeights, updateWeight } from '../../services/weightsService';
import { healthSyncService } from '../../services/health/healthSyncService';
import type { WeightEntry, GoalType } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { addLocalDays, getLocalIsoDate } from '../../shared/date/localDate';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { WeightChart } from '../../shared/components/WeightChart';
import { ProgressHeroCard, WeightEntryForm } from '../../shared/components/ProgressHeroCard';
import { HistoryList } from '../../shared/components/HistoryList';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { Icon } from '../../shared/components/Icon';
import { profileApi } from '../../shared/api/profileApi';
import { ProgressCalendar } from './ProgressCalendar';
import { getProgressAverageForWindow, getProgressEntriesForDate, getProgressEntriesInWindow, parseWeightInput, type ProgressWindowDays } from './progressUtils';
import { formatKilograms } from '../../shared/weightFormatting';

const WINDOW_OPTIONS: { label: string; value: ProgressWindowDays }[] = [
  { label: '7T', value: 7 },
  { label: '30T', value: 30 },
  { label: '90T', value: 90 },
  { label: 'Alle', value: 0 },
];

function sortWeightEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((left, right) =>
    right.date.localeCompare(left.date)
      || right.createdAt.localeCompare(left.createdAt)
      || left.id.localeCompare(right.id),
  );
}

function formatWeightInput(value: number): string {
  return String(value).replace('.', ',');
}

function formatEditorDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProgressScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [input, setInput] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => getLocalIsoDate());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeightEntry | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(undefined);
  const [goalType, setGoalType] = useState<GoalType>('lose_weight');
  const [windowDays, setWindowDays] = useState<ProgressWindowDays>(7);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, profileData] = await Promise.all([
        listWeights(),
        profileApi.getMe(),
      ]);
      setEntries(sortWeightEntries(data));
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
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onSave = useCallback(async () => {
    const value = parseWeightInput(input);
    if (value === null) {
      setInputError(input.trim()
        ? 'Bitte gib ein gültiges Gewicht größer als 0 kg ein.'
        : 'Bitte gib dein Gewicht in kg ein.');
      return;
    }
    const dateToSave = editorVisible ? selectedDate : getLocalIsoDate();
    if (!editingEntryId && dateToSave > getLocalIsoDate()) {
      setSaveError('Zukünftige Messungen können nicht eingetragen werden.');
      return;
    }

    Keyboard.dismiss();
    setInputError(null);
    setSaveError(null);
    setSaving(true);
    try {
      const entryToUpdate = editingEntryId
        ? entries.find((entry) => entry.id === editingEntryId)
        : entries.find((entry) => entry.date === dateToSave);
      if (editingEntryId && !entryToUpdate) {
        setSaveError('Diese Messung ist nicht mehr verfügbar. Bitte lade den Verlauf neu.');
        return;
      }
      if (entryToUpdate && entryToUpdate.unit !== 'kg') {
        setSaveError('Diese Messung kann nur in Kilogramm aktualisiert werden.');
        return;
      }

      const savedEntry = entryToUpdate
        ? await updateWeight(entryToUpdate.id, value)
        : await addWeight({ value, unit: 'kg', date: dateToSave });
      setEntries((previous) => sortWeightEntries(entryToUpdate
        ? previous.map((entry) => entry.id === savedEntry.id ? savedEntry : entry)
        : [...previous, savedEntry]));
      setInput('');
      setEditingEntryId(null);
      setSelectedDate(getLocalIsoDate());
      if (editorVisible) {
        setEditorVisible(false);
      }
      // fire-and-forget — FitTrack-Flow nicht blockieren
      void healthSyncService.syncWeightUpsert(savedEntry);
    } catch (saveFailure) {
      setSaveError(formatApiError(saveFailure, 'Speichern fehlgeschlagen. Bitte versuche es erneut.'));
    } finally {
      setSaving(false);
    }
  }, [editingEntryId, editorVisible, entries, input, selectedDate]);

  const onInputChange = useCallback((value: string) => {
    setInput(value);
    setInputError(null);
    setSaveError(null);
  }, []);

  const onSelectCalendarDate = useCallback((date: string) => {
    if (date > getLocalIsoDate()) return;
    const entry = entries.find((current) => current.date === date);
    if (entry && entry.unit !== 'kg') {
      setMutationError('Diese Messung kann in Progress nicht bearbeitet werden.');
      setCalendarVisible(false);
      return;
    }
    setSelectedDate(date);
    setEditingEntryId(entry?.id ?? null);
    setInput(entry ? formatWeightInput(entry.value) : '');
    setInputError(null);
    setSaveError(null);
    setMutationError(null);
    setCalendarVisible(false);
    setEditorVisible(true);
  }, [entries]);

  const onEditEntry = useCallback((entry: WeightEntry) => {
    if (entry.unit !== 'kg') {
      setMutationError('Diese Messung kann in Progress nicht bearbeitet werden.');
      return;
    }
    setSelectedDate(entry.date);
    setEditingEntryId(entry.id);
    setInput(formatWeightInput(entry.value));
    setInputError(null);
    setSaveError(null);
    setCalendarVisible(false);
    setEditorVisible(true);
  }, []);

  const onCancelEdit = useCallback(() => {
    setEditorVisible(false);
    setSelectedDate(getLocalIsoDate());
    setEditingEntryId(null);
    setInput('');
    setInputError(null);
    setSaveError(null);
  }, []);

  const onOpenCalendar = useCallback(() => setCalendarVisible(true), []);
  const onCloseCalendar = useCallback(() => setCalendarVisible(false), []);

  const onDelete = useCallback((entry: WeightEntry) => {
    setMutationError(null);
    setDeleteTarget(entry);
  }, []);

  const confirmDelete = useCallback(async (entry: WeightEntry) => {
    setEntries((prev) => prev.filter((current) => current.id !== entry.id));
    if (editingEntryId === entry.id) onCancelEdit();
    try {
      await deleteWeight(entry.id);
      void healthSyncService.syncWeightDelete(entry.id);
    } catch (deleteFailure) {
      setEntries((current) => {
        if (current.some((currentEntry) => currentEntry.id === entry.id)) return current;
        return sortWeightEntries([...current, entry]);
      });
      setMutationError(formatApiError(deleteFailure, 'Eintrag konnte nicht gelöscht werden.'));
    } finally {
      setDeleteTarget(null);
    }
  }, [editingEntryId, onCancelEdit]);

  const sortedEntries = useMemo(() => sortWeightEntries(entries), [entries]);
  const today = getLocalIsoDate();
  const latest = sortedEntries.find((entry) => entry.date <= today);
  // Oldest entry = starting point for total progress calculation
  const startEntry = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : undefined;
  const todayEntry = getProgressEntriesForDate(sortedEntries, today)[0];
  const chartEntries = useMemo(
    () => getProgressEntriesInWindow(sortedEntries, windowDays, today),
    [sortedEntries, today, windowDays],
  );
  const chartAverage = getProgressAverageForWindow(sortedEntries, windowDays, today);
  const chartAverageLabel = windowDays === 0 ? 'Ø Gesamt' : `Ø ${windowDays} Tage`;
  const chartWidth = screenWidth - spacing.md * 4;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
        {error ? <ErrorBanner error={error} onRetry={load} /> : null}
        {mutationError ? <ErrorBanner error={mutationError} /> : null}

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={styles.initialLoader}
            size="large"
          />
        ) : (
          <>
            <ProgressHeroCard
              entries={sortedEntries}
              latest={latest}
              startEntry={startEntry}
              targetWeightKg={targetWeightKg}
              goalType={goalType}
              today={today}
              showTodayForm={!todayEntry}
              onOpenCalendar={onOpenCalendar}
              input={input}
              onInputChange={onInputChange}
              onSave={onSave}
              saving={saving}
              inputError={inputError}
              saveError={saveError}
            />

            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
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
                {chartAverage !== null ? (
                  <View
                    style={styles.chartAverageRow}
                    accessible
                    accessibilityLabel={`${chartAverageLabel}: ${formatKilograms(chartAverage)} kg`}
                  >
                    <Text style={styles.chartAverageValue}>{formatKilograms(chartAverage)} kg</Text>
                  </View>
                ) : null}
              </View>
              {chartEntries.length >= 2 ? (
                <WeightChart
                  entries={chartEntries}
                  averageEntries={sortedEntries}
                  averageWindowDays={windowDays === 0 ? 90 : windowDays}
                  width={chartWidth}
                  height={220}
                  windowDays={chartEntries.length}
                  targetWeightKg={targetWeightKg}
                  calendarWindow={windowDays === 7 ? { firstDate: addLocalDays(today, -6), lastDate: today } : undefined}
                />
              ) : (
                <View style={styles.chartEmpty}>
                  <Text style={styles.chartEmptyText}>
                    {entries.length < 2
                      ? 'Nach zwei Messungen erscheint hier deine Entwicklung.'
                      : 'Für diesen Zeitraum gibt es noch nicht genug Messungen.'}
                  </Text>
                </View>
              )}
            </View>

            {/* 5: History */}
            <Text style={styles.sectionLabel}>Verlauf</Text>
            <HistoryList
              entries={sortedEntries}
              onDelete={onDelete}
              onEdit={onEditEntry}
            />
          </>
        )}
      </ScrollView>
      <Modal
        visible={calendarVisible}
        transparent
        animationType="slide"
        onRequestClose={onCloseCalendar}
      >
          <View style={styles.calendarModalRoot}>
          <TouchableOpacity
            style={styles.calendarBackdrop}
            onPress={onCloseCalendar}
            activeOpacity={1}
            accessible={false}
          />
          <View style={[styles.calendarSheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <ProgressCalendar
              selectedDate={selectedDate}
              today={today}
              entries={sortedEntries}
              onSelectDate={onSelectCalendarDate}
              onClose={onCloseCalendar}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={editorVisible}
        transparent
        animationType="slide"
        onRequestClose={onCancelEdit}
      >
          <KeyboardAvoidingView
            style={styles.calendarModalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <TouchableOpacity
            style={styles.calendarBackdrop}
            onPress={onCancelEdit}
            activeOpacity={1}
            accessible={false}
          />
          <View style={[styles.editorSheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.editorHeader}>
              <View style={styles.editorHeading}>
                <Text style={styles.editorTitle} accessibilityRole="header">
                  {editingEntryId ? 'Gewicht aktualisieren' : 'Gewicht eintragen'}
                </Text>
                <Text style={styles.editorDate}>{formatEditorDate(selectedDate)}</Text>
              </View>
              <TouchableOpacity
                style={styles.editorCloseButton}
                onPress={onCancelEdit}
                accessibilityRole="button"
                accessibilityLabel="Gewichtseingabe schließen"
              >
                <Icon lib="feather" name="x" size="md" color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.editorFormScroll}
              keyboardShouldPersistTaps="handled"
            >
              <WeightEntryForm
                isEditing={editingEntryId !== null}
                input={input}
                onInputChange={onInputChange}
                onSave={onSave}
                saving={saving}
                inputError={inputError}
                saveError={saveError}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <ConfirmSheet
        visible={deleteTarget !== null}
        title="Eintrag löschen?"
        subtitle={deleteTarget
          ? `${formatKilograms(deleteTarget.value, 2)} kg · ${deleteTarget.date}`
          : undefined}
        actions={deleteTarget
          ? [{ label: 'Eintrag löschen', destructive: true, onPress: () => { void confirmDelete(deleteTarget); } }]
          : []}
        onClose={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
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
  calendarModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  calendarBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay,
  },
  calendarSheet: {
    width: '100%',
    paddingHorizontal: spacing.md,
  },
  editorSheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '100%',
    flexShrink: 1,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  editorFormScroll: {
    flexShrink: 1,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  editorHeading: {
    flex: 1,
    minWidth: 0,
  },
  editorTitle: {
    ...typography.h3,
    color: colors.text,
  },
  editorDate: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  editorCloseButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  chartEmpty: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  chartEmptyText: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
  },
  windowRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chartAverageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: spacing.sm,
  },
  chartAverageValue: {
    ...typography.h3,
    color: colors.text,
  },
  windowChip: {
    minWidth: spacing.xxl,
    minHeight: spacing.xxl,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
