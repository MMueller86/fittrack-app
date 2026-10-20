// ProgressHeroCard — Hero card for the Progress screen.
//
// Shows the latest weight, inline today form, weekly comparison, and goal progress.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { WeightEntry, GoalType } from '@fittrack/shared';
import { calculateWeightTrendRegressionSeries, progressGrowsOnDecrease } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from './Icon';
import { differenceInLocalDays, getLocalIsoDate, isValidDateOnly } from '../date/localDate';
import { formatKilograms } from '../weightFormatting';
import { getWeightWeekComparison } from '../weightHistory';

export interface WeightEntryFormProps {
  isEditing: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  inputError: string | null;
  saveError: string | null;
}

export interface ProgressHeroCardProps extends Omit<WeightEntryFormProps, 'isEditing'> {
  entries: WeightEntry[];
  latest: WeightEntry | undefined;
  /** Oldest recorded entry — used to compute total delta since start. */
  startEntry: WeightEntry | undefined;
  targetWeightKg: number | undefined;
  /** User's primary goal — drives all evaluations. Defaults to lose_weight. */
  goalType?: GoalType;
  today: string;
  showTodayForm: boolean;
  onOpenCalendar: () => void;
}

function formatLongDate(iso: string, today: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const currentYear = Number(today.slice(0, 4));
  return new Date(year, month - 1, day, 12).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    ...(year === currentYear ? {} : { year: 'numeric' }),
  });
}

function getMeasurementDateDisplay(iso: string, today: string) {
  const age = differenceInLocalDays(today, iso);
  if (age === 0) return { label: 'Heute', color: colors.primaryBright };
  if (age === 1) return { label: 'Vor 1 Tag', color: colors.primaryBright };
  if (age === 2) {
    return { label: `Vor ${age} Tagen`, color: colors.warning };
  }
  return { label: formatLongDate(iso, today), color: colors.textSecondary };
}

export function daysSince(iso: string, now: Date = new Date()): number {
  if (!isValidDateOnly(iso)) return 0;
  return differenceInLocalDays(getLocalIsoDate(now), iso);
}

export function WeightEntryForm({
  isEditing,
  input,
  onInputChange,
  onSave,
  saving,
  inputError,
  saveError,
}: WeightEntryFormProps) {
  const [inputFocused, setInputFocused] = useState(false);
  const canSave = input.trim().length > 0 && !saving;

  return (
    <>
      <View style={styles.entryRow}>
        <View style={[
          styles.inputWrap,
          inputFocused && styles.inputFocused,
          inputError && styles.inputInvalid,
        ]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={onInputChange}
            placeholder="0,0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            editable={!saving}
            autoCorrect={false}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            selectionColor={colors.primaryBright}
            returnKeyType="done"
            onSubmitEditing={canSave ? onSave : undefined}
            accessibilityLabel="Gewicht in Kilogramm"
            accessibilityHint="Gib dein aktuelles Gewicht in Kilogramm ein"
          />
          <Text style={styles.inputUnit}>kg</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Gewicht aktualisieren' : 'Gewicht speichern'}
          accessibilityState={{ disabled: !canSave, busy: saving }}
          accessibilityHint={isEditing
            ? 'Aktualisiert das Gewicht am ausgewählten Tag.'
            : 'Speichert das Gewicht am ausgewählten Tag.'}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.textSecondary} size="small" />
          ) : (
            <Icon lib="feather" name="save" size="sm" color={canSave ? colors.background : colors.textMuted} />
          )}
          <Text numberOfLines={1} style={[styles.saveLabel, !canSave && styles.saveLabelDisabled]}>
            {isEditing ? 'Aktualisieren' : 'Speichern'}
          </Text>
        </TouchableOpacity>
      </View>
      {inputError ? <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">{inputError}</Text> : null}
      {saveError ? <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">{saveError}</Text> : null}
    </>
  );
}

export function ProgressHeroCard({
  entries,
  latest,
  startEntry,
  targetWeightKg,
  goalType = 'lose_weight',
  today,
  showTodayForm,
  onOpenCalendar,
  input,
  onInputChange,
  onSave,
  saving,
  inputError,
  saveError,
}: ProgressHeroCardProps) {
  const currentKg = latest?.value;
  const startKg = startEntry?.value ?? currentKg;
  const hasGoal = targetWeightKg !== undefined;
  const growsOnDecrease = progressGrowsOnDecrease(goalType);
  const hasDirectionalGoal = growsOnDecrease !== null;

  let progressPct = 0;
  let remainingDisplay: number | null = null;

  if (hasGoal && hasDirectionalGoal && currentKg !== undefined && startKg !== undefined) {
    const targetKg = targetWeightKg!;
    const totalChange = Math.abs(startKg - targetKg);
    const achievedChange = growsOnDecrease
      ? Math.max(0, startKg - currentKg)
      : Math.max(0, currentKg - startKg);
    progressPct = totalChange > 0 ? Math.min(1, achievedChange / totalChange) : 1;
    const remainingKg = growsOnDecrease
      ? Math.max(0, currentKg - targetKg)
      : Math.max(0, targetKg - currentKg);
    remainingDisplay = remainingKg;
  }

  const hasStart = latest && startEntry && startEntry.id !== latest.id;
  const startDays = hasStart ? daysSince(startEntry.date) : null;
  const fillWidth = `${Math.round(progressPct * 100)}%`;
  const latestDate = latest ? getMeasurementDateDisplay(latest.date, today) : null;
  const weeks = getWeightWeekComparison(entries);
  const weekDelta = weeks.delta === null ? null : Number(weeks.delta.toFixed(1));
  const comparisonLabel = weekDelta === null
    ? ''
    : weekDelta === 0
    ? 'Gleicher Schnitt wie letzte Woche'
    : `${formatKilograms(Math.abs(weekDelta))} kg ${weekDelta < 0 ? 'weniger' : 'mehr'} als letzte Woche`;
  const comparisonSummary = weekDelta === null
    ? ''
    : `${weekDelta < 0 ? '−' : weekDelta > 0 ? '+' : '='} ${formatKilograms(Math.abs(weekDelta))} kg`;
  const comparisonIcon = weekDelta === null || weekDelta === 0
    ? 'arrow-right'
    : weekDelta < 0 ? 'arrow-down-right' : 'arrow-up-right';
  const fallbackTrend = weeks.delta === null
    ? calculateWeightTrendRegressionSeries(entries, 7).slopeKgPerWeek
    : null;
  const fallbackTrendRounded = fallbackTrend === null ? null : Number(fallbackTrend.toFixed(1));
  const fallbackTrendSummary = fallbackTrendRounded === null
    ? ''
    : fallbackTrendRounded === 0
    ? 'Unverändert'
    : `${formatKilograms(Math.abs(fallbackTrendRounded))} kg/Woche ${fallbackTrendRounded < 0 ? 'weniger' : 'mehr'}`;
  const fallbackTrendIcon = fallbackTrendRounded === null || fallbackTrendRounded === 0
    ? 'arrow-right'
    : fallbackTrendRounded < 0 ? 'arrow-down-right' : 'arrow-up-right';

  return (
    <>
      <View style={styles.card} testID="weight-entry-card">
        <View style={styles.summaryRow}>
          <View style={styles.measurementSummary}>
            {latest ? (
              <>
                <Text style={styles.latestValue}>{formatKilograms(latest.value)} {latest.unit}</Text>
                <Text style={[styles.dateText, { color: latestDate?.color }]}>{latestDate?.label}</Text>
              </>
            ) : (
              <Text style={styles.emptySummary}>Noch keine Messung</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            hitSlop={4}
            onPress={onOpenCalendar}
            accessibilityRole="button"
            accessibilityLabel="Datum zum Bearbeiten wählen"
          >
            <Icon lib="feather" name="edit-2" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showTodayForm ? (
          <View style={styles.todayFormSection}>
            <Text style={styles.todayFormLabel}>Heute eintragen</Text>
            <WeightEntryForm
              isEditing={false}
              input={input}
              onInputChange={onInputChange}
              onSave={onSave}
              saving={saving}
              inputError={inputError}
              saveError={saveError}
            />
          </View>
        ) : null}

        {weeks.delta !== null ? (
          <View style={styles.weekComparison} testID="weight-week-comparison">
            <View style={styles.weekRow}>
              <View style={styles.weekColumn} accessible
                accessibilityLabel={`Letzte 7 Tage, ${weeks.recent.label}: Durchschnitt ${formatKilograms(weeks.recent.average!)} kg, ${weeks.recent.count} ${weeks.recent.count === 1 ? 'Messung' : 'Messungen'}`}>
                <Text style={styles.weekLabel}>Letzte 7 Tage</Text>
                <Text style={styles.weekValue}>Ø {formatKilograms(weeks.recent.average!)} kg</Text>
              </View>
              <View style={styles.weekDivider} testID="weight-week-divider" />
              <View style={styles.weekColumn} accessible
                accessibilityLabel={`Letzte Woche, ${weeks.previous.label}: Durchschnitt ${formatKilograms(weeks.previous.average!)} kg, ${weeks.previous.count} ${weeks.previous.count === 1 ? 'Messung' : 'Messungen'}`}>
                <Text style={styles.weekLabel}>Letzte Woche</Text>
                <Text style={styles.previousWeekValue}>Ø {formatKilograms(weeks.previous.average!)} kg</Text>
              </View>
              <View style={styles.weekDivider} testID="weight-week-divider" />
              <View style={[styles.weekColumn, styles.weekColumnRight]} accessible accessibilityLabel={comparisonLabel}>
                <Text style={[styles.weekLabel, styles.weekLabelRight]}>Veränderung</Text>
                <View style={styles.weekDeltaRight}>
                  <Icon lib="feather" name={comparisonIcon} size="md" color={colors.textSecondary} />
                  <Text style={[styles.weekDeltaText, styles.weekDeltaTextRight]}>{comparisonSummary}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : fallbackTrendRounded !== null ? (
          <View style={styles.weekComparison} testID="weight-week-comparison">
            <View style={styles.fallbackTrend} accessible
              accessibilityLabel={`Trend letzte 7 Tage: ${fallbackTrendSummary}`}>
              <Text style={styles.weekLabel}>Trend letzte 7 Tage</Text>
              <View style={styles.weekDelta}>
                <Icon lib="feather" name={fallbackTrendIcon} size="md" color={colors.textSecondary} />
                <Text style={styles.weekDeltaText}>{fallbackTrendSummary}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {latest && hasGoal && hasDirectionalGoal && currentKg !== undefined && startKg !== undefined ? (
          <View style={styles.goalSection} testID="weight-goal-section">
            <View style={styles.goalHeader}>
              <Text style={styles.goalLabel}>
                {remainingDisplay !== null && remainingDisplay > 0.05
                  ? `Noch ${formatKilograms(remainingDisplay)} kg bis zum Ziel`
                  : 'Ziel erreicht'}
              </Text>
              <Text style={styles.goalPct}>{Math.round(progressPct * 100)} % erreicht</Text>
            </View>
            <View
              style={styles.progressTrack}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Fortschritt zum Zielgewicht"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPct * 100) }}
            >
              <View style={[styles.progressFill, { width: fillWidth as `${number}%` }]} />
            </View>
            <View style={styles.goalFooter}>
              {hasStart && startDays !== null && (
                <Text style={styles.startHint}>
                  Start {formatKilograms(startEntry.value)} kg
                  {startDays > 0
                    ? ` · vor ${startDays} ${startDays === 1 ? 'Tag' : 'Tagen'}`
                    : ''}
                </Text>
              )}
              <Text style={styles.targetHint}>Ziel {formatKilograms(targetWeightKg)} kg</Text>
            </View>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  measurementSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  latestValue: {
    ...typography.h2,
    color: colors.text,
    flexShrink: 1,
  },
  dateText: {
    ...typography.body2,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 0,
  },
  emptySummary: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
  },
  todayFormSection: {
    marginTop: 0,
  },
  todayFormLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  weekComparison: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  weekColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xs,
  },
  weekColumnRight: {
    alignItems: 'flex-end',
  },
  weekDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  weekLabel: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  weekLabelRight: {
    textAlign: 'right',
  },
  weekValue: {
    ...typography.h3,
    letterSpacing: 0,
    color: colors.text,
  },
  previousWeekValue: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  weekDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  weekDeltaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  fallbackTrend: {
    gap: spacing.xs,
  },
  weekDeltaText: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  weekDeltaTextRight: {
    flex: 0,
    textAlign: 'right',
  },
  entryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  inputWrap: {
    flexGrow: 1,
    flexBasis: 128,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputFocused: {
    borderColor: colors.primaryBright,
  },
  inputInvalid: {
    borderColor: colors.negative,
  },
  input: {
    flex: 1,
    minWidth: 0,
    ...typography.body1,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputUnit: {
    ...typography.body2,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  saveButton: {
    flexBasis: 144,
    flexGrow: 0,
    minWidth: 144,
    minHeight: 48,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primaryBright,
    borderWidth: 1,
    borderColor: colors.primaryBright,
  },
  saveButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  saveLabel: {
    ...typography.button,
    letterSpacing: 0,
    color: colors.background,
    flexShrink: 0,
    textAlign: 'center',
  },
  saveLabelDisabled: {
    color: colors.textMuted,
  },
  formError: {
    ...typography.caption,
    color: colors.negative,
    marginTop: spacing.xs,
  },
  goalSection: {
    marginTop: spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  goalLabel: {
    ...typography.body2,
    color: colors.text,
    flexGrow: 1,
    flexShrink: 1,
  },
  goalPct: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  goalFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  startHint: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
  targetHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
